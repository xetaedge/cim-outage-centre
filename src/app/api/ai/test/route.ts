import { NextResponse } from 'next/server';
import { requireSession, stripMasked } from '@/lib/auth';
import { testGeminiConnection } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireSession(['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  const result = await testGeminiConnection();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const auth = await requireSession(['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = stripMasked(await request.json().catch(() => ({})));
    const result = await testGeminiConnection(body.apiKey, body.model);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

