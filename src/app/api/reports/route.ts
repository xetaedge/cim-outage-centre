import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const PRIORITY_COLORS: Record<string, string> = {
  P1: '#EF4444',
  P2: '#FB923C',
  P3: '#FACC15',
  P4: '#3B82F6',
};

const STATUS_COLORS: Record<string, string> = {
  INVESTIGATING: '#3B82F6',
  IDENTIFIED: '#8B5CF6',
  MONITORING: '#F59E0B',
  RESOLVED: '#10B981',
  CLOSED: '#6B7280',
};

function getIsoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

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
          { shortDescription: { contains: keyword } },
          { description: { contains: keyword } },
          { issueSummary: { contains: keyword } },
        ],
      });
    }

    if (siteId) {
      andConditions.push({
        sites: {
          some: {
            OR: [
              { siteId },
              { site: { name: { contains: siteId } } },
            ],
          },
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
        updates: true,
      },
      orderBy: { openedAt: 'asc' },
    });

    // Compute Analytics
    const incidentsOverTimeMap = new Map<string, number>();
    const priorityMap = new Map<string, number>();
    const statusMap = new Map<string, number>();
    const mttrWeekMap = new Map<string, { total: number; count: number }>();
    const topSitesMap = new Map<string, number>();
    const assignmentGroupsMap = new Map<string, number>();

    let totalMttrMinutes = 0;
    let resolvedMttrCount = 0;
    let p1Count = 0;
    let p2Count = 0;
    let p3Count = 0;
    let p4Count = 0;
    let resolvedCount = 0;
    let openCount = 0;

    for (const inc of incidents) {
      // Timeline
      const dateStr = inc.openedAt.toISOString().split('T')[0];
      incidentsOverTimeMap.set(dateStr, (incidentsOverTimeMap.get(dateStr) || 0) + 1);

      // Priority
      priorityMap.set(inc.priority, (priorityMap.get(inc.priority) || 0) + 1);
      if (inc.priority === 'P1') p1Count++;
      if (inc.priority === 'P2') p2Count++;
      if (inc.priority === 'P3') p3Count++;
      if (inc.priority === 'P4') p4Count++;

      // Status
      statusMap.set(inc.status, (statusMap.get(inc.status) || 0) + 1);
      if (inc.status === 'RESOLVED' || inc.status === 'CLOSED') {
        resolvedCount++;
      } else {
        openCount++;
      }

      // MTTR
      if (inc.resolvedAt) {
        const mttrMin = (inc.resolvedAt.getTime() - inc.openedAt.getTime()) / 60000;
        totalMttrMinutes += mttrMin;
        resolvedMttrCount++;

        const weekKey = `Week ${getIsoWeek(inc.openedAt)}`;
        const wkData = mttrWeekMap.get(weekKey) || { total: 0, count: 0 };
        wkData.total += mttrMin;
        wkData.count += 1;
        mttrWeekMap.set(weekKey, wkData);
      }

      // Sites
      for (const s of inc.sites) {
        topSitesMap.set(s.site.name, (topSitesMap.get(s.site.name) || 0) + 1);
      }

      // Assignment Groups
      if (inc.assignmentGroup) {
        assignmentGroupsMap.set(inc.assignmentGroup, (assignmentGroupsMap.get(inc.assignmentGroup) || 0) + 1);
      }
    }

    const avgMttr = resolvedMttrCount > 0 ? (totalMttrMinutes / resolvedMttrCount).toFixed(1) + 'm' : '0m';

    const analytics = {
      incidentsOverTime: Array.from(incidentsOverTimeMap.entries()).map(([date, count]) => ({ date, count })),
      priorityDistribution: Array.from(priorityMap.entries()).map(([name, value]) => ({
        name: `${name} ${name === 'P1' ? 'Critical' : ''}`.trim(),
        value,
        color: PRIORITY_COLORS[name] || '#9CA3AF'
      })),
      statusDistribution: Array.from(statusMap.entries()).map(([name, value]) => ({
        name: name.charAt(0) + name.slice(1).toLowerCase(),
        value,
        color: STATUS_COLORS[name] || '#9CA3AF'
      })),
      mttrTrend: Array.from(mttrWeekMap.entries()).map(([period, data]) => ({
        period,
        avgMttr: Math.round(data.total / data.count)
      })),
      topSites: Array.from(topSitesMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topAssignmentGroups: Array.from(assignmentGroupsMap.entries())
        .map(([group, count]) => ({ group, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };

    const summary = {
      totalIncidents: incidents.length,
      avgMttr,
      p1Count,
      p2Count,
      p3Count,
      p4Count,
      resolvedCount,
      openCount,
    };

    const [allSites, allGroups, allCtis] = await Promise.all([
      prisma.site.findMany({ select: { id: true, name: true, code: true } }),
      prisma.incident.findMany({ select: { assignmentGroup: true }, distinct: ['assignmentGroup'] }),
      prisma.incident.findMany({ select: { cti: true }, distinct: ['cti'] }),
    ]);

    const filterOptions = {
      sites: allSites.map(s => ({ id: s.id, name: `${s.name} (${s.code})` })),
      assignmentGroups: allGroups.map(g => g.assignmentGroup).filter(Boolean),
      ctis: allCtis.map(c => c.cti).filter(Boolean),
    };

    return NextResponse.json({
      success: true,
      incidents,
      analytics,
      summary,
      filterOptions
    });
  } catch (error: any) {
    console.error('Reports API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
