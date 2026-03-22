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
  };
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

    // Verify we have some way to call Anthropic
    if (!anthropicApiKey && !process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        {
          error: "Missing Anthropic API key",
          detail:
            "Provide an API key via the request body (anthropicApiKey) or set the ANTHROPIC_API_KEY environment variable.",
        },
        { status: 500 }
      );
    }

    // Step 1: Run NCUA pipeline
    console.log("[quarterly] Running NCUA quarterly pipeline...");
    const quarterly = await runQuarterlyPipeline();
    console.log(
      `[quarterly] Pipeline complete: ${quarterly.quartersAnalyzed} quarters, ${quarterly.anomalies.length} anomalies`
    );

    // Step 2: Generate AI narratives
    console.log("[quarterly] Generating narratives...");
    const sections = await generateQuarterlyNarratives(
      quarterly,
      anthropicApiKey
    );
    const analysis = {
      generatedAt: new Date().toISOString(),
      model: "claude-sonnet-4-6",
      dataSource: "NCUA 5300 Call Report",
      sections,
    };
    console.log("[quarterly] Narratives generated.");

    // Step 3: Run verification (quarterly-only, no daily data)
    console.log("[quarterly] Running verification...");
    const verification = await runVerification(null, null, quarterly);
    console.log(
      `[quarterly] Verification: ${verification.overallPassed ? "PASS" : "FAIL"} (${verification.passedChecks}/${verification.totalChecks})`
    );

    const result: QuarterlyScanResult = { quarterly, analysis, verification };

    // Step 4: Save to Vercel Blob if configured, always save to /tmp as fallback
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import("@vercel/blob");
        await put("mcul-scanner/quarterly.json", JSON.stringify(result), {
          access: "public",
          contentType: "application/json",
          addRandomSuffix: false,
        });
        console.log("[quarterly] Saved to Vercel Blob.");
      } catch (blobErr) {
        console.error("[quarterly] Blob save failed:", blobErr);
      }
    }

    // Always write to /tmp as a fallback cache
    try {
      const fs = await import("fs/promises");
      await fs.mkdir("/tmp/mcul-scanner", { recursive: true });
      await fs.writeFile(
        "/tmp/mcul-scanner/quarterly.json",
        JSON.stringify(result)
      );
      console.log("[quarterly] Saved to /tmp cache.");
    } catch (tmpErr) {
      console.error("[quarterly] /tmp save failed:", tmpErr);
    }

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
