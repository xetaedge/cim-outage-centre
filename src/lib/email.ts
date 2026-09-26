import { prisma } from './prisma';
import { getMicrosoftCredentials, getMicrosoftGraphToken } from './microsoft';

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
 * Resolve Microsoft Graph / Azure AD email configuration.
 */
export async function getEmailConfig() {
  return await getMicrosoftCredentials();
}

/**
 * Fetch a Microsoft Graph Access Token using Client Credentials
 */
export async function getGraphToken(overrideSecret?: string): Promise<string> {
  return await getMicrosoftGraphToken(overrideSecret);
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

export interface BridgeRecipientsResolution {
  allEmails: string[];
  bridgeRecipients: string[];
  assignmentGroupEmail: string;
  siteEmails: string[];
  organizerEmail: string;
}

/**
 * Resolves all recipient email addresses for a Teams Command Bridge meeting:
 * 1. Bridge Recipients (from SystemSetting 'BRIDGE_RECIPIENTS')
 * 2. Assignment Group Email (from AssignmentGroup table)
 * 3. Sites Affected Emails (from Site.supportEmails & SiteSupportPerson.email)
 * 4. Organizer / Admin Email (from GRAPH_SENDER_EMAIL or fallback)
 */
export async function resolveBridgeRecipients(incident: any): Promise<BridgeRecipientsResolution> {
  // 1. Setting: BRIDGE_RECIPIENTS
  const rawBridgeSetting = await getSetting('BRIDGE_RECIPIENTS', '');
  const bridgeRecipients = rawBridgeSetting
    .split(/[,;\n]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && e.includes('@'));

  // 2. Assignment Group Email
  let assignmentGroupEmail = '';
  if (incident?.assignmentGroup) {
    assignmentGroupEmail = await getAssignmentGroupEmail(incident.assignmentGroup);
  }

  // 3. Sites Affected Emails
  let siteEmailsList: string[] = [];
  let sites = incident?.sites;

  // If incident has an ID but sites aren't fully populated with supportPersons, fetch them
  if (incident?.id && (!sites || sites.length === 0 || !sites[0]?.site?.supportPersons)) {
    try {
      const freshSites = await prisma.incidentSite.findMany({
        where: { incidentId: incident.id },
        include: {
          site: {
            include: {
              supportPersons: true,
            },
          },
        },
      });
      if (freshSites && freshSites.length > 0) {
        sites = freshSites;
      }
    } catch (e) {
      console.warn('[resolveBridgeRecipients] Failed to fetch fresh sites with supportPersons:', e);
    }
  }

  // If incident only has affectedSiteIds array (e.g. before incidentSite creation)
  if ((!sites || sites.length === 0) && Array.isArray(incident?.affectedSiteIds) && incident.affectedSiteIds.length > 0) {
    try {
      const siteRecords = await prisma.site.findMany({
        where: { id: { in: incident.affectedSiteIds } },
        include: { supportPersons: true },
      });
      sites = siteRecords.map((site) => ({ site }));
    } catch (e) {
      console.warn('[resolveBridgeRecipients] Failed to fetch sites from affectedSiteIds:', e);
    }
  }

  if (sites && Array.isArray(sites)) {
    const rawSiteEmails = getSiteEmails(sites);
    siteEmailsList = rawSiteEmails
      .split(/[,;\n]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes('@'));
  }

  // 4. Organizer / Admin Email
  const { senderEmail } = await getEmailConfig();
  const organizerEmail = senderEmail || 'shivam@xetainteractives.com';

  // 5. Combine and deduplicate
  const combined = [
    organizerEmail,
    ...bridgeRecipients,
    assignmentGroupEmail,
    ...siteEmailsList,
  ]
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && e.includes('@'));

  const seen = new Set<string>();
  const allEmails: string[] = [];
  for (const email of combined) {
    const lower = email.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      allEmails.push(email);
    }
  }

  return {
    allEmails,
    bridgeRecipients,
    assignmentGroupEmail,
    siteEmails: siteEmailsList,
    organizerEmail,
  };
}
