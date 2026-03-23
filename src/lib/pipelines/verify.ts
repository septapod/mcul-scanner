/**
 * Three-Layer Verification Pipeline
 * Guarantees accuracy at data collection, analysis, and presentation layers.
 *
 * Ported from Python: daily_verify.py
 */

import type {
  DailyData,
  DailyCrossRef,
  QuarterlyData,
  VerificationReport,
  VerificationLayer,
  VerificationCheck,
  CrossRefFinding,
} from "./types";

// ── Inflammatory language blocklist ──────────────────────────────────────────

const INFLAMMATORY_TERMS = [
  "crisis",
  "catastrophe",
  "collapse",
  "disaster",
  "failing",
  "doomed",
  "worst",
  "terrible",
  "alarming",
  "dire",
  "panic",
  "plummet",
  "crash",
  "hemorrhaging",
  "devastating",
];

// ── Tone classification keywords ─────────────────────────────────────────────

const POSITIVE_KEYWORDS = [
  "opportunity",
  "growth",
  "strong",
  "stable",
  "improving",
  "positive",
  "increased",
  "gain",
  "appreciating",
  "healthy",
];

const NEGATIVE_KEYWORDS = [
  "risk",
  "warning",
  "decline",
  "loss",
  "concern",
  "pressure",
  "stress",
  "vulnerability",
  "exposed",
  "elevated",
];

const ACTIONABLE_KEYWORDS = [
  "opportunity",
  "position",
  "consider",
  "monitor",
  "prepare",
  "advantage",
  "capture",
  "adjust",
  "plan",
];

// ── Layer 1: Data Collection Verification ────────────────────────────────────

function verifyDataCollection(dailyData: DailyData | null): VerificationLayer {
  const checks: VerificationCheck[] = [];

  if (!dailyData) {
    return {
      layer: "data_collection",
      passed: false,
      checksPassed: 0,
      checksTotal: 1,
      checks: [
        {
          check: "Daily data exists",
          passed: false,
          detail: "No daily data provided",
        },
      ],
    };
  }

  const { fred, cfpb, zillow } = dailyData.sources;

  // FRED: verify values are non-null and in plausible ranges
  if (fred && Object.keys(fred).length > 0) {
    for (const [seriesId, series] of Object.entries(fred)) {
      const hasValue =
        series.latestValue !== null && series.latestValue !== undefined;
      checks.push({
        check: `FRED ${seriesId} has data`,
        passed: hasValue,
        detail: hasValue
          ? `Latest value: ${series.latestValue} (${series.latestDate})`
          : "No latest value in stored data",
      });
    }
  }

  // CFPB: verify complaint count > 0 and company names present
  if (cfpb) {
    const hasComplaints = cfpb.total > 0;
    checks.push({
      check: "CFPB has complaint data",
      passed: hasComplaints,
      detail: hasComplaints
        ? `${cfpb.total} total complaints`
        : "No complaints found",
    });

    const hasCompanies =
      cfpb.byCompany && Object.keys(cfpb.byCompany).length > 0;
    checks.push({
      check: "CFPB has company names",
      passed: !!hasCompanies,
      detail: hasCompanies
        ? `${Object.keys(cfpb.byCompany).length} companies`
        : "No company data",
    });
  }

  // Zillow: verify home values in $80K-$800K range, MoM changes < 5%
  if (zillow && zillow.zhvi && zillow.zhvi.length > 0) {
    const values = zillow.zhvi
      .map((m) => m.latestValue)
      .filter((v) => v > 0);

    if (values.length > 0) {
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const rangeOk = minVal > 80_000 && maxVal < 800_000;
      checks.push({
        check: "Zillow home values in plausible Michigan range ($80K-$800K)",
        passed: rangeOk,
        detail: `Range: $${(minVal ?? 0).toLocaleString()}-$${(maxVal ?? 0).toLocaleString()} across ${zillow.zhvi.length} MSAs`,
        minValue: minVal,
        maxValue: maxVal,
      });
    }

    const momChanges = zillow.zhvi
      .map((m) => Math.abs(m.momPctChange ?? 0))
      .filter((v) => v > 0);

    if (momChanges.length > 0) {
      const maxMom = Math.max(...momChanges);
      const momOk = maxMom < 5.0;
      checks.push({
        check: "Zillow MoM changes plausible (no >5% monthly swings)",
        passed: momOk,
        detail: `Max MoM change: ${maxMom.toFixed(2)}%`,
        maxMomChange: maxMom,
      });
    }
  }

  const passedCount = checks.filter((c) => c.passed).length;

  return {
    layer: "data_collection",
    passed: checks.length > 0 && checks.every((c) => c.passed),
    checksPassed: passedCount,
    checksTotal: checks.length,
    checks,
  };
}

// ── Layer 2: Analysis Verification ───────────────────────────────────────────

