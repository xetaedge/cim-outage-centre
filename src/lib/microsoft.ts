import { prisma } from './prisma';

export interface MicrosoftCredentials {
  appName: string;
  clientId: string;
  clientSecret: string;
  tenantId: string;
  senderEmail: string;
  webhookUrl: string;
}

/**
 * Single source of truth for Microsoft Entra ID / Graph API Plug & Play credentials.
 * Checks DB settings first, then falls back to environment variables or defaults.
 */
export async function getMicrosoftCredentials(): Promise<MicrosoftCredentials> {
  const defaults: MicrosoftCredentials = {
    appName: 'Graph Java quick start',
    clientId: process.env.AZURE_CLIENT_ID || 'bcb10dc2-3ef1-41f3-aa41-2f1cef152a7a',
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
    tenantId: process.env.AZURE_TENANT_ID || '00550e88-11f9-4a42-b775-d0274f01576e',
    senderEmail: process.env.GRAPH_SENDER_EMAIL || 'shivam@xetainteractives.com',
    webhookUrl: 'https://outlook.office.com/webhook/cim-incidents',
  };

  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'TEAMS_APP_NAME',
            'TEAMS_CLIENT_ID',
            'TEAMS_CLIENT_SECRET',
            'TEAMS_TENANT_ID',
            'TEAMS_WEBHOOK_URL',
            'GRAPH_SENDER_EMAIL',
          ],
        },
      },
    });

    settings.forEach((s) => {
      if (s.key === 'TEAMS_APP_NAME' && s.value?.trim()) defaults.appName = s.value.trim();
      if (s.key === 'TEAMS_CLIENT_ID' && s.value?.trim()) defaults.clientId = s.value.trim();
      if (s.key === 'TEAMS_CLIENT_SECRET' && s.value?.trim()) defaults.clientSecret = s.value.trim();
      if (s.key === 'TEAMS_TENANT_ID' && s.value?.trim() && s.value.trim() !== 'common') {
        defaults.tenantId = s.value.trim();
      }
      if (s.key === 'GRAPH_SENDER_EMAIL' && s.value?.trim()) defaults.senderEmail = s.value.trim();
      if (s.key === 'TEAMS_WEBHOOK_URL' && s.value?.trim()) defaults.webhookUrl = s.value.trim();
    });
  } catch (err) {
    console.warn('[Microsoft Config] Could not query database for settings, using defaults/env:', err);
  }

  // Ensure single-tenant fallback if 'common' was somehow configured
  if (!defaults.tenantId || defaults.tenantId === 'common') {
    defaults.tenantId = process.env.AZURE_TENANT_ID || '00550e88-11f9-4a42-b775-d0274f01576e';
  }

  return defaults;
}

/**
 * Fetch a Microsoft Graph Access Token using OAuth 2.0 client_credentials grant.
 */
export async function getMicrosoftGraphToken(overrideSecret?: string): Promise<string> {
  const creds = await getMicrosoftCredentials();
  const secret = (overrideSecret || creds.clientSecret || '').trim();

  if (!creds.clientId || !secret) {
    throw new Error('Microsoft Client ID or Client Secret is missing. Please configure it in Admin Settings.');
  }

  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: secret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(`https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OAuth Token acquisition failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('OAuth endpoint response did not contain an access_token.');
  }

  return data.access_token;
}
