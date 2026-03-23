import type { QuarterData } from "@/lib/pipelines/types";
import { StatTile } from "@/components/ui/stat-tile";
import { fmtAssets, fmtMembers, fmtNetWorth, fmtDelinquency, fmtCurrency, fmtChange } from "@/lib/format";

interface StatewideOverviewProps {
  quarters: QuarterData[];
}

function computeChange(
  current: number,
  previous: number | undefined,
): { change?: string; changeType?: "positive" | "negative" | "neutral" } {
  if (previous === undefined) return {};
  const result = fmtChange(current, previous);
  return { change: result.text, changeType: result.type };
}

export function StatewideOverview({ quarters }: StatewideOverviewProps) {
  const latest = quarters[quarters.length - 1];
  const prev = quarters.length > 1 ? quarters[quarters.length - 2] : undefined;

  if (!latest) return null;

  const s = latest.statewide;
  const p = prev?.statewide;

  const tiles = [
    {
      label: "Total CUs",
      value: s.totalCUs.toLocaleString(),
      ...computeChange(s.totalCUs, p?.totalCUs),
    },
    {
      label: "Aggregate Assets",
      value: fmtAssets(s.totalAssets),
      ...computeChange(s.totalAssets, p?.totalAssets),
    },
    {
      label: "Total Members",
      value: fmtMembers(s.totalMembers),
      ...computeChange(s.totalMembers, p?.totalMembers),
    },
    {
      label: "Avg Net Worth Ratio",
      value: fmtNetWorth(s.avgNetWorthRatio),
      ...(p ? (() => {
        const currPct = s.avgNetWorthRatio / 100;
        const prevPct = p.avgNetWorthRatio / 100;
        return computeChange(currPct, prevPct);
      })() : {}),
    },
    {
      label: "Weighted Delinquency",
      value: fmtDelinquency(s.weightedDelinquencyRate),
      // For delinquency, rising is negative
      ...(p
        ? (() => {
            const r = fmtChange(s.weightedDelinquencyRate, p.weightedDelinquencyRate);
            return {
              change: r.text,
              changeType: r.type === "positive" ? "negative" as const : r.type === "negative" ? "positive" as const : r.type,
            };
          })()
        : {}),
    },
    {
      label: "Total Net Income",
      value: fmtCurrency(s.totalNetIncome),
      ...computeChange(s.totalNetIncome, p?.totalNetIncome),
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {tiles.map((tile) => (
        <StatTile
          key={tile.label}
          label={tile.label}
          value={tile.value}
          change={tile.change}
          changeType={tile.changeType}
        />
      ))}
    </div>
  );
}
