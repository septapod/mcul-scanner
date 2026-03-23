import type { DailyData, DailyCrossRef, FREDSeries } from "@/lib/pipelines/types";
import { StatTile } from "@/components/ui/stat-tile";
import { fmtCurrency } from "@/lib/format";

interface MarketPulseProps {
  dailyData: DailyData | null;
  crossref?: DailyCrossRef;
}

/* ── FRED Economic Indicators ────────────────────────────── */

function FREDIndicators({ series }: { series: Record<string, FREDSeries> }) {
  const entries = Object.entries(series);

  if (entries.length === 0) {
    return (
      <p className="text-[15px] text-muted">No FRED data available.</p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {entries.map(([key, s]) => {
        const changeVal = s.pctChange;
        const changeText =
          changeVal !== undefined && changeVal !== null
            ? `${changeVal > 0 ? "+" : ""}${changeVal.toFixed(2)}%`
            : undefined;

        // For most economic indicators, positive change is neutral or context-dependent.
        // Use the "significant" flag and direction to determine color.
        let changeType: "positive" | "negative" | "neutral" = "neutral";
        if (s.significant && changeVal !== undefined) {
          // Simple heuristic: flag significant changes as "negative" (attention-worthy)
          changeType = changeVal > 0 ? "negative" : "positive";
        }

        const displayValue =
          s.unit === "Percent" || s.unit === "%"
            ? `${s.latestValue.toFixed(2)}%`
            : s.latestValue.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              });

        return (
          <StatTile
            key={key}
            label={s.name}
            value={displayValue}
            change={changeText}
            changeType={changeType}
            subtitle={s.flag ?? undefined}
          />
        );
      })}
    </div>
  );
}

/* ── CFPB Consumer Complaints ────────────────────────────── */

function CFPBSection({ dailyData }: { dailyData: DailyData }) {
  const cfpb = dailyData.sources.cfpb;

  const topCompanies = Object.entries(cfpb.byCompany)
    .map(([name, info]) => ({ name, count: info.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topIssues = Object.entries(cfpb.byIssue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Complaint counts */}
      <div className="text-[15px] text-muted mb-2">
        Complaints filed in Michigan: {cfpb.total.toLocaleString()}.{" "}
        Against Michigan-headquartered CUs: {cfpb.totalMichiganCUs.toLocaleString()}.
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Michigan CU Complaints" value={cfpb.totalMichiganCUs.toLocaleString()} />
        <StatTile label="30-Day (all)" value={cfpb.counts30d.toLocaleString()} />
        <StatTile label="60-Day (all)" value={cfpb.counts60d.toLocaleString()} />
        <StatTile label="90-Day (all)" value={cfpb.counts90d.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Companies */}
        <div>
          <div className="text-[15px] font-mono text-accent-light uppercase tracking-wider mb-2">
            Top Companies by Complaints
          </div>
          <div className="space-y-1.5">
            {topCompanies.map((company) => (
              <div
                key={company.name}
                className="flex items-center justify-between py-1 px-2 rounded bg-surface-elevated/50"
              >
                <span className="text-[15px] text-foreground truncate mr-2">
                  {company.name}
                </span>
                <span className="text-[15px] font-mono text-heading tabular-nums flex-shrink-0">
                  {company.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Issues */}
        <div>
          <div className="text-[15px] font-mono text-accent-light uppercase tracking-wider mb-2">
            Top Issues
          </div>
          <div className="space-y-1.5">
            {topIssues.map(([issue, count]) => (
              <div
                key={issue}
                className="flex items-center justify-between py-1 px-2 rounded bg-surface-elevated/50"
              >
                <span className="text-[15px] text-foreground truncate mr-2">
                  {issue}
                </span>
                <span className="text-[15px] font-mono text-heading tabular-nums flex-shrink-0">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Zillow Housing Market ───────────────────────────────── */

function ZillowSection({ dailyData }: { dailyData: DailyData }) {
  const zillow = dailyData.sources.zillow;
  const flaggedRegions = new Set(zillow.flags.map((f) => f.region));

  // Show ZHVI records (home values)
  const msas = zillow.zhvi.slice(0, 12);

  if (msas.length === 0) {
    return (
      <p className="text-[15px] text-muted">No Zillow data available.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {msas.map((msa) => {
        const isFlagged = flaggedRegions.has(msa.region);
        const momText =
          msa.momPctChange !== undefined
            ? `${msa.momPctChange > 0 ? "+" : ""}${msa.momPctChange.toFixed(2)}% MoM`
            : undefined;
        const momType: "positive" | "negative" | "neutral" =
          msa.momPctChange !== undefined
            ? msa.momPctChange > 0
              ? "positive"
              : msa.momPctChange < 0
                ? "negative"
                : "neutral"
            : "neutral";

        return (
          <div
            key={msa.region}
            className={`glass-card p-3 ${isFlagged ? "border-l-2 border-l-warning" : ""}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[15px] font-[family-name:var(--font-display)] font-medium text-heading truncate">
                {msa.region}
              </span>
              {isFlagged && (
                <span className="text-[13px] font-mono text-warning uppercase tracking-wider flex-shrink-0 ml-1">
                  Flagged
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-mono text-heading tabular-nums">
                {fmtCurrency(msa.latestValue)}
              </span>
              {momText && (
                <span
                  className={`text-[14px] font-mono ${
                    momType === "positive"
                      ? "text-success"
                      : momType === "negative"
                        ? "text-coral"
                        : "text-muted"
                  }`}
                >
                  {momText}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Market Pulse Component ─────────────────────────── */

export function MarketPulse({ dailyData, crossref }: MarketPulseProps) {
  if (!dailyData) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[15px] text-muted">Daily market data not yet available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* FRED */}
      <div>
        <div className="font-mono text-[14px] tracking-[0.15em] uppercase text-accent-light mb-3">
          Economic Indicators (FRED)
        </div>
        <FREDIndicators series={dailyData.sources.fred} />
      </div>

      {/* CFPB */}
      <div>
        <div className="font-mono text-[14px] tracking-[0.15em] uppercase text-accent-light mb-3">
          Consumer Complaints (CFPB)
        </div>
        <CFPBSection dailyData={dailyData} />
      </div>

      {/* Zillow */}
      <div>
        <div className="font-mono text-[14px] tracking-[0.15em] uppercase text-accent-light mb-3">
          Housing Market (Zillow)
        </div>
        <ZillowSection dailyData={dailyData} />
      </div>

      {/* Cross-reference findings */}
      {crossref && crossref.findings.length > 0 && (
        <div>
          <div className="font-mono text-[14px] tracking-[0.15em] uppercase text-accent-light mb-3">
            Cross-Reference Findings
          </div>
          <div className="space-y-2">
            {crossref.findings.map((finding, i) => (
              <div key={i} className="glass-card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-mono text-muted uppercase tracking-wider">
                    {finding.type}
                  </span>
                  <span className="text-[15px] font-mono text-accent-light uppercase tracking-wider">
                    {finding.severity}
                  </span>
                </div>
                <h4 className="text-[15px] font-[family-name:var(--font-display)] font-medium text-heading mb-1">
                  {finding.headline}
                </h4>
                <p className="text-[15px] text-muted leading-relaxed">
                  {finding.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
