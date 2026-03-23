import type { AnalysisSections } from "@/lib/pipelines/types";
import { TrendingUp, TrendingDown, Minus, ChevronsUp, ChevronsDown } from "lucide-react";

interface EmergingTrendsProps {
  trends?: AnalysisSections["emergingTrends"];
}

function DirectionIcon({ direction }: { direction: string }) {
  switch (direction) {
    case "rising":
      return <TrendingUp size={16} className="text-success" />;
    case "falling":
      return <TrendingDown size={16} className="text-coral" />;
    case "accelerating":
      return <ChevronsUp size={16} className="text-warning" />;
    case "decelerating":
      return <ChevronsDown size={16} className="text-info" />;
    case "stable":
    default:
      return <Minus size={16} className="text-muted" />;
  }
}

const DIRECTION_LABELS: Record<string, string> = {
  rising: "Rising",
  falling: "Falling",
  accelerating: "Accelerating",
  decelerating: "Decelerating",
  stable: "Stable",
};

export function EmergingTrends({ trends }: EmergingTrendsProps) {
  if (!trends || trends.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[15px] text-muted">Analysis pending. Trends will appear after the next analysis run.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {trends.map((trend, i) => (
        <div key={`${trend.trendName}-${i}`} className="glass-card p-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <DirectionIcon direction={trend.direction} />
            <h3 className="text-[15px] font-[family-name:var(--font-display)] font-medium text-heading">
              {trend.trendName}
            </h3>
            <span className="text-[13px] font-mono text-muted uppercase tracking-wider ml-auto">
              {DIRECTION_LABELS[trend.direction] ?? trend.direction}
            </span>
          </div>

          {/* Evidence */}
          <div className="mb-2">
            <span className="text-[13px] font-mono text-accent-light uppercase tracking-wider">
              Evidence
            </span>
            <p className="text-[15px] text-muted leading-relaxed mt-0.5">
              {trend.evidence}
            </p>
          </div>

          {/* Implication */}
          <div>
            <span className="text-[13px] font-mono text-accent-light uppercase tracking-wider">
              Implication
            </span>
            <p className="text-[15px] text-foreground leading-relaxed mt-0.5">
              {trend.implication}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
