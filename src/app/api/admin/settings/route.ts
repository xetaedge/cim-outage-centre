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

    // Auto-heal and migrate any legacy gpt-* strings in the database to Gemini
    if (
      !settingsMap['AI_MODEL'] ||
      settingsMap['AI_MODEL'].startsWith('gpt-') ||
      settingsMap['AI_MODEL'].includes('openai') ||
      settingsMap['AI_MODEL'] === 'gemini-2.5-flash-lite'
    ) {
      settingsMap['AI_MODEL'] = 'gemini-flash-lite-latest';
      await prisma.systemSetting.upsert({
        where: { key: 'AI_MODEL' },
        update: { value: 'gemini-flash-lite-latest' },
        create: { key: 'AI_MODEL', value: 'gemini-flash-lite-latest' },
      }).catch(() => {});
    }

    if (
      settingsMap['AI_SUMMARY_MODEL'] &&
      (settingsMap['AI_SUMMARY_MODEL'].startsWith('gpt-') || settingsMap['AI_SUMMARY_MODEL'].includes('openai'))
    ) {
      settingsMap['AI_SUMMARY_MODEL'] = 'gemini-flash-lite-latest';
      await prisma.systemSetting.upsert({
        where: { key: 'AI_SUMMARY_MODEL' },
        update: { value: 'gemini-flash-lite-latest' },
        create: { key: 'AI_SUMMARY_MODEL', value: 'gemini-flash-lite-latest' },
      }).catch(() => {});
    }

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
          let val = String(item.value);
          if (item.key === 'AI_MODEL' || item.key === 'AI_SUMMARY_MODEL') {
            if (val.startsWith('gpt-') || val.includes('openai') || !val.startsWith('gemini-')) {
              val = 'gemini-flash-lite-latest';
            }
          }
          await prisma.systemSetting.upsert({
            where: { key: item.key },
            update: { value: val },
            create: { key: item.key, value: val },
          });
        }
      }
    } 
    // Support dictionary format e.g. { 'X': 'Y' }
    else if (body && typeof body === 'object') {
      for (const [key, value] of Object.entries(body)) {
        let val = String(value);
        if (key === 'AI_MODEL' || key === 'AI_SUMMARY_MODEL') {
          if (val.startsWith('gpt-') || val.includes('openai') || !val.startsWith('gemini-')) {
            val = 'gemini-flash-lite-latest';
          }
        }
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value: val },
          create: { key, value: val },
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
