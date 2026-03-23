/**
 * Cross-Reference Engine
 * Combines daily FRED/CFPB/Zillow data with the NCUA quarterly baseline
 * to produce actionable findings with severity rankings.
 *
 * Tone: balanced. Michigan is not painted negatively. Positive cross-references
 * get OPPORTUNITY severity.
 */

import type {
  FREDSeries,
  CFPBData,
  ZillowData,
  QuarterlyData,
  CUDetail,
  CrossRefFinding,
  Severity,
} from "./types";

// ── Michigan city-to-MSA mapping (for Zillow x NCUA geography matching) ────

const MI_CITY_TO_MSA: Record<string, string> = {
  detroit: "Detroit-Warren-Dearborn, MI",
  warren: "Detroit-Warren-Dearborn, MI",
  dearborn: "Detroit-Warren-Dearborn, MI",
  livonia: "Detroit-Warren-Dearborn, MI",
  troy: "Detroit-Warren-Dearborn, MI",
  southfield: "Detroit-Warren-Dearborn, MI",
  pontiac: "Detroit-Warren-Dearborn, MI",
  "sterling heights": "Detroit-Warren-Dearborn, MI",
  canton: "Detroit-Warren-Dearborn, MI",
  novi: "Detroit-Warren-Dearborn, MI",
  "grand rapids": "Grand Rapids-Kentwood, MI",
  kentwood: "Grand Rapids-Kentwood, MI",
  wyoming: "Grand Rapids-Kentwood, MI",
  "ann arbor": "Ann Arbor, MI",
  ypsilanti: "Ann Arbor, MI",
  lansing: "Lansing-East Lansing, MI",
  "east lansing": "Lansing-East Lansing, MI",
  kalamazoo: "Kalamazoo-Portage, MI",
  portage: "Kalamazoo-Portage, MI",
  flint: "Flint, MI",
  burton: "Flint, MI",
  saginaw: "Saginaw, MI",
  "bay city": "Bay City, MI",
  midland: "Midland, MI",
  muskegon: "Muskegon, MI",
  jackson: "Jackson, MI",
  "battle creek": "Battle Creek, MI",
  "traverse city": "Traverse City, MI",
  holland: "Holland, MI",
  marquette: "Marquette, MI",
  "port huron": "Port Huron, MI",
};

function cityToMSA(city: string | undefined): string | null {
  if (!city) return null;
  return MI_CITY_TO_MSA[city.toLowerCase().trim()] ?? null;
}

// ── FRED x NCUA cross-references ───────────────────────────────────────────

