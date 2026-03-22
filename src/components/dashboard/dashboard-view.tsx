"use client";

import { useTheme } from "next-themes";
import {
  Sun,
  Moon,
  Settings,
  RefreshCw,
  Shield,
} from "lucide-react";
import type {
  QuarterlyData,
  DailyData,
  AnalysisOutput,
  VerificationReport,
  DailyCrossRef,
} from "@/lib/pipelines/types";
import { fmtAssets, fmtMembers } from "@/lib/format";

import { StatewideOverview } from "./statewide-overview";
import { TierHealth } from "./tier-health";
import { AnomalyFlags } from "./anomaly-flags";
import { EmergingTrends } from "./emerging-trends";
import { RiskConcentrations } from "./risk-concentrations";
import { MarketPulse } from "./market-pulse";
import { StatTile } from "@/components/ui/stat-tile";

/* ── Props ────────────────────────────────────────────────── */

interface DashboardViewProps {
  quarterlyData: QuarterlyData | null;
  dailyData: DailyData | null;
  analysis: AnalysisOutput | null;
  dailyAnalysis: DailyCrossRef | null;
  verification: VerificationReport | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}

/* ── Skeleton helpers ─────────────────────────────────────── */

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[10px] bg-surface-elevated ${className}`}
    />
  );
}

function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} className="h-[72px]" />
      ))}
    </div>
  );
}

function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} className="h-[120px]" />
      ))}
    </div>
  );
}

/* ── Section wrapper ──────────────────────────────────────── */

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card p-5 sm:p-6">
      <div className="font-mono text-[11px] tracking-[0.15em] uppercase text-accent-light mb-4">
        {label}
      </div>
      {children}
    </section>
  );
}

/* ── Data source pills ────────────────────────────────────── */

const DATA_SOURCES = [
  { name: "NCUA", color: "#437481" },
  { name: "FRED", color: "#FBE248" },
  { name: "CFPB", color: "#CF5A5A" },
  { name: "Zillow", color: "#5a9aaa" },
] as const;

/* ── Main component ───────────────────────────────────────── */

export function DashboardView({
  quarterlyData,
  dailyData,
  analysis,
  dailyAnalysis,
  verification,
  loading,
  refreshing,
  onRefresh,
}: DashboardViewProps) {
  const { theme, setTheme } = useTheme();

  const latest = quarterlyData?.quarters[quarterlyData.quarters.length - 1];
  const totalCUs = latest?.statewide.totalCUs;
  const totalAssets = latest?.statewide.totalAssets;
  const totalMembers = latest?.statewide.totalMembers;

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Gradient accent line (DXN signature) */}
      <div className="dxn-gradient-line" />

      {/* Noise texture overlay */}
      <div className="noise-overlay" />

      {/* Background glow */}
      <div className="dashboard-bg fixed inset-0 -z-10" />

      {/* ── Header bar ──────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="dxn-monogram">
              <span className="text-xs font-bold text-heading tracking-tight">
                DX
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-muted uppercase tracking-[0.2em] leading-none">
                Dixon Strategic Labs
              </span>
              <span className="text-sm font-medium text-heading leading-tight font-[family-name:var(--font-display)]">
                Michigan Credit Union Scanner
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="header-icon-btn"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="header-icon-btn" aria-label="Settings">
              <Settings size={16} />
            </button>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="refresh-btn min-h-[44px] ml-2"
            >
              <RefreshCw
                size={14}
                className={refreshing ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">
                {refreshing ? "Refreshing..." : "Refresh"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────── */}
      <main
        id="main-content"
        className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 mb-20"
      >
        {/* ── Hero section ──────────────────────────────── */}
        <section className="text-center mb-12 sm:mb-16">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <SkeletonBlock className="h-14 w-80 max-w-full" />
              <SkeletonBlock className="h-6 w-48" />
            </div>
          ) : (
            <>
              <h1 className="hero-metric font-[family-name:var(--font-display)]">
                <div className="flex flex-col items-center gap-1 sm:gap-0 sm:flex-row sm:flex-wrap sm:justify-center">
                  <span className="flex items-center gap-2 sm:gap-3">
                    <span className="hero-gold">
                      {totalCUs?.toLocaleString() ?? "---"}
                    </span>
                    <span className="text-muted text-base sm:text-2xl font-normal">
                      institutions.
                    </span>
                  </span>
                  <span className="flex items-center gap-2 sm:gap-3">
                    <span className="hero-gold">
                      {totalAssets ? fmtAssets(totalAssets) : "---"}
                    </span>
                    <span className="text-muted text-base sm:text-2xl font-normal">
                      in assets.
                    </span>
                  </span>
                  <span className="text-heading text-base sm:text-2xl font-medium">
                    Scanned daily.
                  </span>
                </div>
              </h1>

              {/* Data source pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
                <span className="text-xs text-muted mr-1">Powered by</span>
                {DATA_SOURCES.map((source) => (
                  <span key={source.name} className="data-source-pill">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: source.color }}
                    />
                    <span className="text-[11px] font-mono text-muted">
                      {source.name}
                    </span>
                  </span>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ── Scanner status bar ────────────────────────── */}
        <div className="glass-card px-4 sm:px-6 py-3 mb-8 sm:mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {loading ? (
            <SkeletonBlock className="h-5 w-64" />
          ) : (
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
              {quarterlyData && (
                <div className="flex items-center gap-2">
                  <span className="text-muted font-mono text-xs">
                    Generated
                  </span>
                  <span className="text-heading font-mono text-xs">
                    {quarterlyData.generatedAt}
                  </span>
                </div>
              )}
              {verification && (
                <div className="flex items-center gap-2">
                  <Shield
                    size={12}
                    className={
                      verification.overallPassed ? "text-success" : "text-coral"
                    }
                  />
                  <span className="text-heading font-mono text-xs">
                    {verification.passedChecks}/{verification.totalChecks}{" "}
                    verified
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="status-dot-live" />
                <span className="text-xs text-success font-mono">Fresh</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Dashboard sections ────────────────────────── */}
        <div className="space-y-6">
          {/* 1. Statewide Overview */}
          <Section label="Statewide Overview">
            {loading || !quarterlyData ? (
              <SkeletonGrid count={6} />
            ) : (
              <StatewideOverview quarters={quarterlyData.quarters} />
            )}
          </Section>

          {/* 2. Tier Health */}
          <Section label="Tier Health">
            {loading || !quarterlyData ? (
              <SkeletonGrid count={5} />
            ) : (
              <TierHealth
                quarters={quarterlyData.quarters}
                analysis={analysis?.sections}
              />
            )}
          </Section>

          {/* 3. Anomaly Flags */}
          <Section label="Anomaly Flags">
            {loading || !quarterlyData ? (
              <SkeletonCards count={3} />
            ) : (
              <AnomalyFlags
                anomalies={quarterlyData.anomalies}
                narratives={analysis?.sections.anomalyNarratives}
              />
            )}
          </Section>

          {/* 4. Emerging Trends */}
          <Section label="Emerging Trends">
            {loading ? (
              <SkeletonCards count={3} />
            ) : (
              <EmergingTrends
                trends={analysis?.sections.emergingTrends}
              />
            )}
          </Section>

          {/* 5. Risk Concentrations */}
          <Section label="Risk Concentrations">
            {loading ? (
              <SkeletonCards count={2} />
            ) : (
              <RiskConcentrations
                risks={analysis?.sections.riskConcentrations}
              />
            )}
          </Section>

          {/* 6. Market Pulse */}
          <Section label="Market Pulse">
            {loading ? (
              <SkeletonGrid count={6} />
            ) : (
              <MarketPulse
                dailyData={dailyData}
                crossref={dailyAnalysis ?? undefined}
              />
            )}
          </Section>

          {/* 7. Key Metrics strip */}
          {!loading && dailyData && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {(() => {
                const fred = dailyData.sources.fred;
                const fredEntries = Object.values(fred).slice(0, 4);
                return fredEntries.map((s) => {
                  const displayValue =
                    s.unit === "Percent" || s.unit === "%"
                      ? `${s.latestValue.toFixed(2)}%`
                      : s.latestValue.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        });
                  return (
                    <StatTile
                      key={s.name}
                      label={s.name}
                      value={displayValue}
                    />
                  );
                });
              })()}
              {!dailyData && totalMembers && (
                <StatTile
                  label="Total Members"
                  value={fmtMembers(totalMembers)}
                />
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-border/30 mt-auto pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
          <span className="font-mono">Dixon Strategic Labs, 2026</span>
          <div className="flex items-center gap-4">
            <a
              href="https://mi.dxn.is"
              className="font-mono hover:text-heading transition-colors"
            >
              mi.dxn.is
            </a>
            {verification && (
              <div className="flex items-center gap-1.5">
                <Shield
                  size={10}
                  className={
                    verification.overallPassed ? "text-success" : "text-coral"
                  }
                />
                <span
                  className={`font-mono ${
                    verification.overallPassed ? "text-success" : "text-coral"
                  }`}
                >
                  {verification.overallPassed ? "Verified" : "Issues Detected"}
                </span>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
