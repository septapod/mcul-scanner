/**
 * NCUA Quarterly Pipeline
 *
 * Downloads NCUA 5300 Call Report ZIPs, extracts CSVs, filters to Michigan CUs,
 * computes per-CU metrics, statewide aggregates, tier breakdowns, and detects anomalies.
 *
 * Ported from the Python pipeline at:
 *   ~/dev/you-conference-2026/demos/act1a-statewide-scanner/data/pipeline.py
 */

import JSZip from "jszip";
import Papa from "papaparse";
import type {
  Anomaly,
  CUMetrics,
  QuarterData,
  QuarterlyData,
  StatewideMetrics,
  TierMetrics,
} from "./types";
import { NCUA_QUARTERS, TIERS } from "./types";

const STATE_FILTER = "MI";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a value to a number, returning 0 for anything non-numeric. */
function num(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Compute the median of a numeric array. Returns 0 for empty arrays. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Assign a CU to an asset tier based on total assets. */
function assignTier(totalAssets: number): string {
  for (const tier of TIERS) {
    if (totalAssets >= tier.threshold) {
      return tier.name;
    }
  }
  return TIERS[TIERS.length - 1].name;
}

/** Round to N decimal places. */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// CSV extraction from ZIP
// ---------------------------------------------------------------------------

type CSVRow = Record<string, string>;

/**
 * Find a file in a JSZip instance by name (case-insensitive suffix match).
 * Returns the matching zip entry path or null.
 */
function findFileInZip(zip: JSZip, filename: string): string | null {
  const upper = filename.toUpperCase();
  for (const path of Object.keys(zip.files)) {
    if (path.toUpperCase().endsWith(upper)) {
      return path;
    }
  }
  return null;
}

/**
 * Read and parse a CSV from a ZIP file, handling encoding issues.
 * Column names are normalized to uppercase and trimmed.
 */
async function readCsvFromZip(
  zip: JSZip,
  filename: string
): Promise<CSVRow[]> {
  const path = findFileInZip(zip, filename);
  if (!path) {
    const available = Object.keys(zip.files).join(", ");
    throw new Error(
      `${filename} not found in ZIP. Available: ${available}`
    );
  }

  // Try UTF-8 first, fall back to latin-1
  let text: string;
  try {
    const buf = await zip.files[path].async("uint8array");
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    const buf = await zip.files[path].async("uint8array");
    text = new TextDecoder("latin1").decode(buf);
  }

  const result = Papa.parse<CSVRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.toUpperCase().trim(),
  });

  return result.data;
}

// ---------------------------------------------------------------------------
// Download and extract quarter data
// ---------------------------------------------------------------------------

interface RawQuarterData {
  label: string;
  date: string;
  foicu: CSVRow[];
  fs220: CSVRow[];
  fs220a: CSVRow[];
  cuCount: number;
}

/**
 * Download an NCUA quarterly ZIP, extract CSVs, and filter to Michigan CUs.
 */
export async function downloadQuarter(
  label: string,
  date: string,
  url: string
): Promise<RawQuarterData> {
  console.log(`  [downloading] ${label} from ${url}`);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to download ${label}: ${resp.status} ${resp.statusText}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  console.log(`  [downloaded] ${(arrayBuffer.byteLength / 1_000_000).toFixed(1)} MB`);

  const zip = await JSZip.loadAsync(arrayBuffer);

  // Load and filter FOICU (profile table) to Michigan
  const foicu = await readCsvFromZip(zip, "FOICU.txt");

  // Find the STATE column (may have different casing after normalization)
  let stateCol = "STATE";
  if (foicu.length > 0 && !(stateCol in foicu[0])) {
    const keys = Object.keys(foicu[0]);
    const match = keys.find((k) => k.includes("STATE"));
    if (match) stateCol = match;
  }

  const miCUs = foicu.filter((row) => row[stateCol] === STATE_FILTER);
  const miCUNumbers = new Set(miCUs.map((row) => row["CU_NUMBER"]));
  console.log(`  [filtered] ${miCUNumbers.size} Michigan CUs found`);

  // Load FS220 (balance sheet) filtered to Michigan
  const fs220All = await readCsvFromZip(zip, "FS220.txt");
  const fs220 = fs220All.filter((row) => miCUNumbers.has(row["CU_NUMBER"]));

  // Load FS220A (net worth / ratios) filtered to Michigan
  const fs220aAll = await readCsvFromZip(zip, "FS220A.txt");
  const fs220a = fs220aAll.filter((row) => miCUNumbers.has(row["CU_NUMBER"]));

  return {
    label,
    date,
    foicu: miCUs,
    fs220,
    fs220a,
    cuCount: miCUNumbers.size,
  };
}

