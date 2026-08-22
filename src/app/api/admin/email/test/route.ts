import { NextResponse } from 'next/server';
import { getEmailConfig, getGraphToken } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const steps: { step: string; status: 'ok' | 'error' | 'pending'; details?: string }[] = [];

  try {
    const body = await request.json().catch(() => ({}));
    const testRecipient = (body.recipient || 'shivam@xetainteractives.com').trim();

    // Step 1: Configuration check with request overrides
    const config = await getEmailConfig();
    const clientId = (body.clientId || config.clientId || '').trim();
    const clientSecret = (body.clientSecret || config.clientSecret || '').trim();
    let tenantId = (body.tenantId || config.tenantId || '').trim();
    if (!tenantId || tenantId === 'common') {
      tenantId = process.env.AZURE_TENANT_ID || '00550e88-11f9-4a42-b775-d0274f01576e';
    }
    const senderEmail = (body.senderEmail || config.senderEmail || 'shivam@xetainteractives.com').trim();

    steps.push({
      step: '1. Resolve Configuration',
      status: clientId && clientSecret ? 'ok' : 'error',
      details: `Client ID: ${clientId} | Tenant: ${tenantId} | Sender: ${senderEmail} | Secret Length: ${clientSecret.length} chars`,
    });

    if (!clientSecret) {
      return NextResponse.json({
        success: false,
        message: 'AZURE_CLIENT_SECRET is missing. Please enter it in the Client Secret field above or set it in Vercel Environment Variables.',
        steps,
      });
    }

    // Step 2: Acquire OAuth Token
    let token = '';
    try {
      const tokenBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      });

      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        throw new Error(`Failed to acquire Microsoft Graph OAuth token (${tokenRes.status}): ${err}`);
      }

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new Error('Token endpoint did not return an access_token.');
      }
      token = tokenData.access_token;

      steps.push({
        step: '2. Acquire Microsoft Graph Token',
        status: 'ok',
        details: `Access Token acquired successfully (prefix: ${token.substring(0, 15)}...)`,
      });
    } catch (tokenErr: any) {
      steps.push({
        step: '2. Acquire Microsoft Graph Token',
        status: 'error',
        details: tokenErr.message,
      });
      return NextResponse.json({
        success: false,
        message: `Token acquisition failed: ${tokenErr.message}`,
        steps,
      });
    }

    // Step 3: Attempt SendMail via Graph API
    const testHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #334155;">
        <h2 style="color: #38bdf8; margin-top: 0;">🚀 CIM Outage Centre — Test Email Delivery</h2>
        <p>This is a real-time verification email sent from your deployed <strong>CIM Outage Centre</strong> portal via Microsoft Graph API.</p>
        <div style="background: #1e293b; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #38bdf8;">
          <p style="margin: 0;"><strong>Sender:</strong> ${config.senderEmail}</p>
          <p style="margin: 5px 0 0 0;"><strong>Recipient:</strong> ${testRecipient}</p>
          <p style="margin: 5px 0 0 0;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">If you received this, your Microsoft Graph Mail.Send integration is fully operational.</p>
      </div>
    `;

    const payload = {
      message: {
        subject: `[Test] CIM Outage Centre Email Dispatch Test — ${new Date().toLocaleTimeString()}`,
        body: {
          contentType: 'HTML',
          content: testHtml,
        },
        toRecipients: [{ emailAddress: { address: testRecipient } }],
      },
      saveToSentItems: 'false',
    };

    const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.senderEmail)}/sendMail`;
    const res = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok || res.status === 202) {
      steps.push({
        step: '3. Dispatch via Graph sendMail',
        status: 'ok',
        details: `HTTP ${res.status}: Delivered successfully to ${testRecipient}`,
      });
      return NextResponse.json({
        success: true,
        message: `✅ Test email successfully dispatched to ${testRecipient}!`,
        steps,
      });
    } else {
      const errText = await res.text();
      let hint = '';
      if (res.status === 403) {
        hint = 'Azure AD App Registration requires Application permission "Mail.Send" with Admin Consent granted.';
      } else if (res.status === 404) {
        hint = `Sender mailbox "${config.senderEmail}" does not exist in this tenant or has no Exchange Online license.`;
      }
      steps.push({
        step: '3. Dispatch via Graph sendMail',
        status: 'error',
        details: `HTTP ${res.status}: ${errText} ${hint ? `| Hint: ${hint}` : ''}`,
      });
      return NextResponse.json({
        success: false,
        message: `Graph API returned HTTP ${res.status}: ${errText}`,
        hint,
        steps,
      });
    }
  } catch (err: any) {
    steps.push({
      step: 'Exception',
      status: 'error',
      details: err.message,
    });
    return NextResponse.json({
      success: false,
      error: err.message,
      message: `Email test failed: ${err.message}`,
      steps,
    }, { status: 500 });
  }
}
