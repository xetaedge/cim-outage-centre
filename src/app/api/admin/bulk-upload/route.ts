import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { incidents } = await request.json();

    if (!Array.isArray(incidents) || incidents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Incidents array is required for bulk upload' },
        { status: 400 }
      );
    }

    const createdRecords = [];

    for (const rawItem of incidents) {
      // Helper to find key case-insensitively
      const getKey = (names: string[]): string => {
        for (const name of names) {
          const key = Object.keys(rawItem).find(
            (k) => k.trim().toLowerCase() === name.toLowerCase()
          );
          if (key && rawItem[key] !== undefined && rawItem[key] !== null) {
            return String(rawItem[key]).trim();
          }
        }
        return '';
      };

      const number = getKey(['number', 'incident', 'incident number', 'inc_number']) || `HIST-${Math.floor(1000 + Math.random() * 9000)}`;
      const shortDescription = getKey(['shortdescription', 'short description', 'title', 'summary', 'subject']) || 'Historical Incident Record';
      const description = getKey(['description', 'desc', 'details', 'long description']) || shortDescription;
      const cti = getKey(['cti', 'category', 'category/type/item', 'type']) || 'General IT';
      const resolutionNotes = getKey(['resolutionnotes', 'resolution notes', 'resolution', 'rootcause', 'root cause', 'fix']) || 'Resolved per standard operating procedure.';
      const assignmentGroup = getKey(['assignmentgroup', 'assignment group', 'group', 'team']) || 'Engineering';

      const created = await prisma.historicalIncident.upsert({
        where: { number },
        update: {
          title: shortDescription,
          shortDescription,
          description,
          cti,
          category: cti,
          resolutionNotes,
          rootCause: resolutionNotes,
          assignmentGroup,
        },
        create: {
          number,
          title: shortDescription,
          shortDescription,
          description,
          cti,
          category: cti,
          resolutionNotes,
          rootCause: resolutionNotes,
          assignmentGroup,
        },
      });
      createdRecords.push(created);
    }

    // Log Audit
    await prisma.auditLog.create({
      data: {
        userName: 'Admin',
        userRole: 'ADMIN',
        action: 'BULK_HISTORICAL_UPLOAD',
        details: `Bulk uploaded ${createdRecords.length} historical incident records into AI Knowledge Base.`,
      },
    });

    return NextResponse.json({
      success: true,
      count: createdRecords.length,
      records: createdRecords,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
