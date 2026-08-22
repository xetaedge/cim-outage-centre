import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const priority = searchParams.get('priority');
    const status = searchParams.get('status');
    const assignmentGroup = searchParams.get('assignmentGroup');
    const keyword = searchParams.get('keyword');
    const cti = searchParams.get('cti');
    const siteId = searchParams.get('siteId');
    const cmdbCi = searchParams.get('cmdbCi');

    const where: any = {};
    const andConditions: any[] = [];

    if (dateFrom || dateTo) {
      const openedAtCond: any = {};
      if (dateFrom) openedAtCond.gte = new Date(dateFrom);
      if (dateTo) openedAtCond.lte = new Date(dateTo);
      andConditions.push({ openedAt: openedAtCond });
    }

    if (priority) {
      andConditions.push({ priority: { in: priority.split(',') } });
    }

    if (status) {
      andConditions.push({ status: { in: status.split(',') } });
    }

    if (assignmentGroup) {
      andConditions.push({ assignmentGroup });
    }

    if (cti) {
      andConditions.push({ cti });
    }

    if (cmdbCi) {
      andConditions.push({ cmdbCi });
    }

    if (keyword) {
      andConditions.push({
        OR: [
          { shortDescription: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
          { issueSummary: { contains: keyword, mode: 'insensitive' } },
        ],
      });
    }

    if (siteId) {
      andConditions.push({
        sites: {
          some: { siteId },
        },
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const incidents = await prisma.incident.findMany({
      where,
      include: {
        sites: {
          include: { site: true },
        },
      },
      orderBy: { openedAt: 'asc' },
    });

    let totalMttrMinutes = 0;
    let resolvedMttrCount = 0;
    let p1Count = 0;
    let p2Count = 0;
    let p3Count = 0;
    let p4Count = 0;
    let resolvedCount = 0;
    let openCount = 0;

    const incidentRows = incidents.map(inc => {
      // Analytics Gathering
      if (inc.priority === 'P1') p1Count++;
      if (inc.priority === 'P2') p2Count++;
      if (inc.priority === 'P3') p3Count++;
      if (inc.priority === 'P4') p4Count++;

      if (inc.status === 'RESOLVED' || inc.status === 'CLOSED') {
        resolvedCount++;
      } else {
        openCount++;
      }

      if (inc.resolvedAt) {
        totalMttrMinutes += (inc.resolvedAt.getTime() - inc.openedAt.getTime()) / 60000;
        resolvedMttrCount++;
      }

      return {
        'Number': inc.number,
        'Short Description': inc.shortDescription,
        'Priority': inc.priority,
        'Status': inc.status,
        'Assignment Group': inc.assignmentGroup,
        'Assigned To': inc.assignedTo || '',
        'CMDB CI': inc.cmdbCi || '',
        'Business Service': inc.businessService || '',
        'CTI': inc.cti || '',
        'Opened At': inc.openedAt.toISOString(),
        'Closed At': inc.closedAt ? inc.closedAt.toISOString() : '',
        'ETTR (min)': inc.ettrMinutes,
        'Sites': inc.sites.map(s => s.site.name).join(', '),
        'Total Outage Duration': inc.totalOutageDuration || '',
      };
    });

    const avgMttr = resolvedMttrCount > 0 ? (totalMttrMinutes / resolvedMttrCount).toFixed(1) : '0';

    const summaryRows = [{
      'Total Incidents': incidents.length,
      'P1 Count': p1Count,
      'P2 Count': p2Count,
      'P3 Count': p3Count,
      'P4 Count': p4Count,
      'Avg MTTR (min)': avgMttr,
      'Resolved Count': resolvedCount,
      'Open Count': openCount,
    }];

    const workbook = XLSX.utils.book_new();
    
    const detailsSheet = XLSX.utils.json_to_sheet(incidentRows);
    XLSX.utils.book_append_sheet(workbook, detailsSheet, 'Incident Details');
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Analytics Summary');

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="CIM_Report_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Export API Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