function crossrefFredNcua(
  fred: Record<string, FREDSeries>,
  quarterly: QuarterlyData,
  cuDetail: CUDetail[]
): CrossRefFinding[] {
  const findings: CrossRefFinding[] = [];

  const latestQuarter =
    quarterly.quarters.length > 0
      ? quarterly.quarters[quarterly.quarters.length - 1]
      : null;
  if (!latestQuarter) return findings;

  const sw = latestQuarter.statewide;

  // Unemployment x Delinquency
  const miur = fred["MIUR"];
  if (miur) {
    const delqRate = sw.weightedDelinquencyRate ?? 0;
    const highDelqCUs = cuDetail.filter(
      (cu) => (cu.delinquencyRate ?? 0) > delqRate * 1.5
    );
    const change = miur.change;
    const yoyChange = miur.yoyChange ?? 0;

    if (change > 0.1) {
      const severity: Severity = change >= 0.3 ? "WARNING" : "INFO";
      findings.push({
        type: "fred_x_ncua",
        severity,
        headline: `Michigan unemployment at ${miur.latestValue}% (${change > 0 ? "+" : ""}${change.toFixed(1)}pp), ${highDelqCUs.length} CUs already above 1.5x statewide delinquency`,
        detail: `Statewide delinquency rate is ${delqRate.toFixed(2)}%. ${highDelqCUs.length} CUs have delinquency rates above ${(delqRate * 1.5).toFixed(2)}%. Rising unemployment typically pressures these portfolios further.`,
        indicators: {
          unemployment: miur.latestValue,
          unemploymentChange: change,
          statewideDelinquency: delqRate,
          elevatedCUs: highDelqCUs.length,
        },
        sources: ["FRED:MIUR", "NCUA:delinquency"],
      });
    } else if (change < -0.1) {
      findings.push({
        type: "fred_x_ncua",
        severity: "OPPORTUNITY",
        headline: `Michigan unemployment improving at ${miur.latestValue}% (${change.toFixed(1)}pp). Positive signal for credit quality.`,
        detail: `Declining unemployment is a tailwind for credit quality. CUs with elevated delinquency may see improvement in coming quarters.`,
        indicators: {
          unemployment: miur.latestValue,
          unemploymentChange: change,
        },
        sources: ["FRED:MIUR", "NCUA:delinquency"],
      });
    } else {
      const severity: Severity = miur.latestValue >= 5.0 ? "WARNING" : "INFO";
      findings.push({
        type: "fred_x_ncua",
        severity,
        headline: `Michigan unemployment holding at ${miur.latestValue}% (YoY: ${yoyChange > 0 ? "+" : ""}${yoyChange.toFixed(1)}pp). ${highDelqCUs.length} CUs with elevated delinquency rates.`,
        detail: `Unemployment is stable at ${miur.latestValue}%. Statewide weighted delinquency rate: ${delqRate.toFixed(2)}%. ${highDelqCUs.length} CUs carry delinquency rates above ${(delqRate * 1.5).toFixed(2)}%.`,
        indicators: {
          unemployment: miur.latestValue,
          unemploymentChange: change,
          yoyChange,
          statewideDelinquency: delqRate,
          elevatedCUs: highDelqCUs.length,
        },
        sources: ["FRED:MIUR", "NCUA:delinquency"],
      });
    }
  }

  // Mortgage rates x CU lending
  const mortgage = fred["MORTGAGE30US"];
  if (mortgage) {
    const rateVal = mortgage.latestValue;
    const rateChange = mortgage.change;
    const yoyRateChange = mortgage.yoyChange ?? 0;
    const highLtsCUs = cuDetail.filter(
      (cu) => (cu.loanToShareRatio ?? 0) > 80
    );
    const totalLoans = sw.totalLoans ?? 0;

    if (rateChange < -0.1) {
      findings.push({
        type: "fred_x_ncua",
        severity: "OPPORTUNITY",
        headline: `30Y mortgage rate at ${rateVal}% (${rateChange.toFixed(2)}pp). Refi/origination opportunity for ${highLtsCUs.length} active-lending CUs.`,
        detail: `Mortgage rates dropped ${Math.abs(rateChange).toFixed(2)}pp. CUs with high loan-to-share ratios (>80%) are well-positioned to capture increased origination demand. Michigan CUs hold $${(totalLoans / 1e9).toFixed(1)}B in total loans.`,
        indicators: {
          mortgageRate: rateVal,
          rateChange,
          activeLendingCUs: highLtsCUs.length,
          totalLoans,
        },
        sources: ["FRED:MORTGAGE30US", "NCUA:loan_to_share"],
      });
    } else if (rateChange > 0.1) {
      const severity: Severity = rateChange > 0.25 ? "WARNING" : "INFO";
      findings.push({
        type: "fred_x_ncua",
        severity,
        headline: `30Y mortgage rate at ${rateVal}% (+${rateChange.toFixed(2)}pp week-over-week). Rising rates may slow originations.`,
        detail: `Mortgage rates increased ${rateChange.toFixed(2)}pp. ${highLtsCUs.length} CUs with loan-to-share >80% are most exposed to origination slowdown. YoY rate change: ${yoyRateChange > 0 ? "+" : ""}${yoyRateChange.toFixed(2)}pp.`,
        indicators: {
          mortgageRate: rateVal,
          rateChange,
          yoyChange: yoyRateChange,
          exposedCUs: highLtsCUs.length,
        },
        sources: ["FRED:MORTGAGE30US", "NCUA:loan_to_share"],
      });
    } else {
      findings.push({
        type: "fred_x_ncua",
        severity: "INFO",
        headline: `30Y mortgage rate stable at ${rateVal}% (YoY: ${yoyRateChange > 0 ? "+" : ""}${yoyRateChange.toFixed(2)}pp). ${highLtsCUs.length} CUs with active lending posture.`,
        detail: `Mortgage rates essentially flat this week. ${highLtsCUs.length} CUs maintain loan-to-share ratios above 80%. Michigan CUs hold $${(totalLoans / 1e9).toFixed(1)}B in total loans.`,
        indicators: {
          mortgageRate: rateVal,
          rateChange,
          yoyChange: yoyRateChange,
          activeLendingCUs: highLtsCUs.length,
        },
        sources: ["FRED:MORTGAGE30US", "NCUA:loan_to_share"],
      });
    }
  }

  // Consumer sentiment x deposit flows
  const sentiment = fred["UMCSENT"];
  if (sentiment) {
    const sentVal = sentiment.latestValue;
    const sentChange = sentiment.change;
    const yoySentChange = sentiment.yoyChange ?? 0;
    const totalDeposits = sw.totalDeposits ?? 0;

    if (sentChange < -3) {
      const severity: Severity = sentChange < -5 ? "WARNING" : "INFO";
      findings.push({
        type: "fred_x_ncua",
        severity,
        headline: `Consumer sentiment at ${sentVal.toFixed(1)} (${sentChange > 0 ? "+" : ""}${sentChange.toFixed(1)}), potential deposit flow risk for $${(totalDeposits / 1e9).toFixed(1)}B in Michigan CU deposits.`,
        detail: `Declining consumer sentiment typically precedes deposit outflows or slower deposit growth. Michigan CUs hold $${(totalDeposits / 1e9).toFixed(1)}B in deposits.`,
        indicators: {
          sentiment: sentVal,
          sentimentChange: sentChange,
          totalDeposits,
        },
        sources: ["FRED:UMCSENT", "NCUA:deposits"],
      });
    } else if (sentChange > 3) {
      findings.push({
        type: "fred_x_ncua",
        severity: "OPPORTUNITY",
        headline: `Consumer sentiment improving at ${sentVal.toFixed(1)} (+${sentChange.toFixed(1)}). Positive signal for $${(totalDeposits / 1e9).toFixed(1)}B in Michigan CU deposits.`,
        detail: `Rising consumer confidence supports deposit growth and loan demand. YoY sentiment change: ${yoySentChange > 0 ? "+" : ""}${yoySentChange.toFixed(1)} points.`,
        indicators: {
          sentiment: sentVal,
          sentimentChange: sentChange,
          yoyChange: yoySentChange,
          totalDeposits,
        },
        sources: ["FRED:UMCSENT", "NCUA:deposits"],
      });
    } else if (sentVal < 65) {
      findings.push({
        type: "fred_x_ncua",
        severity: "INFO",
        headline: `Consumer sentiment at ${sentVal.toFixed(1)} (below historical average). Caution for deposit and loan demand outlook.`,
        detail: `U of M Consumer Sentiment at ${sentVal.toFixed(1)} is below the long-run average (~85). Low confidence dampens consumer borrowing appetite and deposit inflows. Michigan CUs hold $${(totalDeposits / 1e9).toFixed(1)}B in deposits.`,
        indicators: {
          sentiment: sentVal,
          sentimentChange: sentChange,
          yoyChange: yoySentChange,
          totalDeposits,
        },
        sources: ["FRED:UMCSENT", "NCUA:deposits"],
      });
    }
  }

  // CPI x member purchasing power
  const cpi = fred["CPIAUCSL"];
  if (cpi) {
    const cpiYoy = cpi.yoyPctChange ?? 0;
    const totalMembers = sw.totalMembers ?? 0;

    if (Math.abs(cpiYoy) > 2.0) {
      const severity: Severity = cpiYoy > 4.0 ? "WARNING" : "INFO";
      findings.push({
        type: "fred_x_ncua",
        severity,
        headline: `CPI running at ${cpiYoy > 0 ? "+" : ""}${cpiYoy.toFixed(1)}% YoY. Inflation pressure on ${(totalMembers ?? 0).toLocaleString()} Michigan CU members.`,
        detail: `Consumer prices up ${cpiYoy.toFixed(1)}% year-over-year (CPI index: ${cpi.latestValue.toFixed(1)}). Elevated inflation erodes member purchasing power, potentially increasing demand for consumer lending while pressuring deposit growth.`,
        indicators: {
          cpiIndex: cpi.latestValue,
          cpiYoyPct: cpiYoy,
          cpiMomChange: cpi.change,
          totalMembers,
        },
        sources: ["FRED:CPIAUCSL", "NCUA:membership"],
      });
    }
  }

  // Fed Funds Rate x Net Worth
  const fedfunds = fred["FEDFUNDS"];
  if (fedfunds) {
    const ffVal = fedfunds.latestValue;
    const ffChange = fedfunds.change;
    const ffYoy = fedfunds.yoyChange ?? 0;
    const avgNw = sw.avgNetWorthRatio ?? 0;

    if (Math.abs(ffChange) >= 0.25) {
      const direction = ffChange > 0 ? "tightening" : "easing";
      const severity: Severity = ffChange > 0 ? "WARNING" : "OPPORTUNITY";
      findings.push({
        type: "fred_x_ncua",
        severity,
        headline: `Fed Funds at ${ffVal}% (${ffChange > 0 ? "+" : ""}${ffChange.toFixed(2)}pp). Monetary ${direction} impacts NIM across all tiers.`,
        detail: `Fed rate change of ${ffChange > 0 ? "+" : ""}${ffChange.toFixed(2)}pp affects net interest margins. Average statewide net worth ratio: ${avgNw.toFixed(0)} basis points.`,
        indicators: { fedFunds: ffVal, fedChange: ffChange, avgNwRatio: avgNw },
        sources: ["FRED:FEDFUNDS", "NCUA:net_worth"],
      });
    } else {
      findings.push({
        type: "fred_x_ncua",
        severity: "INFO",
        headline: `Fed Funds steady at ${ffVal}% (YoY: ${ffYoy > 0 ? "+" : ""}${ffYoy.toFixed(2)}pp). Rate environment stable for CU balance sheets.`,
        detail: `Fed Funds rate holding at ${ffVal}%. Year-over-year change: ${ffYoy > 0 ? "+" : ""}${ffYoy.toFixed(2)}pp. Stable rate environment reduces NIM volatility. Average statewide net worth ratio: ${avgNw.toFixed(0)} basis points.`,
        indicators: {
          fedFunds: ffVal,
          fedChange: ffChange,
          yoyChange: ffYoy,
          avgNwRatio: avgNw,
        },
        sources: ["FRED:FEDFUNDS", "NCUA:net_worth"],
      });
    }
  }

  return findings;
}

