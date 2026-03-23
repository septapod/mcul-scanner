import { runQuarterlyPipeline } from "@/lib/pipelines/ncua";
import { generateQuarterlyNarratives } from "@/lib/pipelines/narratives";
import { runVerification } from "@/lib/pipelines/verify";
import type { QuarterlyData, AnalysisSections, VerificationReport } from "@/lib/pipelines/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface QuarterlyScanResult {
  quarterly: QuarterlyData;
  analysis: {
    generatedAt: string;
    model: string;
    dataSource: string;
    sections: AnalysisSections;
  } | null;
  verification: VerificationReport;
}

export async function POST(request: Request) {
  try {
    // Extract API key from request body or header
    let anthropicApiKey: string | undefined;
    try {
      const body = await request.json();
      anthropicApiKey = body.anthropicApiKey;
    } catch {
      // No body or invalid JSON, that's fine
    }

    if (!anthropicApiKey) {
      const headerKey = request.headers.get("x-anthropic-api-key");
      if (headerKey) anthropicApiKey = headerKey;
    }

    const hasAnthropicKey = !!(anthropicApiKey || process.env.ANTHROPIC_API_KEY);

    // Step 1: Run NCUA pipeline (no AI needed, just data)
    console.log("[quarterly] Running NCUA quarterly pipeline...");
    const quarterly = await runQuarterlyPipeline();
    console.log(
      `[quarterly] Pipeline complete: ${quarterly.quartersAnalyzed} quarters, ${quarterly.anomalies.length} anomalies`
    );

    // Step 2: Generate AI narratives (optional, requires API key)
    let analysis: QuarterlyScanResult["analysis"] | null = null;
    if (hasAnthropicKey) {
      try {
        console.log("[quarterly] Generating narratives...");
        const sections = await generateQuarterlyNarratives(
          quarterly,
          anthropicApiKey
        );
        analysis = {
          generatedAt: new Date().toISOString(),
          model: "claude-opus-4-6",
          dataSource: "NCUA 5300 Call Report",
          sections,
        };
        console.log("[quarterly] Narratives generated.");
      } catch (narrativeErr) {
        console.error("[quarterly] Narrative generation failed (continuing without):", narrativeErr);
      }
    } else {
      console.log("[quarterly] No Anthropic API key. Skipping narrative generation.");
    }

    // Step 3: Run verification (quarterly-only, no daily data)
    console.log("[quarterly] Running verification...");
    const verification = await runVerification(null, null, quarterly);
    console.log(
      `[quarterly] Verification: ${verification.overallPassed ? "PASS" : "FAIL"} (${verification.passedChecks}/${verification.totalChecks})`
    );

    const result: QuarterlyScanResult = {
      quarterly,
      analysis: analysis ?? {
        generatedAt: new Date().toISOString(),
        model: "none",
        dataSource: "NCUA 5300 Call Report",
        sections: {
          statewideOverview: "Narrative generation pending. Set an Anthropic API key and refresh to generate AI analysis.",
          anomalyNarratives: [],
          tierHealthSummary: { tiers: [], synthesis: "Pending AI analysis." },
          emergingTrends: [],
          riskConcentrations: [],
          summaryInsight: "Data loaded successfully. AI narratives will be generated when an API key is available.",
        },
      },
      verification,
    };

    // Return data directly (no /tmp or Blob writes)
    return Response.json(result);
  } catch (err) {
    console.error("[quarterly] Pipeline error:", err);
    return Response.json(
      {
        error: "Quarterly pipeline failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