function verifyAnalysis(
  crossref: DailyCrossRef | null,
  quarterly: QuarterlyData | null,
  dailyData: DailyData | null
): VerificationLayer {
  const checks: VerificationCheck[] = [];

  if (!crossref) {
    return {
      layer: "analysis",
      passed: true,
      checksPassed: 0,
      checksTotal: 0,
      checks: [],
    };
  }

  const findings = crossref.findings;

  // 2a. Verify every finding has valid source attribution or substance
  const validTypes = new Set([
    "fred_indicator",
    "cfpb_alert",
    "zillow_housing",
    "fred_ncua_crossref",
    "cfpb_ncua_crossref",
    "zillow_ncua_crossref",
    "fred_x_ncua",
    "cfpb_x_ncua",
    "zillow_x_ncua",
    "economic",
    "complaint",
    "housing",
    "crossref",
  ]);
  const validSourcesList = new Set([
    "FRED",
    "CFPB",
    "Zillow",
    "NCUA",
    "FRED+NCUA",
    "CFPB+NCUA",
    "Zillow+NCUA",
    "FRED x NCUA",
    "CFPB x NCUA",
    "Zillow x NCUA",
  ]);

  for (let i = 0; i < findings.length; i++) {
    const finding = findings[i];
    const typeValid =
      validTypes.has(finding.type.toLowerCase()) ||
      finding.sources.some((s) => validSourcesList.has(s));
    const hasSubstance = !!finding.headline && !!finding.detail;
    const passed = typeValid || hasSubstance;

    checks.push({
      check: `Finding ${i + 1} has valid attribution or substance`,
      passed,
      findingHeadline: finding.headline.slice(0, 80),
      type: finding.type,
      sources: finding.sources,
    });
  }

  // 2b. Verify NCUA CU count is in plausible range (150-250)
  if (quarterly && quarterly.quarters.length > 0) {
    const latestQuarter = quarterly.quarters[quarterly.quarters.length - 1];
    const cuCount = latestQuarter.statewide.totalCUs;
    const cuCountOk = cuCount >= 150 && cuCount <= 250;
    checks.push({
      check: `NCUA CU count in plausible range (got ${cuCount})`,
      passed: cuCountOk,
      value: cuCount,
    });
  }

  // 2c. Verify no findings reference nonexistent data
  if (dailyData) {
    const { fred, cfpb, zillow } = dailyData.sources;
    const hasFred = fred && Object.keys(fred).length > 0;
    const hasCfpb =
      cfpb && (cfpb.total > 0 || Object.keys(cfpb.byCompany).length > 0);
    const hasZillow = zillow && zillow.zhvi && zillow.zhvi.length > 0;

    for (const finding of findings) {
      const sourceStr = finding.sources.join(" ");
      if (sourceStr.includes("FRED") && !hasFred) {
        checks.push({
          check: "Finding references FRED but no FRED data available",
          passed: false,
          finding: finding.headline,
        });
      }
      if (sourceStr.includes("CFPB") && !hasCfpb) {
        checks.push({
          check: "Finding references CFPB but no CFPB data available",
          passed: false,
          finding: finding.headline,
        });
      }
      if (sourceStr.includes("Zillow") && !hasZillow) {
        checks.push({
          check: "Finding references Zillow but no Zillow data available",
          passed: false,
          finding: finding.headline,
        });
      }
    }
  }

  const passedCount = checks.filter((c) => c.passed).length;

  return {
    layer: "analysis",
    passed: checks.length === 0 || checks.every((c) => c.passed),
    checksPassed: passedCount,
    checksTotal: checks.length,
    checks,
  };
}

// ── Layer 3: Presentation Verification ───────────────────────────────────────

