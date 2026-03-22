"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Settings } from "lucide-react";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { RefreshButton } from "@/components/ui/refresh-button";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { FlagCard } from "@/components/ui/flag-card";
import type {
  QuarterlyData,
  DailyData,
  VerificationReport,
  AnalysisOutput,
} from "@/lib/pipelines/types";

// ── Static data ─────────────────────────────────────────────────────────────

const DATA_SOURCES = [
  { name: "NCUA", color: "#437481" },
  { name: "FRED", color: "#FBE248" },
  { name: "CFPB", color: "#CF5A5A" },
  { name: "Zillow", color: "#5a9aaa" },
] as const;

// ── Types for page state ────────────────────────────────────────────────────

interface ScannerData {
  quarterly: QuarterlyData | null;
  daily: DailyData | null;
  verification: VerificationReport | null;
  analysis: AnalysisOutput | null;
}

// ── Skeleton loader ─────────────────────────────────────────────────────────

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-surface-elevated ${className ?? ""}`}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero skeleton */}
      <section className="text-center mb-12 sm:mb-16">
        <SkeletonPulse className="h-12 w-96 mx-auto mb-4" />
        <div className="flex justify-center gap-2 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonPulse key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
      </section>

      {/* Status bar skeleton */}
      <SkeletonPulse className="h-14 w-full rounded-lg" />

      {/* Two-column skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        <div className="lg:col-span-3 space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonPulse key={i} className="h-12 w-full" />
          ))}
        </div>
        <div className="lg:col-span-2 space-y-1">
          {[1, 2, 3].map((i) => (
            <SkeletonPulse key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>

      {/* Metrics strip skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonPulse key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ── Dashboard View ──────────────────────────────────────────────────────────

function DashboardView({
  data,
  loading,
  refreshing,
  onRefresh,
  refreshProgress,
}: {
  data: ScannerData;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  refreshProgress?: string;
}) {
  const { quarterly, daily, verification, analysis } = data;
  const latestQuarter = quarterly?.quarters?.[quarterly.quarters.length - 1];

  return (
    <main
      id="main-content"
      className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 mb-20"
    >
      {/* Hero section */}
      <section className="text-center mb-12 sm:mb-16">
        <h1 className="hero-metric font-[family-name:var(--font-display)]">
          <div className="flex flex-col items-center gap-1 sm:gap-0 sm:flex-row sm:flex-wrap sm:justify-center">
            <span className="flex items-center gap-2 sm:gap-3">
              <span className="hero-gold">
                {latestQuarter?.statewide?.totalCUs ?? "171"}
              </span>
              <span className="text-muted text-base sm:text-2xl font-normal">
                institutions.
              </span>
            </span>
            <span className="flex items-center gap-2 sm:gap-3">
              <span className="hero-gold">
                {latestQuarter?.statewide?.totalAssets
                  ? `$${(latestQuarter.statewide.totalAssets / 1e9).toFixed(1)}B`
                  : "$115.4B"}
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
      </section>

      {/* Scanner status bar */}
      <div className="glass-card px-4 sm:px-6 py-3 mb-8 sm:mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted font-mono text-xs">Last refresh</span>
            <span className="text-heading font-mono text-xs">
              {quarterly?.generatedAt
                ? new Date(quarterly.generatedAt).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "No data yet"}
            </span>
          </div>
          {verification && (
            <VerificationBadge
              passedChecks={verification.passedChecks}
              totalChecks={verification.totalChecks}
              verifiedAt={verification.verifiedAt}
            />
          )}
          <div className="flex items-center gap-2">
            <span className="status-dot-live" />
            <span className="text-xs text-success font-mono">
              {quarterly ? "Fresh" : "Awaiting scan"}
            </span>
          </div>
        </div>
        <RefreshButton
          onRefresh={onRefresh}
          loading={refreshing}
          progress={refreshProgress}
        />
      </div>

      {loading && !quarterly ? (
        <DashboardSkeleton />
      ) : !quarterly && !daily ? (
        /* Empty state: no data available yet */
        <div className="glass-card p-12 sm:p-16 text-center max-w-2xl mx-auto">
          <div className="mb-6">
            <div className="w-12 h-12 rounded-xl mx-auto mb-4" style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-light))" }}>
              <span className="flex items-center justify-center h-full text-white font-bold text-sm">MI</span>
            </div>
            <h2 className="text-xl font-[family-name:var(--font-display)] font-medium text-heading mb-2">
              Ready to Scan
            </h2>
            <p className="text-muted text-[15px] max-w-md mx-auto">
              Click <strong className="text-heading">Refresh Data</strong> in the header above to download NCUA call report data for all Michigan credit unions and generate your first analysis.
            </p>
          </div>
          <div className="border-t border-border/30 pt-5 mt-5">
            <p className="text-muted font-mono text-xs">
              The first scan downloads 4 quarters of regulatory data across ~171 institutions. Takes 2-3 minutes.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Key Metrics strip (from daily data) */}
          {daily?.sources?.fred && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              {Object.entries(daily.sources.fred)
                .slice(0, 4)
                .map(([key, series]) => (
                  <StatTile
                    key={key}
                    label={series.name}
                    value={
                      series.latestValue != null
                        ? series.unit === "percent"
                          ? `${series.latestValue.toFixed(2)}%`
                          : series.latestValue.toLocaleString()
                        : "N/A"
                    }
                    change={
                      series.yoyPctChange != null
                        ? `${series.yoyPctChange > 0 ? "+" : ""}${series.yoyPctChange.toFixed(1)}% YoY`
                        : undefined
                    }
                    changeType={
                      series.significant
                        ? series.yoyPctChange && series.yoyPctChange > 0
                          ? "negative"
                          : "positive"
                        : "neutral"
                    }
                  />
                ))}
            </div>
          )}

          {/* Anomalies and Flags */}
          {quarterly?.anomalies && quarterly.anomalies.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-[family-name:var(--font-display)] font-medium text-heading mb-3">
                Flags &amp; Anomalies
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quarterly.anomalies.slice(0, 6).map((anomaly, i) => (
                  <FlagCard
                    key={i}
                    severity={anomaly.severity}
                    category={anomaly.category}
                    headline={anomaly.headline}
                    narrative={anomaly.detail}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Analysis narratives (from analysis output) */}
          {analysis?.sections?.anomalyNarratives &&
            analysis.sections.anomalyNarratives.length > 0 && (
              <section className="mb-6">
                <h2 className="text-sm font-[family-name:var(--font-display)] font-medium text-heading mb-3">
                  Analysis Narratives
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysis.sections.anomalyNarratives.map((narrative, i) => (
                    <FlagCard
                      key={i}
                      severity={
                        (narrative.severity as
                          | "CRITICAL"
                          | "WARNING"
                          | "INFO"
                          | "OPPORTUNITY") || "INFO"
                      }
                      category={narrative.category}
                      headline={narrative.headline}
                      narrative={narrative.narrative}
                      watchItems={narrative.watchItems}
                    />
                  ))}
                </div>
              </section>
            )}

          {/* Risk concentrations */}
          {analysis?.sections?.riskConcentrations &&
            analysis.sections.riskConcentrations.length > 0 && (
              <section className="mb-6">
                <h2 className="text-sm font-[family-name:var(--font-display)] font-medium text-heading mb-3">
                  Risk Concentrations
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysis.sections.riskConcentrations.map((risk, i) => (
                    <FlagCard
                      key={i}
                      severity={risk.severity}
                      headline={risk.riskName}
                      narrative={`${risk.evidence} ${risk.implication}`}
                    />
                  ))}
                </div>
              </section>
            )}
        </>
      )}
    </main>
  );
}

// ── Presentation View (placeholder) ─────────────────────────────────────────

function PresentationView({ data }: { data: ScannerData }) {
  const latestQuarter =
    data.quarterly?.quarters?.[data.quarterly.quarters.length - 1];

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-4xl w-full text-center space-y-8">
        <h1 className="hero-metric font-[family-name:var(--font-display)]">
          <span className="hero-gold">
            {latestQuarter?.statewide?.totalCUs ?? "171"}
          </span>{" "}
          <span className="text-heading text-2xl font-normal">
            Michigan Credit Unions
          </span>
        </h1>
        <p className="text-muted font-mono text-sm">
          Presentation mode. Full view coming soon.
        </p>
      </div>
    </main>
  );
}

// ── Inner page (uses hooks that need Suspense boundary) ─────────────────────

function HomeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = searchParams.get("mode") || "dashboard";

  const [data, setData] = useState<ScannerData>({
    quarterly: null,
    daily: null,
    verification: null,
    analysis: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<string | undefined>();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [q, d, v] = await Promise.allSettled([
        fetch("/api/data/quarterly").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/data/daily").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/data/verification").then((r) => (r.ok ? r.json() : null)),
      ]);
      setData({
        quarterly: q.status === "fulfilled" ? q.value : null,
        daily: d.status === "fulfilled" ? d.value : null,
        verification: v.status === "fulfilled" ? v.value : null,
        analysis: null, // loaded separately when available
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keyboard: P to toggle presentation mode
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "p" || e.key === "P") {
        if (mode === "present") {
          router.push("/");
        } else {
          router.push("/?mode=present");
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setRefreshProgress("Running quarterly scan...");
      await fetch("/api/scan/quarterly", { method: "POST" });

      setRefreshProgress("Running daily scan...");
      await fetch("/api/scan/daily", { method: "POST" });

      setRefreshProgress("Loading fresh data...");
      await fetchData();
    } finally {
      setRefreshing(false);
      setRefreshProgress(undefined);
    }
  }, [fetchData]);

  if (mode === "present") {
    return (
      <>
        <div className="dxn-gradient-line" />
        <PresentationView data={data} />
        <ModeToggle />
      </>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Gradient accent line (DXN signature) */}
      <div className="dxn-gradient-line" />

      {/* Noise texture overlay */}
      <div className="noise-overlay" />

      {/* Background glow */}
      <div className="dashboard-bg fixed inset-0 -z-10" />

      {/* Header bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* DX Monogram */}
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
            <ThemeToggle />
            <button className="header-icon-btn" aria-label="Settings">
              <Settings size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <DashboardView
        data={data}
        loading={loading}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        refreshProgress={refreshProgress}
      />

      {/* Presentation mode toggle */}
      <ModeToggle />

      {/* Footer */}
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
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Exported page with Suspense boundary for useSearchParams ────────────────

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-screen flex flex-col">
          <div className="dxn-gradient-line" />
          <div className="noise-overlay" />
          <div className="dashboard-bg fixed inset-0 -z-10" />
          <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <DashboardSkeleton />
          </div>
        </div>
      }
    >
      <HomeInner />
    </Suspense>
  );
}
