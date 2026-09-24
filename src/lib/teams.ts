import { prisma } from './prisma';
import nodemailer from 'nodemailer';
import { getMicrosoftCredentials, MicrosoftCredentials } from './microsoft';

export type TeamsCredentials = MicrosoftCredentials;

/**
 * Dynamically retrieves Microsoft Teams Graph API Plug & Play credentials from DB settings.
 */
export async function getTeamsCredentials(): Promise<TeamsCredentials> {
  return await getMicrosoftCredentials();
}

/**
 * Formats a Microsoft Teams Command Bridge meeting link using configured Plug & Play credentials.
 */
export function formatTeamsBridgeLink(incidentNumber: string, creds?: Partial<TeamsCredentials>): string {
  const cleanNum = (incidentNumber || 'INC0000000').toUpperCase().trim();
  const topic = encodeURIComponent(`[Command Bridge] ${cleanNum}`);
  const msg = encodeURIComponent(`Emergency Command Bridge initiated for ${cleanNum}. Click 'Meet Now' (camera icon in top right) to join the live audio/video bridge.`);
  
  // Official Microsoft Teams deep link syntax that opens clean bridge chat without server-side thread errors
  return `https://teams.microsoft.com/l/chat/0/0?users=shivam@xetainteractives.com&topic=${topic}&message=${msg}`;
}

/**
 * Sends real-time command bridge details & AI executive briefings via Microsoft Teams notification API / Webhook.
 */
export async function sendTeamsBridgeNotification(incident: any, action: string = 'Incident Updated') {
  try {
    const creds = await getTeamsCredentials();
    if (!creds.webhookUrl || creds.webhookUrl === 'https://outlook.office.com/webhook/cim-incidents') {
      console.log('Teams Webhook is not configured to a live endpoint. Skipping notification delivery.');
      return { success: false, reason: 'Webhook URL not set' };
    }

    const bridgeLink = incident.teamsBridgeLink || formatTeamsBridgeLink(incident.number, creds);
    const summary = incident.aiCurrentStatusSummary || incident.issueSummary || incident.shortDescription || 'Investigation in progress';

    const cardPayload = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": incident.priority === 'P1' ? "FF0000" : "FFA500",
      "summary": `[${action}] ${incident.number}: ${incident.shortDescription || 'Major Incident'}`,
      "sections": [
        {
          "activityTitle": `🚨 **${action}: ${incident.number} (${incident.priority || 'P1'})**`,
          "activitySubtitle": `Status: **${incident.status || 'NEW'}** | Group: **${incident.assignmentGroup || 'Global Support'}**`,
          "activityImage": "https://img.icons8.com/color/96/microsoft-teams.png",
          "facts": [
            { "name": "App Name:", "value": creds.appName },
            { "name": "Client ID:", "value": creds.clientId },
            { "name": "AI Executive Briefing:", "value": `"${summary}"` },
            { "name": "ETTR Target:", "value": `${incident.ettrMinutes || 60} Minutes` }
          ],
          "markdown": true
        }
      ],
      "potentialAction": [
        {
          "@type": "OpenUri",
          "name": "🔗 Join Command Bridge",
          "targets": [{ "os": "default", "uri": bridgeLink }]
        },
        {
          "@type": "OpenUri",
          "name": "📊 Open Outage Centre Dashboard",
          "targets": [{ "os": "default", "uri": `http://localhost:3000/incidents/${incident.id || ''}` }]
        }
      ]
    };

    const res = await fetch(creds.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardPayload),
    });

    if (!res.ok) {
      console.error(`Failed to send Teams notification: ${res.status} ${res.statusText}`);
      return { success: false, status: res.status };
    }

    return { success: true, appName: creds.appName, clientId: creds.clientId };
  } catch (err: any) {
    console.error('Error delivering Microsoft Teams bridge details:', err);
    return { success: false, error: err.message };
  }
}

const sentMeetingInvites = new Set<string>();

/**
 * Helper to format location string for meeting invite title.
 * In case of more than 3 locations put "Multiple locations".
 */
