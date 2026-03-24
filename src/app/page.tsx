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
import { MichiganMap } from "@/components/ui/michigan-map";
import { StatewideOverview } from "@/components/dashboard/statewide-overview";
import { TierHealth } from "@/components/dashboard/tier-health";
import { AnomalyFlags } from "@/components/dashboard/anomaly-flags";
import { EmergingTrends } from "@/components/dashboard/emerging-trends";
import { RiskConcentrations } from "@/components/dashboard/risk-concentrations";
import { MarketPulse } from "@/components/dashboard/market-pulse";
import { PresentationView } from "@/components/presentation/presentation-view";
import type {
  QuarterlyData,
  DailyData,
  VerificationReport,
  AnalysisOutput,
  DailyCrossRef,
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
          <div className="flex flex-col items-center gap-1 sm:gap-x-3 sm:gap-y-1 sm:flex-row sm:flex-wrap sm:justify-center">
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
          <span className="text-sm text-muted mr-1">Powered by</span>
          {DATA_SOURCES.map((source) => (
            <span key={source.name} className="data-source-pill">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: source.color }}
              />
              <span className="text-[14px] font-mono text-muted">
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
            <span className="text-muted font-mono text-sm">Last refresh</span>
            <span className="text-heading font-mono text-sm">
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
            <span className="text-sm text-success font-mono">
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
            <div className="flex justify-center mb-4">
              <MichiganMap
                size="lg"
                fillColor="rgba(67,116,129,0.08)"
                strokeColor="var(--color-accent)"
                showDots={true}
                glowColor="rgba(67,116,129,0.15)"
              />
            </div>
            <h2 className="text-xl font-[family-name:var(--font-display)] font-medium text-heading mb-2">
              Ready to Scan
            </h2>
            <p className="text-muted text-[15px] max-w-md mx-auto">
              Click <strong className="text-heading">Refresh Data</strong> in the header above to scan NCUA regulatory filings, FRED economic indicators, CFPB consumer complaints, and Zillow housing data for Michigan.
            </p>
          </div>
          <div className="border-t border-border/30 pt-5 mt-5">
            <p className="text-muted font-mono text-sm">
              First scan: 4 quarters of NCUA data (~171 CUs), 7 FRED economic series, CFPB complaints, and 31 Michigan housing markets. Takes 2-3 minutes.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Statewide Overview */}
          {quarterly?.quarters && quarterly.quarters.length > 0 && (
            <section className="glass-card p-5 sm:p-6">
              <div className="font-mono text-[14px] tracking-[0.15em] uppercase text-accent-light mb-4">
                Statewide Overview
              </div>
              {analysis?.sections?.statewideOverview && (
                <p className="text-[15px] text-foreground leading-relaxed mb-4">
                  {analysis.sections.statewideOverview}
                </p>
              )}
              <StatewideOverview quarters={quarterly.quarters} />
            </section>
          )}

          {/* 2. Tier Health */}
          {quarterly?.quarters && quarterly.quarters.length > 0 && (
            <section className="glass-card p-5 sm:p-6">
              <div className="font-mono text-[14px] tracking-[0.15em] uppercase text-accent-light mb-4">
                Tier Health
              </div>
              <TierHealth
                quarters={quarterly.quarters}
                analysis={analysis?.sections}
              />
            </section>
          )}

          {/* 3. Anomaly Flags */}
          {quarterly?.anomalies && quarterly.anomalies.length > 0 && (
            <section className="glass-card p-5 sm:p-6">
              <div className="font-mono text-[14px] tracking-[0.15em] uppercase text-accent-light mb-4">
                Flags &amp; Anomalies
              </div>
              <AnomalyFlags
                anomalies={quarterly.anomalies}
                narratives={analysis?.sections.anomalyNarratives}
              />
            </section>
          )}

          {/* 4. Emerging Trends */}
          <section className="glass-card p-5 sm:p-6">
            <div className="font-mono text-[14px] tracking-[0.15em] uppercase text-accent-light mb-4">
              Emerging Trends
            </div>
            <EmergingTrends
              trends={analysis?.sections.emergingTrends}
            />
          </section>

          {/* 5. Risk Concentrations */}
          <section className="glass-card p-5 sm:p-6">
            <div className="font-mono text-[14px] tracking-[0.15em] uppercase text-accent-light mb-4">
              Risk Concentrations
            </div>
            <RiskConcentrations
              risks={analysis?.sections.riskConcentrations}
            />
          </section>

          {/* 6. Market Pulse */}
          <section className="glass-card p-5 sm:p-6">
            <div className="font-mono text-[14px] tracking-[0.15em] uppercase text-accent-light mb-4">
              Market Pulse
            </div>
            <MarketPulse
              dailyData={daily}
            />
          </section>

          {/* 7. Key Metrics strip (from daily FRED data) */}
          {daily?.sources?.fred && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {Object.entries(daily.sources.fred)
                .slice(0, 4)
                .map(([key, series]) => (
                  <StatTile
                    key={key}
                    label={series.name}
                    value={
                      series.latestValue != null
                        ? series.unit === "percent" || series.unit === "Percent" || series.unit === "%"
                          ? `${series.latestValue.toFixed(2)}%`
                          : (series.latestValue ?? 0).toLocaleString()
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
        </div>
      )}
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
  const [reasoningLog, setReasoningLog] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (typeof window === "undefined") { setLoading(false); return; }

      // Safely read from localStorage with automatic cleanup on corruption
      let cachedQ: string | null = null;
      let cachedD: string | null = null;
      try {
        cachedQ = localStorage.getItem("mcul-quarterly");
        cachedD = localStorage.getItem("mcul-daily");
      } catch {
        // localStorage unavailable (private browsing, etc.)
      }

      if (cachedQ) {
        try {
          const parsed = JSON.parse(cachedQ);
          // Validate the data has the expected shape before using it
          if (parsed && typeof parsed === "object" && (parsed.quarterly || parsed.quartersAnalyzed)) {
            setData((prev) => ({
              ...prev,
              quarterly: parsed.quarterly || null,
              analysis: parsed.analysis || null,
              verification: parsed.verification || prev.verification || null,
            }));
          } else {
            // Data shape is wrong, clear it
            localStorage.removeItem("mcul-quarterly");
          }
        } catch {
          // Corrupted JSON, clear it
          try { localStorage.removeItem("mcul-quarterly"); } catch { /* ignore */ }
        }
      }
      if (cachedD) {
        try {
          const parsed = JSON.parse(cachedD);
          if (parsed && typeof parsed === "object") {
            setData((prev) => ({
              ...prev,
              daily: parsed.dailyData || parsed,
              verification: parsed.verification || prev.verification || null,
            }));
          } else {
            localStorage.removeItem("mcul-daily");
          }
        } catch {
          try { localStorage.removeItem("mcul-daily"); } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error("Error loading cached data:", err);
      // Nuclear option: clear all cached data if something goes wrong
      try {
        localStorage.removeItem("mcul-quarterly");
        localStorage.removeItem("mcul-daily");
      } catch { /* ignore */ }
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

  const addLog = useCallback((msg: string) => {
    setReasoningLog((prev) => [...prev, `${new Date().toLocaleTimeString()} > ${msg}`]);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setReasoningLog([]);
    try {
      // Step 1: Quarterly NCUA scan
      addLog("Initiating quarterly NCUA pipeline...");
      addLog("Downloading Q1-Q4 2025 call report data from ncua.gov...");
      setRefreshProgress("Downloading NCUA data...");
      const qRes = await fetch("/api/scan/quarterly", { method: "POST" });
      const qData = qRes.ok ? await qRes.json() : null;

      if (qData?.quarterly) {
        const q = qData.quarterly;
        addLog(`Parsed ${q.quartersAnalyzed} quarters of data for ${q.quarters?.[q.quarters.length - 1]?.statewide?.totalCUs || "?"} Michigan credit unions.`);
        addLog(`Aggregate assets: $${(q.quarters?.[q.quarters.length - 1]?.statewide?.totalAssets / 1e9).toFixed(1)}B`);
        addLog(`Detected ${q.anomalies?.length || 0} anomalies across ${Object.keys(q.quarters?.[q.quarters.length - 1]?.tiers || {}).length} asset tiers.`);
        if (qData.analysis?.sections?.statewideOverview && qData.analysis.model !== "none") {
          addLog("AI narratives generated and verified.");
        } else {
          addLog("Data loaded. AI narratives pending (no API key).");
        }
        if (qData.verification) {
          addLog(`Verification: ${qData.verification.passedChecks}/${qData.verification.totalChecks} checks passed.`);
        }
        setData((prev) => ({
          ...prev,
          quarterly: qData.quarterly,
          analysis: qData.analysis,
          verification: qData.verification,
        }));
        localStorage.setItem("mcul-quarterly", JSON.stringify(qData));
      } else {
        addLog("Quarterly scan returned no data. Check server logs.");
      }

      // Step 2: Daily market pulse
      addLog("Initiating daily market pulse scan...");
      addLog("Fetching FRED economic indicators (7 series)...");
      addLog("Fetching CFPB consumer complaints (Michigan CUs)...");
      addLog("Fetching Zillow housing data (Michigan MSAs)...");
      setRefreshProgress("Fetching market data...");
      const dailyBody: Record<string, unknown> = {};
      if (qData?.quarterly) {
        dailyBody.quarterly = qData.quarterly;
      }
      const dRes = await fetch("/api/scan/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dailyBody),
      });
      const dData = dRes.ok ? await dRes.json() : null;

      if (dData) {
        // Check if FRED data is empty (Vercel IP blocked by FRED API)
        const dailySources = dData.dailyData?.sources || dData.sources || {};
        let fredData = dailySources.fred || {};
        // Filter out _errors key
        const fredSeriesKeys = Object.keys(fredData).filter(k => !k.startsWith("_"));

        if (fredSeriesKeys.length === 0) {
          addLog("FRED data empty from server (IP blocked). Fetching from browser...");
          try {
            const FRED_KEY = "c8e42acf745638e304bbd1328ff2c980";
            const SERIES = ["MIUR","MORTGAGE30US","UMCSENT","ICSA","MIBPPRIVSA","FEDFUNDS","CPIAUCSL"];
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const startDate = oneYearAgo.toISOString().slice(0, 10);

            const fredResults: Record<string, unknown> = {};
            for (const sid of SERIES) {
              try {
                const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${sid}&api_key=${FRED_KEY}&file_type=json&observation_start=${startDate}&sort_order=desc&limit=12`;
                const r = await fetch(url);
                if (r.ok) {
                  const json = await r.json();
                  const obs = (json.observations || [])
                    .filter((o: {value: string}) => o.value !== ".")
                    .map((o: {date: string; value: string}) => ({ date: o.date, value: parseFloat(o.value) }));
                  if (obs.length >= 2) {
                    fredResults[sid] = {
                      name: sid,
                      frequency: "monthly",
                      unit: "%",
                      latestDate: obs[0].date,
                      latestValue: obs[0].value,
                      previousDate: obs[1].date,
                      previousValue: obs[1].value,
                      change: Math.round((obs[0].value - obs[1].value) * 10000) / 10000,
                      pctChange: obs[1].value ? Math.round(((obs[0].value - obs[1].value) / obs[1].value) * 10000) / 100 : 0,
                      observations: obs.slice(0, 6),
                    };
                  }
                }
              } catch { /* skip individual series errors */ }
            }

            const NAMES: Record<string, string> = {
              MIUR: "Michigan Unemployment Rate",
              MORTGAGE30US: "30-Year Mortgage Rate",
              UMCSENT: "Consumer Sentiment (U of M)",
              ICSA: "Initial Jobless Claims",
              MIBPPRIVSA: "Michigan Building Permits (SA)",
              FEDFUNDS: "Federal Funds Rate",
              CPIAUCSL: "CPI All Urban (SA)",
            };
            for (const [k, v] of Object.entries(fredResults)) {
              (v as Record<string, unknown>).name = NAMES[k] || k;
            }

            if (Object.keys(fredResults).length > 0) {
              fredData = fredResults as Record<string, never>;
              if (dData.dailyData?.sources) {
                dData.dailyData.sources.fred = fredResults;
              } else if (dData.sources) {
                dData.sources.fred = fredResults;
              }
              addLog(`FRED: ${Object.keys(fredResults).length} series fetched from browser.`);
            } else {
              addLog("FRED: browser fetch also failed.");
            }
          } catch (fredErr) {
            addLog(`FRED browser fetch error: ${fredErr}`);
          }
        }

        const fredCount = Object.keys(fredData).filter(k => !k.startsWith("_")).length;
        const cfpbTotal = dailySources.cfpb?.total || 0;
        const zillowCount = (dailySources.zillow?.zhvi || []).length;
        addLog(`FRED: ${fredCount} economic indicators loaded.`);
        addLog(`CFPB: ${cfpbTotal} complaints in the last 90 days.`);
        addLog(`Zillow: ${zillowCount} Michigan MSAs with housing data.`);
        const findings = dData.crossref?.findings || dData.dailyCrossref?.findings || [];
        if (findings.length > 0) {
          addLog(`Cross-reference engine: ${findings.length} findings generated.`);
        }
        setData((prev) => ({
          ...prev,
          daily: dData.dailyData || dData,
          verification: dData.verification || prev.verification,
        }));
        localStorage.setItem("mcul-daily", JSON.stringify(dData));
      } else {
        addLog("Daily scan returned no data. Some sources may be unavailable.");
      }

      addLog("Scan complete.");
      setRefreshProgress(undefined);
    } catch (err) {
      console.error("Refresh failed:", err);
      addLog(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setRefreshProgress("Refresh failed. See log below.");
    } finally {
      setRefreshing(false);
    }
  }, [addLog]);

  if (mode === "present") {
    return (
      <>
        <div className="dxn-gradient-line" />
        <PresentationView data={{
          quarterlyData: data.quarterly,
          dailyData: data.daily,
          analysis: data.analysis,
        }} />
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

      {/* Michigan watermark */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-5 pointer-events-none opacity-[0.02]">
        <MichiganMap size="hero" strokeColor="var(--color-accent)" />
      </div>

      {/* Header bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* DX Monogram */}
            <div className="dxn-monogram">
              <span className="text-sm font-bold text-heading tracking-tight">
                DX
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-mono text-muted uppercase tracking-[0.2em] leading-none">
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

      {/* Reasoning log (visible during and after refresh) */}
      {reasoningLog.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <span className="font-mono text-sm uppercase tracking-widest" style={{ color: "var(--color-accent-light)" }}>
                {refreshing ? "Scanning..." : "Scan Log"}
              </span>
              {!refreshing && (
                <button
                  onClick={() => setReasoningLog([])}
                  className="text-sm font-mono hover:opacity-70 transition-opacity"
                  style={{ color: "var(--color-muted)" }}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="px-4 py-3 max-h-64 overflow-y-auto space-y-1">
              {reasoningLog.map((line, i) => (
                <div
                  key={i}
                  className="font-mono text-sm leading-relaxed"
                  style={{
                    color: line.includes("Error") ? "var(--color-coral)" :
                           line.includes("complete") || line.includes("passed") ? "var(--color-success)" :
                           "var(--color-muted)",
                    animation: i === reasoningLog.length - 1 && refreshing ? "fadeIn 0.3s ease" : undefined,
                  }}
                >
                  {line}
                </div>
              ))}
              {refreshing && (
                <div className="font-mono text-sm animate-pulse" style={{ color: "var(--color-accent-light)" }}>
                  &gt; ...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted">
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
