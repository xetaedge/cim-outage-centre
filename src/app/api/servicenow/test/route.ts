import { NextResponse } from 'next/server';
import { requireSession, stripMasked } from '@/lib/auth';
import { testServiceNowConnection, ServiceNowConfig } from '@/lib/servicenow';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireSession(['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  const result = await testServiceNowConnection();
  return NextResponse.json(result, { status: result.success ? 200 : (result.statusCode || 500) });
}

export async function POST(request: Request) {
  const auth = await requireSession(['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = stripMasked(await request.json().catch(() => ({})));
    const overrides: Partial<ServiceNowConfig> = {};
    if (body.instanceUrl) overrides.instanceUrl = body.instanceUrl;
    if (body.username) overrides.username = body.username;
    if (body.password) overrides.password = body.password;

    const result = await testServiceNowConnection(overrides);
    return NextResponse.json(result, { status: result.success ? 200 : (result.statusCode || 500) });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: err.message || 'Error executing ServiceNow test',
    }, { status: 500 });
  }
}
