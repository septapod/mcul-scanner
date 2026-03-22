/**
 * Zillow Housing Data Pipeline
 * Downloads ZHVI (home values) and inventory CSVs, filters to Michigan MSAs,
 * and computes month-over-month, 3-month, and year-over-year changes.
 */

import Papa from "papaparse";
import type { ZillowData, ZillowMSARecord, ZillowFlag, Severity } from "./types";

const ZHVI_URL =
  "https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv";
const INVENTORY_URL =
  "https://files.zillowstatic.com/research/public_csvs/invt_fs/Metro_invt_fs_uc_sfrcondo_sm_month.csv";

/** Date column pattern: YYYY-MM-DD or YYYY-MM-31 */
const DATE_COL_RE = /^\d{4}-\d{2}/;

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

/**
 * Download and parse a CSV from a URL. Returns parsed rows or null on failure.
 */
async function downloadCSV(
  url: string,
  label: string
): Promise<Papa.ParseResult<Record<string, string>> | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      if (resp.status === 404) {
        console.warn(`[Zillow] ${label} returned 404. URL may have changed.`);
      } else {
        console.warn(`[Zillow] ${label} returned ${resp.status}`);
      }
      return null;
    }

    const text = await resp.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    return parsed;
  } catch (err) {
    console.error(`[Zillow] Failed to download ${label}:`, err);
    return null;
  }
}

/**
 * Filter rows to Michigan MSAs.
 * Checks StateName === "MI" or RegionName containing ", MI".
 */
function filterMichigan(
  rows: Record<string, string>[]
): Record<string, string>[] {
  return rows.filter((row) => {
    if (row.StateName === "MI") return true;
    if (row.RegionName && row.RegionName.includes(", MI")) return true;
    return false;
  });
}

/**
 * Identify date columns in the CSV header and return them sorted ascending.
 */
function getDateColumns(row: Record<string, string>): string[] {
  return Object.keys(row)
    .filter((col) => DATE_COL_RE.test(col))
    .sort();
}

/**
 * Compute MoM, 3-month, and YoY changes for a set of Michigan MSA rows.
 */
function computeChanges(
  rows: Record<string, string>[],
  label: string
): ZillowMSARecord[] {
  if (rows.length === 0) return [];

  const dateCols = getDateColumns(rows[0]);
  if (dateCols.length === 0) {
    console.warn(`[Zillow] No date columns found in ${label}`);
    return [];
  }

  const results: ZillowMSARecord[] = [];

  for (const row of rows) {
    const region = row.RegionName ?? "Unknown";

    // Find latest non-null value (scan from end)
    let latestVal: number | null = null;
    let latestCol: string | null = null;
    let latestIdx = -1;

    for (let i = dateCols.length - 1; i >= 0; i--) {
      const raw = row[dateCols[i]];
      if (raw != null && raw !== "") {
        const val = parseFloat(raw);
        if (!isNaN(val)) {
          latestVal = val;
          latestCol = dateCols[i];
          latestIdx = i;
          break;
        }
      }
    }

    if (latestVal === null || latestCol === null) continue;

    const record: ZillowMSARecord = {
      region,
      latestDate: latestCol,
      latestValue: latestVal,
    };

    // MoM change
    if (latestIdx >= 1) {
      const prevRaw = row[dateCols[latestIdx - 1]];
      if (prevRaw != null && prevRaw !== "") {
        const prevVal = parseFloat(prevRaw);
        if (!isNaN(prevVal) && prevVal !== 0) {
          record.prevMonthValue = prevVal;
          record.momChange = round(latestVal - prevVal, 2);
          record.momPctChange = round(
            ((latestVal - prevVal) / prevVal) * 100,
            2
          );
        }
      }
    }

    // 3-month change
    if (latestIdx >= 3) {
      const val3mRaw = row[dateCols[latestIdx - 3]];
      if (val3mRaw != null && val3mRaw !== "") {
        const val3m = parseFloat(val3mRaw);
        if (!isNaN(val3m) && val3m !== 0) {
          record.threeMonthChange = round(latestVal - val3m, 2);
          record.threeMonthPctChange = round(
            ((latestVal - val3m) / val3m) * 100,
            2
          );
        }
      }
    }

    // YoY change (12 months back)
    if (latestIdx >= 12) {
      const valYoyRaw = row[dateCols[latestIdx - 12]];
      if (valYoyRaw != null && valYoyRaw !== "") {
        const valYoy = parseFloat(valYoyRaw);
        if (!isNaN(valYoy) && valYoy !== 0) {
          record.yoyChange = round(latestVal - valYoy, 2);
          record.yoyPctChange = round(
            ((latestVal - valYoy) / valYoy) * 100,
            2
          );
        }
      }
    }

    results.push(record);
  }

  return results;
}

/**
 * Fetch Zillow ZHVI and inventory data for Michigan MSAs.
 * Handles 404s gracefully, returning empty data with a warning.
 */
export async function fetchZillowHousing(): Promise<ZillowData> {
  const result: ZillowData = {
    zhvi: [],
    inventory: [],
    flags: [],
    warnings: [],
  };

  // Fetch both CSVs in parallel
  const [zhviParsed, invParsed] = await Promise.all([
    downloadCSV(ZHVI_URL, "ZHVI"),
    downloadCSV(INVENTORY_URL, "Inventory"),
  ]);

  // Process ZHVI
  if (zhviParsed && zhviParsed.data.length > 0) {
    const miRows = filterMichigan(zhviParsed.data);
    result.zhvi = computeChanges(miRows, "ZHVI");

    // Flag significant MoM price moves (>2%)
    for (const r of result.zhvi) {
      const mom = r.momPctChange ?? 0;
      if (Math.abs(mom) > 2.0) {
        const direction = mom > 0 ? "surging" : "declining";
        const severity: Severity = mom < -2.0 ? "WARNING" : "INFO";
        result.flags.push({
          source: "zillow_zhvi",
          region: r.region,
          flag: `Home values ${direction} ${Math.abs(mom).toFixed(1)}% MoM in ${r.region}`,
          severity,
          value: mom,
        });
      }
    }
  } else {
    result.warnings.push("ZHVI data unavailable. Zillow URL may have changed.");
  }

  // Process Inventory
  if (invParsed && invParsed.data.length > 0) {
    const miRows = filterMichigan(invParsed.data);
    result.inventory = computeChanges(miRows, "Inventory");

    // Flag significant inventory changes (>20% MoM)
    for (const r of result.inventory) {
      const mom = r.momPctChange ?? 0;
      if (Math.abs(mom) > 20.0) {
        const direction = mom > 0 ? "surging" : "plunging";
        result.flags.push({
          source: "zillow_inventory",
          region: r.region,
          flag: `Inventory ${direction} ${Math.abs(mom).toFixed(1)}% MoM in ${r.region}`,
          severity: "WARNING",
          value: mom,
        });
      }
    }
  } else {
    result.warnings.push(
      "Inventory data unavailable. Zillow URL may have changed."
    );
  }

  return result;
}
