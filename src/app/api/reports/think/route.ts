import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will',
  'with', 'the', 'this', 'have', 'been', 'or', 'not', 'what', 'which', 'who', 'how'
]);

function extractKeywords(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3 && !STOP_WORDS.has(word));
}

export async function GET(request: Request) {
  const startTimer = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const incidentId = searchParams.get('incidentId');
    const query = searchParams.get('query') || '';

    let baseIncident: any = null;
    let searchText = query;

    if (incidentId) {
      baseIncident = await prisma.incident.findUnique({
        where: { id: incidentId },
        include: { sites: { include: { site: true } }, updates: true },
      });
      if (baseIncident) {
        searchText = `${baseIncident.shortDescription || ''} ${baseIncident.description || ''} ${baseIncident.cti || ''}`;
      }
    }

    const keywords = extractKeywords(searchText);
    const targetCti = baseIncident?.cti?.toLowerCase() || '';

    // Fetch candidate records from both Incident (closed/resolved) and HistoricalIncident (bulk uploaded CSV)
    const [closedIncidents, historicalIncidents] = await Promise.all([
      prisma.incident.findMany({
        where: {
          id: { not: incidentId || undefined },
          status: { in: ['CLOSED', 'RESOLVED'] },
        },
        include: {
          sites: { include: { site: true } },
          updates: true,
        },
        take: 100,
      }),
      prisma.historicalIncident.findMany({
        take: 100,
      }),
    ]);

    // Score candidates
    const scoredCandidates: Array<{
      number: string;
      desc: string;
      res: string;
      similarity: string;
      score: number;
      source: 'INCIDENT' | 'HISTORICAL';
      rawRecord: any;
    }> = [];

    // Score active/closed incidents
    closedIncidents.forEach(inc => {
      let score = 0;
      const incCti = (inc.cti || '').toLowerCase();
      const siteNames = inc.sites.map(s => s.site?.name || '').join(' ').toLowerCase();

      // CTI match
      if (targetCti && incCti && (incCti.includes(targetCti) || targetCti.includes(incCti))) {
        score += 30;
      }

      // Keyword matches across shortDescription, description, cti, site, root cause
      keywords.forEach(kw => {
        if (inc.shortDescription?.toLowerCase().includes(kw)) score += 15;
        if (inc.description?.toLowerCase().includes(kw)) score += 10;
        if (incCti.includes(kw)) score += 12;
        if (siteNames.includes(kw)) score += 10;
        if (inc.aiRootCause?.toLowerCase().includes(kw)) score += 8;
      });

      if (score > 0) {
        const similarityPct = Math.min(98, Math.max(45, Math.round(50 + score * 1.5)));
        scoredCandidates.push({
          number: inc.number,
          desc: inc.shortDescription,
          res: inc.aiRootCause || inc.aiExecutiveSummary || 'Issue resolved per standard incident procedure.',
          similarity: `${similarityPct}% match`,
          score,
          source: 'INCIDENT',
          rawRecord: inc,
        });
      }
    });

    // Score historical incidents (from bulk upload CSV)
    historicalIncidents.forEach(hist => {
      let score = 0;
      const histCti = (hist.cti || hist.category || '').toLowerCase();

      if (targetCti && histCti && (histCti.includes(targetCti) || targetCti.includes(histCti))) {
        score += 30;
      }

      keywords.forEach(kw => {
        if (hist.title?.toLowerCase().includes(kw) || hist.shortDescription?.toLowerCase().includes(kw)) score += 15;
        if (hist.description?.toLowerCase().includes(kw)) score += 10;
        if (histCti.includes(kw)) score += 12;
        if (hist.resolutionNotes?.toLowerCase().includes(kw)) score += 8;
        if (hist.rootCause?.toLowerCase().includes(kw)) score += 8;
      });

      if (score > 0) {
        const similarityPct = Math.min(98, Math.max(45, Math.round(50 + score * 1.5)));
        scoredCandidates.push({
          number: hist.number,
          desc: hist.shortDescription || hist.title,
          res: hist.resolutionNotes || hist.rootCause || 'Resolved per historical resolution SOP.',
          similarity: `${similarityPct}% match`,
          score,
          source: 'HISTORICAL',
          rawRecord: hist,
        });
      }
    });

    // Sort candidates by match score
    scoredCandidates.sort((a, b) => b.score - a.score);
    const topMatches = scoredCandidates.slice(0, 5);

    // Fetch AI credentials
    let apiKey = process.env.GEMINI_API_KEY;
    let modelName = process.env.AI_MODEL || 'gemini-1.5-flash';

    try {
      const settings = await prisma.systemSetting.findMany({
        where: { key: { in: ['GEMINI_API_KEY', 'AI_MODEL'] } }
      });
      const keySetting = settings.find(s => s.key === 'GEMINI_API_KEY');
      const modelSetting = settings.find(s => s.key === 'AI_MODEL');
      if (keySetting?.value) apiKey = keySetting.value;
      if (modelSetting?.value) modelName = modelSetting.value;
    } catch (e) {
      // Ignore missing setting table
    }

    // Default response using topMatches
    let thinkingResult = {
      similarIncidents: topMatches.map(m => ({
        number: m.number,
        desc: m.desc,
        res: m.res,
        similarity: m.similarity
      })),
      rootCauses: topMatches.length > 0 
        ? topMatches.map(m => m.res.slice(0, 120))
        : ['Perform primary diagnostic on affected component and network path.'],
      recommendedActions: topMatches.length > 0
        ? topMatches.map((m, i) => `[${m.number}] Verify resolution step: ${m.res.slice(0, 100)}`)
        : [
            'Review recent change requests matching CTI or assignment domain.',
            'Check telemetry metrics and system logs for error spikes.',
            'Engage secondary escalation group if error rate exceeds threshold.'
          ],
      estimatedResolution: {
        time: '~30-45 mins',
        confidence: topMatches.length > 0 ? Math.min(95, 60 + topMatches.length * 7) : 50
      }
    };

    if (apiKey && topMatches.length > 0) {
      const prompt = `You are an expert ITSM AI Analyst. Analyze the target issue against the top matching past incidents and synthesize precise root causes and recommended actions.

Target Search / Incident:
${baseIncident ? `Number: ${baseIncident.number}\nShort Desc: ${baseIncident.shortDescription}\nDesc: ${baseIncident.description}\nCTI: ${baseIncident.cti}` : `Query: ${query}`}

Top Matched Incidents (${topMatches.length} found):
${JSON.stringify(topMatches.map(m => ({ number: m.number, desc: m.desc, resolution: m.res, similarity: m.similarity })), null, 2)}

Return valid JSON with these exact keys:
1. similarIncidents: array of objects [{ "number": "INC...", "desc": "...", "res": "...", "similarity": "92% match" }]
2. rootCauses: array of 3-4 specific strings explaining probable root cause patterns
3. recommendedActions: array of 3-4 step-by-step action items for engineers
4. estimatedResolution: object { "time": "~30 mins", "confidence": 85 }`;

      try {
        const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3
            }
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const responseText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (responseText) {
            const parsed = JSON.parse(responseText);
            thinkingResult = {
              similarIncidents: Array.isArray(parsed.similarIncidents) && parsed.similarIncidents.length > 0
                ? parsed.similarIncidents
                : thinkingResult.similarIncidents,
              rootCauses: Array.isArray(parsed.rootCauses) && parsed.rootCauses.length > 0
                ? parsed.rootCauses
                : parsed.commonRootCauses || thinkingResult.rootCauses,
              recommendedActions: Array.isArray(parsed.recommendedActions) && parsed.recommendedActions.length > 0
                ? parsed.recommendedActions
                : thinkingResult.recommendedActions,
              estimatedResolution: {
                time: parsed.estimatedResolution?.time || parsed.estimatedResolutionTime || '~35 mins',
                confidence: typeof parsed.estimatedResolution?.confidence === 'number' 
                  ? parsed.estimatedResolution.confidence 
                  : (typeof parsed.confidence === 'number' ? parsed.confidence : 80)
              }
            };
          }
        }
      } catch (aiErr) {
        console.warn('Gemini API call failed in think route, using scored DB result:', aiErr);
      }
    }

    return NextResponse.json({
      success: true,
      thinking: thinkingResult,
      meta: {
        incidentsSearched: closedIncidents.length + historicalIncidents.length,
        matchesFound: topMatches.length,
        processingTimeMs: Date.now() - startTimer,
      },
    });

  } catch (err: any) {
    console.error('Think API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