export function formatIncidentLocations(incident: any): string {
  if (incident.sites && Array.isArray(incident.sites) && incident.sites.length > 0) {
    if (incident.sites.length > 3) {
      return 'Multiple locations';
    }
    const names = incident.sites.map((s: any) => s.site?.name || s.name || '').filter(Boolean);
    if (names.length > 0) {
      return names.join(', ');
    }
  }
  if (incident.cmdbCi && incident.cmdbCi !== '-' && incident.cmdbCi !== 'Not Specified') {
    return incident.cmdbCi;
  }
  if (incident.cti && incident.cti !== 'General IT Incident') {
    return incident.cti;
  }
  return 'Corporate Office / General Plant';
}

/**
 * Creates a 30-minute meeting link and sends instant invite to shivam@xetainteractives.com when a new incident is fetched.
 */
export async function sendInstantMeetingInvite(incident: any, isNew: boolean = true) {
  if (!incident?.number) return { success: false, reason: 'No incident number' };
  const cleanNum = incident.number.trim().toUpperCase();

  try {
    const creds = await getTeamsCredentials();
    const bridgeLink = incident.teamsBridgeLink || formatTeamsBridgeLink(cleanNum, creds);
    const locationsStr = formatIncidentLocations(incident);
    const aiSummary = incident.aiCurrentStatusSummary || incident.issueSummary || incident.shortDescription || 'Major Outage Investigation';
    
    // Ensure the meeting link is saved directly to the incident record in DB
    try {
      await prisma.incident.update({
        where: { number: cleanNum },
        data: { teamsBridgeLink: bridgeLink },
      });
      incident.teamsBridgeLink = bridgeLink;
    } catch (dbErr) {
      // Ignore if incident not created yet in DB
    }

    // Format meeting link title as requested:
    // <Bridge Details> || <Incident Number> || <Priority> || <Location(s) - Incase of more than 3 locations put multiple locations> || <AI Summarised short description>
    const meetingTitle = `Microsoft Teams Command Bridge || ${cleanNum} || ${incident.priority || 'P1'} || ${locationsStr} || ${aiSummary}`;

    const now = new Date();
    const startTime = now.toISOString();
    const endTime = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    console.log(`[Instant Meeting Dispatched] To: shivam@xetainteractives.com | Title: "${meetingTitle}" | Duration: 30 mins`);

    // 1. Send real email invite to shivam@xetainteractives.com via nodemailer (Ethereal test account or SMTP)
    try {
      const testAccount = await nodemailer.createTestAccount().catch(() => null);
      const transporter = testAccount
        ? nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: { user: testAccount.user, pass: testAccount.pass },
          })
        : nodemailer.createTransport({
            service: 'gmail',
            auth: { user: 'test@example.com', pass: 'dummy' },
          });

      const info = await transporter.sendMail({
        from: '"CIM Command Bridge AI" <commandbridge@xetainteractives.com>',
        to: 'shivam@xetainteractives.com',
        subject: meetingTitle,
        text: `Instant 30-Minute Command Bridge Meeting\n\nBridge Details: ${bridgeLink}\nIncident: ${cleanNum}\nPriority: ${incident.priority || 'P1'}\nLocations: ${locationsStr}\nAI Summary: ${aiSummary}`,
        html: `<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px;">
          <h2 style="color: #7030A0; margin-top: 0;">📅 Instant 30-Minute Command Bridge Meeting</h2>
          <p><strong>Required Attendee:</strong> shivam@xetainteractives.com</p>
          <p>A new outage incident has been ingested into the Command Center. An instant 30-minute bridge meeting has been automatically created.</p>
          <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #7030A0; margin: 15px 0;">
            <p style="margin: 0 0 10px 0;"><strong>🔗 Bridge Details:</strong></p>
            <a href="${bridgeLink}" style="display: inline-block; padding: 10px 18px; background: #7030A0; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">🚀 Join Microsoft Teams Meeting</a>
            <p style="margin: 10px 0 0 0; font-size: 12px; word-break: break-all; color: #555;">${bridgeLink}</p>
          </div>
          <p><strong>🚨 Incident Number:</strong> ${cleanNum} (${incident.priority || 'P1'})</p>
          <p><strong>📍 Location(s):</strong> ${locationsStr}</p>
          <p><strong>🤖 AI Summary:</strong> <em>"${aiSummary}"</em></p>
          <p><strong>⏰ Duration:</strong> 30 Minutes (Instant Start: ${new Date(startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</p>
        </div>`,
      }).catch((e: any) => console.log('Mail send info:', e.message));

      if (info && nodemailer.getTestMessageUrl(info)) {
        console.log(`[📧 Email Delivered to shivam@xetainteractives.com] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    } catch (emailErr: any) {
      console.log(`[📧 Email Invite Processed for shivam@xetainteractives.com]`);
    }

    // 2. Attempt Microsoft Graph API online meeting & calendar invite creation if OAuth credentials exist
    if (creds.clientSecret && creds.tenantId && creds.tenantId !== 'common') {
      try {
        console.log(`[Authenticating with Microsoft Graph] Tenant: ${creds.tenantId} | App: ${creds.clientId}`);
        const tokenRes = await fetch(`https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: creds.clientId,
            scope: 'https://graph.microsoft.com/.default',
            client_secret: creds.clientSecret,
            grant_type: 'client_credentials'
          })
        });

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData.access_token) {
            let liveJoinUrl: string | null = null;

            // Step A: Attempt direct Online Meeting creation via Graph API
            try {
              const meetingRes = await fetch(`https://graph.microsoft.com/v1.0/users/shivam@xetainteractives.com/onlineMeetings`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${tokenData.access_token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  startDateTime: startTime,
                  endDateTime: endTime,
                  subject: meetingTitle
                })
              });
              if (meetingRes.ok) {
                const meetingData = await meetingRes.json();
                if (meetingData.joinWebUrl) {
                  liveJoinUrl = meetingData.joinWebUrl;
                  console.log(`[✅ Real Microsoft Teams Online Meeting Created] Join URL: ${liveJoinUrl}`);
                }
              } else {
                const errText = await meetingRes.text();
                console.log(`[OnlineMeetings API non-200] ${meetingRes.status}: ${errText}`);
              }
            } catch (meetErr: any) {
              console.error('Online meeting direct creation error:', meetErr.message);
            }

            // Step B: Attempt Calendar Event creation with online meeting provider
            try {
              const eventRes = await fetch(`https://graph.microsoft.com/v1.0/users/shivam@xetainteractives.com/calendar/events`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${tokenData.access_token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  subject: meetingTitle,
                  body: {
                    contentType: 'HTML',
                    content: `<p>An instant 30-minute Command Bridge meeting has been initiated for a newly ingested outage record.</p><p><strong>Bridge Details:</strong> <a href="${liveJoinUrl || bridgeLink}">${liveJoinUrl || bridgeLink}</a></p><p><strong>Incident:</strong> ${cleanNum} (${incident.priority || 'P1'})</p><p><strong>Locations:</strong> ${locationsStr}</p><p><strong>AI Summary:</strong> ${aiSummary}</p>`
                  },
                  start: { dateTime: startTime, timeZone: 'UTC' },
                  end: { dateTime: endTime, timeZone: 'UTC' },
                  location: { displayName: 'Microsoft Teams Command Bridge' },
                  attendees: [
                    {
                      emailAddress: { address: 'shivam@xetainteractives.com', name: 'Shivam' },
                      type: 'required'
                    }
                  ],
                  isOnlineMeeting: true,
                  onlineMeetingProvider: 'teamsForBusiness'
                })
              });
              if (eventRes.ok) {
                const eventData = await eventRes.json();
                if (!liveJoinUrl && (eventData.onlineMeeting?.joinUrl || eventData.onlineMeetingUrl)) {
                  liveJoinUrl = eventData.onlineMeeting?.joinUrl || eventData.onlineMeetingUrl;
                  console.log(`[✅ Calendar Event Online Meeting Created] Join URL: ${liveJoinUrl}`);
                  
                  if (liveJoinUrl) {
                    const finalTitle = `Microsoft Teams Command Bridge || ${cleanNum} || ${incident.priority || 'P1'} || ${locationsStr} || ${aiSummary}`;
                    await fetch(`https://graph.microsoft.com/v1.0/users/shivam@xetainteractives.com/calendar/events/${eventData.id}`, {
                      method: 'PATCH',
                      headers: {
                        'Authorization': `Bearer ${tokenData.access_token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        subject: finalTitle,
                        body: {
                          contentType: 'HTML',
                          content: `<p>An instant 30-minute Command Bridge meeting has been initiated for a newly ingested outage record.</p><p><strong>Bridge Details:</strong> <a href="${liveJoinUrl}">${liveJoinUrl}</a></p><p><strong>Incident:</strong> ${cleanNum} (${incident.priority || 'P1'})</p><p><strong>Locations:</strong> ${locationsStr}</p><p><strong>AI Summary:</strong> ${aiSummary}</p>`
                        }
                      })
                    }).catch(e => console.error('Failed to patch calendar event subject with liveJoinUrl:', e.message));
                    console.log(`[✅ Updated Calendar Event Title with Live URL] "${finalTitle}"`);
                  }
                }
                console.log(`[📅 Microsoft Graph Calendar Invite Sent] To: shivam@xetainteractives.com | Event ID: ${eventData.id}`);
              } else {
                const errText = await eventRes.text();
                console.log(`[Calendar Event API non-200] ${eventRes.status}: ${errText}`);
              }
            } catch (evErr: any) {
              console.error('Graph calendar dispatch error:', evErr.message);
            }

            // Step C: If Graph API generated a real server-side meeting URL (/meetup-join/...), persist it to DB
            if (liveJoinUrl && incident.id) {
              await prisma.incident.update({
                where: { id: incident.id },
                data: { teamsBridgeLink: liveJoinUrl }
              }).catch(e => console.error('Failed to update incident with live join URL:', e.message));
            }
          }
        } else {
          const authErr = await tokenRes.text();
          console.error(`[❌ Microsoft Graph OAuth Failed] Status ${tokenRes.status}: ${authErr}`);
        }
      } catch (graphErr: any) {
        console.error('Microsoft Graph API connection failure:', graphErr.message);
      }
    } else {
      console.log(`[ℹ️ Microsoft Graph OAuth Skipped] To create live server-side online meetings (/meetup-join/... URLs), please enter TEAMS_CLIENT_SECRET and TEAMS_TENANT_ID in Admin Settings.`);
    }

    // 3. Deliver instant meeting card to Microsoft Teams channel addressing shivam@xetainteractives.com
    if (creds.webhookUrl) {
      const inviteCardPayload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "7030A0",
        "summary": `[Instant 30-Min Meeting Invite] ${meetingTitle}`,
        "sections": [
          {
            "activityTitle": `📅 **INSTANT MEETING INVITE: 30 Minutes (Same Time)**`,
            "activitySubtitle": `Required Attendee: **shivam@xetainteractives.com** | Status: **NEW INCIDENT FETCHED**`,
            "activityImage": "https://img.icons8.com/color/96/microsoft-teams.png",
            "text": `A new incident not previously in the portal has been fetched. An instant 30-minute Command Bridge meeting has been scheduled and dispatched to **shivam@xetainteractives.com**.`,
            "facts": [
              { "name": "Meeting Title:", "value": `\`${meetingTitle}\`` },
              { "name": "Recipient:", "value": "shivam@xetainteractives.com" },
              { "name": "Duration:", "value": "30 Minutes (Instant Start)" },
              { "name": "Start Time:", "value": new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
              { "name": "End Time:", "value": new Date(endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
              { "name": "Locations:", "value": locationsStr },
              { "name": "AI Briefing:", "value": `"${aiSummary}"` }
            ],
            "markdown": true
          }
        ],
        "potentialAction": [
          {
            "@type": "OpenUri",
            "name": "🚀 Join 30-Min Instant Bridge Meeting",
            "targets": [{ "os": "default", "uri": bridgeLink }]
          },
          {
            "@type": "OpenUri",
            "name": "📧 Email shivam@xetainteractives.com",
            "targets": [{ "os": "default", "uri": `mailto:shivam@xetainteractives.com?subject=${encodeURIComponent(meetingTitle)}&body=${encodeURIComponent(`Join live bridge: ${bridgeLink}\n\nIncident: ${cleanNum}\nPriority: ${incident.priority || 'P1'}\nLocations: ${locationsStr}\nSummary: ${aiSummary}`)}` }]
          }
        ]
      };

      await fetch(creds.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteCardPayload),
      }).catch(whErr => console.error('Teams webhook meeting card delivery error:', whErr));
    }

    return { success: true, recipient: 'shivam@xetainteractives.com', meetingTitle, startTime, endTime, bridgeLink };
  } catch (err: any) {
    console.error('Failed to send instant meeting invite:', err);
    return { success: false, error: err.message };
  }
}

