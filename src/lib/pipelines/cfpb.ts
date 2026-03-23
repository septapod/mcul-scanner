/**
 * CFPB Consumer Complaints Pipeline
 * Fetches Michigan credit union complaints and aggregates by company, product, issue.
 */

import type { CFPBData, CFPBComplaint, CFPBCompanyInfo } from "./types";

const CFPB_API_URL =
  "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/";

/**
 * Top 20 Michigan credit union names for fuzzy matching against CFPB company names.
 * Sourced from NCUA data. Used to link complaints back to known CUs.
 */
const MI_CU_NAMES = [
  "LAKE MICHIGAN",
  "MSU FEDERAL",
  "DFCU FINANCIAL",
  "ADVIA",
  "LAKE TRUST",
  "CONSUMERS",
  "DOW",
  "DORT FINANCIAL",
  "COMMUNITY CHOICE",
  "CREDIT UNION ONE",
  "GENISYS",
  "MICHIGAN STATE UNIVERSITY FEDERAL",
  "UNITED FEDERAL",
  "MICHIGAN FIRST",
  "AMERICAN 1",
  "HONOR",
  "KELLOGG",
  "CHEMICAL FEDERAL",
  "NORTHLAND AREA FEDERAL",
  "EDUCATIONAL COMMUNITY",
] as const;

/**
 * Normalize a credit union name for comparison.
 * Strips "credit union", "federal credit union", "fcu", punctuation, extra whitespace.
 */
function normalizeCUName(name: string): string {
  let n = name.toLowerCase().trim();
  for (const suffix of [
    "federal credit union",
    "credit union",
    "fcu",
    "cu",
    "f.c.u.",
    "c.u.",
  ]) {
    n = n.replace(new RegExp(suffix, "g"), "");
  }
  n = n.replace(/[^\w\s]/g, "");
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

/**
 * Try to match a CFPB company name to one of our known MI CU names.
 * Returns the matched CU name or null.
 */
function matchCompanyToCU(
  cfpbCompany: string
): { name: string; normalized: string } | null {
  const normalizedCfpb = normalizeCUName(cfpbCompany);
  if (!normalizedCfpb) return null;

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const cuName of MI_CU_NAMES) {
    const normalizedCU = normalizeCUName(cuName);
    if (!normalizedCU) continue;

    // Exact match after normalization
    if (normalizedCfpb === normalizedCU) {
      return { name: cuName, normalized: normalizedCU };
    }

    // Substring containment
    if (
      normalizedCfpb.includes(normalizedCU) ||
      normalizedCU.includes(normalizedCfpb)
    ) {
      const score =
        Math.min(normalizedCfpb.length, normalizedCU.length) /
        Math.max(normalizedCfpb.length, normalizedCU.length);
      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = cuName;
      }
    }

    // Word overlap
    const cfpbWords = new Set(normalizedCfpb.split(" "));
    const cuWords = new Set(normalizedCU.split(" "));
    const intersection = [...cfpbWords].filter((w) => cuWords.has(w));
    const overlap =
      intersection.length / Math.max(cfpbWords.size, cuWords.size);
    if (overlap > bestScore && overlap > 0.5) {
      bestScore = overlap;
      bestMatch = cuName;
    }
  }

  if (bestMatch) {
    return { name: bestMatch, normalized: normalizeCUName(bestMatch) };
  }
  return null;
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetch Michigan credit union complaints from the CFPB API.
 * @param daysBack Number of days to look back (default 90).
 */
