import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServiceNowConfig, fetchServiceNowAPI } from '@/lib/servicenow';
import { getTeamsCredentials, formatTeamsBridgeLink, sendTeamsBridgeNotification, sendInstantMeetingInvite } from '@/lib/teams';

function parseSnPriority(val: any): string {
  if (!val) return 'P2';
  const str = String(val).toLowerCase();
  if (str.includes('1') || str.includes('critical')) return 'P1';
  if (str.includes('2') || str.includes('high')) return 'P2';
  if (str.includes('3') || str.includes('moderate')) return 'P3';
  if (str.includes('4') || str.includes('low')) return 'P4';
  if (str.includes('5') || str.includes('planning')) return 'P4';
  return 'P2';
}

function parseSnState(val: any): string {
  if (!val) return 'INVESTIGATING';
  const str = String(val).toLowerCase();
  if (str.includes('closed') || str === '7') return 'CLOSED';
  if (str.includes('resolved') || str === '6') return 'RESOLVED';
  if (str.includes('hold') || str === '3') return 'MONITORING';
  if (str.includes('progress') || str === '2') return 'INVESTIGATING';
  if (str.includes('new') || str === '1') return 'NEW';
  return 'INVESTIGATING';
}

function extractDisplayValue(field: any, defaultVal: string = 'Not Specified'): string {
  if (!field) return defaultVal;
  if (typeof field === 'string') return field.trim() || defaultVal;
  if (typeof field === 'object' && field.display_value) return String(field.display_value).trim() || defaultVal;
  return defaultVal;
}

export async function POST(request: Request) {
  try {
    const { incidentNumber } = await request.json();

    if (!incidentNumber) {
      return NextResponse.json(
        { success: false, error: 'Incident number is required' },
        { status: 400 }
      );
    }

    const cleanNum = incidentNumber.trim().toUpperCase();

    const { instanceUrl } = await getServiceNowConfig();
    const endpointPath = `/api/now/table/incident?sysparm_query=number=${cleanNum}&sysparm_display_value=true&sysparm_limit=1`;

    const snRes = await fetchServiceNowAPI(endpointPath, {
      method: 'GET',
    });

    if (snRes.ok) {
      const snData = await snRes.json();
      if (snData.result && snData.result.length > 0) {
        const raw = snData.result[0];
        const teamsCreds = await getTeamsCredentials();

        const recordNumber = raw.number || cleanNum;
        const shortDescription = raw.short_description || 'No short description provided';
        const description = raw.description || raw.work_notes || 'No detailed description provided in ServiceNow.';
        const priority = parseSnPriority(raw.priority);
        const state = parseSnState(raw.state);
        const assignmentGroup = extractDisplayValue(raw.assignment_group, 'Unassigned Group');
        const assignedTo = extractDisplayValue(raw.assigned_to, 'Unassigned');
        const cmdbCi = extractDisplayValue(raw.cmdb_ci, '-');
        const businessService = extractDisplayValue(raw.business_service, '-');
        const category = extractDisplayValue(raw.category, '');
        const subcategory = extractDisplayValue(raw.subcategory, '');
        const cti = category && subcategory ? `${category} / ${subcategory}` : category || 'General IT Incident';
        const urgency = extractDisplayValue(raw.urgency, '-');
        const impact = extractDisplayValue(raw.impact, '-');
        const createdBy = extractDisplayValue(raw.sys_created_by, 'System');
        const updatedBy = extractDisplayValue(raw.sys_updated_by, 'System');

        const incidentData = {
          number: recordNumber,
          shortDescription,
          description,
          priority,
          state,
          openedAt: raw.opened_at || new Date().toISOString(),
          closedAt: raw.closed_at || null,
          resolvedAt: raw.resolved_at || null,
          assignmentGroup,
          assignedTo,
          cmdbCi,
          businessService,
          cti,
          resolution: raw.close_notes || '',
          resolvedBy: extractDisplayValue(raw.resolved_by, ''),
          urgency,
          impact,
          createdBy,
          updatedBy,
          issueSummary: `ServiceNow Incident ${recordNumber}: ${shortDescription}. State: ${state}.`,
          teamsBridgeLink: formatTeamsBridgeLink(recordNumber, teamsCreds),
        };

        return NextResponse.json({
          success: true,
          source: `ServiceNow Live API (${instanceUrl})`,
          incident: incidentData,
        });
      }
    }

    return NextResponse.json(
      { success: false, error: `Incident ${cleanNum} not found in ServiceNow instance at ${instanceUrl}` },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
