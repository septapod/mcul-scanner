/**
 * Formatting helpers for dashboard display values.
 */

/** Format large asset values: $115.4B, $3.7M, $521K */
export function fmtAssets(val: number): string {
  if (val == null || isNaN(val)) return "N/A";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_000_000_000) {
    const b = abs / 1_000_000_000;
    return `${sign}$${b >= 100 ? b.toFixed(0) : b >= 10 ? b.toFixed(1) : b.toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$${m >= 100 ? m.toFixed(0) : m >= 10 ? m.toFixed(1) : m.toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}$${k >= 100 ? k.toFixed(0) : k >= 10 ? k.toFixed(1) : k.toFixed(2)}K`;
  }
  return `${sign}$${abs.toFixed(0)}`;
}

/** Format member counts: 6.1M, 521K, 1,234 */
export function fmtMembers(val: number): string {
  if (val == null || isNaN(val)) return "N/A";
  const abs = Math.abs(val);
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${m >= 10 ? m.toFixed(1) : m.toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${k >= 100 ? k.toFixed(0) : k >= 10 ? k.toFixed(1) : k.toFixed(2)}K`;
  }
  return (abs ?? 0).toLocaleString();
}

/** Format percentage: 12.78% */
export function fmtPct(val: number, decimals = 2): string {
  if (val == null || isNaN(val)) return "N/A";
  return `${val.toFixed(decimals)}%`;
}

/** Format net worth ratio from basis points: 1278 -> "12.78%" */
export function fmtNetWorth(bps: number): string {
  if (bps == null || isNaN(bps)) return "N/A";
  return `${(bps / 100).toFixed(2)}%`;
}

/** Format delinquency rate: 0.85% */
export function fmtDelinquency(val: number): string {
  if (val == null || isNaN(val)) return "N/A";
  return `${val.toFixed(2)}%`;
}

/** Compute QoQ change text and direction */
export function fmtChange(
  current: number,
  previous: number,
): { text: string; type: "positive" | "negative" | "neutral" } {
  if (current == null || isNaN(current) || previous == null || isNaN(previous)) {
    return { text: "N/A", type: "neutral" };
  }
  if (previous === 0) {
    return { text: "N/A", type: "neutral" };
  }
  const diff = current - previous;
  const pct = (diff / Math.abs(previous)) * 100;
  const sign = pct > 0 ? "+" : "";
  const text = `${sign}${pct.toFixed(1)}%`;

  if (Math.abs(pct) < 0.05) {
    return { text, type: "neutral" };
  }
  return { text, type: pct > 0 ? "positive" : "negative" };
}

/** Format currency values: $4.2M, $115.4B (alias of fmtAssets) */
export function fmtCurrency(val: number): string {
  if (val == null || isNaN(val)) return "N/A";
  return fmtAssets(val);
}
