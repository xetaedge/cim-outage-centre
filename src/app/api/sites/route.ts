import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const siteType = searchParams.get('siteType');
    const search = searchParams.get('search');
    const contactPriority = searchParams.get('contactPriority');

    const where: any = {};

    if (city) {
      where.city = city;
    }

    if (siteType) {
      where.siteType = siteType;
    }

    if (contactPriority) {
      where.supportPersons = {
        some: {
          priority: contactPriority,
        },
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { city: { contains: search } },
        { state: { contains: search } },
        { country: { contains: search } },
        { businessUnit: { contains: search } },
      ];
    }

    const sites = await prisma.site.findMany({
      where,
      include: {
        _count: {
          select: { supportPersons: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, sites });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      code,
      country = 'Global',
      state,
      city,
      lat,
      lng,
      businessUnit = 'General Operations',
      siteType = 'Corporate',
      supportEmails,
      status = 'HEALTHY',
      usersImpacted = 0,
    } = body;

    if (!name || !city) {
      return NextResponse.json(
        { success: false, error: 'Site name and predefined city are required' },
        { status: 400 }
      );
    }

    const siteCode =
      code || `${city.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const latitude =
      typeof lat === 'number' ? lat : (lat ? parseFloat(lat) : 40.7128);
    const longitude =
      typeof lng === 'number' ? lng : (lng ? parseFloat(lng) : -74.006);
    const impactedCount =
      typeof usersImpacted === 'number' ? usersImpacted : (parseInt(usersImpacted, 10) || 0);

    const newSite = await prisma.site.create({
      data: {
        name: name.trim(),
        code: siteCode.trim(),
        country: country.trim(),
        state: state ? state.trim() : null,
        city: city.trim(),
        lat: isNaN(latitude) ? 40.7128 : latitude,
        lng: isNaN(longitude) ? -74.006 : longitude,
        businessUnit: businessUnit.trim(),
        siteType: siteType.trim(),
        supportEmails: supportEmails ? supportEmails.trim() : null,
        status,
        usersImpacted: impactedCount,
      },
      include: {
        _count: {
          select: { supportPersons: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userName: 'Admin',
        userRole: 'ADMIN',
        action: 'CUSTOM_SITE_CREATED',
        details: `Created custom location: ${newSite.name} (${newSite.city}, ${newSite.country}) [Code: ${newSite.code}].`,
      },
    });

    return NextResponse.json({ success: true, site: newSite }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
