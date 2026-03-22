/**
 * AI Narrative Generation
 * Uses the Anthropic SDK to generate analyst-quality narratives from raw data.
 *
 * Ported from Python: generate_analysis.py
 */

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "../anthropic";
import type {
  QuarterlyData,
  DailyData,
  DailyCrossRef,
  AnalysisSections,
  CrossRefFinding,
} from "./types";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2000;

// ── Shared system prompt ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert credit union industry analyst writing for Michigan credit union executives.

ABSOLUTE RULES:
1. Do not invent or estimate any numbers. Only reference values provided in the data.
2. Do not name any specific credit union. Use tier labels or geographic regions only.
3. Write for an audience of credit union executives who know their industry. Be specific and actionable, not generic.
4. Net worth ratio values in the data are in basis points (e.g., 1278.4 means 12.78%). Always present them as percentages.
5. Delinquency rates in the data are already percentages (e.g., 0.8483 means 0.85%). Present them as percentages with appropriate precision.
6. Dollar amounts should be formatted with appropriate units ($110.6B, $80.8B, etc.).
7. When computing quarter-over-quarter changes, use the actual values from the data. Show your math implicitly by citing the before and after values.
8. Present a balanced mix of positive signals and challenges. Do not paint Michigan CUs or the Michigan economy negatively.
9. Never use em dashes. Use periods, commas, parentheses, or restructure the sentence instead.`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeClient(apiKey?: string): Anthropic {
  if (apiKey) {
    return new Anthropic({ apiKey });
  }
  return getAnthropicClient();
}

async function callClaude(
  client: Anthropic,
  userPrompt: string
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  const block = response.content[0];
  if (block.type === "text") {
    return block.text;
  }
  return "";
}

function parseJSON<T>(raw: string): T {
  let cleaned = raw.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.split("\n").slice(1).join("\n");
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.split("\n").slice(0, -1).join("\n");
  }
  return JSON.parse(cleaned.trim()) as T;
}

function formatQuarterlyContext(quarterly: QuarterlyData): string {
  return (
    "=== MICHIGAN CREDIT UNION DATA ===\n" +
    JSON.stringify(quarterly, null, 2)
  );
}

function formatDailyContext(
  dailyData: DailyData,
  crossref: DailyCrossRef,
  quarterly: QuarterlyData
): string {
  return (
    "=== QUARTERLY NCUA BASELINE ===\n" +
    JSON.stringify(quarterly, null, 2) +
    "\n\n=== DAILY MARKET DATA ===\n" +
    JSON.stringify(dailyData.sources, null, 2) +
    "\n\n=== CROSS-REFERENCE FINDINGS ===\n" +
    JSON.stringify(crossref.findings, null, 2)
  );
}

// ── Quarterly narrative generation ───────────────────────────────────────────

export async function generateQuarterlyNarratives(
  quarterly: QuarterlyData,
  apiKey?: string
): Promise<AnalysisSections> {
  const client = makeClient(apiKey);
  const dataContext = formatQuarterlyContext(quarterly);

  console.log("Generating quarterly narratives...");

  // Statewide overview
  console.log("  Generating statewide overview...");
  const statewideOverview = (
    await callClaude(
      client,
      `${dataContext}

Generate a statewide overview narrative for the Michigan Credit Union Landscape Scanner dashboard. This is the opening context that frames the entire analysis.

Requirements:
- 2-3 sentences contextualizing the aggregate numbers from the most recent quarter
- Reference total CUs, aggregate assets, total members, and average net worth ratio
- Note the quarterly trajectory (growth/contraction direction)
- Tone: authoritative, data-grounded, concise

Return ONLY the narrative text, no headers or formatting.`
    )
  ).trim();

  // Anomaly narratives
  console.log("  Generating anomaly narratives...");
  const anomalyRaw = await callClaude(
    client,
    `${dataContext}

=== DETECTED ANOMALIES ===
${JSON.stringify(quarterly.anomalies, null, 2)}

Generate expanded narrative analysis for each detected anomaly. For each anomaly, provide:
1. A restatement of the finding with the exact numbers from the data
2. Strategic context: why this matters for Michigan CU executives
3. What to watch: specific metrics or thresholds to monitor going forward

Return a JSON array with objects having these fields:
- "headline": the anomaly headline (use the exact headline from the data)
- "severity": the severity level from the data
- "category": the category from the data
- "narrative": 2-4 sentences of strategic analysis
- "watchItems": array of 1-2 specific things to monitor

Return ONLY valid JSON, no markdown code fences.`
  );
  const anomalyNarratives = parseJSON<AnalysisSections["anomalyNarratives"]>(anomalyRaw);

  // Tier health summary
  console.log("  Generating tier health summary...");
  const tierRaw = await callClaude(
    client,
    `${dataContext}

Generate a tier-level health summary analyzing which of the 5 asset tiers are strengthening vs. weakening across the available quarters.

For each tier, assess:
- Direction of key metrics (delinquency, net worth ratio, membership, CU count)
- Whether the tier is strengthening, weakening, or stable
- One specific data point that illustrates the trend

Then provide a 2-3 sentence synthesis of the overall tier health picture.