function verifyPresentation(
  crossref: DailyCrossRef | null,
  dailyData: DailyData | null
): VerificationLayer {
  const checks: VerificationCheck[] = [];

  // 3a. Tone balance on cross-reference findings
  if (crossref && crossref.findings.length > 0) {
    const findings = crossref.findings;
    const total = findings.length;

    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    for (const finding of findings) {
      const text = `${finding.headline} ${finding.detail}`.toLowerCase();
      const hasPositive = POSITIVE_KEYWORDS.some((kw) => text.includes(kw));
      const hasNegative = NEGATIVE_KEYWORDS.some((kw) => text.includes(kw));

      if (hasPositive && !hasNegative) {
        positiveCount++;
      } else if (hasNegative && !hasPositive) {
        negativeCount++;
      } else {
        neutralCount++;
      }
    }

    const negativePct = total > 0 ? (negativeCount / total) * 100 : 0;
    const balanceOk = negativePct <= 60;
    checks.push({
      check: "Tone balance: negative findings <=60% of total",
      passed: balanceOk,
      positive: positiveCount,
      negative: negativeCount,
      neutral: neutralCount,
      total,
      negativePct: Math.round(negativePct * 10) / 10,
      detail: `${positiveCount} positive, ${negativeCount} negative, ${neutralCount} neutral/mixed (${negativePct.toFixed(0)}% negative)`,
    });

    // 3b. No inflammatory language
    const inflammatoryFound: Array<{ term: string; finding: string }> = [];
    for (const finding of findings) {
      const text = `${finding.headline} ${finding.detail}`.toLowerCase();
      for (const term of INFLAMMATORY_TERMS) {
        if (text.includes(term)) {
          inflammatoryFound.push({
            term,
            finding: finding.headline.slice(0, 60),
          });
        }
      }
    }

    checks.push({
      check: "No inflammatory or alarmist language",
      passed: inflammatoryFound.length === 0,
      flaggedTerms: inflammatoryFound.length > 0 ? inflammatoryFound : "None",
      detail:
        inflammatoryFound.length > 0
          ? `Found ${inflammatoryFound.length} inflammatory terms`
          : "Clean",
    });

    // 3c. Actionable framing >= 30%
    let actionableCount = 0;
    for (const finding of findings) {
      const text = `${finding.headline} ${finding.detail}`.toLowerCase();
      if (ACTIONABLE_KEYWORDS.some((kw) => text.includes(kw))) {
        actionableCount++;
      }
    }

    const actionablePct = total > 0 ? (actionableCount / total) * 100 : 0;
    checks.push({
      check: "At least 30% of findings use actionable framing",
      passed: actionablePct >= 30,
      actionableCount,
      total,
      actionablePct: Math.round(actionablePct * 10) / 10,
      detail: `${actionableCount}/${total} findings have actionable framing (${actionablePct.toFixed(0)}%)`,
    });

    // 3d. Severity distribution: max 2 CRITICAL
    const severities = findings.map((f) => f.severity);
    const criticalCount = severities.filter((s) => s === "CRITICAL").length;
    const warningCount = severities.filter((s) => s === "WARNING").length;
    const infoCount = severities.filter((s) => s === "INFO").length;
    const opportunityCount = severities.filter(
      (s) => s === "OPPORTUNITY"
    ).length;

    checks.push({
      check: "No more than 2 CRITICAL severity findings",
      passed: criticalCount <= 2,
      critical: criticalCount,
      warning: warningCount,
      info: infoCount,
      opportunity: opportunityCount,
      detail: `CRITICAL=${criticalCount}, WARNING=${warningCount}, INFO=${infoCount}, OPPORTUNITY=${opportunityCount}`,
    });
  }

  // 3e. At least 2 of 3 data sources present
  if (dailyData) {
    const { fred, cfpb, zillow } = dailyData.sources;
    const sourcesPresent: string[] = [];

    if (fred && Object.keys(fred).length > 0) sourcesPresent.push("FRED");
    if (cfpb && (cfpb.total > 0 || Object.keys(cfpb.byCompany).length > 0))
      sourcesPresent.push("CFPB");
    if (zillow && zillow.zhvi && zillow.zhvi.length > 0)
      sourcesPresent.push("Zillow");

    checks.push({
      check: "At least 2 of 3 data sources have data",
      passed: sourcesPresent.length >= 2,
      sourcesWithData: sourcesPresent,
      detail: `Sources with data: ${sourcesPresent.join(", ")}`,
    });
  }

  const passedCount = checks.filter((c) => c.passed).length;

  return {
    layer: "presentation",
    passed: checks.length === 0 || checks.every((c) => c.passed),
    checksPassed: passedCount,
    checksTotal: checks.length,
    checks,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the three-layer verification pipeline.
 *
 * Layer 1: Data Collection (values non-null, plausible ranges)
 * Layer 2: Analysis (valid source attribution, NCUA counts, no phantom data)
 * Layer 3: Presentation (tone balance, no inflammatory language, actionable framing)
 */
export async function runVerification(
  dailyData: DailyData | null,
  crossref: DailyCrossRef | null,
  quarterly: QuarterlyData | null
): Promise<VerificationReport> {
  console.log("Running three-layer verification pipeline...");

  const layer1 = verifyDataCollection(dailyData);
  console.log(
    `  Layer 1 (Data Collection): ${layer1.checksPassed}/${layer1.checksTotal} passed`
  );

  const layer2 = verifyAnalysis(crossref, quarterly, dailyData);
  console.log(
    `  Layer 2 (Analysis): ${layer2.checksPassed}/${layer2.checksTotal} passed`
  );

  const layer3 = verifyPresentation(crossref, dailyData);
  console.log(
    `  Layer 3 (Presentation): ${layer3.checksPassed}/${layer3.checksTotal} passed`
  );

  const layers = [layer1, layer2, layer3];
  const totalChecks = layers.reduce((sum, l) => sum + l.checksTotal, 0);
  const passedChecks = layers.reduce((sum, l) => sum + l.checksPassed, 0);
  const overallPassed = layers.every((l) => l.passed);

  console.log(
    `  Overall: ${passedChecks}/${totalChecks} checks passed. ${overallPassed ? "PASS" : "FAIL"}`
  );

  return {
    verifiedAt: new Date().toISOString(),
    overallPassed,
    totalChecks,
    passedChecks,
    layers,
  };
}
