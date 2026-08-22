import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany();
    const settingsMap: Record<string, string> = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });
    return NextResponse.json({ success: true, settings: settingsMap });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Support list array format e.g. { settings: [{ key: 'X', value: 'Y' }] }
    if (body && Array.isArray(body.settings)) {
      for (const item of body.settings) {
        if (item && item.key) {
          await prisma.systemSetting.upsert({
            where: { key: item.key },
            update: { value: String(item.value) },
            create: { key: item.key, value: String(item.value) },
          });
        }
      }
    } 
    // Support dictionary format e.g. { 'X': 'Y' }
    else if (body && typeof body === 'object') {
      for (const [key, value] of Object.entries(body)) {
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        });
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userName: 'Admin',
        userRole: 'ADMIN',
        action: 'SYSTEM_SETTINGS_UPDATED',
        details: 'Updated integration configurations (ServiceNow, OpenAI, Teams, AI models).',
      },
    });

    return NextResponse.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
