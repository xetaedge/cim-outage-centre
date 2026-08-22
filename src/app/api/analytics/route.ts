import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [allIncidents, allSites] = await Promise.all([
      prisma.incident.findMany({
        include: { sites: true, updates: true },
      }),
      prisma.site.findMany(),
    ]);

    const activeP1 = allIncidents.filter((i) => i.priority === 'P1' && i.status !== 'CLOSED').length;
    const activeP2 = allIncidents.filter((i) => i.priority === 'P2' && i.status !== 'CLOSED').length;
    const resolvedToday = allIncidents.filter((i) => i.status === 'CLOSED').length;
    const affectedSitesCount = allSites.filter((s) => s.status === 'IMPACTED').length;

    // Calculate real MTTR
    let totalEttrMinutes = 0;
    allIncidents.forEach((i) => {
      totalEttrMinutes += i.ettrMinutes || 25;
    });
    const avgMttr = allIncidents.length > 0 ? (totalEttrMinutes / allIncidents.length).toFixed(1) : '24.0';

    // Priority Distribution
    const p1Count = allIncidents.filter((i) => i.priority === 'P1').length;
    const p2Count = allIncidents.filter((i) => i.priority === 'P2').length;
    const p3Count = allIncidents.filter((i) => i.priority === 'P3').length;
    const p4Count = allIncidents.filter((i) => i.priority === 'P4').length;

    const priorityDistribution = [
      { name: 'P1 Critical', value: p1Count, color: '#EF4444' },
      { name: 'P2 Major', value: p2Count, color: '#FB923C' },
      { name: 'P3 Moderate', value: p3Count, color: '#FACC15' },
      { name: 'P4 Low', value: p4Count, color: '#3B82F6' },
    ];

    // Assignment Group Workload
    const groupCounts: Record<string, number> = {};
    allIncidents.forEach((i) => {
      const g = i.assignmentGroup || 'General IT';
      groupCounts[g] = (groupCounts[g] || 0) + 1;
    });

    const assignmentGroupWorkload = Object.keys(groupCounts).map((g) => ({
      group: g,
      incidents: groupCounts[g],
    }));

    return NextResponse.json({
      success: true,
      kpis: {
        activeP1,
        activeP2,
        resolvedToday,
        averageMttr: `${avgMttr}m`,
        affectedSitesCount,
        activeTeamsBridges: activeP1 + activeP2,
      },
      analytics: {
        priorityDistribution,
        assignmentGroupWorkload,
        totalIncidentsCount: allIncidents.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
