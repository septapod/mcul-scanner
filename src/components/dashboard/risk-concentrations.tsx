import type { AnalysisSections } from "@/lib/pipelines/types";

interface RiskConcentrationsProps {
  risks?: AnalysisSections["riskConcentrations"];
}

const SEVERITY_STYLES: Record<string, { dot: string; text: string; border: string }> = {
  high: { dot: "bg-coral", text: "text-coral", border: "border-l-coral" },
  moderate: { dot: "bg-warning", text: "text-warning", border: "border-l-warning" },
  low: { dot: "bg-muted", text: "text-muted", border: "border-l-muted" },
};

export function RiskConcentrations({ risks }: RiskConcentrationsProps) {
  if (!risks || risks.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[15px] text-muted">No risk concentrations flagged.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {risks.map((risk, i) => {
        const styles = SEVERITY_STYLES[risk.severity] ?? SEVERITY_STYLES.low;

        return (
          <div
            key={`${risk.riskName}-${i}`}
            className={`glass-card p-4 border-l-2 ${styles.border}`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
              <span className={`text-[13px] font-mono uppercase tracking-wider ${styles.text}`}>
                {risk.severity}
              </span>
            </div>

            <h3 className="text-[15px] font-[family-name:var(--font-display)] font-medium text-heading mb-2">
              {risk.riskName}
            </h3>

            {/* Evidence */}
            <div className="mb-2">
              <span className="text-[13px] font-mono text-accent-light uppercase tracking-wider">
                Evidence
              </span>
              <p className="text-[15px] text-muted leading-relaxed mt-0.5">
                {risk.evidence}
              </p>
            </div>

            {/* Implication */}
            <div>
              <span className="text-[13px] font-mono text-accent-light uppercase tracking-wider">
                Implication
              </span>
              <p className="text-[15px] text-foreground leading-relaxed mt-0.5">
                {risk.implication}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
