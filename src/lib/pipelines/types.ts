/**
 * Shared TypeScript types for the MCUL Scanner data pipelines.
 * Covers NCUA quarterly data, daily market pulse, verification, and analysis.
 */

// NCUA CU metrics for a single credit union in a single quarter
export interface CUMetrics {
  cuNumber: number;
  city: string;
  tier: string;
  totalAssets: number;
  totalLoans: number;
  totalDeposits: number;
  currentMembers: number;
  netIncome: number;
  loansGrantedYtd: number;
  delinquent2Plus: number;
  provisionLoanLosses: number;
  allowanceLoanLosses: number;
  netWorth: number;
  netWorthRatio: number; // in basis points (1278 = 12.78%)
  loanToShareRatio: number; // percentage
  delinquencyRate: number; // percentage (0.85 = 0.85%)
  coverageRatio: number; // percentage
}

// Statewide aggregate metrics
export interface StatewideMetrics {
  totalCUs: number;
  totalAssets: number;
  totalLoans: number;
  totalDeposits: number;
  totalMembers: number;
  totalNetIncome: number;
  avgNetWorthRatio: number;
  medianNetWorthRatio: number;
  avgDelinquencyRate: number;
  medianDelinquencyRate: number;
  avgLoanToShare: number;
  totalDelinquent: number;
  weightedDelinquencyRate: number;
}

// Tier breakdown
export interface TierMetrics {
  cuCount: number;
  totalAssets: number;
  totalMembers: number;
  avgNetWorthRatio: number;
  avgDelinquencyRate: number;
  avgLoanToShare: number;
  totalNetIncome: number;
  medianAssets: number;
}

// Quarter data
export interface QuarterData {
  label: string; // "Q1 2025"
  date: string; // "2025-03"
  statewide: StatewideMetrics;
  tiers: Record<string, TierMetrics>;
}

// Anomaly
export interface Anomaly {
  severity: "CRITICAL" | "WARNING" | "INFO";
  category: string;
  headline: string;
  currentValue: number;
  previousValue: number;
  metric: string;
  detail: string;
  valuesByQuarter?: Record<string, number>;
}

// Full quarterly data output
export interface QuarterlyData {
  generatedAt: string;
  state: string;
  quartersAnalyzed: number;
  quarters: QuarterData[];
  anomalies: Anomaly[];
}

// Analysis sections (AI-generated narratives)
export interface AnalysisSections {
  statewideOverview: string;
  anomalyNarratives: Array<{
    headline: string;
    severity: string;
    category: string;
    narrative: string;
    watchItems: string[];
  }>;
  tierHealthSummary: {
    tiers: Array<{
      tierName: string;
      status: "strengthening" | "weakening" | "stable" | "mixed";
      summary: string;
    }>;
    synthesis: string;
  };
  emergingTrends: Array<{
    trendName: string;
    direction: "rising" | "falling" | "accelerating" | "decelerating" | "stable";
    evidence: string;
    implication: string;
  }>;
  riskConcentrations: Array<{
    riskName: string;
    severity: "high" | "moderate" | "low";
    evidence: string;
    implication: string;
  }>;
  summaryInsight: string;
}

export interface AnalysisOutput {
  generatedAt: string;
  model: string;
  dataSource: string;
  sections: AnalysisSections;
}

// Verification
export interface VerificationCheck {
  check: string;
  passed: boolean;
  detail?: string;
  [key: string]: unknown;
}

export interface VerificationLayer {
  layer: string;
  passed: boolean;
  checksPassed: number;
  checksTotal: number;
  checks: VerificationCheck[];
}

export interface VerificationReport {
  verifiedAt: string;
  overallPassed: boolean;
  totalChecks: number;
  passedChecks: number;
  layers: VerificationLayer[];
}

// FRED data
export interface FREDObservation {
  date: string;
  value: number;
}

export interface FREDSeries {
  name: string;
  frequency: string;
  unit: string;
  observations: FREDObservation[];
  latestDate: string;
  latestValue: number;
  previousDate: string;
  previousValue: number;
  change: number;
  pctChange: number;
  yearAgoDate?: string;
  yearAgoValue?: number;
  yoyChange?: number;
  yoyPctChange?: number;
  significant: boolean;
  flag?: string;
}

// CFPB
export interface CFPBComplaint {
  complaintId: string | null;
  dateReceived: string | null;
  product: string | null;
  subProduct: string | null;
  issue: string | null;
  subIssue: string | null;
  company: string | null;
  companyResponse: string | null;
  zipCode: string | null;
  timely: string | null;
}

