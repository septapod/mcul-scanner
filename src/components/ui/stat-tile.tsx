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
      <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-mono font-semibold text-heading tabular-nums">
          {value}
        </span>
        {change && (
          <span className={`text-xs font-mono ${changeColor}`}>{change}</span>
        )}
      </div>
      {subtitle && (
        <div className="text-[10px] font-mono text-muted mt-1">{subtitle}</div>
      )}
      {/* Mini sparkline decoration */}
      <div className="stat-sparkline">
        {[40, 55, 45, 60, 50, 65, 70, 60].map((h, i) => (
          <span key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}
