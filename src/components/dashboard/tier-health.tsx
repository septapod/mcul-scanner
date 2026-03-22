import type { QuarterData, AnalysisSections } from "@/lib/pipelines/types";
import { fmtAssets, fmtPct, fmtDelinquency, fmtChange } from "@/lib/format";

interface TierHealthProps {
  quarters: QuarterData[];
  analysis?: AnalysisSections;
}

const STATUS_COLORS: Record<string, string> = {
  strengthening: "bg-success",
  weakening: "bg-coral",
  stable: "bg-muted",
  mixed: "bg-warning",
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  strengthening: "text-success",
  weakening: "text-coral",
  stable: "text-muted",
  mixed: "text-warning",
};

function MetricRow({
  label,
  value,
  change,
  changeType,
}: {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}) {
  const changeColor =
    changeType === "positive"
      ? "text-success"
      : changeType === "negative"
        ? "text-coral"
        : "text-muted";

  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[12px] text-muted">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[15px] font-mono text-heading tabular-nums">{value}</span>
        {change && (
          <span className={`text-[11px] font-mono ${changeColor}`}>{change}</span>
        )}
      </div>
    </div>
  );
}

export function TierHealth({ quarters, analysis }: TierHealthProps) {
  const latest = quarters[quarters.length - 1];
  const prev = quarters.length > 1 ? quarters[quarters.length - 2] : undefined;

  if (!latest) return null;

  const tierNames = Object.keys(latest.tiers);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {tierNames.map((tierName) => {
        const tier = latest.tiers[tierName];
        const prevTier = prev?.tiers[tierName];

        // Find analysis narrative for this tier
        const tierAnalysis = analysis?.tierHealthSummary?.tiers.find(
          (t) => t.tierName === tierName,
        );
        const status = tierAnalysis?.status ?? "stable";

        const cuChange = prevTier
          ? fmtChange(tier.cuCount, prevTier.cuCount)
          : undefined;
        const assetChange = prevTier
          ? fmtChange(tier.totalAssets, prevTier.totalAssets)
          : undefined;
        const delinqChange = prevTier
          ? (() => {
              const r = fmtChange(tier.avgDelinquencyRate, prevTier.avgDelinquencyRate);
              return {
                text: r.text,
                type: (r.type === "positive" ? "negative" : r.type === "negative" ? "positive" : r.type) as "positive" | "negative" | "neutral",
              };
            })()
          : undefined;
        const nwChange = prevTier
          ? fmtChange(tier.avgNetWorthRatio, prevTier.avgNetWorthRatio)
          : undefined;
        const ltsChange = prevTier
          ? fmtChange(tier.avgLoanToShare, prevTier.avgLoanToShare)
          : undefined;

        return (
          <div key={tierName} className="glass-card p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-[family-name:var(--font-display)] font-medium text-heading leading-tight">
                {tierName}
              </h3>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`}
                />
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider ${STATUS_TEXT_COLORS[status]}`}
                >
                  {status}
                </span>
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-2">
              <MetricRow
                label="CU Count"
                value={tier.cuCount.toLocaleString()}
                change={cuChange?.text}
                changeType={cuChange?.type}
              />
              <MetricRow
                label="Total Assets"
                value={fmtAssets(tier.totalAssets)}
                change={assetChange?.text}
                changeType={assetChange?.type}
              />
              <MetricRow
                label="Avg Delinquency"
                value={fmtDelinquency(tier.avgDelinquencyRate)}
                change={delinqChange?.text}
                changeType={delinqChange?.type}
              />
              <MetricRow
                label="Avg Net Worth"
                value={fmtPct(tier.avgNetWorthRatio)}
                change={nwChange?.text}
                changeType={nwChange?.type}
              />
              <MetricRow
                label="Loan-to-Share"
                value={fmtPct(tier.avgLoanToShare)}
                change={ltsChange?.text}
                changeType={ltsChange?.type}
              />
            </div>

            {/* Narrative */}
            {tierAnalysis?.summary && (
              <p className="mt-3 pt-3 border-t border-border/30 text-[13px] text-muted leading-relaxed">
                {tierAnalysis.summary}
              </p>
            )}
          </div>
        );
      })}

      {/* Synthesis card */}
      {analysis?.tierHealthSummary?.synthesis && (
        <div className="glass-card p-4 md:col-span-2 xl:col-span-3">
          <div className="text-[10px] font-mono text-accent-light uppercase tracking-wider mb-2">
            Synthesis
          </div>
          <p className="text-[15px] text-foreground leading-relaxed">
            {analysis.tierHealthSummary.synthesis}
          </p>
        </div>
      )}
    </div>
  );
}
