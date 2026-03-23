/**
 * Safe number formatting. Never crashes on undefined/null/NaN.
 */
export function safeLocale(value: unknown, fallback = "0"): string {
  if (value === null || value === undefined) return fallback;
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num)) return fallback;
  return num.toLocaleString();
}
