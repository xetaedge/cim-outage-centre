import { NextResponse } from 'next/server';
import { requireSession, stripMasked } from '@/lib/auth';
import { getServiceNowConfig, fetchServiceNowAPI } from '@/lib/servicenow';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireSession(['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  return testConnection();
}

export async function POST(request: Request) {
  const auth = await requireSession(['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    return testConnection(stripMasked(body));
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: err.message || 'Error executing ServiceNow test',
    }, { status: 500 });
  }
}
