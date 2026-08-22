import { prisma } from './prisma';

/**
 * Retrieves setting value by key.
 */
async function getSetting(key: string): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key },
  });
  return setting?.value || '';
}

/**
 * Parses comma-separated or semicolon-separated emails into an array of Graph API recipient objects.
 */
function parseGraphRecipients(emailsStr: string): any[] {
  if (!emailsStr) return [];
  return emailsStr
    .split(/[,;\n]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && e.includes('@'))
    .map((email) => ({ emailAddress: { address: email } }));
}

/**
 * Fetch a Microsoft Graph Access Token using Client Credentials
 */
async function getGraphToken(): Promise<string> {
  const clientId = await getSetting('TEAMS_CLIENT_ID');
  const clientSecret = await getSetting('TEAMS_CLIENT_SECRET');
  const tenantId = (await getSetting('TEAMS_TENANT_ID')) || 'common';

  if (!clientId || !clientSecret) {
    throw new Error('TEAMS_CLIENT_ID or TEAMS_CLIENT_SECRET is missing. Cannot send email via Graph API.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch Graph token for email: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Deduplicates an array of Graph recipient objects by email address.
 */
function dedupeRecipients(recipients: any[]): any[] {
  const seen = new Set<string>();
  return recipients.filter((r) => {
    const addr = r.emailAddress?.address?.toLowerCase();
    if (!addr || seen.has(addr)) return false;
    seen.add(addr);
    return true;
  });
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
          { name: { equals: trimmed } },
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
 * Sends HTML email using Microsoft Graph API.
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
) {
  try {
    // Merge setting recipients + extra emails (deduplicated)
    const settingEmails = await getSetting(toSettingKey);
    const combined = [settingEmails, extraEmails].filter(Boolean).join(',');
    const toRecipients = dedupeRecipients(parseGraphRecipients(combined));

    if (toRecipients.length === 0) {
      console.log(`[Graph Email] Skipping: No recipients configured for ${toSettingKey} and no extra recipients provided.`);
      return;
    }

    const recipientList = toRecipients.map((r) => r.emailAddress?.address).join(', ');
    console.log(`[Graph Email] Sending "${subject}" to ${toRecipients.length} recipients (${recipientList})`);

    const token = await getGraphToken();
    const senderEmail = 'shivam@xetainteractives.com';

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

    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      console.log(`[Graph Email] Successfully sent "${subject}" to ${toRecipients.length} recipients`);
    } else {
      const err = await res.text();
      console.error(`[Graph Email] Failed to send email. Status: ${res.status} Error: ${err}`);
    }
  } catch (error) {
    console.error(`[Graph Email] Exception sending email for ${toSettingKey}:`, error);
  }
}
