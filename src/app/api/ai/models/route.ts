import { NextResponse } from 'next/server';
import { getGeminiConfig } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyOverride = searchParams.get('apiKey');
    const config = await getGeminiConfig();
    const apiKey = (keyOverride || config.apiKey || '').trim();

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'No Gemini API Key provided.',
        models: [],
      });
    }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({
        success: false,
        error: `Google API returned ${res.status}: ${errText}`,
        models: [],
      });
    }

    const data = await res.json();
    const allModels = data.models || [];
    
    // Filter for models supporting generateContent
    const generateModels = allModels
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => ({
        name: m.name.replace(/^models\//, ''),
        displayName: m.displayName || m.name.replace(/^models\//, ''),
        description: m.description || '',
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit,
      }));

    return NextResponse.json({
      success: true,
      models: generateModels,
      count: generateModels.length,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      models: [],
    }, { status: 500 });
  }
}
