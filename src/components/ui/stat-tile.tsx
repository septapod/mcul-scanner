interface StatTileProps {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  subtitle?: string;
}

export function StatTile({
  label,
  value,
  change,
  changeType = "neutral",
  subtitle,
}: StatTileProps) {
  const changeColor =
    changeType === "positive"
      ? "text-success"
      : changeType === "negative"
        ? "text-coral"
        : "text-muted";

  return (
    <div className="glass-card px-4 py-3">
      <div className="text-[13px] font-mono text-muted uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-mono font-semibold text-heading tabular-nums">
          {value}
        </span>
        {change && (
          <span className={`text-sm font-mono ${changeColor}`}>{change}</span>
        )}
      </div>
      {subtitle && (
        <div className="text-[13px] font-mono text-muted mt-1">{subtitle}</div>
      )}
    </div>
  );
}
