import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function testAiConnection(overrides?: { apiKey?: string; model?: string }) {
  try {
    const keySetting = await prisma.systemSetting.findUnique({ where: { key: 'GEMINI_API_KEY' } });
    const modelSetting = await prisma.systemSetting.findUnique({ where: { key: 'AI_MODEL' } });

    const apiKey = overrides?.apiKey || keySetting?.value || process.env.GEMINI_API_KEY || null;
    const model = overrides?.model || modelSetting?.value || 'gemini-flash-latest';

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        message: 'No Gemini API Key found in settings or environment variables.',
      });
    }

    const startTime = Date.now();

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'Ping! Reply with exactly "Pong" and nothing else.' }]
          }
        ]
      }),
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      return NextResponse.json({
        success: true,
        latencyMs: latency,
        model,
        message: `Successfully connected to Gemini. Model replied: "${reply}"`,
      });
    } else {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json({
        success: false,
        statusCode: response.status,
        message: `Gemini responded with status code ${response.status}: ${errorData.error?.message || response.statusText}`,
      });
    }
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      message: 'Failed to connect to Gemini network endpoint.',
    });
  }
}

export async function GET() {
  return testAiConnection();
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return testAiConnection(body);
  } catch (err: any) {
    return testAiConnection();
  }
}