// ── CFPB x NCUA cross-references ───────────────────────────────────────────

function crossrefCfpbNcua(
  cfpb: CFPBData,
  cuDetail: CUDetail[]
): CrossRefFinding[] {
  const findings: CrossRefFinding[] = [];
  if (!cfpb || cuDetail.length === 0) return findings;

  // Build CU name lookup from cuDetail (normalized name -> detail)
  const cuByName: Record<string, CUDetail> = {};
  for (const cu of cuDetail) {
    const normalized = cu.cuName.toLowerCase().trim();
    cuByName[normalized] = cu;
  }

  for (const [company, info] of Object.entries(cfpb.byCompany)) {
    if (!info.ncuaMatch || info.count < 2) continue;

    // Try to find matching CU in detail data by normalized name
    const matchName = info.ncuaMatch.normalized;
    let cuMetrics: CUDetail | undefined;
    for (const cu of cuDetail) {
      const cuNorm = cu.cuName.toLowerCase().trim();
      if (
        cuNorm.includes(matchName) ||
        matchName.includes(cuNorm) ||
        cuNorm === matchName
      ) {
        cuMetrics = cu;
        break;
      }
    }

    if (!cuMetrics) continue;

    const delq = cuMetrics.delinquencyRate ?? 0;
    const nwRatio = cuMetrics.netWorthRatio ?? 0;
    const assets = cuMetrics.totalAssets ?? 0;

    const stressSignals: string[] = [];
    if (delq > 1.0) stressSignals.push(`elevated delinquency (${delq.toFixed(2)}%)`);
    if (nwRatio < 700) stressSignals.push(`low net worth ratio (${nwRatio.toFixed(0)} bps)`);

    const severity: Severity = stressSignals.length > 0 ? "WARNING" : "INFO";
    const topIssues = Object.keys(info.issues).slice(0, 3);

    let detail = `${info.count} CFPB complaints in last 90 days. Top issues: ${topIssues.join(", ")}.`;
    if (stressSignals.length > 0) {
      detail += ` Financial stress signals: ${stressSignals.join(", ")}.`;
    }

    findings.push({
      type: "cfpb_x_ncua",
      severity,
      headline: `${info.ncuaMatch.name} (${cuMetrics.city ?? "Michigan"}): ${info.count} complaints with ${stressSignals.length > 0 ? "financial stress signals" : "stable financials"}`,
      detail,
      indicators: {
        complaints90d: info.count,
        delinquencyRate: delq,
        netWorthRatio: nwRatio,
        totalAssets: assets,
        topIssues,
      },
      sources: ["CFPB:complaints", "NCUA:financials"],
    });
  }

  return findings;
}

