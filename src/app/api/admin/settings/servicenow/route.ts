import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, SECRET_MASK } from '@/lib/auth';
import {
  getServiceNowConfig,
  getServiceNowConfigSource,
  syncServiceNowGlobally,
  testServiceNowConnection,
} from '@/lib/servicenow';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/settings/servicenow
 * Returns the currently active ServiceNow configuration and its source (DB / env / unconfigured).
 */
export async function GET() {
  const auth = await requireSession(['ADMIN', 'INCIDENT_MANAGER']);
  if (auth instanceof NextResponse) return auth;

  try {
    const source = await getServiceNowConfigSource();
    return NextResponse.json({
      success: true,
      instanceUrl: source.instanceUrl,
      username: source.username,
      source: source.source,
      message:
        source.source === 'database'
          ? '✅ Configuration active from Admin Settings (database)'
          : source.source === 'environment'
          ? '⚙️ Configuration active from environment variables (.env / Vercel)'
          : '⚠️ ServiceNow is not configured. Please enter credentials in Admin Settings.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/settings/servicenow
 * PLUG & PLAY ENDPOINT:
 * Saves ServiceNow credentials globally across:
 *   1. Database SystemSetting table
 *   2. In-Memory process.env
 *   3. .env.local file on disk
 *   4. mcp_config.json file on disk
 *
 * Then immediately runs a deep connection test and returns the diagnostic report.
 */
export async function POST(request: Request) {
  const auth = await requireSession(['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const instanceUrl = (body.instanceUrl || body.SERVICENOW_INSTANCE_URL || '').trim().replace(/\/$/, '');
    const username = (body.username || body.SERVICENOW_USERNAME || '').trim();
    let password = (body.password || body.SERVICENOW_PASSWORD || '').trim();

    // Unchanged masked field: reuse the stored password (only released for the stored instance URL).
    if (password === SECRET_MASK) {
      password = await getServiceNowConfig({ instanceUrl, username })
        .then((c) => c.password)
        .catch(() => '');
    }

    if (!instanceUrl || !username || !password) {
      return NextResponse.json(
        { success: false, error: 'Instance URL, Username and Password are all required.' },
        { status: 400 }
      );
    }

    // 1. Synchronize globally across DB, process.env, .env.local, and mcp_config.json
    const syncResult = await syncServiceNowGlobally({ instanceUrl, username, password });

    // 2. Audit log
    await prisma.auditLog.create({
      data: {
        userId: auth.id,
        userName: auth.name,
        userRole: auth.role,
        action: 'SERVICENOW_SETTINGS_UPDATED',
        details: `ServiceNow instance updated globally to: ${instanceUrl}. Username: ${username}. Env & MCP synchronized.`,
      },
    }).catch(() => {});

    // 3. Immediately test the connection with deep diagnostic checks (401, 403, hibernation, 200)
    const testResult = await testServiceNowConnection({ instanceUrl, username, password });

    return NextResponse.json({
      success: true,
      saved: true,
      testSuccess: testResult.success,
      testMessage: testResult.message,
      testLatency: testResult.latencyMs,
      isHibernating: testResult.isHibernating,
      statusCode: testResult.statusCode,
      instanceUrl,
      username,
      source: 'database',
      syncResult,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
