import { fetchAllFRED } from "@/lib/pipelines/fred";
import { fetchCFPBComplaints } from "@/lib/pipelines/cfpb";
import { fetchZillowHousing } from "@/lib/pipelines/zillow";
import { generateCrossReferences } from "@/lib/pipelines/crossref";
import { generateDailyNarratives } from "@/lib/pipelines/narratives";
import { runVerification } from "@/lib/pipelines/verify";
import type {
  DailyData,
  DailyCrossRef,
  QuarterlyData,
  FREDSeries,
  CFPBData,
  ZillowData,
} from "@/lib/pipelines/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    // Extract options from request body
    let anthropicApiKey: string | undefined;
    let quarterlyBaseline: QuarterlyData | undefined;

    try {
      const body = await request.json();
      anthropicApiKey = body.anthropicApiKey;
      quarterlyBaseline = body.quarterly;
    } catch {
      // No body or invalid JSON
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

    // Step 1: Fetch daily data from all three sources in parallel
    console.log("[daily] Fetching FRED, CFPB, Zillow in parallel...");
    const [fredResult, cfpbResult, zillowResult] = await Promise.allSettled([
      fetchAllFRED(),
      fetchCFPBComplaints(),
      fetchZillowHousing(),
    ]);

    const fred: Record<string, FREDSeries> =
      fredResult.status === "fulfilled" ? fredResult.value : {};
    if (fredResult.status === "rejected") {
      console.error("[daily] FRED fetch failed:", fredResult.reason);
    }

    const cfpb: CFPBData =
      cfpbResult.status === "fulfilled"
        ? cfpbResult.value
        : {
            total: 0,
            periodStart: "",
            periodEnd: "",
            counts30d: 0,
            counts60d: 0,
            counts90d: 0,
            byCompany: {},
            byProduct: {},
            byIssue: {},
            sampleComplaints: [],
          };
    if (cfpbResult.status === "rejected") {
      console.error("[daily] CFPB fetch failed:", cfpbResult.reason);
    }

    const zillow: ZillowData =
      zillowResult.status === "fulfilled"
        ? zillowResult.value
        : { zhvi: [], inventory: [], flags: [], warnings: [] };
    if (zillowResult.status === "rejected") {
      console.error("[daily] Zillow fetch failed:", zillowResult.reason);
    }

    console.log(
      `[daily] Data fetched: FRED=${Object.keys(fred).length} series, CFPB=${cfpb.total} complaints, Zillow=${zillow.zhvi.length} MSAs`
    );

    const dailyData: DailyData = {
      generatedAt: new Date().toISOString(),
      sources: { fred, cfpb, zillow },
    };

    // Step 2: Load quarterly baseline from Blob, request body, or skip
    let quarterly: QuarterlyData | null = quarterlyBaseline ?? null;

    if (!quarterly && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { list } = await import("@vercel/blob");
        const blobs = await list({ prefix: "mcul-scanner/quarterly.json" });
        if (blobs.blobs.length > 0) {
          const resp = await fetch(blobs.blobs[0].url);
          const data = await resp.json();
          quarterly = data.quarterly ?? data;
          console.log("[daily] Loaded quarterly baseline from Blob.");
        }
      } catch (blobErr) {
        console.error("[daily] Blob read failed:", blobErr);
      }
    }

    // Try /tmp fallback for quarterly baseline
    if (!quarterly) {
      try {
        const fs = await import("fs/promises");
        const raw = await fs.readFile(
          "/tmp/mcul-scanner/quarterly.json",
          "utf-8"
        );
        const data = JSON.parse(raw);
        quarterly = data.quarterly ?? data;
        console.log("[daily] Loaded quarterly baseline from /tmp cache.");
      } catch {
        // No cached quarterly data available
      }
    }

    if (!quarterly) {
      console.log(
        "[daily] No quarterly baseline available. Cross-references will be limited."
      );
    }

    // Step 3: Generate cross-references
    console.log("[daily] Generating cross-references...");
    const findings = quarterly
      ? generateCrossReferences(fred, cfpb, zillow, quarterly)
      : [];

    const crossref: DailyCrossRef = {
      generatedAt: new Date().toISOString(),
      totalFindings: findings.length,
      bySeverity: findings.reduce(
        (acc, f) => {
          acc[f.severity] = (acc[f.severity] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      findings,
    };
    console.log(`[daily] ${findings.length} cross-reference findings.`);

    // Step 4: Generate AI narratives
    console.log("[daily] Generating narratives...");
    let narratives;
    if (quarterly) {
      narratives = await generateDailyNarratives(
        dailyData,
        crossref,
        quarterly,
        anthropicApiKey
      );
    } else {
      narratives = {
        economicSnapshot:
          "Quarterly baseline not available. Narrative generation requires NCUA quarterly data.",
        complaintMonitor:
          "Quarterly baseline not available. Run the quarterly scan first.",
        housingPulse:
          "Quarterly baseline not available. Run the quarterly scan first.",
        crossReferenceAlerts: findings,
      };
    }
    console.log("[daily] Narratives generated.");

    // Step 5: Run verification
    console.log("[daily] Running verification...");
    const verification = await runVerification(
      dailyData,
      crossref,
      quarterly
    );
    console.log(
      `[daily] Verification: ${verification.overallPassed ? "PASS" : "FAIL"} (${verification.passedChecks}/${verification.totalChecks})`
    );

    const result = {
      dailyData,
      crossref,
      narratives,
      verification,
    };

    // Step 6: Save to Vercel Blob if configured, always save to /tmp as fallback
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import("@vercel/blob");
        await put("mcul-scanner/daily.json", JSON.stringify(result), {
          access: "public",
          contentType: "application/json",
          addRandomSuffix: false,
        });
        console.log("[daily] Saved to Vercel Blob.");
      } catch (blobErr) {
        console.error("[daily] Blob save failed:", blobErr);
      }
    }

    // Always write to /tmp as a fallback cache
    try {
      const fs = await import("fs/promises");
      await fs.mkdir("/tmp/mcul-scanner", { recursive: true });
      await fs.writeFile(
        "/tmp/mcul-scanner/daily.json",
        JSON.stringify(result)
      );
      console.log("[daily] Saved to /tmp cache.");
    } catch (tmpErr) {
      console.error("[daily] /tmp save failed:", tmpErr);
    }

    return Response.json(result);
  } catch (err) {
    console.error("[daily] Pipeline error:", err);
    return Response.json(
      {
        error: "Daily pipeline failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