export async function fetchCFPBComplaints(
  daysBack: number = 90
): Promise<CFPBData> {
  const startDate = daysAgoISO(daysBack);

  const params = new URLSearchParams({
    state: "MI",
    search_term: "credit union",
    field: "company",
    date_received_min: startDate,
    size: "1000",
    format: "json",
    no_aggs: "true",
  });

  const emptyResult: CFPBData = {
    total: 0,
    totalMichiganCUs: 0,
    periodStart: startDate,
    periodEnd: todayISO(),
    counts30d: 0,
    counts60d: 0,
    counts90d: 0,
    byCompany: {},
    byProduct: {},
    byIssue: {},
    sampleComplaints: [],
  };

  let data: unknown;
  try {
    const resp = await fetch(`${CFPB_API_URL}?${params.toString()}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) MichiganCUScanner/1.0",
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      console.error(`[CFPB] API returned ${resp.status}`);
      return emptyResult;
    }

    data = await resp.json();
  } catch (err) {
    console.error("[CFPB] Fetch error:", err);
    return emptyResult;
  }

  // Parse Elasticsearch envelope: hits.hits[]._source
  let hits: Array<{ _source?: Record<string, unknown> }> = [];
  if (Array.isArray(data)) {
    hits = data;
  } else if (data && typeof data === "object") {
    const envelope = data as Record<string, unknown>;
    const nested = envelope.hits;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const nestedObj = nested as Record<string, unknown>;
      hits = Array.isArray(nestedObj.hits) ? nestedObj.hits : [];
    } else if (Array.isArray(nested)) {
      hits = nested;
    }
  }

  // Parse individual complaints
  const complaints: CFPBComplaint[] = hits.map((hit) => {
    const s = hit._source ?? {};
    return {
      complaintId: (s.complaint_id as string) ?? null,
      dateReceived: (s.date_received as string) ?? null,
      product: (s.product as string) ?? null,
      subProduct: (s.sub_product as string) ?? null,
      issue: (s.issue as string) ?? null,
      subIssue: (s.sub_issue as string) ?? null,
      company: (s.company as string) ?? null,
      companyResponse: (s.company_response as string) ?? null,
      zipCode: (s.zip_code as string) ?? null,
      timely: (s.timely as string) ?? null,
    };
  });

  if (complaints.length === 0) {
    return emptyResult;
  }

  // Aggregate by company
  const byCompany: Record<string, CFPBCompanyInfo> = {};
  for (const c of complaints) {
    const company = c.company ?? "Unknown";
    if (!byCompany[company]) {
      byCompany[company] = {
        count: 0,
        products: {},
        issues: {},
        ncuaMatch: null,
      };
    }
    byCompany[company].count += 1;

    const product = c.product ?? "Unknown";
    byCompany[company].products[product] =
      (byCompany[company].products[product] ?? 0) + 1;

    const issue = c.issue ?? "Unknown";
    byCompany[company].issues[issue] =
      (byCompany[company].issues[issue] ?? 0) + 1;
  }

  // Match companies to known MI CU names
  for (const company of Object.keys(byCompany)) {
    byCompany[company].ncuaMatch = matchCompanyToCU(company);
  }

  // Filter byCompany to only Michigan-headquartered CUs
  const michiganByCompany: Record<string, CFPBCompanyInfo> = {};
  let michiganCUComplaintCount = 0;
  for (const [company, info] of Object.entries(byCompany)) {
    if (info.ncuaMatch) {
      michiganByCompany[company] = info;
      michiganCUComplaintCount += info.count;
    }
  }

  // Sort by count descending (Michigan CUs only)
  const sortedCompany = Object.fromEntries(
    Object.entries(michiganByCompany).sort(([, a], [, b]) => b.count - a.count)
  );

  // Aggregate by product
  const byProduct: Record<string, number> = {};
  for (const c of complaints) {
    const product = c.product ?? "Unknown";
    byProduct[product] = (byProduct[product] ?? 0) + 1;
  }
  const sortedProduct = Object.fromEntries(
    Object.entries(byProduct).sort(([, a], [, b]) => b - a)
  );

  // Aggregate by issue
  const byIssue: Record<string, number> = {};
  for (const c of complaints) {
    const issue = c.issue ?? "Unknown";
    byIssue[issue] = (byIssue[issue] ?? 0) + 1;
  }
  const sortedIssue = Object.fromEntries(
    Object.entries(byIssue).sort(([, a], [, b]) => b - a)
  );

  // Time-based counts
  const now = Date.now();
  const ms30d = 30 * 24 * 60 * 60 * 1000;
  const ms60d = 60 * 24 * 60 * 60 * 1000;

  let counts30d = 0;
  let counts60d = 0;
  for (const c of complaints) {
    if (!c.dateReceived) continue;
    const received = new Date(c.dateReceived.slice(0, 10)).getTime();
    if (now - received <= ms30d) counts30d++;
    if (now - received <= ms60d) counts60d++;
  }

  return {
    total: complaints.length,
    totalMichiganCUs: michiganCUComplaintCount,
    periodStart: startDate,
    periodEnd: todayISO(),
    counts30d,
    counts60d,
    counts90d: complaints.length,
    byCompany: sortedCompany,
    byProduct: sortedProduct,
    byIssue: sortedIssue,
    sampleComplaints: complaints.slice(0, 20),
  };
}

export { MI_CU_NAMES, normalizeCUName, matchCompanyToCU };
