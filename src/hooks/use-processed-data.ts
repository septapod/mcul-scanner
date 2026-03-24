"use client";

import { useMemo } from "react";
import type {
  QuarterlyData,
  DailyData,
  VerificationReport,
  AnalysisOutput,
  Anomaly,
  FREDSeries,
} from "@/lib/pipelines/types";
import {
  fmtAssets,
  fmtMembers,
  fmtPct,
  fmtNetWorth,
  fmtDelinquency,
  fmtChange,
} from "@/lib/format";

// ── Input type (raw data from API/localStorage) ──────────────────────────────

export interface RawScannerData {
  quarterly: QuarterlyData | null;
  daily: DailyData | null;
  verification: VerificationReport | null;
  analysis: AnalysisOutput | null;
}

// ── Output types (processed, null-safe, display-ready) ───────────────────────

export interface ProcessedMetric {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}

export interface ProcessedTier {
  name: string;
  shortName: string;
  cuCount: string;
  totalAssets: string;
  avgDelinquency: string;
  avgDelinquencyRaw: number;
  avgNetWorth: string;
  avgLoanToShare: string;
  members: string;
  status: "strengthening" | "weakening" | "stable" | "mixed";
  statusNarrative?: string;
  isHighestDelinquency: boolean;
  changes: {
    cuCount?: { text: string; type: "positive" | "negative" | "neutral" };
    assets?: { text: string; type: "positive" | "negative" | "neutral" };
    delinquency?: { text: string; type: "positive" | "negative" | "neutral" };
    netWorth?: { text: string; type: "positive" | "negative" | "neutral" };
  };
}

export interface ProcessedAnomaly {
  severity: "CRITICAL" | "WARNING" | "INFO";
  category: string;
  headline: string;
  detail: string;
  narrative?: string;
  watchItems?: string[];
  currentValue?: string;
  previousValue?: string;
}

export interface ProcessedTrend {
  name: string;
  direction: "rising" | "falling" | "accelerating" | "decelerating" | "stable";
  evidence: string;
  implication: string;
}

export interface ProcessedRisk {
  name: string;
  severity: "high" | "moderate" | "low";
  evidence: string;
  implication: string;
}

export interface ProcessedFREDSeries {
  id: string;
  name: string;
  value: string;
  change?: string;
  direction: "up" | "down" | "flat";
  significant: boolean;
}

export interface ProcessedData {
  // Hero metrics
  totalCUs: string;
  totalCUsRaw: number;
  totalAssets: string;
  totalAssetsRaw: number;
  totalMembers: string;
  totalMembersRaw: number;

  // Growth metrics
  assetGrowth: string;
  assetGrowthPct: string;
  cusLost: number;
  firstQCUs: number;

  // Overview stat tiles
  overviewMetrics: ProcessedMetric[];

  // Tiers
  tiers: ProcessedTier[];
  highestDelinquencyTier: string;

  // Delinquency sparkline data
  quarterlyDelinquency: number[];
  quarterlyLabels: string[];

  // Anomalies
  anomalies: ProcessedAnomaly[];

  // Trends (AI or data-derived, always populated when data exists)
  trends: ProcessedTrend[];

  // Risks (AI or data-derived, always populated when data exists)
  risks: ProcessedRisk[];

  // FRED economic data
  fred: ProcessedFREDSeries[];

  // CFPB summary
  cfpbTotal: string;
  cfpbMichiganCUs: string;

  // Narrative
  overview: string;
  summaryInsight: string;
  isAIGenerated: boolean;
  tierSynthesis: string;

