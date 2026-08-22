import { prisma } from './prisma';

/**
 * Retrieves setting value by key, with optional fallback.
 */
async function getSetting(key: string, fallback: string = ''): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting?.value || fallback;
  } catch (err) {
    return fallback;
  }
}

/**
 * Parses comma-separated, semicolon-separated, or newline-separated emails into an array of Graph API recipient objects.
 */
export function parseGraphRecipients(emailsStr: string): any[] {
  if (!emailsStr) return [];
  return emailsStr
    .split(/[,;\n]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && e.includes('@'))
    .map((email) => ({ emailAddress: { address: email } }));
}

/**
 * Deduplicates an array of Graph recipient objects by email address.
 */
export function dedupeRecipients(recipients: any[]): any[] {
  const seen = new Set<string>();
  return recipients.filter((r) => {
    const addr = r.emailAddress?.address?.toLowerCase();
    if (!addr || seen.has(addr)) return false;
    seen.add(addr);
    return true;
  });
}

/**
 * Resolve Microsoft Graph / Azure AD email configuration with DB and environment variable fallbacks.
 */
export async function getEmailConfig() {
  const dbClientId = await getSetting('TEAMS_CLIENT_ID');
  const dbClientSecret = await getSetting('TEAMS_CLIENT_SECRET');
  const dbTenantId = await getSetting('TEAMS_TENANT_ID');
  const dbSender = await getSetting('GRAPH_SENDER_EMAIL');

  const clientId = dbClientId || process.env.AZURE_CLIENT_ID || 'bcb10dc2-3ef1-41f3-aa41-2f1cef152a7a';
  const clientSecret = dbClientSecret || process.env.AZURE_CLIENT_SECRET || '';
  let tenantId = dbTenantId || process.env.AZURE_TENANT_ID || '00550e88-11f9-4a42-b775-d0274f01576e';
  if (tenantId === 'common') {
    tenantId = process.env.AZURE_TENANT_ID || '00550e88-11f9-4a42-b775-d0274f01576e';
  }
  const senderEmail = dbSender || process.env.GRAPH_SENDER_EMAIL || 'shivam@xetainteractives.com';

  return { clientId, clientSecret, tenantId, senderEmail };
}

/**
 * Fetch a Microsoft Graph Access Token using Client Credentials
 */
export async function getGraphToken(): Promise<string> {
  const { clientId, clientSecret, tenantId } = await getEmailConfig();

  if (!clientId || !clientSecret) {
    throw new Error('Microsoft Azure Client ID or Client Secret is missing. Set AZURE_CLIENT_SECRET in Vercel or Admin Settings.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to acquire Microsoft Graph OAuth token (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Token endpoint did not return an access_token.');
  }
  return data.access_token;
}

/**
 * Looks up the email address for a given assignment group name from the DB.
 * Returns an empty string if not found.
 */
export async function getAssignmentGroupEmail(groupName?: string | null): Promise<string> {
  if (!groupName || !groupName.trim()) return '';
  try {
    const trimmed = groupName.trim();
    const group = await prisma.assignmentGroup.findFirst({
      where: {
        OR: [
          { name: trimmed },
          { name: { equals: trimmed, mode: 'insensitive' as any } },
        ],
      },
    });
    return group?.email || '';
  } catch (err) {
    console.error(`[Email Lib] Error looking up email for assignment group "${groupName}":`, err);
    return '';
  }
}

/**
 * Collects all site support emails from impacted sites.
 * Handles both site.supportEmails string and site.supportPersons array.
 */
export function getSiteEmails(sites: any[]): string {
  if (!sites || !Array.isArray(sites)) return '';
  const emails: string[] = [];

  for (const s of sites) {
    const siteObj = s.site || s;
    if (siteObj?.supportEmails) {
      emails.push(siteObj.supportEmails);
    }
    if (siteObj?.supportPersons && Array.isArray(siteObj.supportPersons)) {
      for (const p of siteObj.supportPersons) {
        if (p.email) emails.push(p.email);
      }
    }
  }

  return emails.join(',');
}

/**
 * Sends HTML email using Microsoft Graph API with comprehensive error handling and diagnostics.
 *
 * @param toSettingKey    - The system-setting key for the base recipient list (e.g. 'BRIDGE_RECIPIENTS' or 'CIM_UPDATE_RECIPIENTS')
 * @param subject         - Email subject
 * @param html            - HTML body
 * @param extraEmails     - Additional comma/semicolon-separated email addresses to include (e.g. assignment group + site emails)
 */
export async function sendEmail(
  toSettingKey: 'BRIDGE_RECIPIENTS' | 'CIM_UPDATE_RECIPIENTS',
  subject: string,
  html: string,
  extraEmails: string = ''
): Promise<{ success: boolean; message: string; recipientCount?: number; error?: string }> {
  try {
    // Merge setting recipients + extra emails (deduplicated)
    const settingEmails = await getSetting(toSettingKey, '');
    const combined = [settingEmails, extraEmails].filter(Boolean).join(',');
    const toRecipients = dedupeRecipients(parseGraphRecipients(combined));

    if (toRecipients.length === 0) {
      const msg = `[Graph Email] Skipped: No recipients configured for ${toSettingKey} and no extra recipients provided.`;
      console.log(msg);
      return { success: false, message: msg, recipientCount: 0 };
    }

    const recipientList = toRecipients.map((r) => r.emailAddress?.address).join(', ');
    console.log(`[Graph Email] Preparing to send "${subject}" to ${toRecipients.length} recipients (${recipientList})`);

    const { senderEmail } = await getEmailConfig();
    const token = await getGraphToken();

    const payload = {
      message: {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: html,
        },
        toRecipients: toRecipients,
      },
      saveToSentItems: 'false',
    };

    const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`;
    const res = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok || res.status === 202) {
      const successMsg = `Successfully sent email "${subject}" to ${toRecipients.length} recipients via Microsoft Graph.`;
      console.log(`[Graph Email] ${successMsg}`);
      return { success: true, message: successMsg, recipientCount: toRecipients.length };
    } else {
      const errText = await res.text();
      let hint = '';
      if (res.status === 403) {
        hint = ' (Hint: Ensure "Mail.Send" Application permission is added in Azure Portal App Registrations and granted Admin Consent)';
      } else if (res.status === 404) {
        hint = ` (Hint: The sender mailbox "${senderEmail}" was not found or lacks an active Exchange Online license)`;
      }
      const errMsg = `Microsoft Graph API error (${res.status}): ${errText}${hint}`;
      console.error(`[Graph Email] ${errMsg}`);
      return { success: false, message: errMsg, error: errText, recipientCount: toRecipients.length };
    }
  } catch (error: any) {
    const msg = `Exception sending email for ${toSettingKey}: ${error?.message || error}`;
    console.error(`[Graph Email] ${msg}`, error);
    return { success: false, message: msg, error: error?.message || String(error) };
  }
}
