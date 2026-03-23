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

    const hasAnthropicKey = !!(anthropicApiKey || process.env.ANTHROPIC_API_KEY);

    // Step 1: Fetch daily data from all three sources in parallel
    console.log("[daily] Fetching FRED, CFPB, Zillow in parallel...");
    const [fredResult, cfpbResult, zillowResult] = await Promise.allSettled([
      fetchAllFRED(),
      fetchCFPBComplaints(),
      fetchZillowHousing(),
    ]);

    const fred: Record<string, FREDSeries> =
      fredResult.status === "fulfilled" ? fredResult.value : {};
    const fredSeriesCount = Object.keys(fred).length;
    if (fredResult.status === "rejected") {
      console.error("[daily] FRED fetch rejected:", fredResult.reason);
    } else {
      console.log(`[daily] FRED returned ${fredSeriesCount} series`);
    }

    const cfpb: CFPBData =
      cfpbResult.status === "fulfilled"
        ? cfpbResult.value
        : {
            total: 0,
            totalMichiganCUs: 0,
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

    // Step 2: Use quarterly baseline from request body if provided
    const quarterly: QuarterlyData | null = quarterlyBaseline ?? null;

    if (!quarterly) {
      console.log(
        "[daily] No quarterly baseline provided. Cross-references will be limited."
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

    // Step 4: Generate AI narratives (optional, requires API key)
    let narratives;
    if (hasAnthropicKey && quarterly) {
      try {
        console.log("[daily] Generating narratives...");
        narratives = await generateDailyNarratives(
          dailyData,
          crossref,
          quarterly,
          anthropicApiKey
        );
        console.log("[daily] Narratives generated.");
      } catch (narrativeErr) {
        console.error("[daily] Narrative generation failed (continuing without):", narrativeErr);
        narratives = {
          economicSnapshot: "Narrative generation failed. Raw data is still available below.",
          complaintMonitor: "Narrative generation failed.",
          housingPulse: "Narrative generation failed.",
          crossReferenceAlerts: findings,
        };
      }
    } else {
      const reason = !hasAnthropicKey ? "No Anthropic API key" : "No quarterly baseline";
      console.log(`[daily] ${reason}. Skipping narrative generation.`);
      narratives = {
        economicSnapshot: quarterly
          ? "Narrative generation skipped (no API key). Raw data available."
          : "Quarterly baseline not available. Run the quarterly scan first for full narratives.",
        complaintMonitor: quarterly
          ? "Narrative generation skipped (no API key)."
          : "Quarterly baseline not available. Run the quarterly scan first.",
        housingPulse: quarterly
          ? "Narrative generation skipped (no API key)."
          : "Quarterly baseline not available. Run the quarterly scan first.",
        crossReferenceAlerts: findings,
      };
    }

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

    // Return data directly (no /tmp or Blob writes)
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
