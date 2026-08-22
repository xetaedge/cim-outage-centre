import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function getAIConfig() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['GEMINI_API_KEY', 'AI_MODEL'] } }
    });
    const keySetting = settings.find((s: any) => s.key === 'GEMINI_API_KEY');
    const modelSetting = settings.find((s: any) => s.key === 'AI_MODEL');
    return {
      apiKey: keySetting?.value || process.env.GEMINI_API_KEY || null,
      model: modelSetting?.value || 'gemini-flash-lite-latest',
    };
  } catch {
    return { apiKey: process.env.GEMINI_API_KEY || null, model: 'gemini-flash-lite-latest' };
  }
}

/** Truncate a string to a maximum number of characters */
function trunc(str: string | null | undefined, max: number): string {
  if (!str) return 'N/A';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// Model priority list — gemini-flash-lite-latest confirmed working first
const MODEL_FALLBACKS = [
  'gemini-flash-lite-latest',   // confirmed working, fast
  'gemini-3.1-flash-lite',      // 3.1 lite
  'gemini-3.1-flash-lite-preview',
  'gemini-flash-latest',        // thinking model — slow, needs more tokens
];

/** Call Gemini, cycling through fallback models on 503/429 */
async function callGemini(apiKey: string, preferredModel: string, body: any): Promise<any> {
  const models = [preferredModel, ...MODEL_FALLBACKS.filter((m) => m !== preferredModel)];
  let lastError = '';

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) return res.json();

      const errText = await res.text().catch(() => '');
      lastError = `HTTP ${res.status} on model ${model}`;

      if (res.status === 503 || res.status === 429) {
        // Transient overload — try next model after brief pause
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      // Non-retriable error
      throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 200)}`);
    } catch (fetchErr: any) {
      if (fetchErr.message?.startsWith('Gemini API error')) throw fetchErr;
      lastError = fetchErr.message;
      continue;
    }
  }

  throw new Error(`All Gemini models unavailable. Last error: ${lastError}`);
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Fetch the current incident
    const incident = await prisma.incident.findFirst({
      where: { OR: [{ id }, { number: id }] },
      include: {
        updates: { orderBy: { updateNumber: 'asc' } },
        sites: { include: { site: true } },
      },
    });

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    // Fetch historical incidents — only the fields we need, capped at 50
    const allIncidents = await prisma.incident.findMany({
      where: { id: { not: incident.id } },
      select: {
        number: true,
        priority: true,
        status: true,
        shortDescription: true,
        assignmentGroup: true,
        businessService: true,
        cti: true,
        aiRootCause: true,
        updates: {
          select: { comment: true },
          orderBy: { updateNumber: 'asc' },
          take: 2,  // Only first 2 updates per incident
        },
      },
      orderBy: { openedAt: 'desc' },
      take: 50,
    });

    // Build compact current incident context
    const updateNotes = incident.updates
      .slice(0, 6)
      .map((u) => `#${u.updateNumber}: ${trunc(u.comment, 120)}`)
      .join('\n');

    // Build compact historical context — one line per incident
    const historicalLines = allIncidents.map((inc) => {
      const firstUpdate = trunc(inc.updates[0]?.comment, 100);
      return `${inc.number}|${inc.priority}|${inc.status}|${inc.assignmentGroup || '?'}|${inc.cti || '?'}|${trunc(inc.shortDescription, 80)}|${trunc(inc.aiRootCause, 100)}|upd:${firstUpdate}`;
    }).join('\n');

    const { apiKey, model } = await getAIConfig();

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Gemini API key not configured in Admin Settings.',
      }, { status: 503 });
    }

    const prompt = `You are an expert IT Incident Management Analyst. Analyze the current incident and historical incidents knowledge base.

CURRENT INCIDENT:
Number: ${incident.number}
Short Description: ${trunc(incident.shortDescription, 200)}
Description: ${trunc(incident.description, 300)}
Priority: ${incident.priority}
CTI: ${incident.cti || 'N/A'}
Assignment Group: ${incident.assignmentGroup || 'Unassigned'}
Business Service: ${incident.businessService || 'N/A'}
CMDB CI: ${incident.cmdbCi || 'N/A'}
Status: ${incident.status}
Impacted Sites: ${incident.sites?.map((s: any) => s.site?.name).filter(Boolean).join(', ') || 'N/A'}

TIMELINE UPDATES (last 6):
${updateNotes || 'None yet.'}

HISTORICAL KNOWLEDGE BASE (format: INC|priority|status|group|cti|description|rootCause|firstUpdate):
${historicalLines || 'No historical incidents.'}

Return ONLY a raw JSON object (no markdown, no code blocks):
{
  "assignmentGroupRecommendation": {
    "recommended": "<best group>",
    "confidence": "HIGH|MEDIUM|LOW",
    "reasoning": "<1-2 sentences>",
    "alternateGroups": ["<group2>", "<group3>"]
  },
  "relatedIncidents": [
    {
      "incidentNumber": "<INC number>",
      "shortDescription": "<description>",
      "priority": "<P1/P2/P3/P4>",
      "assignmentGroup": "<group>",
      "status": "<status>",
      "similarityReason": "<why related>",
      "resolution": "<how it was resolved>"
    }
  ],
  "resolutionSteps": [
    {
      "stepNumber": 1,
      "action": "<action>",
      "responsible": "<team/role>",
      "priority": "IMMEDIATE|SHORT_TERM|LONG_TERM",
      "rationale": "<why>"
    }
  ],
  "impactAssessment": "<1-2 sentence impact summary>",
  "urgencyNote": "<urgency observation from history>"
}

Rules: max 5 relatedIncidents (most relevant only), 4-7 resolutionSteps, base steps on historical resolutions.`;

    const geminiData = await callGemini(apiKey, model, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 3000 },
    });

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let analysis: any;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      // Fallback structured response if JSON parse fails
      analysis = {
        assignmentGroupRecommendation: {
          recommended: incident.assignmentGroup || 'Unassigned',
          confidence: 'LOW',
          reasoning: 'AI could not generate a recommendation. The response was not valid JSON. Please retry.',
          alternateGroups: [],
        },
        relatedIncidents: [],
        resolutionSteps: [
          { stepNumber: 1, action: 'Engage the assigned group and initiate a bridge call', responsible: 'Incident Manager', priority: 'IMMEDIATE', rationale: 'Ensure technical team is engaged immediately.' },
          { stepNumber: 2, action: 'Gather diagnostic logs and reproduce the issue', responsible: incident.assignmentGroup || 'Support Team', priority: 'IMMEDIATE', rationale: 'Identify root cause.' },
          { stepNumber: 3, action: 'Apply fix and validate with impacted users', responsible: incident.assignmentGroup || 'Support Team', priority: 'SHORT_TERM', rationale: 'Confirm resolution and close the incident.' },
        ],
        impactAssessment: 'Unable to assess automatically. Review incident details manually.',
        urgencyNote: '',
      };
    }

    return NextResponse.json({ success: true, analysis, incidentNumber: incident.number });
  } catch (err: any) {
    console.error('[AI Analysis] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'AI analysis failed' }, { status: 500 });
  }
}
