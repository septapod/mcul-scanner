import { Shield } from "lucide-react";

interface VerificationBadgeProps {
  passedChecks: number;
  totalChecks: number;
  verifiedAt?: string;
}

export function VerificationBadge({
  passedChecks,
  totalChecks,
  verifiedAt,
}: VerificationBadgeProps) {
  const allPassed = passedChecks === totalChecks;

  return (
    <div className="flex items-center gap-2">
      <Shield
        size={12}
        className={allPassed ? "text-success" : "text-warning"}
      />
      <span className="text-heading font-mono text-xs">
        {passedChecks}/{totalChecks} verified
      </span>
      {verifiedAt && (
        <span className="text-muted font-mono text-[10px] hidden sm:inline">
          {new Date(verifiedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}
    </div>
  );
}
