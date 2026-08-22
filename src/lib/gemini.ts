import { prisma } from './prisma';

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export const DEFAULT_GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest';

// Available model fallback priority list
export const GEMINI_MODEL_FALLBACKS = [
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

export function sanitizeGeminiModel(model?: string | null): string {
  if (!model || typeof model !== 'string') return DEFAULT_GEMINI_MODEL;
  const trimmed = model.trim();
  if (trimmed.startsWith('gpt-') || trimmed.includes('openai') || trimmed === 'gemini-2.5-flash-lite') {
    return DEFAULT_GEMINI_MODEL;
  }
  if (!trimmed.startsWith('gemini-')) {
    return DEFAULT_GEMINI_MODEL;
  }
  return trimmed;
}

/**
 * Single source of truth for Gemini AI configuration.
 * Checks DB settings first, then falls back to environment variables or hardcoded default.
 */
export async function getGeminiConfig(): Promise<GeminiConfig> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: ['GEMINI_API_KEY', 'AI_MODEL', 'AI_SUMMARY_MODEL'] },
      },
    });

    const keySetting = settings.find((s) => s.key === 'GEMINI_API_KEY');
    const modelSetting = settings.find((s) => s.key === 'AI_MODEL' || s.key === 'AI_SUMMARY_MODEL');

    const apiKey = (
      keySetting?.value?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      DEFAULT_GEMINI_API_KEY
    );

    const rawModel = (
      modelSetting?.value?.trim() ||
      process.env.AI_MODEL?.trim() ||
      DEFAULT_GEMINI_MODEL
    );

    const model = sanitizeGeminiModel(rawModel);

    return { apiKey, model };
  } catch (err) {
    console.warn('[Gemini Config] Could not query DB settings, using defaults/env:', err);
    return {
      apiKey: process.env.GEMINI_API_KEY?.trim() || DEFAULT_GEMINI_API_KEY,
      model: sanitizeGeminiModel(process.env.AI_MODEL) || DEFAULT_GEMINI_MODEL,
    };
  }
}

/**
 * Low-level caller for Gemini API with automatic fallback across models on 503 / 429 / 404.
 */
export async function callGeminiAPI(params: {
  prompt: string;
  systemPrompt?: string;
  maxOutputTokens?: number;
  temperature?: number;
  jsonOutput?: boolean;
  overrideApiKey?: string;
  preferredModel?: string;
}): Promise<{ text: string; modelUsed: string; parsedJson?: any }> {
  const config = await getGeminiConfig();
  const apiKey = (params.overrideApiKey || config.apiKey).trim();

  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please configure it in Admin Settings.');
  }

  const preferred = sanitizeGeminiModel(params.preferredModel || config.model);
  const modelsToTry = [
    preferred,
    ...GEMINI_MODEL_FALLBACKS.filter((m) => m !== preferred),
  ];

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const contents: any[] = [];
      if (params.systemPrompt) {
        contents.push({
          role: 'user',
          parts: [{ text: `[System Instructions]\n${params.systemPrompt}` }],
        });
        contents.push({
          role: 'model',
          parts: [{ text: 'Understood. I will strictly follow these instructions.' }],
        });
      }

      contents.push({
        role: 'user',
        parts: [{ text: params.prompt }],
      });

      const body: any = {
        contents,
        generationConfig: {
          temperature: params.temperature ?? 0.2,
          maxOutputTokens: params.maxOutputTokens ?? 3000,
        },
      };

      if (params.jsonOutput) {
        body.generationConfig.responseMimeType = 'application/json';
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Clean JSON if requested
        let parsedJson = undefined;
        if (params.jsonOutput || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
          try {
            const cleanText = rawText
              .replace(/^```json\s*/i, '')
              .replace(/^```\s*/i, '')
              .replace(/```\s*$/i, '')
              .trim();
            parsedJson = JSON.parse(cleanText);
          } catch (e) {
            // keep rawText
          }
        }

        return { text: rawText, modelUsed: model, parsedJson };
      }

      // If temporary overload or rate limit or not found, wait and try next model
      if (res.status === 503 || res.status === 429 || res.status === 404) {
        const errText = await res.text();
        console.warn(`[Gemini API] Model ${model} returned ${res.status}: ${errText}. Trying next fallback...`);
        lastError = new Error(`Gemini API error (${res.status}) on model ${model}: ${errText}`);
        await new Promise((resolve) => setTimeout(resolve, 800));
        continue;
      }

      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    } catch (err: any) {
      lastError = err;
      // If it's a hard error and not 503/429/404, we still try next model if available
    }
  }

  throw lastError || new Error('All Gemini model fallbacks failed.');
}

/**
 * Diagnostic test tool for Gemini connection with latency measurement.
 */
export async function testGeminiConnection(overrideApiKey?: string, overrideModel?: string) {
  const startTime = Date.now();
  const config = await getGeminiConfig();
  const keyToTest = (overrideApiKey || config.apiKey || '').trim();
  const modelToTest = overrideModel || config.model || DEFAULT_GEMINI_MODEL;

  if (!keyToTest) {
    return {
      success: false,
      message: 'Gemini API Key is not provided.',
      latencyMs: 0,
    };
  }

  try {
    const result = await callGeminiAPI({
      prompt: 'Respond with exactly: "OK — Gemini AI Connected."',
      maxOutputTokens: 50,
      overrideApiKey: keyToTest,
      preferredModel: modelToTest,
    });

    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      message: `✅ Connected to Gemini successfully! Model: ${result.modelUsed} | Response: "${result.text.trim()}"`,
      latencyMs,
      modelUsed: result.modelUsed,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      message: `❌ Gemini Connection Failed: ${err.message}`,
      latencyMs,
    };
  }
}
