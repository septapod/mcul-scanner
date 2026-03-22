interface SeverityBadgeProps {
  severity: "CRITICAL" | "WARNING" | "INFO" | "OPPORTUNITY";
}

const SEVERITY_STYLES: Record<SeverityBadgeProps["severity"], string> = {
  CRITICAL: "bg-coral/15 text-coral border-coral/30",
  WARNING: "bg-warning/15 text-warning border-warning/30",
  INFO: "bg-muted/15 text-muted border-muted/30",
  OPPORTUNITY: "bg-accent-light/15 text-accent-light border-accent-light/30",
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${SEVERITY_STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}
