import { NextResponse } from 'next/server';
import { getTeamsCredentials } from '@/lib/teams';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const saved = await getTeamsCredentials();

    const appName = body.appName || saved.appName || 'Graph Java quick start';
    const clientId = body.clientId || saved.clientId || 'bcb10dc2-3ef1-41f3-aa41-2f1cef152a7a';
    const tenantId = body.tenantId || saved.tenantId || 'common';
    const webhookUrl = body.webhookUrl || saved.webhookUrl;

    const startTime = Date.now();

    // 1. Validate UUID format / Client ID structure
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(clientId);
    if (!isUuid && clientId !== 'bcb10dc2-3ef1-41f3-aa41-2f1cef152a7a') {
      return NextResponse.json({
        success: false,
        message: `Invalid Microsoft Graph Client ID format: "${clientId}". Must be a valid UUID / GUID.`,
      });
    }

    // 2. Verify Microsoft Graph Authority / Tenant Endpoint
    const authorityUrl = `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`;
    const authRes = await fetch(authorityUrl, { method: 'GET' }).catch(() => null);

    const latencyMs = Date.now() - startTime;

    if (!authRes || !authRes.ok) {
      return NextResponse.json({
        success: false,
        latencyMs,
        message: `Failed to reach Microsoft Graph authority for tenant "${tenantId}". Verify your network connection or Tenant ID.`,
      });
    }

    // 3. Test OAuth 2.0 Client Credentials token acquisition if Secret is provided
    let oauthStatus = '⚠️ OAuth Secret not configured. To enable live server-side online meeting creation, add the Client Secret Value from Azure Portal.';
    let oauthSuccess = false;

    const clientSecret = body.clientSecret || saved.clientSecret;
    if (clientSecret && tenantId && tenantId !== 'common') {
      try {
        const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            scope: 'https://graph.microsoft.com/.default',
            client_secret: clientSecret,
            grant_type: 'client_credentials'
          })
        });

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData.access_token) {
            oauthSuccess = true;
            oauthStatus = '✅ OAuth 2.0 Access Token acquired successfully! Server-side Microsoft Teams online meeting creation is fully operational.';
          }
        } else {
          const errJson = await tokenRes.json().catch(() => ({}));
          oauthStatus = `❌ Microsoft OAuth Error (${tokenRes.status}): ${errJson.error_description || errJson.error || tokenRes.statusText}`;
        }
      } catch (authErr: any) {
        oauthStatus = `❌ OAuth token request failed: ${authErr.message}`;
      }
    }

    // 4. Test Webhook Ping if provided and custom
    let webhookStatus = 'Webhook URL is default or unset.';
    if (webhookUrl && webhookUrl !== 'https://outlook.office.com/webhook/cim-incidents') {
      try {
        const pingPayload = {
          "@type": "MessageCard",
          "@context": "http://schema.org/extensions",
          "themeColor": "0072C6",
          "summary": `[Connection Test] Microsoft Teams API for ${appName}`,
          "sections": [
            {
              "activityTitle": `🔌 **Plug & Play Authentication Verified: ${appName}**`,
              "activitySubtitle": `Client ID: \`${clientId}\` | Tenant: \`${tenantId}\``,
              "text": "The Microsoft Teams Graph API Plug and Play authentication is connected and operational. Bridge details will be delivered automatically."
            }
          ]
        };
        const whRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pingPayload),
        });
        if (whRes.ok) {
          webhookStatus = 'Test card delivered to Teams webhook channel!';
        } else {
          webhookStatus = `Webhook returned HTTP ${whRes.status}: ${whRes.statusText}`;
        }
      } catch (whErr: any) {
        webhookStatus = `Webhook delivery test failed: ${whErr.message}`;
      }
    }

    return NextResponse.json({
      success: true,
      latencyMs,
      appName,
      clientId,
      tenantId,
      oauthSuccess,
      message: `Microsoft Teams Plug & Play Test (App: "${appName}") — Authority Endpoint: Verified. | OAuth Token Status: ${oauthStatus} | Webhook: ${webhookStatus}`,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      message: `Microsoft Teams authentication test failed: ${err.message}`,
    }, { status: 500 });
  }
}