// ---------------------------------------------------------------------------
// Per-CU metric computation
// ---------------------------------------------------------------------------

/**
 * Compute per-CU metrics from raw quarter data.
 * Mirrors the Python compute_cu_metrics function.
 */
export function computeCUMetrics(quarterData: RawQuarterData): CUMetrics[] {
  const { foicu, fs220, fs220a } = quarterData;

  // Index FOICU and FS220A by CU_NUMBER for fast lookups
  const foicuByCU = new Map<string, CSVRow>();
  for (const row of foicu) {
    foicuByCU.set(row["CU_NUMBER"], row);
  }

  const fs220aByCU = new Map<string, CSVRow>();
  for (const row of fs220a) {
    fs220aByCU.set(row["CU_NUMBER"], row);
  }

  const metrics: CUMetrics[] = [];

  for (const row of fs220) {
    const cuNum = row["CU_NUMBER"];
    const profile = foicuByCU.get(cuNum);
    const aRow = fs220aByCU.get(cuNum);

    const totalAssets = num(row["ACCT_010"]);
    const totalLoans = num(row["ACCT_025B"]);
    const totalDeposits = num(row["ACCT_018"]);
    const currentMembers = num(row["ACCT_083"]);
    const delinquent2Plus = num(row["ACCT_041B"]);
    const netIncome = num(row["ACCT_602"]);
    const loansGrantedYtd = num(row["ACCT_031B"]);
    const provision = num(row["ACCT_300"]);
    const allowance = num(row["ACCT_719"]);

    // From FS220A
    const netWorth = aRow ? num(aRow["ACCT_997"]) : 0;
    const netWorthRatio = aRow ? num(aRow["ACCT_998"]) : 0;

    // Computed ratios
    const loanToShareRatio =
      totalDeposits > 0 ? round((totalLoans / totalDeposits) * 100, 2) : 0;
    const delinquencyRate =
      totalLoans > 0 ? round((delinquent2Plus / totalLoans) * 100, 4) : 0;
    const coverageRatio =
      delinquent2Plus > 0
        ? round((allowance / delinquent2Plus) * 100, 2)
        : 0;

    // City from profile
    const city = profile ? (profile["CITY"] || "").trim() : "";

    metrics.push({
      cuNumber: parseInt(cuNum, 10) || 0,
      city,
      tier: assignTier(totalAssets),
      totalAssets,
      totalLoans,
      totalDeposits,
      currentMembers: Math.round(currentMembers),
      netIncome,
      loansGrantedYtd,
      delinquent2Plus,
      provisionLoanLosses: provision,
      allowanceLoanLosses: allowance,
      netWorth,
      netWorthRatio,
      loanToShareRatio,
      delinquencyRate,
      coverageRatio,
    });
  }

  return metrics;
}

// ---------------------------------------------------------------------------
// Statewide aggregates
// ---------------------------------------------------------------------------

/**
 * Compute statewide aggregate metrics from per-CU data.
 */
export function computeStatewideAggregates(
  cuMetrics: CUMetrics[]
): StatewideMetrics {
  const totalLoans = cuMetrics.reduce((s, c) => s + c.totalLoans, 0);
  const totalDelinquent = cuMetrics.reduce((s, c) => s + c.delinquent2Plus, 0);

  const netWorthRatios = cuMetrics.map((c) => c.netWorthRatio);
  const delinquencyRates = cuMetrics.map((c) => c.delinquencyRate);

  return {
    totalCUs: cuMetrics.length,
    totalAssets: cuMetrics.reduce((s, c) => s + c.totalAssets, 0),
    totalLoans,
    totalDeposits: cuMetrics.reduce((s, c) => s + c.totalDeposits, 0),
    totalMembers: cuMetrics.reduce((s, c) => s + c.currentMembers, 0),
    totalNetIncome: cuMetrics.reduce((s, c) => s + c.netIncome, 0),
    avgNetWorthRatio: round(
      netWorthRatios.reduce((s, v) => s + v, 0) / (netWorthRatios.length || 1),
      2
    ),
    medianNetWorthRatio: round(median(netWorthRatios), 2),
    avgDelinquencyRate: round(
      delinquencyRates.reduce((s, v) => s + v, 0) /
        (delinquencyRates.length || 1),
      4
    ),
    medianDelinquencyRate: round(median(delinquencyRates), 4),
    avgLoanToShare: round(
      cuMetrics.reduce((s, c) => s + c.loanToShareRatio, 0) /
        (cuMetrics.length || 1),
      2
    ),
    totalDelinquent,
    weightedDelinquencyRate:
      totalLoans > 0 ? round((totalDelinquent / totalLoans) * 100, 4) : 0,
  };
}