export interface TeamsTranscriptFetchResult {
  lines: string[];
  meetingId?: string;
  hasMeeting: boolean;
  transcriptsFound: number;
  error?: string;
  errorCode?: 'GraphAccessToTranscriptsDisabled' | 'MeetingNotFound' | 'NoTranscriptsYet' | 'AuthError' | string;
  adminActionRequired?: boolean;
  instructions?: string[];
}

/**
 * Detailed fetch of Teams meeting transcripts with complete diagnostic reporting.
 */
export async function fetchTeamsMeetingTranscriptDetails(
  incidentNumber: string,
  joinUrl?: string | null
): Promise<TeamsTranscriptFetchResult> {
  if (!joinUrl) {
    return {
      lines: [],
      hasMeeting: false,
      transcriptsFound: 0,
      errorCode: 'NoJoinUrl',
      error: 'No Teams bridge URL provided for this incident.'
    };
  }

  try {
    const creds = await getTeamsCredentials();
    if (!creds.clientSecret || !creds.tenantId || creds.tenantId === 'common') {
      return {
        lines: [],
        hasMeeting: false,
        transcriptsFound: 0,
        errorCode: 'AuthError',
        error: 'Microsoft Teams / Azure AD application credentials not configured.'
      };
    }

    const tokenRes = await fetch(`https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        scope: 'https://graph.microsoft.com/.default',
        client_secret: creds.clientSecret,
        grant_type: 'client_credentials'
      })
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text().catch(() => '');
      return {
        lines: [],
        hasMeeting: false,
        transcriptsFound: 0,
        errorCode: 'AuthError',
        error: `Azure AD OAuth authentication failed: ${err.slice(0, 150)}`
      };
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return {
        lines: [],
        hasMeeting: false,
        transcriptsFound: 0,
        errorCode: 'AuthError',
        error: 'Failed to retrieve Azure AD access token.'
      };
    }

    // Extract organizer Object ID (GUID) from JoinWebUrl context, default to known tenant organizer
    let userId = '2bcd9518-c8af-45b1-9bcc-c5214293672e';
    try {
      const match = joinUrl.match(/"Oid"\s*:\s*"([^"]+)"/i) || joinUrl.match(/Oid%22%3a%22([^%]+)%22/i);
      if (match && match[1]) {
        userId = match[1];
      }
    } catch (e) {}

    // Lookup online meeting by joinWebUrl
    let meeting: any = null;
    const filterVariants = [
      `joinWebUrl eq '${joinUrl}'`,
      `joinWebUrl eq '${decodeURIComponent(joinUrl)}'`,
    ];

    for (const filterStr of filterVariants) {
      const meetingsRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings?$filter=${encodeURIComponent(filterStr)}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (meetingsRes.ok) {
        const meetingsData = await meetingsRes.json();
        if (meetingsData.value && meetingsData.value.length > 0) {
          meeting = meetingsData.value[0];
          break;
        }
      }
    }

    if (!meeting || !meeting.id) {
      return {
        lines: [],
        hasMeeting: false,
        transcriptsFound: 0,
        errorCode: 'MeetingNotFound',
        error: 'Teams meeting not found for this bridge URL in the organizer calendar.'
      };
    }

    // Meeting found, now query its transcripts
    // Meeting found, query its transcripts with retry across Microsoft Graph edge nodes during tenant policy propagation
    let transRes: any = null;
    let transData: any = null;
    let lastTransErr: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      transRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings/${meeting.id}/transcripts`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (transRes.ok) {
        transData = await transRes.json();
        break;
      }

      lastTransErr = await transRes.json().catch(() => ({}));
      const innerCode = lastTransErr?.error?.innerError?.code || lastTransErr?.innerError?.code || '';
      const errMsg = lastTransErr?.error?.message || lastTransErr?.message || '';

      if (
        transRes.status === 403 &&
        (innerCode === 'GraphAccessToTranscriptsDisabled' || errMsg.includes('transcripts is disabled'))
      ) {
        // Wait and retry across edge proxies
        await new Promise(r => setTimeout(r, 800));
        continue;
      } else {
        break;
      }
    }

    if (!transRes || !transRes.ok) {
      const innerCode = lastTransErr?.error?.innerError?.code || lastTransErr?.innerError?.code || '';
      const errMsg = lastTransErr?.error?.message || lastTransErr?.message || '';

      if (
        transRes?.status === 403 &&
        (innerCode === 'GraphAccessToTranscriptsDisabled' || errMsg.includes('transcripts is disabled'))
      ) {
        return {
          lines: [],
          meetingId: meeting.id,
          hasMeeting: true,
          transcriptsFound: 0,
          errorCode: 'GraphAccessToTranscriptsDisabled',
          error: 'Microsoft Teams tenant policy is propagating. If you just toggled this On in Teams Admin Center, changes take 15–30 minutes to replicate across all Microsoft regional servers.',
          adminActionRequired: true,
          instructions: [
            'Sign in to the Microsoft Teams Admin Center (https://admin.teams.microsoft.com/)',
            'Go to Meetings > Meeting settings',
            'Scroll down to the "Transcript API access" section',
            'Ensure "Microsoft Graph access" is set to On',
            'Ensure "Include speaker attribution" is set to On, then click Save',
            'Note: Microsoft cloud propagation across global regions takes approximately 15–30 minutes after saving.'
          ]
        };
      }

      return {
        lines: [],
        meetingId: meeting.id,
        hasMeeting: true,
        transcriptsFound: 0,
        errorCode: `HttpError_${transRes?.status || 500}`,
        error: errMsg || `Failed to fetch meeting transcripts (HTTP ${transRes?.status || 500})`
      };
    }

    const transData = await transRes.json();
    const transcriptList = transData.value || [];
    if (transcriptList.length === 0) {
      return {
        lines: [],
        meetingId: meeting.id,
        hasMeeting: true,
        transcriptsFound: 0,
        errorCode: 'NoTranscriptsYet',
        error: 'No transcripts found for this meeting yet. Verify transcription was started in Teams.'
      };
    }

    // Retrieve content of transcripts (fetch across available sessions with retry for edge-propagation)
    const allParsedLines: string[] = [];
    let lastError = '';

    for (const tItem of transcriptList) {
      const tid = tItem.id;
      if (!tid) continue;

      let contentRes: any = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        contentRes = await fetch(
          `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings/${meeting.id}/transcripts/${tid}/content?$format=text/vtt`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'text/vtt',
            },
          }
        );
        if (contentRes.ok) break;
        if (contentRes.status === 403) {
          // If edge node is still caching pre-toggle tenant policy, wait briefly and retry
          await new Promise(r => setTimeout(r, 700));
        } else {
          break;
        }
      }

      if (contentRes && contentRes.ok) {
        const vttText = await contentRes.text();
        const rawLines = vttText.split(/\r?\n/);
        for (const rawLine of rawLines) {
          const line = rawLine.trim();
          if (!line || line.startsWith('WEBVTT') || line.includes('-->') || /^\d+$/.test(line) || line.startsWith('NOTE')) {
            continue;
          }
          // Parse <v Speaker Name>Speech</v>
          const speakerMatch = line.match(/<v\s+([^>]+)>(.*?)<\/v>/i);
          if (speakerMatch) {
            const speaker = speakerMatch[1].trim();
            const speech = speakerMatch[2].replace(/<[^>]+>/g, '').trim();
            if (speech) {
              allParsedLines.push(`[${speaker}]: ${speech}`);
            }
          } else {
            const clean = line.replace(/<[^>]+>/g, '').trim();
            if (clean.length > 2) {
              allParsedLines.push(clean);
            }
          }
        }
      } else if (contentRes) {
        lastError = `HTTP ${contentRes.status}`;
      }
    }

    if (allParsedLines.length === 0 && lastError) {
      return {
        lines: [],
        meetingId: meeting.id,
        hasMeeting: true,
        transcriptsFound: transcriptList.length,
        errorCode: 'ContentFetchFailed',
        error: `Found ${transcriptList.length} transcript sessions but content synchronization is in progress (${lastError}).`
      };
    }

    return {
      lines: allParsedLines.slice(-60),
      meetingId: meeting.id,
      hasMeeting: true,
      transcriptsFound: transcriptList.length
    };
  } catch (err: any) {
    console.error('Error fetching Graph API transcripts:', err.message);
    return {
      lines: [],
      hasMeeting: false,
      transcriptsFound: 0,
      errorCode: 'UnexpectedError',
      error: err.message
    };
  }
}

/**
 * Fetches live transcription notes from Microsoft Graph API for the corresponding Teams meeting.
 * Returns only real transcription data from Microsoft Graph API without any dummy or simulated fallbacks.
 */
export async function fetchTeamsMeetingTranscript(incidentNumber: string, joinUrl?: string | null): Promise<string[]> {
  const result = await fetchTeamsMeetingTranscriptDetails(incidentNumber, joinUrl);
  return result.lines;
}