// ── Zillow x NCUA cross-references ─────────────────────────────────────────

function crossrefZillowNcua(
  zillow: ZillowData,
  cuDetail: CUDetail[]
): CrossRefFinding[] {
  const findings: CrossRefFinding[] = [];
  if (!zillow || cuDetail.length === 0) return findings;

  const zhvi = zillow.zhvi;
  if (zhvi.length === 0) return findings;

  // Build MSA -> aggregated CU data
  const msaCUCount: Record<string, number> = {};
  const msaCUAssets: Record<string, number> = {};
  const msaCULoans: Record<string, number> = {};

  for (const cu of cuDetail) {
    const msa = cityToMSA(cu.city);
    if (!msa) continue;

    msaCUCount[msa] = (msaCUCount[msa] ?? 0) + 1;
    msaCUAssets[msa] = (msaCUAssets[msa] ?? 0) + (cu.totalAssets ?? 0);
    msaCULoans[msa] = (msaCULoans[msa] ?? 0) + (cu.totalLoans ?? 0);
  }

  // Match Zillow MSA names to our lookup
  for (const hvData of zhvi) {
    const momPct = hvData.momPctChange ?? 0;
    const yoyPct = hvData.yoyPctChange ?? 0;
    const latestVal = hvData.latestValue;
    const msaName = hvData.region;

    // Fuzzy match MSA names
    let matchedMSA: string | null = null;
    const msaNameLower = msaName.toLowerCase();

    for (const msaKey of Object.keys(msaCUCount)) {
      const msaKeyLower = msaKey.toLowerCase();
      const firstCity = msaKeyLower.split(",")[0].split("-")[0].trim();
      const zilFirstCity = msaNameLower.split(",")[0].split("-")[0].trim();

      if (
        msaNameLower.includes(firstCity) ||
        msaKeyLower.includes(zilFirstCity)
      ) {
        matchedMSA = msaKey;
        break;
      }
    }

    const cuCount = matchedMSA ? (msaCUCount[matchedMSA] ?? 0) : 0;
    const cuLoans = matchedMSA ? (msaCULoans[matchedMSA] ?? 0) : 0;
    const cuAssets = matchedMSA ? (msaCUAssets[matchedMSA] ?? 0) : 0;

    if (cuCount === 0) continue;

    if (momPct < -0.5 || yoyPct < -2.0) {
      findings.push({
        type: "zillow_x_ncua",
        severity: "WARNING",
        headline: `${msaName}: Home values weakening (MoM: ${momPct > 0 ? "+" : ""}${momPct.toFixed(1)}%, YoY: ${yoyPct > 0 ? "+" : ""}${yoyPct.toFixed(1)}%), ${cuCount} CUs with $${(cuLoans / 1e9).toFixed(1)}B in loans exposed.`,
        detail: `Median home value in ${msaName} is $${(latestVal ?? 0).toLocaleString()}. ${cuCount} credit unions headquartered in this MSA hold $${(cuLoans / 1e9).toFixed(1)}B in total loans. Declining home values increase collateral risk on mortgage and HELOC portfolios.`,
        indicators: {
          msa: msaName,
          homeValue: latestVal,
          momPctChange: momPct,
          yoyPctChange: yoyPct,
          cuCount,
          cuTotalLoans: cuLoans,
          cuTotalAssets: cuAssets,
        },
        sources: ["Zillow:ZHVI", "NCUA:geography"],
      });
    } else if (momPct > 1.0 || yoyPct > 5.0) {
      findings.push({
        type: "zillow_x_ncua",
        severity: "OPPORTUNITY",
        headline: `${msaName}: Home values appreciating (MoM: +${momPct.toFixed(1)}%, YoY: +${yoyPct.toFixed(1)}%), positive for ${cuCount} CU collateral positions.`,
        detail: `Median home value in ${msaName} is $${(latestVal ?? 0).toLocaleString()}. Appreciating values strengthen collateral on $${(cuLoans / 1e9).toFixed(1)}B in CU loans.`,
        indicators: {
          msa: msaName,
          homeValue: latestVal,
          momPctChange: momPct,
          yoyPctChange: yoyPct,
          cuCount,
          cuTotalLoans: cuLoans,
        },
        sources: ["Zillow:ZHVI", "NCUA:geography"],
      });
    }
  }

  // Inventory flags
  for (const r of zillow.inventory) {
    const momPct = r.momPctChange ?? 0;
    if (Math.abs(momPct) > 20) {
      const direction = momPct > 0 ? "surging" : "plunging";
      findings.push({
        type: "zillow_x_ncua",
        severity: "INFO",
        headline: `${r.region}: Housing inventory ${direction} (${momPct > 0 ? "+" : ""}${momPct.toFixed(1)}% MoM). Monitor for market cooling/heating signals.`,
        detail: `Current inventory: ${(r.latestValue ?? 0).toLocaleString()} listings. Significant inventory changes are leading indicators for home values.`,
        indicators: {
          msa: r.region,
          inventory: r.latestValue,
          momPctChange: momPct,
        },
        sources: ["Zillow:Inventory"],
      });
    }
  }

  return findings;
}

// ── Public API ──────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
  OPPORTUNITY: 3,
};

/**
 * Generate cross-reference findings from all daily data sources against
 * the quarterly NCUA baseline.
 *
 * @param fred - FRED economic indicators (keyed by series ID)
 * @param cfpb - CFPB complaint data
 * @param zillow - Zillow housing data
 * @param quarterly - NCUA quarterly baseline
 * @param cuDetail - Per-CU detail records (optional, enables deeper cross-refs)
 */
export function generateCrossReferences(
  fred: Record<string, FREDSeries>,
  cfpb: CFPBData,
  zillow: ZillowData,
  quarterly: QuarterlyData,
  cuDetail: CUDetail[] = []
): CrossRefFinding[] {
  const allFindings: CrossRefFinding[] = [];

  // FRED x NCUA
  allFindings.push(...crossrefFredNcua(fred, quarterly, cuDetail));

  // CFPB x NCUA
  allFindings.push(...crossrefCfpbNcua(cfpb, cuDetail));

  // Zillow x NCUA
  allFindings.push(...crossrefZillowNcua(zillow, cuDetail));

  // Sort by severity
  allFindings.sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
  );

  return allFindings;
}