// ---------------------------------------------------------------------------
// Tier breakdown
// ---------------------------------------------------------------------------

/**
 * Compute metrics broken down by asset tier.
 */
export function computeTierBreakdown(
  cuMetrics: CUMetrics[]
): Record<string, TierMetrics> {
  const tiers: Record<string, TierMetrics> = {};

  for (const tier of TIERS) {
    const tierCUs = cuMetrics.filter((c) => c.tier === tier.name);
    if (tierCUs.length === 0) continue;

    const assets = tierCUs.map((c) => c.totalAssets);

    tiers[tier.name] = {
      cuCount: tierCUs.length,
      totalAssets: tierCUs.reduce((s, c) => s + c.totalAssets, 0),
      totalMembers: tierCUs.reduce((s, c) => s + c.currentMembers, 0),
      avgNetWorthRatio: round(
        tierCUs.reduce((s, c) => s + c.netWorthRatio, 0) / tierCUs.length,
        2
      ),
      avgDelinquencyRate: round(
        tierCUs.reduce((s, c) => s + c.delinquencyRate, 0) / tierCUs.length,
        4
      ),
      avgLoanToShare: round(
        tierCUs.reduce((s, c) => s + c.loanToShareRatio, 0) / tierCUs.length,
        2
      ),
      totalNetIncome: tierCUs.reduce((s, c) => s + c.netIncome, 0),
      medianAssets: median(assets),
    };
  }

  return tiers;
}

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

/**
 * Detect anomalies across quarters at statewide and tier level.
 * Same thresholds as the Python pipeline:
 *   - >10% delinquency change = WARNING, >15% = CRITICAL
 *   - >0.15pp net worth ratio change
 *   - >0.5% membership change
 *   - Tier delinquency spike >15%
 *   - Multi-quarter sustained trends (3+ quarters)
 */
