import type { Anomaly, AnalysisSections } from "@/lib/pipelines/types";
import { SeverityBadge } from "@/components/ui/severity-badge";

function formatAnomalyValue(value: number, metric: string): string {
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
    return (value ?? 0).toLocaleString();
  }
  return (value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

interface AnomalyFlagsProps {
  anomalies: Anomaly[];
  narratives?: AnalysisSections["anomalyNarratives"];
}

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
};

export function AnomalyFlags({ anomalies, narratives }: AnomalyFlagsProps) {
  if (!anomalies?.length) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[15px] text-muted">No anomalies detected this quarter.</p>
      </div>
    );
  }

  const sorted = [...anomalies].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );

  return (
    <div className="space-y-3">
      {sorted.map((anomaly, i) => {
        // Find matching narrative
        const narrative = narratives?.find(
          (n) => n.headline === anomaly.headline,
        );

        return (
          <div
            key={`${anomaly.headline}-${i}`}
            className={`glass-card p-4 ${
              anomaly.severity === "CRITICAL" ? "border-l-2 border-l-coral" : ""
            }`}
          >
            {/* Header row */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <SeverityBadge severity={anomaly.severity} />
              <span className="text-[13px] font-mono text-muted uppercase tracking-wider">
                {anomaly.category}
              </span>
            </div>

            {/* Headline */}
            <h3 className="text-[15px] font-[family-name:var(--font-display)] font-medium text-heading mb-1">
              {anomaly.headline}
            </h3>

            {/* Detail */}
            <p className="text-[15px] text-muted leading-relaxed mb-2">
              {anomaly.detail}
            </p>

            {/* Metric values */}
            <div className="flex flex-wrap items-center gap-4 text-[14px] font-mono">
              <span className="text-muted">
                Current:{" "}
                <span className="text-heading tabular-nums">
                  {formatAnomalyValue(anomaly.currentValue ?? 0, anomaly.metric ?? "")}
                </span>
              </span>
              <span className="text-muted">
                Previous:{" "}
                <span className="text-heading tabular-nums">
                  {formatAnomalyValue(anomaly.previousValue ?? 0, anomaly.metric ?? "")}
                </span>
              </span>
              <span className="text-muted">
                Metric: <span className="text-accent-light">{anomaly.metric}</span>
              </span>
            </div>

            {/* AI narrative */}
            {narrative?.narrative && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-[15px] text-foreground leading-relaxed">
                  {narrative.narrative}
                </p>
              </div>
            )}

            {/* Watch items */}
            {narrative?.watchItems && narrative.watchItems.length > 0 && (
              <div className="mt-2">
                <span className="text-[13px] font-mono text-accent-light uppercase tracking-wider">
                  Watch Items
                </span>
                <ul className="mt-1 space-y-1">
                  {narrative.watchItems.map((item, j) => (
                    <li
                      key={j}
                      className="text-[15px] text-muted flex items-start gap-2"
                    >
                      <span className="text-accent-light mt-0.5 flex-shrink-0">
                        &bull;
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
