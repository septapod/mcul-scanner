import { SeverityBadge } from "./severity-badge";

type FlagSeverity =
  | "CRITICAL"
  | "WARNING"
  | "INFO"
  | "OPPORTUNITY"
  | "high"
  | "moderate"
  | "low";

interface FlagCardProps {
  severity: FlagSeverity;
  category?: string;
  headline: string;
  narrative?: string;
  watchItems?: string[];
}

function normalizeSeverity(
  severity: FlagSeverity
): "CRITICAL" | "WARNING" | "INFO" | "OPPORTUNITY" {
  switch (severity) {
    case "high":
      return "CRITICAL";
    case "moderate":
      return "WARNING";
    case "low":
      return "INFO";
    default:
      return severity;
  }
}

const BORDER_COLORS: Record<string, string> = {
  CRITICAL: "border-l-coral",
  WARNING: "border-l-warning",
  INFO: "border-l-muted",
  OPPORTUNITY: "border-l-accent-light",
};

export function FlagCard({
  severity,
  category,
  headline,
  narrative,
  watchItems,
}: FlagCardProps) {
  const normalized = normalizeSeverity(severity);
  const borderColor = BORDER_COLORS[normalized] || "border-l-muted";

  const severityBarClass =
    normalized === "CRITICAL"
      ? "critical"
      : normalized === "WARNING"
        ? "warning"
        : "info";

  return (
    <div
      className={`glass-card border-l-2 ${borderColor} px-4 py-3 space-y-2`}
    >
      <div className={`severity-bar ${severityBarClass}`} />
      <div className="flex items-center gap-2 flex-wrap">
        <SeverityBadge severity={normalized} />
        {category && (
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-elevated border border-border/50">
            {category}
          </span>
        )}
      </div>

      <h3 className="text-sm font-[family-name:var(--font-display)] font-medium text-heading leading-snug">
        {headline}
      </h3>

      {narrative && (
        <p className="text-xs text-foreground/80 leading-relaxed">
          {narrative}
        </p>
      )}

      {watchItems && watchItems.length > 0 && (
        <ul className="space-y-1 mt-1">
          {watchItems.map((item, i) => (
            <li
              key={i}
              className="text-[11px] text-muted flex items-start gap-1.5"
            >
              <span className="text-accent-light mt-0.5 flex-shrink-0">
                &bull;
              </span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