export function detectAnomalies(quarters: QuarterData[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (quarters.length < 2) return anomalies;

  // Compare most recent quarter to previous
  const current = quarters[quarters.length - 1];
  const previous = quarters[quarters.length - 2];
  const curr = current.statewide;
  const prev = previous.statewide;

  // 1. CU count change (mergers/closures)
  const cuDelta = curr.totalCUs - prev.totalCUs;
  if (cuDelta < 0) {
    anomalies.push({
      severity: "INFO",
      category: "Consolidation",
      headline: `Michigan lost ${Math.abs(cuDelta)} credit union(s) this quarter through mergers/closures`,
      currentValue: curr.totalCUs,
      previousValue: prev.totalCUs,
      metric: "totalCUs",
      detail:
        `CU count went from ${prev.totalCUs} to ${curr.totalCUs}. ` +
        `This continues the consolidation trend driven by rising compliance costs and scale pressures.`,
    });
  }

  // 2. Delinquency rate change
  const delqChange =
    curr.weightedDelinquencyRate - prev.weightedDelinquencyRate;
  const delqPctChange =
    prev.weightedDelinquencyRate > 0
      ? (delqChange / prev.weightedDelinquencyRate) * 100
      : 0;

  if (Math.abs(delqPctChange) > 10) {
    const severity: Anomaly["severity"] =
      delqPctChange > 15 ? "CRITICAL" : delqPctChange > 0 ? "WARNING" : "INFO";
    const direction = delqChange > 0 ? "increased" : "decreased";
    anomalies.push({
      severity,
      category: "Credit Quality",
      headline: `Statewide delinquency rate ${direction} ${Math.abs(delqPctChange).toFixed(1)}% quarter-over-quarter`,
      currentValue: curr.weightedDelinquencyRate,
      previousValue: prev.weightedDelinquencyRate,
      metric: "weightedDelinquencyRate",
      detail:
        `Weighted delinquency rate moved from ${prev.weightedDelinquencyRate.toFixed(2)}% to ` +
        `${curr.weightedDelinquencyRate.toFixed(2)}%.`,
    });
  }

  // 3. Net worth ratio change
  const nwChange = curr.avgNetWorthRatio - prev.avgNetWorthRatio;
  if (Math.abs(nwChange) > 0.15) {
    const severity: Anomaly["severity"] = nwChange < 0 ? "WARNING" : "INFO";
    const direction = nwChange < 0 ? "declined" : "improved";
    anomalies.push({
      severity,
      category: "Capital Adequacy",
      headline: `Average net worth ratio ${direction} ${Math.abs(nwChange).toFixed(2)} percentage points`,
      currentValue: curr.avgNetWorthRatio,
      previousValue: prev.avgNetWorthRatio,
      metric: "avgNetWorthRatio",
      detail:
        `Average net worth ratio moved from ${(prev.avgNetWorthRatio / 100).toFixed(2)}% to ` +
        `${(curr.avgNetWorthRatio / 100).toFixed(2)}%.`,
    });
  }

  // 4. Membership change
  const memberChange = curr.totalMembers - prev.totalMembers;
  const memberPct =
    prev.totalMembers > 0 ? (memberChange / prev.totalMembers) * 100 : 0;
  if (Math.abs(memberPct) > 0.5) {
    const severity: Anomaly["severity"] = memberPct < -0.5 ? "WARNING" : "INFO";
    const direction = memberPct < 0 ? "declined" : "grew";
    anomalies.push({
      severity,
      category: "Membership",
      headline: `Statewide membership ${direction} ${Math.abs(memberPct).toFixed(1)}% (${(Math.abs(memberChange) ?? 0).toLocaleString()} members)`,
      currentValue: curr.totalMembers,
      previousValue: prev.totalMembers,
      metric: "totalMembers",
      detail: `Total membership moved from ${(prev.totalMembers ?? 0).toLocaleString()} to ${(curr.totalMembers ?? 0).toLocaleString()}.`,
    });
  }

  // Tier-level anomalies
  const currTiers = current.tiers;
  const prevTiers = previous.tiers;

  for (const tierName of Object.keys(currTiers)) {
    if (!(tierName in prevTiers)) continue;
    const ct = currTiers[tierName];
    const pt = prevTiers[tierName];

    // Tier delinquency spike
    const tierDelqChange = ct.avgDelinquencyRate - pt.avgDelinquencyRate;
    const tierDelqPct =
      pt.avgDelinquencyRate > 0
        ? (tierDelqChange / pt.avgDelinquencyRate) * 100
        : 0;
    if (tierDelqPct > 15) {
      anomalies.push({
        severity: "WARNING",
        category: "Credit Quality",
        headline: `${tierName}: delinquency rate up ${tierDelqPct.toFixed(1)}% QoQ`,
        currentValue: ct.avgDelinquencyRate,
        previousValue: pt.avgDelinquencyRate,
        metric: `tierDelinquency_${tierName}`,
        detail:
          `Average delinquency in ${tierName} moved from ${pt.avgDelinquencyRate.toFixed(2)}% to ` +
          `${ct.avgDelinquencyRate.toFixed(2)}%.`,
      });
    }

    // Tier CU count change (mergers concentrated in a tier)
    const tierCUDelta = ct.cuCount - pt.cuCount;
    if (tierCUDelta < -1) {
      anomalies.push({
        severity: "INFO",
        category: "Consolidation",
        headline: `${tierName}: lost ${Math.abs(tierCUDelta)} credit union(s) this quarter`,
        currentValue: ct.cuCount,
        previousValue: pt.cuCount,
        metric: `tierCUCount_${tierName}`,
        detail: `CU count in ${tierName} went from ${pt.cuCount} to ${ct.cuCount}.`,
      });
    }
  }

  // Multi-quarter trend detection (3+ consecutive quarters)
  if (quarters.length >= 3) {
    const trendMetrics: Array<{
      key: keyof StatewideMetrics;
      label: string;
    }> = [
      { key: "weightedDelinquencyRate", label: "Weighted Delinquency Rate" },
      { key: "avgNetWorthRatio", label: "Avg Net Worth Ratio" },
      { key: "totalMembers", label: "Total Members" },
    ];

    for (const { key, label } of trendMetrics) {
      const values = quarters.map((q) => q.statewide[key] as number);
      const increasing = values.every(
        (v, i) => i === 0 || v > values[i - 1]
      );
      const decreasing = values.every(
        (v, i) => i === 0 || v < values[i - 1]
      );

      // Format values based on metric type
      const formatTrendValue = (v: number): string => {
        if (key === "avgNetWorthRatio") return `${(v / 100).toFixed(2)}%`;
        if (key === "weightedDelinquencyRate") return `${v.toFixed(2)}%`;
        if (key === "totalMembers") return (v ?? 0).toLocaleString();
        return v.toFixed(2);
      };
      const formattedValues = values.map(formatTrendValue).join(", ");

      if (increasing) {
        anomalies.push({
          severity: "WARNING",
          category: "Sustained Trend",
          headline: `${label} has increased for ${values.length} consecutive quarters`,
          currentValue: values[values.length - 1],
          previousValue: values[0],
          metric: `trend_${key}`,
          detail: `Values: ${formattedValues}`,
          valuesByQuarter: Object.fromEntries(
            quarters.map((q, i) => [q.label, values[i]])
          ),
        });
      } else if (decreasing) {
        const severity: Anomaly["severity"] =
          key === "weightedDelinquencyRate" ? "INFO" : "WARNING";
        anomalies.push({
          severity,
          category: "Sustained Trend",
          headline: `${label} has decreased for ${values.length} consecutive quarters`,
          currentValue: values[values.length - 1],
          previousValue: values[0],
          metric: `trend_${key}`,
          detail: `Values: ${formattedValues}`,
          valuesByQuarter: Object.fromEntries(
            quarters.map((q, i) => [q.label, values[i]])
          ),
        });
      }
    }
  }

  return anomalies;
}

// ---------------------------------------------------------------------------
// Full pipeline orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full quarterly pipeline:
 * 1. Download all 4 quarters of NCUA data
 * 2. Compute per-CU metrics for each quarter
 * 3. Compute statewide aggregates and tier breakdowns
 * 4. Detect anomalies across quarters
 * 5. Return the assembled QuarterlyData object
 */
export async function runQuarterlyPipeline(): Promise<QuarterlyData> {
  console.log("=".repeat(60));
  console.log("Michigan Credit Union Statewide Scanner - NCUA Pipeline");
  console.log("=".repeat(60));

  const quarterResults: QuarterData[] = [];

  for (const quarter of NCUA_QUARTERS) {
    console.log(`\nProcessing ${quarter.label}...`);

    try {
      const rawData = await downloadQuarter(
        quarter.label,
        quarter.date,
        quarter.url
      );
      const cuMetrics = computeCUMetrics(rawData);
      const statewide = computeStatewideAggregates(cuMetrics);
      const tiers = computeTierBreakdown(cuMetrics);

      quarterResults.push({
        label: quarter.label,
        date: quarter.date,
        statewide,
        tiers,
      });

      console.log(
        `  [computed] ${statewide.totalCUs} CUs, ` +
          `$${(statewide.totalAssets / 1e9).toFixed(1)}B assets, ` +
          `${(statewide.totalMembers ?? 0).toLocaleString()} members`
      );
    } catch (err) {
      console.error(
        `  [ERROR] Failed to load ${quarter.label}:`,
        err instanceof Error ? err.message : err
      );
      // Continue with remaining quarters
    }
  }

  // Detect anomalies across all successfully loaded quarters
  console.log("\nDetecting anomalies...");
  const anomalies = detectAnomalies(quarterResults);
  console.log(`  [found] ${anomalies.length} anomalies`);
  for (const a of anomalies) {
    console.log(`    [${a.severity}] ${a.headline}`);
  }

  const result: QuarterlyData = {
    generatedAt: new Date().toISOString(),
    state: STATE_FILTER,
    quartersAnalyzed: quarterResults.length,
    quarters: quarterResults,
    anomalies,
  };

  console.log("\nPipeline complete.");
  return result;
}