export interface CFPBData {
  total: number;
  periodStart: string;
  periodEnd: string;
  counts30d: number;
  counts60d: number;
  counts90d: number;
  byCompany: Record<string, CFPBCompanyInfo>;
  byProduct: Record<string, number>;
  byIssue: Record<string, number>;
  sampleComplaints: CFPBComplaint[];
}

// Zillow (canonical shape used by zillow.ts pipeline)
export interface ZillowData {
  zhvi: ZillowMSARecord[];
  inventory: ZillowMSARecord[];
  flags: ZillowFlag[];
  warnings: string[];
}

// Daily data
export interface DailyData {
  generatedAt: string;
  sources: {
    fred: Record<string, FREDSeries>;
    cfpb: CFPBData;
    zillow: ZillowData;
  };
}

// Cross-reference finding
export interface CrossRefFinding {
  type: string;
  severity: "CRITICAL" | "WARNING" | "INFO" | "OPPORTUNITY";
  headline: string;
  detail: string;
  indicators: Record<string, unknown>;
  sources: string[];
}

export interface DailyCrossRef {
  generatedAt: string;
  totalFindings: number;
  bySeverity: Record<string, number>;
  findings: CrossRefFinding[];
}

// Tier definitions
export const TIERS = [
  { name: "Tier 1: Anchor (>$5B)", threshold: 5_000_000_000 },
  { name: "Tier 2: Large ($1B-$5B)", threshold: 1_000_000_000 },
  { name: "Tier 3: Mid-Large ($500M-$1B)", threshold: 500_000_000 },
  { name: "Tier 4: Mid-Size ($100M-$500M)", threshold: 100_000_000 },
  { name: "Tier 5: Community (<$100M)", threshold: 0 },
] as const;

// NCUA field mappings
export const NCUA_FIELDS = {
  ACCT_010: "totalAssets",
  ACCT_025B: "totalLoans",
  ACCT_025A: "totalLoanCount",
  ACCT_018: "totalDeposits",
  ACCT_083: "currentMembers",
  ACCT_084: "potentialMembers",
  ACCT_031B: "loansGrantedYtd",
  ACCT_041B: "delinquent2Plus",
  ACCT_020B: "delinquent1to2Months",
  ACCT_021B: "delinquent2to6Months",
  ACCT_022B: "delinquent6to12Months",
  ACCT_300: "provisionLoanLosses",
  ACCT_719: "allowanceLoanLosses",
  ACCT_602: "netIncome",
} as const;

export const NCUA_FIELDS_A = {
  ACCT_997: "netWorth",
  ACCT_998: "netWorthRatio",
} as const;

// NCUA quarter URLs
export const NCUA_QUARTERS = [
  { label: "Q1 2025", date: "2025-03", url: "https://www.ncua.gov/files/publications/analysis/call-report-data-2025-03.zip" },
  { label: "Q2 2025", date: "2025-06", url: "https://www.ncua.gov/files/publications/analysis/call-report-data-2025-06.zip" },
  { label: "Q3 2025", date: "2025-09", url: "https://www.ncua.gov/files/publications/analysis/call-report-data-2025-09.zip" },
  { label: "Q4 2025", date: "2025-12", url: "https://www.ncua.gov/files/publications/analysis/call-report-data-2025-12.zip" },
] as const;

// ── Compatibility types for existing pipeline modules ──────────────────────

// Used by fred.ts
export interface FREDSeriesConfig {
  readonly id: string;
  readonly name: string;
  readonly frequency: "weekly" | "monthly";
  readonly unit: string;
  readonly threshold: number;
}

// Used by cfpb.ts
export interface CFPBCompanyInfo {
  count: number;
  products: Record<string, number>;
  issues: Record<string, number>;
  ncuaMatch: { name: string; normalized: string } | null;
}

// Used by zillow.ts
export type Severity = "CRITICAL" | "WARNING" | "INFO" | "OPPORTUNITY";

export interface ZillowMSARecord {
  region: string;
  latestDate: string;
  latestValue: number;
  prevMonthValue?: number;
  momChange?: number;
  momPctChange?: number;
  threeMonthChange?: number;
  threeMonthPctChange?: number;
  yoyChange?: number;
  yoyPctChange?: number;
}

export interface ZillowFlag {
  source: string;
  region: string;
  flag: string;
  severity: Severity;
  value: number;
}

// Used by crossref.ts (lighter version of CUMetrics for cross-referencing)
export interface CUDetail {
  cuNumber: number;
  cuName: string;
  city?: string;
  totalAssets?: number;
  totalLoans?: number;
  delinquencyRate?: number;
  netWorthRatio?: number;
  loanToShareRatio?: number;
}
