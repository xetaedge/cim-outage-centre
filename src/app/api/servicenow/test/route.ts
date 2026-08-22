import { NextResponse } from 'next/server';
import { getServiceNowConfig, fetchServiceNowAPI } from '@/lib/servicenow';

export const dynamic = 'force-dynamic';

async function testConnection(overrides?: { instanceUrl?: string; username?: string; password?: string }) {
  try {
    const { instanceUrl } = await getServiceNowConfig(overrides);
    const startTime = Date.now();

    const response = await fetchServiceNowAPI(
      '/api/now/table/incident?sysparm_limit=1',
      { method: 'GET' },
      overrides
    );

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        success: true,
        instanceUrl,
        latencyMs: latency,
        recordCount: data.result ? data.result.length : 0,
        message: 'Successfully authenticated & connected to live ServiceNow instance.',
      });
    } else {
      return NextResponse.json({
        success: false,
        instanceUrl,
        statusCode: response.status,
        message: `ServiceNow responded with status code ${response.status}: ${response.statusText}`,
      });
    }
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      message: 'Failed to connect to ServiceNow instance network endpoint.',
    });
  }
}

export async function GET() {
  return testConnection();
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return testConnection(body);
  } catch (err: any) {
    return testConnection();
  }
}