Return a JSON object with:
- "tiers": array of objects, each with "tierName", "status" (one of "strengthening", "weakening", "stable", "mixed"), "summary" (1-2 sentences with specific numbers from the data)
- "synthesis": 2-3 sentence overall synthesis

Return ONLY valid JSON, no markdown code fences.`
  );
  const tierHealthSummary = parseJSON<AnalysisSections["tierHealthSummary"]>(tierRaw);

  // Emerging trends
  console.log("  Generating emerging trends...");
  const trendsRaw = await callClaude(
    client,
    `${dataContext}

Identify 2-3 directional shifts visible in the quarter-over-quarter data. These should be genuine trends derived from the data, not speculation.

For each trend:
- Name the trend in 5-8 words
- Cite the specific data points (with actual values from the data) that evidence it
- Explain the strategic implication for Michigan CU leaders
- Indicate direction: "rising", "falling", "accelerating", or "decelerating"

Return a JSON array of objects with: "trendName", "direction", "evidence" (2-3 sentences with specific numbers), "implication" (1-2 sentences)

Return ONLY valid JSON, no markdown code fences.`
  );
  const emergingTrends = parseJSON<AnalysisSections["emergingTrends"]>(trendsRaw);

  // Risk concentrations
  console.log("  Generating risk concentrations...");
  const riskRaw = await callClaude(
    client,
    `${dataContext}

Identify risk concentrations visible in the data. Where is risk building up across Michigan's credit union landscape?

Look for:
- Tiers where delinquency is rising fastest
- Segments where CU count is declining (consolidation pressure)
- Any tier where multiple metrics are moving in concerning directions simultaneously

Generate 2-3 risk concentration findings. Each should cite specific data points.

Return a JSON array of objects with: "riskName" (5-8 words), "severity" ("high", "moderate", "low"), "evidence" (2-3 sentences with specific numbers from the data), "implication" (1 sentence)

Return ONLY valid JSON, no markdown code fences.`
  );
  const riskConcentrations = parseJSON<AnalysisSections["riskConcentrations"]>(riskRaw);

  // Summary insight
  console.log("  Generating summary insight...");
  const summaryInsight = (
    await callClaude(
      client,
      `${dataContext}

Write a 1-2 sentence summary insight that captures the overarching story of Michigan credit unions. This is the "so what" takeaway for credit union executives.

Ground it in the most significant data points. Make it specific to Michigan, not generic industry commentary.

Return ONLY the narrative text, no headers or formatting.`
    )
  ).trim();

  console.log("Quarterly narrative generation complete.");

  return {
    statewideOverview,
    anomalyNarratives,
    tierHealthSummary,
    emergingTrends,
    riskConcentrations,
    summaryInsight,
  };
}

// ── Daily narrative generation ───────────────────────────────────────────────

export async function generateDailyNarratives(
  dailyData: DailyData,
  crossref: DailyCrossRef,
  quarterly: QuarterlyData,
  apiKey?: string
): Promise<{
  economicSnapshot: string;
  complaintMonitor: string;
  housingPulse: string;
  crossReferenceAlerts: CrossRefFinding[];
}> {
  const client = makeClient(apiKey);
  const dataContext = formatDailyContext(dailyData, crossref, quarterly);

  console.log("Generating daily narratives...");

  // Economic snapshot (from FRED data)
  console.log("  Generating economic snapshot...");
  const economicSnapshot = (
    await callClaude(
      client,
      `${dataContext}

Generate a concise economic snapshot narrative for Michigan credit union executives based on the FRED economic indicators.

Requirements:
- Summarize key indicators: unemployment, mortgage rates, consumer sentiment, CPI, fed funds rate
- Highlight any significant changes (week-over-week or month-over-month)
- Connect economic signals to credit union operations (lending, deposits, credit quality)
- 3-5 sentences, data-grounded

Return ONLY the narrative text, no headers or formatting.`
    )
  ).trim();

  // Complaint monitor (from CFPB data)
  console.log("  Generating complaint monitor...");
  const complaintMonitor = (
    await callClaude(
      client,
      `${dataContext}

Generate a complaint monitoring narrative for Michigan credit union executives based on CFPB complaint data.

Requirements:
- Summarize total complaint volume and trends
- Note top product categories and issues
- Identify any emerging patterns worth watching
- Do not name specific credit unions
- 2-4 sentences, actionable

Return ONLY the narrative text, no headers or formatting.`
    )
  ).trim();

  // Housing pulse (from Zillow data)
  console.log("  Generating housing pulse...");
  const housingPulse = (
    await callClaude(
      client,
      `${dataContext}

Generate a housing market pulse narrative for Michigan credit union executives based on Zillow housing data.

Requirements:
- Summarize home value trends across Michigan MSAs
- Highlight any MSAs with notable appreciation or depreciation
- Note inventory trends if available
- Connect housing trends to CU mortgage and HELOC portfolios
- 3-5 sentences, data-grounded

Return ONLY the narrative text, no headers or formatting.`
    )
  ).trim();

  // Cross-reference alerts are passed through from the crossref engine
  // (already generated by crossref.ts). The AI narratives above provide context.
  const crossReferenceAlerts = crossref.findings;

  console.log("Daily narrative generation complete.");

  return {
    economicSnapshot,
    complaintMonitor,
    housingPulse,
    crossReferenceAlerts,
  };
}
