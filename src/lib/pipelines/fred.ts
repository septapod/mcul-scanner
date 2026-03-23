/**
 * FRED Economic Data Pipeline
 * Fetches 7 key economic series from the FRED API relevant to Michigan credit unions.
 */

import type { FREDSeries, FREDObservation, FREDSeriesConfig } from "./types";

const FRED_SERIES: readonly FREDSeriesConfig[] = [
  { id: "MIUR", name: "Michigan Unemployment Rate", frequency: "monthly", unit: "%", threshold: 0.3 },
  { id: "MORTGAGE30US", name: "30-Year Mortgage Rate", frequency: "weekly", unit: "%", threshold: 0.25 },
  { id: "UMCSENT", name: "Consumer Sentiment (U of M)", frequency: "monthly", unit: "index", threshold: 5.0 },
  { id: "ICSA", name: "Initial Jobless Claims", frequency: "weekly", unit: "thousands", threshold: 20000 },
  { id: "MIBPPRIVSA", name: "Michigan Building Permits (SA)", frequency: "monthly", unit: "permits", threshold: 500 },
  { id: "FEDFUNDS", name: "Federal Funds Rate", frequency: "monthly", unit: "%", threshold: 0.25 },
  { id: "CPIAUCSL", name: "CPI All Urban (SA)", frequency: "monthly", unit: "index", threshold: 0.5 },
] as const;

const FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations";

const FRED_FALLBACK_KEY = "c8e42acf745638e304bbd1328ff2c980";

function getApiKey(): string {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    console.warn("[FRED] FRED_API_KEY env var not set, using fallback key");
    return FRED_FALLBACK_KEY;
  }
  return key;
}

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch a single FRED series and return parsed observations (newest first).
 */
async function fetchSeries(seriesId: string, apiKey: string): Promise<FREDObservation[]> {
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: "json",
    observation_start: oneYearAgo(),
    sort_order: "desc",
    limit: "24",
  });

  const resp = await fetch(`${FRED_BASE_URL}?${params.toString()}`);
  if (!resp.ok) {
    const body = await resp.text().catch(() => "(unable to read body)");
    throw new Error(`FRED API returned ${resp.status} for ${seriesId}: ${body}`);
  }

  const data = (await resp.json()) as {
    observations?: Array<{ date: string; value: string }>;
  };

  const observations: FREDObservation[] = [];
  for (const obs of data.observations ?? []) {
    if (obs.value === ".") continue;
    const value = parseFloat(obs.value);
    if (isNaN(value)) continue;
    observations.push({ date: obs.date, value });
  }

  return observations;
}

/**
 * Compute change metrics for a series: latest vs previous, YoY, significance flag.
 */
function computeChanges(
  observations: FREDObservation[],
  config: FREDSeriesConfig
): FREDSeries | null {
  if (observations.length < 2) return null;

  const latest = observations[0];
  const previous = observations[1];
  const change = round(latest.value - previous.value, 4);
  const pctChange =
    previous.value !== 0
      ? round(((latest.value - previous.value) / previous.value) * 100, 2)
      : 0;

  const result: FREDSeries = {
    name: config.name,
    frequency: config.frequency,
    unit: config.unit,
    latestDate: latest.date,
    latestValue: latest.value,
    previousDate: previous.date,
    previousValue: previous.value,
    change,
    pctChange,
    significant: false,
    observations: observations.slice(0, 6),
  };

  // Year-ago value: find the first observation at or before 365 days ago
  const targetDate = new Date(latest.date);
  targetDate.setFullYear(targetDate.getFullYear() - 1);

  for (const obs of observations) {
    if (new Date(obs.date) <= targetDate) {
      result.yearAgoDate = obs.date;
      result.yearAgoValue = obs.value;
      result.yoyChange = round(latest.value - obs.value, 4);
      result.yoyPctChange =
        obs.value !== 0
          ? round(((latest.value - obs.value) / obs.value) * 100, 2)
          : 0;
      break;
    }
  }

  // Flag significant moves
  const isSignificant = Math.abs(change) >= config.threshold;
  result.significant = isSignificant;
  if (isSignificant) {
    const direction = change > 0 ? "up" : "down";
    result.flag = `${config.name} moved ${direction} ${Math.abs(change).toFixed(2)} ${config.unit}`;
  }

  return result;
}

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

/**
 * Fetch all 7 FRED series and return a map of series ID to computed data.
 */
export async function fetchAllFRED(): Promise<Record<string, FREDSeries>> {
  const apiKey = getApiKey();
  console.log(`[FRED] Using API key: ${apiKey.slice(0, 8)}...`);
  const results: Record<string, FREDSeries> = {};
  const errors: string[] = [];

  // Fetch series SEQUENTIALLY to avoid rate limiting
  for (const config of FRED_SERIES) {
    try {
      console.log(`[FRED] Fetching ${config.id}...`);
      const observations = await fetchSeries(config.id, apiKey);
      console.log(`[FRED] ${config.id}: ${observations.length} observations`);
      if (observations.length === 0) {
        errors.push(`${config.id}: no observations returned`);
        continue;
      }
      const computed = computeChanges(observations, config);
      if (computed) {
        results[config.id] = computed;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[FRED] Error fetching ${config.id}: ${errMsg}`);
      errors.push(`${config.id}: ${errMsg}`);
    }
  }

  if (errors.length > 0) {
    console.warn(`[FRED] ${errors.length} errors: ${errors.join("; ")}`);
    // Store errors in a special key so the caller can see them
    (results as Record<string, unknown>)["_errors"] = errors;
  }
  console.log(`[FRED] Completed: ${Object.keys(results).length}/${FRED_SERIES.length} series loaded`);
  return results;
}

export { FRED_SERIES };
