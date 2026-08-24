import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServiceNowConfig, fetchServiceNowAPI } from '@/lib/servicenow';

export const dynamic = 'force-dynamic';

function mapServiceNowPriority(p: any): string | null {
  if (!p) return null;
  const val = String(p.value || p.display_value || p).toLowerCase();
  if (val.includes('1') || val.includes('crit')) return 'P1';
  if (val.includes('2') || val.includes('high')) return 'P2';
  if (val.includes('3') || val.includes('mod') || val.includes('med')) return 'P3';
  if (val.includes('4') || val.includes('5') || val.includes('low') || val.includes('plan')) return 'P4';
  return null;
}

function mapServiceNowState(s: any): string | null {
  if (!s) return null;
  const val = String(s.value || s.display_value || s).toLowerCase();
  if (val === '1' || val.includes('new')) return 'INVESTIGATING';
  if (val === '2' || val.includes('progress')) return 'IDENTIFIED';
  if (val === '3' || val.includes('hold')) return 'MONITORING';
  if (val === '6' || val.includes('resolve')) return 'RESOLVED';
  if (val === '7' || val.includes('close')) return 'CLOSED';
  return null;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // 1. Locate current incident in local DB
    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
      include: {
        updates: { orderBy: { updateNumber: 'asc' } },
        sites: {
          include: {
            site: {
              include: { supportPersons: true },
            },
          },
        },
      },
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    const cleanNum = incident.number.trim().toUpperCase();
    const isSysId = /^[0-9a-f]{32}$/i.test(cleanNum);
    const queryParam = isSysId ? `sys_id=${cleanNum}` : `number=${cleanNum}`;

    // 2. Query Live ServiceNow Instance via MCP helper
    const snRes = await fetchServiceNowAPI(
      `/api/now/table/incident?sysparm_query=${encodeURIComponent(queryParam)}&sysparm_display_value=true&sysparm_limit=1`
    );

    if (!snRes.ok) {
      const errText = await snRes.text();
      return NextResponse.json({
        success: false,
        error: `ServiceNow returned status ${snRes.status}: ${errText.slice(0, 200)}`,
      }, { status: 502 });
    }

    const snJson = await snRes.json();
    const snItem = snJson.result && snJson.result.length > 0 ? snJson.result[0] : null;

    if (!snItem) {
      return NextResponse.json({
        success: false,
        error: `Incident record "${cleanNum}" was not found in ServiceNow (${snRes.url}).`,
      }, { status: 404 });
    }

    // 3. Extract and map updated fields from ServiceNow
    const newShortDesc = snItem.short_description?.display_value || snItem.short_description || incident.shortDescription;
    const newDesc = snItem.description?.display_value || snItem.description || incident.description;
    const newAssignmentGroup = snItem.assignment_group?.display_value || snItem.assignment_group || incident.assignmentGroup;
    const newAssignedTo = snItem.assigned_to?.display_value || snItem.assigned_to || incident.assignedTo;
    const newCi = snItem.cmdb_ci?.display_value || snItem.cmdb_ci || incident.cmdbCi;
    const newCategory = snItem.category?.display_value || snItem.category;
    const newSubcategory = snItem.subcategory?.display_value || snItem.subcategory;
    const newCti = newCategory && newSubcategory ? `${newCategory} / ${newSubcategory}` : (newCategory || incident.cti);
    const mappedPriority = mapServiceNowPriority(snItem.priority);
    const mappedStatus = mapServiceNowState(snItem.state);

    const updateData: any = {};
    const updatedFields: string[] = [];

    if (newShortDesc && newShortDesc !== incident.shortDescription) {
      updateData.shortDescription = newShortDesc;
      updatedFields.push('shortDescription');
    }
    if (newDesc && newDesc !== incident.description) {
      updateData.description = newDesc;
      updatedFields.push('description');
    }
    if (newAssignmentGroup && newAssignmentGroup !== incident.assignmentGroup) {
      updateData.assignmentGroup = newAssignmentGroup;
      updatedFields.push('assignmentGroup');
    }
    if (newAssignedTo && newAssignedTo !== incident.assignedTo) {
      updateData.assignedTo = newAssignedTo;
      updatedFields.push('assignedTo');
    }
    if (newCi && newCi !== incident.cmdbCi) {
      updateData.cmdbCi = newCi;
      updatedFields.push('cmdbCi');
    }
    if (newCti && newCti !== incident.cti) {
      updateData.cti = newCti;
      updatedFields.push('cti');
    }
    if (mappedPriority && mappedPriority !== incident.priority) {
      updateData.priority = mappedPriority;
      updatedFields.push('priority');
    }
    if (mappedStatus && mappedStatus !== incident.status) {
      updateData.status = mappedStatus;
      if (mappedStatus === 'RESOLVED' || mappedStatus === 'CLOSED') {
        updateData.resolvedAt = new Date();
        if (mappedStatus === 'CLOSED') updateData.closedAt = new Date();
      }
      updatedFields.push('status');
    }

    // 4. Update Prisma PostgreSQL Database if changes exist
    let updatedIncident = incident;
    if (Object.keys(updateData).length > 0) {
      updatedIncident = await prisma.incident.update({
        where: { id: incident.id },
        data: updateData,
        include: {
          updates: { orderBy: { updateNumber: 'asc' } },
          sites: {
            include: {
              site: {
                include: { supportPersons: true },
              },
            },
          },
        },
      });

      // Create Audit Log
      await prisma.auditLog.create({
        data: {
          userName: 'Incident Manager',
          userRole: 'INCIDENT_MANAGER',
          action: 'SERVICENOW_SYNCED',
          details: `Synchronized incident ${incident.number} from ServiceNow. Updated: ${updatedFields.join(', ')}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: updatedFields.length > 0
        ? `Successfully synchronized ${updatedFields.length} field(s) from ServiceNow: ${updatedFields.join(', ')}`
        : 'Incident details are already in sync with ServiceNow.',
      updatedFields,
      incident: updatedIncident,
      serviceNowData: {
        number: snItem.number?.display_value || snItem.number,
        state: snItem.state?.display_value || snItem.state,
        priority: snItem.priority?.display_value || snItem.priority,
        assignmentGroup: newAssignmentGroup,
        assignedTo: newAssignedTo,
        cmdbCi: newCi,
      },
    });
  } catch (err: any) {
    console.error('[ServiceNow Refresh API] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Refresh failed' }, { status: 500 });
  }
}