  // Meta
  lastRefresh: string;
  verificationBadge: string;
  hasData: boolean;
  hasAnalysis: boolean;
  hasDaily: boolean;
  dataSourceCount: number;
  quartersAnalyzed: number;
  firstQuarterLabel: string;
  lastQuarterLabel: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAnomalyValue(value: number | undefined | null, metric: string): string {
  if (value == null) return "N/A";
  if (metric === "avgNetWorthRatio" || metric.startsWith("trend_avgNetWorthRatio")) {
    return `${(value / 100).toFixed(2)}%`;
  }
  if (
    metric === "weightedDelinquencyRate" ||
    metric.startsWith("tierDelinquency_") ||
    metric.startsWith("trend_weightedDelinquencyRate")
  ) {
    return `${value.toFixed(2)}%`;
  }
  if (metric === "totalMembers" || metric.startsWith("trend_totalMembers")) {
    return value.toLocaleString();
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Extract a short tier name: "Tier 1: Anchor (>$5B)" -> "Anchor" */
function shortTierName(fullName: string): string {
  const match = fullName.match(/:\s*([^(]+)/);
  return match ? match[1].trim() : fullName;
}

/** Determine if an analysis narrative is a placeholder */
function isPlaceholder(text: string | undefined | null): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  return (
    lower.includes("pending") ||
    lower.includes("api key") ||
    lower.includes("placeholder") ||
    lower.includes("not available") ||
    text.trim().length < 10
  );
}

/** Compute data-derived trends when AI analysis is unavailable */
function computeTrendsFromData(
  quarterly: QuarterlyData,
): ProcessedTrend[] {
  const quarters = quarterly.quarters ?? [];
  if (quarters.length < 2) return [];
  const latest = quarters[quarters.length - 1];
  const first = quarters[0];
  const ls = latest?.statewide;
  const fs = first?.statewide;
  if (!ls || !fs) return [];

  const trends: ProcessedTrend[] = [];

  // Delinquency trend
  const delinqChange =
    (ls.weightedDelinquencyRate ?? 0) - (fs.weightedDelinquencyRate ?? 0);
  if (Math.abs(delinqChange) > 0.05) {
    trends.push({
      name:
        delinqChange > 0
          ? "Delinquency Rising Across the State"
          : "Delinquency Improving Statewide",
      direction: delinqChange > 0 ? "rising" : "falling",
      evidence: `Weighted delinquency rate moved from ${(fs.weightedDelinquencyRate ?? 0).toFixed(2)}% to ${(ls.weightedDelinquencyRate ?? 0).toFixed(2)}% over ${quarters.length} quarters.`,
      implication:
        delinqChange > 0
          ? "Credit quality pressure is building. Monitor early-stage delinquency (30-60 day buckets) for signs of stabilization."
          : "Credit quality is strengthening, which supports lending growth and reduces provisioning needs.",
    });
  }

  // Asset growth trend
  const assetGrowth =
    ls.totalAssets && fs.totalAssets
      ? ((ls.totalAssets - fs.totalAssets) / fs.totalAssets) * 100
      : 0;
  if (Math.abs(assetGrowth) > 1) {
    trends.push({
      name: assetGrowth > 0 ? "Steady Asset Growth" : "Asset Contraction",
      direction: assetGrowth > 0 ? "rising" : "falling",
      evidence: `Total assets grew from $${((fs.totalAssets ?? 0) / 1e9).toFixed(1)}B to $${((ls.totalAssets ?? 0) / 1e9).toFixed(1)}B (${assetGrowth.toFixed(1)}%) across ${quarters.length} quarters.`,
      implication:
        assetGrowth > 0
          ? "The industry is growing despite consolidation, indicating remaining institutions are expanding."
          : "Contraction signals competitive pressure from banks and fintechs.",
    });
  }

  // Consolidation trend
  const cuLost = (fs.totalCUs ?? 0) - (ls.totalCUs ?? 0);
  if (cuLost > 0) {
    trends.push({
      name: "Continued Industry Consolidation",
      direction: "accelerating",
      evidence: `Michigan went from ${fs.totalCUs ?? 0} to ${ls.totalCUs ?? 0} credit unions (${cuLost} fewer) over ${quarters.length} quarters.`,
      implication:
        "Smaller institutions face increasing pressure from compliance costs and technology investment requirements. Merger activity is expected to continue.",
    });
  }

  return trends;
}

/** Compute data-derived risks when AI analysis is unavailable */
function computeRisksFromData(
  quarterly: QuarterlyData,
): ProcessedRisk[] {
  const quarters = quarterly.quarters ?? [];
  if (quarters.length < 2) return [];
  const latest = quarters[quarters.length - 1];
  const first = quarters[0];
  if (!latest?.tiers || !latest?.statewide) return [];

  const risks: ProcessedRisk[] = [];

  // Highest delinquency tier
  let highTier = "";
  let highDelinq = 0;
  for (const [name, tier] of Object.entries(latest.tiers)) {
    if ((tier.avgDelinquencyRate ?? 0) > highDelinq) {
      highDelinq = tier.avgDelinquencyRate ?? 0;
      highTier = name;
    }
  }
  if (highDelinq > 0.8) {
    risks.push({
      name: `Elevated Delinquency in ${highTier.split(":")[0]?.trim() || "One"} Tier`,
      severity: highDelinq > 1.0 ? "high" : "moderate",
      evidence: `${highTier} shows ${highDelinq.toFixed(2)}% average delinquency, the highest among all tiers.`,
      implication:
        "Institutions in this tier should review underwriting standards and monitor early-warning indicators.",
    });
  }

  // Sustained delinquency increase
  const allRising =
    quarters.length >= 3 &&
    quarters.every((q, i) => {
      if (i === 0) return true;
      return (
        (q.statewide?.weightedDelinquencyRate ?? 0) >=
        (quarters[i - 1].statewide?.weightedDelinquencyRate ?? 0)
      );
    });
  if (allRising) {
    risks.push({
      name: "Sustained Delinquency Trend",
      severity: "high",
      evidence: `Statewide delinquency has risen for ${quarters.length} consecutive quarters, from ${(first.statewide?.weightedDelinquencyRate ?? 0).toFixed(2)}% to ${(latest.statewide?.weightedDelinquencyRate ?? 0).toFixed(2)}%.`,
      implication:
        "A multi-quarter upward trend in delinquency warrants proactive credit risk management across all tiers.",
    });
  }

  // Community tier pressure
  const communityTier = latest.tiers["Tier 5: Community (<$100M)"];
  const firstCommunity = first?.tiers?.["Tier 5: Community (<$100M)"];
  if (communityTier && firstCommunity) {
    const cuLoss =
      (firstCommunity.cuCount ?? 0) - (communityTier.cuCount ?? 0);
    if (cuLoss >= 3) {
      risks.push({
        name: "Community Tier Under Pressure",
        severity: "moderate",
        evidence: `Community credit unions (<$100M) lost ${cuLoss} institutions (from ${firstCommunity.cuCount ?? 0} to ${communityTier.cuCount ?? 0}) over ${quarters.length} quarters.`,
        implication:
          "Scale challenges in compliance, technology, and member expectations are driving consolidation in the smallest tier.",
      });
    }
  }

  return risks;
}

// ── Main hook ────────────────────────────────────────────────────────────────

export function useProcessedData(raw: RawScannerData): ProcessedData {
  return useMemo(() => {
    const { quarterly, daily, verification, analysis } = raw;

    const quarters = quarterly?.quarters ?? [];
    const latestQ = quarters.length > 0 ? quarters[quarters.length - 1] : null;
    const prevQ = quarters.length > 1 ? quarters[quarters.length - 2] : null;
    const firstQ = quarters.length > 0 ? quarters[0] : null;
    const ls = latestQ?.statewide;
    const ps = prevQ?.statewide;
    const fs = firstQ?.statewide;

    // ── Hero metrics ───────────────────────────────────────────────────────

    const totalCUsRaw = ls?.totalCUs ?? 0;
    const totalAssetsRaw = ls?.totalAssets ?? 0;
    const totalMembersRaw = ls?.totalMembers ?? 0;

    const totalCUs = totalCUsRaw > 0 ? totalCUsRaw.toLocaleString() : "0";
    const totalAssets = totalAssetsRaw > 0 ? fmtAssets(totalAssetsRaw) : "$0";
    const totalMembers =
      totalMembersRaw > 0 ? fmtMembers(totalMembersRaw) : "0";

    // ── Growth metrics ─────────────────────────────────────────────────────

    const assetGrowthNum =
      ls?.totalAssets && fs?.totalAssets
        ? ls.totalAssets - fs.totalAssets
        : 0;
    const assetGrowthPctNum =
      fs?.totalAssets && fs.totalAssets > 0
        ? (assetGrowthNum / fs.totalAssets) * 100
        : 0;
    const assetGrowth = fmtAssets(assetGrowthNum);
    const assetGrowthPct = fmtPct(assetGrowthPctNum, 1);
    const cusLost = (fs?.totalCUs ?? 0) - (ls?.totalCUs ?? 0);
    const firstQCUs = fs?.totalCUs ?? 0;

    // ── Overview stat tiles ────────────────────────────────────────────────

    const overviewMetrics: ProcessedMetric[] = [];

    // Total Assets
    const assetsChange = ps?.totalAssets
      ? fmtChange(ls?.totalAssets ?? 0, ps.totalAssets)
      : null;
    overviewMetrics.push({
      label: "Total Assets",
      value: totalAssets,
      change: assetsChange?.text,
      changeType: assetsChange?.type ?? "neutral",
    });

    // Total Members
    const membersChange = ps?.totalMembers
      ? fmtChange(ls?.totalMembers ?? 0, ps.totalMembers)
      : null;
    overviewMetrics.push({
      label: "Members",
      value: totalMembers,
      change: membersChange?.text,
      changeType: membersChange?.type ?? "neutral",
    });

    // Avg Delinquency
    overviewMetrics.push({
      label: "Avg Delinquency",
      value: fmtDelinquency(ls?.weightedDelinquencyRate ?? 0),
      change: ps?.weightedDelinquencyRate != null
        ? (() => {
            const ch = fmtChange(
              ls?.weightedDelinquencyRate ?? 0,
              ps.weightedDelinquencyRate,
            );
            // Invert: rising delinquency is negative
            return ch.text;
          })()
        : undefined,
      changeType: ps?.weightedDelinquencyRate != null
        ? (() => {
            const ch = fmtChange(
              ls?.weightedDelinquencyRate ?? 0,
              ps.weightedDelinquencyRate,
            );
            // Invert direction for delinquency
            if (ch.type === "positive") return "negative" as const;
            if (ch.type === "negative") return "positive" as const;
            return "neutral" as const;
          })()
        : "neutral",
    });

    // Avg Net Worth Ratio
    overviewMetrics.push({
      label: "Avg Net Worth",
      value: fmtNetWorth(ls?.avgNetWorthRatio ?? 0),
      change: ps?.avgNetWorthRatio != null
        ? fmtChange(ls?.avgNetWorthRatio ?? 0, ps.avgNetWorthRatio).text
        : undefined,
      changeType: ps?.avgNetWorthRatio != null
        ? fmtChange(ls?.avgNetWorthRatio ?? 0, ps.avgNetWorthRatio).type
        : "neutral",
    });

    // ── Tiers ──────────────────────────────────────────────────────────────

    const tierEntries = latestQ?.tiers
      ? Object.entries(latestQ.tiers)
      : [];
    const prevTiers = prevQ?.tiers ?? {};

    // Find highest delinquency tier
    let highestDelinqTier = "";
    let highestDelinqVal = 0;
    for (const [name, tier] of tierEntries) {
      if ((tier.avgDelinquencyRate ?? 0) > highestDelinqVal) {
        highestDelinqVal = tier.avgDelinquencyRate ?? 0;
        highestDelinqTier = name;
      }
    }

    // Get AI tier health data if available
    const aiTierHealth = analysis?.sections?.tierHealthSummary?.tiers ?? [];
    const aiTierMap = new Map(
      aiTierHealth.map((t) => [t.tierName, t]),
    );

    const tiers: ProcessedTier[] = tierEntries.map(([name, tier]) => {
      const prev = prevTiers[name];
      const aiTier = aiTierMap.get(name);

      const cuCountChange = prev
        ? fmtChange(tier.cuCount ?? 0, prev.cuCount ?? 0)
        : undefined;
      const assetsChg = prev
        ? fmtChange(tier.totalAssets ?? 0, prev.totalAssets ?? 0)
        : undefined;
      const delinqChg = prev
        ? (() => {
            const ch = fmtChange(
              tier.avgDelinquencyRate ?? 0,
              prev.avgDelinquencyRate ?? 0,
            );
            // Invert for delinquency
            return {
              text: ch.text,
              type:
                ch.type === "positive"
                  ? ("negative" as const)
                  : ch.type === "negative"
                    ? ("positive" as const)
                    : ("neutral" as const),
            };
          })()
        : undefined;
      const nwChg = prev
        ? fmtChange(tier.avgNetWorthRatio ?? 0, prev.avgNetWorthRatio ?? 0)
        : undefined;

      return {
        name,
        shortName: shortTierName(name),
        cuCount: (tier.cuCount ?? 0).toLocaleString(),
        totalAssets: fmtAssets(tier.totalAssets ?? 0),
        avgDelinquency: fmtDelinquency(tier.avgDelinquencyRate ?? 0),
        avgDelinquencyRaw: tier.avgDelinquencyRate ?? 0,
        avgNetWorth: fmtNetWorth(tier.avgNetWorthRatio ?? 0),
        avgLoanToShare: fmtPct(tier.avgLoanToShare ?? 0, 1),
        members: fmtMembers(tier.totalMembers ?? 0),
        status: aiTier?.status ?? "stable",
        statusNarrative: aiTier?.summary,
        isHighestDelinquency: name === highestDelinqTier,
        changes: {
          cuCount: cuCountChange,
          assets: assetsChg,
          delinquency: delinqChg,
          netWorth: nwChg,
        },
      };
    });

    // ── Delinquency sparkline ──────────────────────────────────────────────

    const quarterlyDelinquency = quarters.map(
      (q) => q.statewide?.weightedDelinquencyRate ?? 0,
    );
    const quarterlyLabels = quarters.map((q) => q.label ?? "");

    // ── Anomalies ──────────────────────────────────────────────────────────

    const rawAnomalies: Anomaly[] = quarterly?.anomalies ?? [];
    const aiNarratives = analysis?.sections?.anomalyNarratives ?? [];
    const narrativeMap = new Map(
      aiNarratives.map((n) => [n.headline, n]),
    );

    const anomalies: ProcessedAnomaly[] = rawAnomalies.map((a) => {
      const narrative = narrativeMap.get(a.headline);
      return {
        severity: a.severity ?? "INFO",
        category: a.category ?? "Unknown",
        headline: a.headline ?? "Anomaly detected",
        detail: a.detail ?? "",
        narrative: narrative?.narrative,
        watchItems: narrative?.watchItems,
        currentValue: formatAnomalyValue(a.currentValue, a.metric ?? ""),
        previousValue: formatAnomalyValue(a.previousValue, a.metric ?? ""),
      };
    });

    // ── Trends ─────────────────────────────────────────────────────────────

    const aiTrends = analysis?.sections?.emergingTrends;
    let trends: ProcessedTrend[];
    if (aiTrends && aiTrends.length > 0) {
      trends = aiTrends.map((t) => ({
        name: t.trendName ?? "Unknown Trend",
        direction: t.direction ?? "stable",
        evidence: t.evidence ?? "",
        implication: t.implication ?? "",
      }));
    } else if (quarterly && quarters.length >= 2) {
      trends = computeTrendsFromData(quarterly);
    } else {
      trends = [];
    }

    // ── Risks ──────────────────────────────────────────────────────────────

    const aiRisks = analysis?.sections?.riskConcentrations;
    let risks: ProcessedRisk[];
    if (aiRisks && aiRisks.length > 0) {
      risks = aiRisks.map((r) => ({
        name: r.riskName ?? "Unknown Risk",
        severity: r.severity ?? "low",
        evidence: r.evidence ?? "",
        implication: r.implication ?? "",
      }));
    } else if (quarterly && quarters.length >= 2) {
      risks = computeRisksFromData(quarterly);
    } else {
      risks = [];
    }

    // ── FRED ───────────────────────────────────────────────────────────────

    const fredRaw = daily?.sources?.fred ?? {};
    const fred: ProcessedFREDSeries[] = Object.entries(fredRaw)
      .filter(([key]) => !key.startsWith("_"))
      .filter(
        ([, series]) =>
          series && typeof series === "object" && "latestValue" in series,
      )
      .map(([id, series]: [string, FREDSeries]) => {
        const isPercent =
          series.unit === "percent" ||
          series.unit === "Percent" ||
          series.unit === "%";
        const value =
          series.latestValue != null
            ? isPercent
              ? `${series.latestValue.toFixed(2)}%`
              : series.latestValue.toLocaleString()
            : "N/A";

        const change =
          series.yoyPctChange != null
            ? `${series.yoyPctChange > 0 ? "+" : ""}${series.yoyPctChange.toFixed(1)}% YoY`
            : undefined;

        const direction: "up" | "down" | "flat" =
          series.yoyPctChange != null
            ? series.yoyPctChange > 0.05
              ? "up"
              : series.yoyPctChange < -0.05
                ? "down"
                : "flat"
            : "flat";

        return {
          id,
          name: series.name ?? id,
          value,
          change,
          direction,
          significant: series.significant ?? false,
        };
      });

    // ── CFPB ───────────────────────────────────────────────────────────────

    const cfpb = daily?.sources?.cfpb;
    const cfpbTotal = cfpb?.total != null ? cfpb.total.toLocaleString() : "0";
    const cfpbMichiganCUs =
      cfpb?.totalMichiganCUs != null
        ? cfpb.totalMichiganCUs.toLocaleString()
        : "0";

    // ── Narrative fields ───────────────────────────────────────────────────

    const rawOverview = analysis?.sections?.statewideOverview ?? "";
    const overview = isPlaceholder(rawOverview) ? "" : rawOverview;

    const rawInsight = analysis?.sections?.summaryInsight ?? "";
    const summaryInsight = isPlaceholder(rawInsight) ? "" : rawInsight;

    const rawSynthesis =
      analysis?.sections?.tierHealthSummary?.synthesis ?? "";
    const tierSynthesis = isPlaceholder(rawSynthesis) ? "" : rawSynthesis;

    const isAIGenerated =
      !!analysis &&
      analysis.model !== "none" &&
      !isPlaceholder(rawOverview);

    // ── Meta ───────────────────────────────────────────────────────────────

    const lastRefresh = quarterly?.generatedAt
      ? new Date(quarterly.generatedAt).toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "No data yet";

    const verificationBadge = verification
      ? `${verification.passedChecks}/${verification.totalChecks} checks passed`
      : "Not verified";

    const hasData = !!quarterly && quarters.length > 0;
    const hasAnalysis = isAIGenerated;
    const hasDaily = !!daily;

    let dataSourceCount = 0;
    if (quarterly) dataSourceCount++;
    if (daily?.sources?.fred && Object.keys(daily.sources.fred).length > 0)
      dataSourceCount++;
    if (daily?.sources?.cfpb) dataSourceCount++;
    if (daily?.sources?.zillow) dataSourceCount++;

    const quartersAnalyzed = quarterly?.quartersAnalyzed ?? quarters.length;
    const firstQuarterLabel = firstQ?.label ?? "";
    const lastQuarterLabel = latestQ?.label ?? "";

    return {
      totalCUs,
      totalCUsRaw,
      totalAssets,
      totalAssetsRaw,
      totalMembers,
      totalMembersRaw,
      assetGrowth,
      assetGrowthPct,
      cusLost,
      firstQCUs,
      overviewMetrics,
      tiers,
      highestDelinquencyTier: highestDelinqTier,
      quarterlyDelinquency,
      quarterlyLabels,
      anomalies,
      trends,
      risks,
      fred,
      cfpbTotal,
      cfpbMichiganCUs,
      overview,
      summaryInsight,
      isAIGenerated,
      tierSynthesis,
      lastRefresh,
      verificationBadge,
      hasData,
      hasAnalysis,
      hasDaily,
      dataSourceCount,
      quartersAnalyzed,
      firstQuarterLabel,
      lastQuarterLabel,
    };
  }, [raw]);
}
