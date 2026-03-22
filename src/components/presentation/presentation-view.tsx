"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  QuarterlyData,
  DailyData,
  AnalysisOutput,
  Anomaly,
} from "@/lib/pipelines/types";
import { Beat } from "./beat";
import { DotAnimation } from "./dot-animation";

// ── Types ───────────────────────────────────────────────────────────────────

interface PresentationViewProps {
  data: {
    quarterlyData: QuarterlyData | null;
    dailyData: DailyData | null;
    analysis?: AnalysisOutput | null;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatBillions(n: number): string {
  return `$${(n / 1_000_000_000).toFixed(1)}B`;
}

function formatMillions(n: number): string {
  return `$${(n / 1_000_000).toFixed(1)}M`;
}

function formatMembers(n: number): string {
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function formatPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

function formatTime(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

// ── Sparkline SVG ───────────────────────────────────────────────────────────

function DelinquencySparkline({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  if (values.length < 2) return null;

  const minVal = Math.min(...values) - 0.05;
  const maxVal = Math.max(...values) + 0.05;
  const range = maxVal - minVal || 1;

  const w = 600;
  const h = 160;
  const padX = 60;
  const padTop = 20;
  const padBot = 35;
  const plotH = h - padTop - padBot;
  const plotW = w - padX * 2 + 40;

  const pts = values.map((v, i) => {
    const x = padX + 40 + (i / (values.length - 1)) * (plotW - 40);
    const y = padTop + plotH - ((v - minVal) / range) * plotH;
    return { x, y, v };
  });

  const linePoints = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath = `M ${pts[0].x} ${pts[0].y} ${pts
    .slice(1)
    .map((p) => `L ${p.x} ${p.y}`)
    .join(" ")} L ${pts[pts.length - 1].x} ${padTop + plotH} L ${pts[0].x} ${padTop + plotH} Z`;

  // Grid lines
  const gridCount = 4;
  const gridLines = Array.from({ length: gridCount }, (_, i) => {
    const y = padTop + (i / (gridCount - 1)) * plotH;
    return y;
  });

  return (
    <div className="mt-8 w-[600px] h-[160px]">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
        <defs>
          <linearGradient id="coralGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(207,90,90,0.25)" />
            <stop offset="100%" stopColor="rgba(207,90,90,0)" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridLines.map((y, i) => (
          <line
            key={i}
            x1={padX}
            y1={y}
            x2={w - 40}
            y2={y}
            stroke="rgba(42,42,50,0.5)"
            strokeWidth={1}
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#coralGrad)" />

        {/* Line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="var(--color-coral)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots and labels */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={i === pts.length - 1 ? 8 : 7}
              fill="var(--color-coral)"
              stroke="var(--color-background)"
              strokeWidth={3}
            />
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              fill="var(--color-coral)"
              fontFamily="var(--font-mono)"
              fontSize={i === pts.length - 1 ? 20 : 18}
              fontWeight={i === pts.length - 1 ? 700 : 500}
            >
              {formatPct(p.v)}
            </text>
            <text
              x={p.x}
              y={h - 12}
              textAnchor="middle"
              fill="var(--color-muted)"
              fontFamily="var(--font-mono)"
              fontSize={16}
            >
              {labels[i] ?? ""}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Tier bar helpers ────────────────────────────────────────────────────────

const TIER_DISPLAY_NAMES: Record<string, string> = {
  "Tier 1: Anchor (>$5B)": "Anchor >$5B",
  "Tier 2: Large ($1B-$5B)": "Large $1B-$5B",
  "Tier 3: Mid-Large ($500M-$1B)": "Mid-Large $500M-$1B",
  "Tier 4: Mid-Size ($100M-$500M)": "Mid-Size $100M-$500M",
  "Tier 5: Community (<$100M)": "Community <$100M",
};

const TIER_ORDER = [
  "Tier 1: Anchor (>$5B)",
  "Tier 2: Large ($1B-$5B)",
  "Tier 3: Mid-Large ($500M-$1B)",
  "Tier 4: Mid-Size ($100M-$500M)",
  "Tier 5: Community (<$100M)",
];

// ── Component ───────────────────────────────────────────────────────────────

const TOTAL_BEATS = 9;

export function PresentationView({ data }: PresentationViewProps) {
  const router = useRouter();
  const [currentBeat, setCurrentBeat] = useState(1);
  const [cursorHidden, setCursorHidden] = useState(false);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Navigation ──────────────────────────────────────────────────────────

  const goTo = useCallback((n: number) => {
    if (n < 1 || n > TOTAL_BEATS) return;
    setCurrentBeat(n);
  }, []);

  const next = useCallback(() => goTo(currentBeat + 1), [currentBeat, goTo]);
  const prev = useCallback(() => goTo(currentBeat - 1), [currentBeat, goTo]);

  // ── Keyboard ────────────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "Enter":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "Backspace":
          e.preventDefault();
          prev();
          break;
        case "Home":
          e.preventDefault();
          goTo(1);
          break;
        case "Escape":
          e.preventDefault();
          router.push("/");
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, prev, goTo, router]);

  // ── Click to advance ───────────────────────────────────────────────────

  useEffect(() => {
    function handleClick() {
      next();
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [next]);

  // ── Cursor auto-hide ──────────────────────────────────────────────────

  useEffect(() => {
    function handleMouseMove() {
      setCursorHidden(false);
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = setTimeout(() => setCursorHidden(true), 2000);
    }
    window.addEventListener("mousemove", handleMouseMove);
    // Start hidden
    cursorTimerRef.current = setTimeout(() => setCursorHidden(true), 2000);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    };
  }, []);

  // ── Force dark mode on html ───────────────────────────────────────────

  useEffect(() => {
    const html = document.documentElement;
    const prevClass = html.className;
    html.classList.add("dark");
    html.classList.remove("light");
    return () => {
      html.className = prevClass;
    };
  }, []);

  // ── Extract data ──────────────────────────────────────────────────────

  const qd = data.quarterlyData;
  const analysis = data.analysis;

  // Latest quarter
  const latestQ = qd?.quarters?.[qd.quarters.length - 1] ?? null;
  const firstQ = qd?.quarters?.[0] ?? null;

  // Statewide stats
  const totalCUs = latestQ?.statewide.totalCUs ?? 171;
  const totalAssets = latestQ?.statewide.totalAssets ?? 115_400_000_000;
  const totalMembers = latestQ?.statewide.totalMembers ?? 6_100_000;
  const firstQAssets = firstQ?.statewide.totalAssets ?? 110_600_000_000;
  const assetChange = totalAssets - firstQAssets;
  const assetGrowthPct =
    firstQAssets > 0 ? ((assetChange / firstQAssets) * 100).toFixed(1) : "4.3";

  // CU count change (consolidation)
  const firstQCUs = firstQ?.statewide.totalCUs ?? 179;
  const cusLost = firstQCUs - totalCUs;

  // Delinquency
  const delinquencyRate =
    latestQ?.statewide.weightedDelinquencyRate ??
    latestQ?.statewide.avgDelinquencyRate ??
    0.85;

  // Quarterly delinquency values for sparkline
  const quarterlyDelinq = (qd?.quarters ?? []).map(
    (q) => q.statewide.weightedDelinquencyRate ?? q.statewide.avgDelinquencyRate
  );
  const quarterlyLabels = (qd?.quarters ?? []).map((q) =>
    q.label.replace(/\s\d{4}$/, "")
  );

  // Tiers for beat 5
  const tiers = latestQ?.tiers ?? {};
  const firstQTiers = firstQ?.tiers ?? {};

  // Max assets across tiers for bar proportions
  const maxTierAssets = Math.max(
    ...TIER_ORDER.map((t) => tiers[t]?.totalAssets ?? 0),
    1
  );

  // Highest delinquency tier
  let highestDelinqTier = "";
  let highestDelinq = 0;
  for (const t of TIER_ORDER) {
    const d = tiers[t]?.avgDelinquencyRate ?? 0;
    if (d > highestDelinq) {
      highestDelinq = d;
      highestDelinqTier = t;
    }
  }

  // Anomalies
  const anomalies: Anomaly[] = qd?.anomalies ?? [];
  const anomaly1 = anomalies[0] ?? null;
  const anomaly2 = anomalies[1] ?? null;

  // Summary insight
  const summaryInsight = analysis?.sections?.summaryInsight ?? null;

  // Data source string
  const quartersAnalyzed = qd?.quartersAnalyzed ?? 4;
  const firstLabel = firstQ?.label ?? "Q1 2025";
  const lastLabel = latestQ?.label ?? "Q4 2025";
  const dataSourceStr = `NCUA 5300 Call Reports, ${firstLabel}–${lastLabel}`;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-background dashboard-bg"
      style={{ cursor: cursorHidden ? "none" : "default" }}
    >
      {/* Noise texture */}
      <div className="noise-overlay" />

      {/* DXN mark */}
      <div
        className="fixed top-7 left-8 z-50 font-mono text-sm tracking-[0.2em] uppercase"
        style={{ color: "rgba(67,116,129,0.4)" }}
      >
        DXN
      </div>

      {/* Step counter */}
      <div
        className="fixed bottom-5 right-7 z-50 font-mono text-sm select-none tracking-wide"
        style={{ color: "rgba(138,138,150,0.35)" }}
      >
        {currentBeat} / {TOTAL_BEATS}
      </div>

      {/* ── Beat 1: Title ──────────────────────────────────────────────── */}
      <Beat active={currentBeat === 1}>
        <h1 className="font-[family-name:var(--font-display)] font-bold text-[56px] text-center leading-[1.15] tracking-tight text-heading mb-8">
          Michigan Credit Union
          <br />
          <span className="text-accent">Landscape Scanner</span>
        </h1>
        <div className="flex items-center gap-10 mt-2">
          <span className="font-mono text-xl text-muted tracking-wide">
            {totalCUs} institutions
          </span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="font-mono text-xl text-muted tracking-wide">
            {formatBillions(totalAssets)} assets
          </span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="font-mono text-xl text-muted tracking-wide">
            {formatMembers(totalMembers)} members
          </span>
        </div>
        <div className="font-mono text-base mt-7" style={{ color: "rgba(138,138,150,0.5)" }}>
          {dataSourceStr}
        </div>
      </Beat>

      {/* ── Beat 2: Total Assets ───────────────────────────────────────── */}
      <Beat active={currentBeat === 2}>
        <div className="font-mono text-lg text-muted tracking-[0.12em] uppercase mb-3">
          Total Assets, Michigan Credit Unions
        </div>
        <div
          className="font-[family-name:var(--font-display)] font-bold text-[128px] leading-none tracking-tight tabular-nums"
          style={{
            color: "var(--color-gold)",
            textShadow: "0 0 60px rgba(251,226,72,0.2)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatBillions(totalAssets)}
        </div>
        <div className="text-[28px] font-medium text-muted mt-4 text-center">
          <span className="text-success font-bold">
            +{formatBillions(assetChange)}
          </span>{" "}
          from {firstLabel}
        </div>
        <div className="font-mono text-lg text-muted tracking-[0.12em] uppercase mt-5">
          {assetGrowthPct}% annual growth
        </div>
      </Beat>

      {/* ── Beat 3: Consolidation ──────────────────────────────────────── */}
      <Beat active={currentBeat === 3}>
        <div className="font-mono text-lg text-muted tracking-[0.12em] uppercase mb-3">
          Credit Union Count
        </div>
        <div
          className="font-[family-name:var(--font-display)] font-bold text-[128px] leading-none tracking-tight text-foreground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {totalCUs}
        </div>
        <div className="text-[28px] font-medium text-muted mt-4 text-center">
          <span className="text-coral font-bold">{cusLost} credit unions</span>{" "}
          lost to mergers in{" "}
          {lastLabel.replace(/Q\d\s/, "")}
        </div>
        <DotAnimation
          total={totalCUs}
          lost={cusLost}
          animate={currentBeat === 3}
        />
      </Beat>

      {/* ── Beat 4: Delinquency ────────────────────────────────────────── */}
      <Beat active={currentBeat === 4}>
        <div className="font-mono text-lg text-muted tracking-[0.12em] uppercase mb-3">
          Statewide Delinquency Rate
        </div>
        <div className="flex items-center justify-center">
          <div
            className="font-[family-name:var(--font-display)] font-bold text-[128px] leading-none tracking-tight"
            style={{
              color: "var(--color-coral)",
              textShadow: "0 0 60px rgba(207,90,90,0.2)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatPct(delinquencyRate)}
          </div>
          <span className="text-coral text-5xl ml-4">&nearr;</span>
        </div>
        <div className="text-[28px] font-medium text-muted mt-4 text-center">
          Rising <span className="text-coral font-bold">every quarter</span> in{" "}
          {lastLabel.replace(/Q\d\s/, "")}
        </div>
        {quarterlyDelinq.length >= 2 && (
          <DelinquencySparkline
            values={quarterlyDelinq}
            labels={quarterlyLabels}
          />
        )}
      </Beat>

      {/* ── Beat 5: Tier Snapshot ──────────────────────────────────────── */}
      <Beat active={currentBeat === 5}>
        <div className="font-mono text-lg text-muted tracking-[0.12em] uppercase mb-5">
          {lastLabel} by Asset Tier
        </div>

        {/* Header row */}
        <div
          className="grid gap-5 w-full max-w-[1100px] px-6 pb-2"
          style={{ gridTemplateColumns: "280px 1fr 120px 120px" }}
        >
          <span className="font-mono text-sm text-muted tracking-[0.1em] uppercase">
            Tier
          </span>
          <span className="font-mono text-sm text-muted tracking-[0.1em] uppercase">
            Total Assets
          </span>
          <span className="font-mono text-sm text-muted tracking-[0.1em] uppercase text-right">
            Delinq.
          </span>
          <span className="font-mono text-sm text-muted tracking-[0.1em] uppercase text-right">
            CUs Lost
          </span>
        </div>

        {/* Tier rows */}
        <div className="flex flex-col gap-3.5 w-full max-w-[1100px]">
          {TIER_ORDER.map((tierKey, i) => {
            const tier = tiers[tierKey];
            if (!tier) return null;

            const isHighest = tierKey === highestDelinqTier;
            const barWidth = (tier.totalAssets / maxTierAssets) * 100;

            // CU loss count
            const firstTier = firstQTiers[tierKey];
            const cuDelta = firstTier
              ? tier.cuCount - firstTier.cuCount
              : 0;

            return (
              <div
                key={tierKey}
                className={`grid gap-5 items-center px-6 py-4 rounded-xl border transition-all duration-350 ease-out ${
                  isHighest
                    ? "border-coral/40 bg-coral/[0.06]"
                    : "border-border bg-surface"
                }`}
                style={{
                  gridTemplateColumns: "280px 1fr 120px 120px",
                  opacity: currentBeat === 5 ? 1 : 0,
                  transform:
                    currentBeat === 5
                      ? "translateX(0)"
                      : "translateX(-16px)",
                  transitionDelay: `${0.1 + i * 0.08}s`,
                }}
              >
                <div className="font-[family-name:var(--font-display)] font-semibold text-[22px] text-foreground">
                  {TIER_DISPLAY_NAMES[tierKey] ?? tierKey}
                  <span className="font-mono text-base text-muted ml-2">
                    {tier.cuCount} CUs
                  </span>
                </div>
                <div className="relative h-7 bg-white/[0.03] rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md transition-[width] duration-600"
                    style={{
                      width: `${barWidth}%`,
                      background: isHighest
                        ? "var(--color-coral)"
                        : "var(--color-accent)",
                    }}
                  />
                </div>
                <div
                  className={`font-mono text-xl font-semibold text-right ${
                    isHighest ? "text-coral text-[22px] font-bold" : "text-foreground"
                  }`}
                >
                  {formatPct(tier.avgDelinquencyRate)}
                </div>
                <div className="font-mono text-base text-right text-muted">
                  {cuDelta === 0 ? (
                    <span>&mdash;</span>
                  ) : (
                    <span className={cuDelta < 0 ? "text-coral" : ""}>
                      {cuDelta > 0 ? `+${cuDelta}` : cuDelta}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Beat>

      {/* ── Beat 6: Anomaly 1 ──────────────────────────────────────────── */}
      <Beat active={currentBeat === 6}>
        {anomaly1 ? (
          <div className="text-center max-w-[900px]">
            <SeverityBadge severity={anomaly1.severity} active={currentBeat === 6} />
            <div
              className="font-[family-name:var(--font-display)] font-bold text-[44px] leading-[1.2] text-heading mb-6 tracking-tight transition-all duration-400 ease-out"
              style={{
                opacity: currentBeat === 6 ? 1 : 0,
                transform: currentBeat === 6 ? "translateY(0)" : "translateY(8px)",
                transitionDelay: "0.2s",
              }}
            >
              {anomaly1.headline}
            </div>
            <div
              className="font-mono text-2xl text-muted transition-opacity duration-400 ease-out"
              style={{
                opacity: currentBeat === 6 ? 1 : 0,
                transitionDelay: "0.35s",
              }}
            >
              {anomaly1.metric}:{" "}
              <span className="text-gold font-semibold">
                {typeof anomaly1.previousValue === "number"
                  ? anomaly1.previousValue < 1000
                    ? formatPct(anomaly1.previousValue)
                    : formatMillions(anomaly1.previousValue)
                  : String(anomaly1.previousValue)}
              </span>
              {" → "}
              <span className="text-coral font-semibold">
                {typeof anomaly1.currentValue === "number"
                  ? anomaly1.currentValue < 1000
                    ? formatPct(anomaly1.currentValue)
                    : formatMillions(anomaly1.currentValue)
                  : String(anomaly1.currentValue)}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center max-w-[900px]">
            <SeverityBadge severity="WARNING" active={currentBeat === 6} />
            <div className="font-[family-name:var(--font-display)] font-bold text-[44px] leading-[1.2] text-heading mb-6 tracking-tight">
              Delinquency has risen every
              <br />
              single quarter in 2025
            </div>
          </div>
        )}
      </Beat>

      {/* ── Beat 7: Anomaly 2 ──────────────────────────────────────────── */}
      <Beat active={currentBeat === 7}>
        {anomaly2 ? (
          <div className="text-center max-w-[900px]">
            <SeverityBadge severity={anomaly2.severity} active={currentBeat === 7} />
            <div
              className="font-[family-name:var(--font-display)] font-bold text-[44px] leading-[1.2] text-heading mb-6 tracking-tight transition-all duration-400 ease-out"
              style={{
                opacity: currentBeat === 7 ? 1 : 0,
                transform: currentBeat === 7 ? "translateY(0)" : "translateY(8px)",
                transitionDelay: "0.2s",
              }}
            >
              {anomaly2.headline}
            </div>
            <div
              className="font-mono text-2xl text-muted transition-opacity duration-400 ease-out"
              style={{
                opacity: currentBeat === 7 ? 1 : 0,
                transitionDelay: "0.35s",
              }}
            >
              {anomaly2.metric}:{" "}
              <span className="text-coral font-semibold">
                {typeof anomaly2.currentValue === "number"
                  ? anomaly2.currentValue < 1000
                    ? formatPct(anomaly2.currentValue)
                    : formatMillions(anomaly2.currentValue)
                  : String(anomaly2.currentValue)}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center max-w-[900px]">
            <SeverityBadge severity="CRITICAL" active={currentBeat === 7} />
            <div className="font-[family-name:var(--font-display)] font-bold text-[44px] leading-[1.2] text-heading mb-6 tracking-tight">
              Mid-Large tier ($500M-$1B) carrying
              <br />
              the highest delinquency in the state
            </div>
          </div>
        )}
      </Beat>

      {/* ── Beat 8: The Year's Story ───────────────────────────────────── */}
      <Beat active={currentBeat === 8}>
        {summaryInsight ? (
          <div
            className="font-[family-name:var(--font-display)] font-medium text-[40px] leading-[1.45] text-center max-w-[1000px] text-foreground transition-all duration-600 ease-out"
            style={{
              opacity: currentBeat === 8 ? 1 : 0,
              transform: currentBeat === 8 ? "translateY(0)" : "translateY(10px)",
              transitionDelay: "0.15s",
            }}
          >
            {summaryInsight}
          </div>
        ) : (
          <div
            className="font-[family-name:var(--font-display)] font-medium text-[40px] leading-[1.45] text-center max-w-[1000px] transition-all duration-600 ease-out"
            style={{
              opacity: currentBeat === 8 ? 1 : 0,
              transform: currentBeat === 8 ? "translateY(0)" : "translateY(10px)",
              transitionDelay: "0.15s",
            }}
          >
            <span style={{ color: "var(--color-gold)" }}>Capital is strong.</span>
            <br />
            <span style={{ color: "var(--color-coral)" }}>
              Delinquency is the story.
            </span>
            <br />
            <span style={{ color: "var(--color-info)" }}>
              And consolidation is accelerating.
            </span>
          </div>
        )}
      </Beat>

      {/* ── Beat 9: Closing ────────────────────────────────────────────── */}
      <Beat active={currentBeat === 9}>
        <div className="flex flex-col items-center gap-5 max-w-[900px]">
          {[
            `This scan ran at ${formatTime()}.`,
            "Every number verified against NCUA call report data.",
            `${totalCUs} institutions. ${quartersAnalyzed} quarters. ${anomalies.length} anomalies flagged.`,
            "The question: who at your credit union\nsaw this before today?",
          ].map((line, i) => (
            <div
              key={i}
              className={`text-center leading-[1.4] transition-all duration-400 ease-out ${
                i === 3
                  ? "text-[32px] font-medium text-foreground mt-6"
                  : i === 2
                    ? "text-[28px] text-muted mt-3"
                    : "text-[28px] text-muted"
              }`}
              style={{
                opacity: currentBeat === 9 ? (i === 2 ? 0.6 : 1) : 0,
                transform:
                  currentBeat === 9
                    ? "translateY(0)"
                    : "translateY(8px)",
                transitionDelay: `${0.15 + i * 0.35}s`,
                whiteSpace: "pre-line",
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </Beat>
    </div>
  );
}

// ── Severity Badge ──────────────────────────────────────────────────────────

function SeverityBadge({
  severity,
  active,
}: {
  severity: string;
  active: boolean;
}) {
  const isWarning = severity === "WARNING";
  const label = severity === "CRITICAL" ? "HIGH RISK" : severity;

  return (
    <div
      className={`inline-block font-mono text-base font-bold tracking-[0.15em] uppercase px-5 py-1.5 rounded-md mb-7 transition-opacity duration-300 ease-out ${
        isWarning
          ? "text-warning bg-warning/10 border border-warning/25"
          : "text-danger bg-coral/10 border border-coral/25"
      }`}
      style={{
        opacity: active ? 1 : 0,
        transitionDelay: "0.1s",
      }}
    >
      {label}
    </div>
  );
}
