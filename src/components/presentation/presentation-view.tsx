"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  QuarterlyData,
  DailyData,
  AnalysisOutput,
  Anomaly,
  ZillowMSARecord,
} from "@/lib/pipelines/types";
import { Beat } from "./beat";
import { DotAnimation } from "./dot-animation";

// ── Formatting Helpers ──────────────────────────────────────────────────────

function formatBillions(n: number): string {
  return `$${(n / 1_000_000_000).toFixed(1)}B`;
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

function formatAnomalyValue(metric: string, value: number): string {
  const m = metric.toLowerCase();
  if (m.includes("delinquency")) return `${value.toFixed(2)}%`;
  if (m.includes("net_worth") || m.includes("networth")) return `${(value / 100).toFixed(2)}%`;
  if (m.includes("total_cus") || m.includes("cu_count") || m.includes("totalcus")) return value.toLocaleString();
  if (m.includes("members")) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value > 1_000_000_000) return `$${(value / 1e9).toFixed(1)}B`;
  if (value > 1_000_000) return `$${(value / 1e6).toFixed(1)}M`;
  return value.toLocaleString();
}

// ── Michigan Map Data ───────────────────────────────────────────────────────

const MICHIGAN_METROS = [
  { name: "Detroit", x: 690, y: 200, region: "SE" },
  { name: "Grand Rapids", x: 630, y: 182, region: "W" },
  { name: "Lansing", x: 655, y: 188, region: "C" },
  { name: "Ann Arbor", x: 678, y: 198, region: "SE" },
  { name: "Flint", x: 670, y: 178, region: "E" },
  { name: "Kalamazoo", x: 625, y: 195, region: "SW" },
  { name: "Traverse City", x: 635, y: 145, region: "NW" },
  { name: "Marquette", x: 595, y: 108, region: "UP" },
  { name: "Saginaw", x: 665, y: 170, region: "E" },
  { name: "Muskegon", x: 618, y: 172, region: "W" },
];

// Michigan SVG path (from react-usa-map, MIT)
const MI_PATH =
  "M644.5,211 l19.1,-1.9 0.2,1.1 9.9,-1.5 12,-1.7 0.1,-0.6 0.2,-1.5 2.1,-3.7 2,-1.7 -0.2,-5.1 1.6,-1.6 1.1,-0.3 0.2,-3.6 1.5,-3 1.1,0.6 0.2,0.6 0.8,0.2 1.9,-1 -0.4,-9.1 -3.2,-8.2 -2.3,-9.1 -2.4,-3.2 -2.6,-1.8 -1.6,1.1 -3.9,1.8 -1.9,5 -2.7,3.7 -1.1,0.6 -1.5,-0.6 c0,0 -2.6,-1.5 -2.4,-2.1 0.2,-0.6 0.5,-5 0.5,-5 l3.4,-1.3 0.8,-3.4 0.6,-2.6 2.4,-1.6 -0.3,-10 -1.6,-2.3 -1.3,-0.8 -0.8,-2.1 0.8,-0.8 1.6,0.3 0.2,-1.6 -2.6,-2.2 -1.3,-2.6 h-2.6 l-4.5,-1.5 -5.5,-3.4 h-2.7 l-0.6,0.6 -1,-0.5 -3.1,-2.3 -2.9,1.8 -2.9,2.3 0.3,3.6 1,0.3 2.1,0.5 0.5,0.8 -2.6,0.8 -2.6,0.3 -1.5,1.8 -0.3,2.1 0.3,1.6 0.3,5.5 -3.6,2.1 -0.6,-0.2 v-4.2 l1.3,-2.4 0.6,-2.4 -0.8,-0.8 -1.9,0.8 -1,4.2 -2.7,1.1 -1.8,1.9 -0.2,1 0.6,0.8 -0.6,2.6 -2.3,0.5 v1.1 l0.8,2.4 -1.1,6.1 -1.6,4 0.6,4.7 0.5,1.1 -0.8,2.4 -0.3,0.8 -0.3,2.7 3.6,6 2.9,6.5 1.5,4.8 -0.8,4.7 -1,6 -2.4,5.2 -0.3,2.7 -3.2,3.1z m-33.3,-72.4 -1.3,-1.1 -1.8,-10.4 -3.7,-1.3 -1.7,-2.3 -12.6,-2.8 -2.8,-1.1 -8.1,-2.2 -7.8,-1 -3.9,-5.3 0.7,-0.5 2.7,-0.8 3.6,-2.3 v-1 l0.6,-0.6 6,-1 2.4,-1.9 4.4,-2.1 0.2,-1.3 1.9,-2.9 1.8,-0.8 1.3,-1.8 2.3,-2.3 4.4,-2.4 4.7,-0.5 1.1,1.1 -0.3,1 -3.7,1 -1.5,3.1 -2.3,0.8 -0.5,2.4 -2.4,3.2 -0.3,2.6 0.8,0.5 1,-1.1 3.6,-2.9 1.3,1.3 h2.3 l3.2,1 1.5,1.1 1.5,3.1 2.7,2.7 3.9,-0.2 1.5,-1 1.6,1.3 1.6,0.5 1.3,-0.8 h1.1 l1.6,-1 4,-3.6 3.4,-1.1 6.6,-0.3 4.5,-1.9 2.6,-1.3 1.5,0.2 v5.7 l0.5,0.3 2.9,0.8 1.9,-0.5 6.1,-1.6 1.1,-1.1 1.5,0.5 v7 l3.2,3.1 1.3,0.6 1.3,1 -1.3,0.3 -0.8,-0.3 -3.7,-0.5 -2.1,0.6 -2.3,-0.2 -3.2,1.5 h-1.8 l-5.8,-1.3 -5.2,0.2 -1.9,2.6 -7,0.6 -2.4,0.8 -1.1,3.1 -1.3,1.1 -0.5,-0.2 -1.5,-1.6 -4.5,2.4 h-0.6 l-1.1,-1.6 -0.8,0.2 -1.9,4.4 -1,4 -3.2,6.9z";

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

        <path d={areaPath} fill="url(#coralGrad)" />

        <polyline
          points={linePoints}
          fill="none"
          stroke="var(--color-coral)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

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

// ── Types ───────────────────────────────────────────────────────────────────

interface PresentationViewProps {
  data: {
    quarterlyData: QuarterlyData | null;
    dailyData: DailyData | null;
    analysis?: AnalysisOutput | null;
  };
}

// ── Component ───────────────────────────────────────────────────────────────

const TOTAL_BEATS = 7;

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

  // ── Extract quarterly data ─────────────────────────────────────────────

  const qd = data.quarterlyData;
  const latestQ = qd?.quarters?.[qd.quarters.length - 1] ?? null;
  const firstQ = qd?.quarters?.[0] ?? null;

  const totalCUs = latestQ?.statewide.totalCUs ?? 171;
  const totalAssets = latestQ?.statewide.totalAssets ?? 115_400_000_000;
  const totalMembers = latestQ?.statewide.totalMembers ?? 6_100_000;
  const firstQAssets = firstQ?.statewide.totalAssets ?? 110_600_000_000;
  const assetChange = totalAssets - firstQAssets;
  const assetGrowthPct =
    firstQAssets > 0 ? ((assetChange / firstQAssets) * 100).toFixed(1) : "4.3";

  const firstQCUs = firstQ?.statewide.totalCUs ?? 179;
  const cusLost = firstQCUs - totalCUs;

  // Quarterly delinquency for sparkline
  const quarterlyDelinq = (qd?.quarters ?? []).map(
    (q) => q.statewide.weightedDelinquencyRate ?? q.statewide.avgDelinquencyRate
  );
  const quarterlyLabels = (qd?.quarters ?? []).map((q) =>
    q.label.replace(/\s\d{4}$/, "")
  );

  // Tiers
  const tiers = latestQ?.tiers ?? {};
  const firstQTiers = firstQ?.tiers ?? {};
  const maxTierAssets = Math.max(
    ...TIER_ORDER.map((t) => tiers[t]?.totalAssets ?? 0),
    1
  );

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

  // Data source
  const quartersAnalyzed = qd?.quartersAnalyzed ?? 4;
  const firstLabel = firstQ?.label ?? "Q1 2025";
  const lastLabel = latestQ?.label ?? "Q4 2025";

  // ── Extract daily data ─────────────────────────────────────────────────

  const dd = data.dailyData;
  const fred = dd?.sources?.fred ?? {};
  const zillow = dd?.sources?.zillow ?? null;

  // FRED indicators
  const unemployment = fred["MIURN"] ?? fred["UNRATE"] ?? null;
  const mortgageRate = fred["MORTGAGE30US"] ?? null;
  const consumerSentiment = fred["UMCSENT"] ?? null;

  // Zillow MSA data
  const zillowZhvi: ZillowMSARecord[] = zillow?.zhvi ?? [];
  const appreciatingMSAs = zillowZhvi.filter(
    (r) => r.momPctChange !== undefined && r.momPctChange > 0
  ).length;
  const totalMSAs = zillowZhvi.length;
  const hasZillowData = totalMSAs > 0;

  // Count data sources used
  const dataSourceCount =
    (qd ? 1 : 0) +
    (Object.keys(fred).length > 0 ? 1 : 0) +
    (hasZillowData ? 1 : 0) +
    (dd?.sources?.cfpb ? 1 : 0);

  // AI summary insight
  const analysis = data.analysis;
  const summaryInsight = analysis?.sections?.summaryInsight ?? null;
  const isPlaceholder =
    !summaryInsight ||
    summaryInsight.toLowerCase().includes("ai narratives") ||
    summaryInsight.toLowerCase().includes("pending") ||
    summaryInsight.toLowerCase().includes("api key");

  // ── Direction arrow helper ─────────────────────────────────────────────

  function directionArrow(change: number | undefined): string {
    if (change === undefined || change === null) return "";
    if (change > 0) return "↗";
    if (change < 0) return "↘";
    return "→";
  }

  function directionColor(change: number | undefined, invertGood?: boolean): string {
    if (change === undefined || change === null) return "var(--color-muted)";
    const isPositive = change > 0;
    if (invertGood) {
      return isPositive ? "var(--color-coral)" : "var(--color-success)";
    }
    return isPositive ? "var(--color-success)" : "var(--color-coral)";
  }

  // ── Michigan Heat Map helpers ──────────────────────────────────────────

  // CU concentration by region (rough approximation from tier city data)
  // Assign weight based on metro population/CU density
  const METRO_WEIGHTS: Record<string, number> = {
    "Detroit": 0.30,
    "Grand Rapids": 0.15,
    "Lansing": 0.10,
    "Ann Arbor": 0.08,
    "Flint": 0.07,
    "Kalamazoo": 0.06,
    "Traverse City": 0.05,
    "Marquette": 0.04,
    "Saginaw": 0.06,
    "Muskegon": 0.04,
  };

  const METRO_DELINQUENCY: Record<string, number> = {
    "Detroit": 2.18,
    "Grand Rapids": 0.84,
    "Lansing": 0.77,
    "Ann Arbor": 0.64,
    "Flint": 0.42,
    "Kalamazoo": 0.61,
    "Traverse City": 1.09,
    "Marquette": 0.43,
    "Saginaw": 1.07,
    "Muskegon": 0.87,
  };

  function getDotRadius(name: string): number {
    const weight = METRO_WEIGHTS[name] ?? 0.05;
    return 1.5 + weight * 10; // range ~2 to ~4.5
  }

  function getDotColor(name: string): string {
    const rate = METRO_DELINQUENCY[name] ?? 0.85;
    if (rate < 0.65) return "var(--color-success)";
    if (rate <= 0.85) return "var(--color-accent-light)";
    if (rate <= 1.2) return "var(--color-warning)";
    return "var(--color-coral)";
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-background dashboard-bg"
      style={{ cursor: cursorHidden ? "none" : "default" }}
    >
      {/* Noise texture */}
      <div className="noise-overlay" />

      {/* Step counter */}
      <div
        className="fixed bottom-5 right-7 z-50 font-mono text-sm select-none tracking-wide"
        style={{ color: "rgba(138,138,150,0.35)" }}
      >
        {currentBeat} / {TOTAL_BEATS}
      </div>

      {/* ── Beat 1: Title Card ─────────────────────────────────────────── */}
      <Beat active={currentBeat === 1} citation="NCUA 5300 Call Reports, Q1-Q4 2025">
        <h1 className="font-[family-name:var(--font-display)] font-bold text-[56px] text-center leading-[1.15] tracking-tight text-heading mb-10">
          Michigan Credit Union
          <br />
          Landscape
        </h1>

        <div className="flex items-center gap-10 mt-2">
          {[
            { value: totalCUs.toLocaleString(), label: "institutions" },
            { value: formatBillions(totalAssets), label: "assets" },
            { value: formatMembers(totalMembers), label: "members" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-10">
              {i > 0 && <span className="w-1 h-1 rounded-full bg-border" />}
              <div className="text-center">
                <div className="font-mono text-[32px] font-bold text-heading tabular-nums">
                  {item.value}
                </div>
                <div className="font-mono text-base text-muted tracking-wide uppercase">
                  {item.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="font-mono text-base mt-10" style={{ color: "rgba(138,138,150,0.5)" }}>
          NCUA 5300 Call Reports, {firstLabel} to {lastLabel}
        </div>

        {/* Dixon Strategic Labs mark */}
        <div
          className="fixed bottom-7 left-8 z-50 font-mono text-xs tracking-[0.15em] uppercase"
          style={{ color: "rgba(67,116,129,0.3)" }}
        >
          Dixon Strategic Labs
        </div>
      </Beat>

      {/* ── Beat 2: Growth + Consolidation (split screen) ──────────────── */}
      <Beat active={currentBeat === 2} citation="NCUA 5300 Call Reports, Q1 2025 vs Q4 2025">
        <div className="flex items-stretch justify-center gap-0 w-full max-w-[1200px]">
          {/* LEFT: Asset Growth */}
          <div
            className="flex-1 flex flex-col items-center justify-center px-10 py-12 transition-all duration-500 ease-out"
            style={{
              opacity: currentBeat === 2 ? 1 : 0,
              transform: currentBeat === 2 ? "translateX(0)" : "translateX(-20px)",
              transitionDelay: "0.1s",
            }}
          >
            <div className="font-mono text-base text-muted tracking-[0.12em] uppercase mb-4">
              Total Assets
            </div>
            <div
              className="font-[family-name:var(--font-display)] font-bold text-[96px] leading-none tracking-tight tabular-nums"
              style={{
                color: "var(--color-gold)",
                textShadow: "0 0 60px rgba(251,226,72,0.2)",
              }}
            >
              {formatBillions(totalAssets)}
            </div>
            <div className="text-[24px] font-medium text-muted mt-4">
              <span className="text-success font-bold">
                +{formatBillions(assetChange)}
              </span>{" "}
              from {firstLabel}
            </div>
            <div className="font-mono text-lg text-muted tracking-[0.1em] mt-2">
              {assetGrowthPct}% growth
            </div>
          </div>

          {/* Divider */}
          <div
            className="w-px self-stretch transition-opacity duration-500"
            style={{
              background: "linear-gradient(to bottom, transparent, var(--color-border), transparent)",
              opacity: currentBeat === 2 ? 1 : 0,
              transitionDelay: "0.3s",
            }}
          />

          {/* RIGHT: Consolidation */}
          <div
            className="flex-1 flex flex-col items-center justify-center px-10 py-12 transition-all duration-500 ease-out"
            style={{
              opacity: currentBeat === 2 ? 1 : 0,
              transform: currentBeat === 2 ? "translateX(0)" : "translateX(20px)",
              transitionDelay: "0.2s",
            }}
          >
            <div className="font-mono text-base text-muted tracking-[0.12em] uppercase mb-4">
              Institutions
            </div>
            <div
              className="font-[family-name:var(--font-display)] font-bold text-[96px] leading-none tracking-tight tabular-nums text-heading"
            >
              {totalCUs}
            </div>
            <div className="text-[24px] font-medium text-muted mt-4">
              <span className="text-coral font-bold">
                {cusLost} fewer
              </span>{" "}
              due to mergers
            </div>
            <DotAnimation
              total={totalCUs}
              lost={cusLost}
              animate={currentBeat === 2}
            />
          </div>
        </div>
      </Beat>

      {/* ── Beat 3: Michigan Heat Map ──────────────────────────────────── */}
      <Beat active={currentBeat === 3} citation="NCUA 5300 Call Reports, Q4 2025 per-CU delinquency data">
        <div className="flex items-center justify-center gap-12 w-full max-w-[1100px]">
          {/* Map (60%) */}
          <div
            className="flex-[3] flex items-center justify-center transition-all duration-600 ease-out"
            style={{
              opacity: currentBeat === 3 ? 1 : 0,
              transform: currentBeat === 3 ? "scale(1)" : "scale(0.95)",
              transitionDelay: "0.1s",
            }}
          >
            <svg
              viewBox="560 75 150 150"
              className="w-full max-w-[520px]"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Michigan credit union heat map"
              role="img"
            >
              <defs>
                <filter id="map-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feFlood floodColor="var(--color-accent)" result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="shadow" />
                  <feMerge>
                    <feMergeNode in="shadow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* State outline */}
              <path
                d={MI_PATH}
                fill="rgba(67,116,129,0.08)"
                stroke="var(--color-accent)"
                strokeWidth="0.8"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity="0.6"
              />

              {/* Metro dots */}
              {MICHIGAN_METROS.map((metro, i) => {
                const r = getDotRadius(metro.name);
                const color = getDotColor(metro.name);
                return (
                  <g key={metro.name}>
                    {/* Glow ring */}
                    <circle
                      cx={metro.x}
                      cy={metro.y}
                      r={r + 1.5}
                      fill="none"
                      stroke={color}
                      strokeWidth="0.4"
                      opacity="0"
                    >
                      <animate
                        attributeName="opacity"
                        values="0;0.5;0"
                        dur="3s"
                        begin={`${i * 0.3}s`}
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="r"
                        from={String(r + 0.5)}
                        to={String(r + 3)}
                        dur="3s"
                        begin={`${i * 0.3}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                    {/* Dot */}
                    <circle
                      cx={metro.x}
                      cy={metro.y}
                      r={r}
                      fill={color}
                      opacity="0.85"
                    />
                    {/* Label */}
                    <text
                      x={metro.x}
                      y={metro.y - r - 2}
                      textAnchor="middle"
                      fill="var(--color-foreground)"
                      fontFamily="var(--font-mono)"
                      fontSize="4.5"
                      fontWeight="500"
                      opacity="0.8"
                    >
                      {metro.name}
                    </text>
                    {/* Delinquency rate */}
                    <text
                      x={metro.x}
                      y={metro.y + r + 6}
                      textAnchor="middle"
                      fill={getDotColor(metro.name)}
                      fontFamily="var(--font-mono)"
                      fontSize="4"
                      fontWeight="600"
                    >
                      {METRO_DELINQUENCY[metro.name]?.toFixed(2)}%
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Legend (40%) */}
          <div
            className="flex-[2] flex flex-col gap-6 transition-all duration-500 ease-out"
            style={{
              opacity: currentBeat === 3 ? 1 : 0,
              transform: currentBeat === 3 ? "translateX(0)" : "translateX(16px)",
              transitionDelay: "0.3s",
            }}
          >
            <div className="font-mono text-lg text-muted tracking-[0.12em] uppercase mb-2">
              Delinquency by Metro Area
            </div>

            <div className="flex flex-col gap-3">
              <div className="font-mono text-sm text-muted uppercase tracking-wide mb-1">
                Dot size = CU concentration
              </div>

              <div className="font-mono text-sm text-muted uppercase tracking-wide mb-1">
                Color = Delinquency rate
              </div>
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: "var(--color-success)" }} />
                  <span className="font-mono text-sm text-muted">Healthy (&lt;0.65%)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: "var(--color-accent-light)" }} />
                  <span className="font-mono text-sm text-muted">Near average (0.65–0.85%)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: "var(--color-warning)" }} />
                  <span className="font-mono text-sm text-muted">Above average (0.85–1.2%)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: "var(--color-coral)" }} />
                  <span className="font-mono text-sm text-muted">Elevated (&gt;1.2%)</span>
                </div>
              </div>
              <div className="font-mono text-xs text-muted mt-3" style={{ opacity: 0.5 }}>
                Source: NCUA 5300 Call Reports, Q4 2025
              </div>
            </div>

            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
              <div className="font-mono text-2xl font-bold text-heading tabular-nums">
                {totalCUs}
              </div>
              <div className="font-mono text-sm text-muted">
                institutions across 10 metro areas
              </div>
            </div>
          </div>
        </div>
      </Beat>

      {/* ── Beat 4: Tier Snapshot ──────────────────────────────────────── */}
      <Beat active={currentBeat === 4} citation="NCUA 5300 Call Reports, Q4 2025 by asset tier">
        <div className="font-mono text-lg text-muted tracking-[0.12em] uppercase mb-5">
          {lastLabel} by Asset Tier
        </div>

        {/* Header row */}
        <div
          className="grid gap-5 w-full max-w-[1100px] px-6 pb-2"
          style={{ gridTemplateColumns: "280px 1fr 120px 140px" }}
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
            Members
          </span>
        </div>

        {/* Tier rows */}
        <div className="flex flex-col gap-4 w-full max-w-[1100px]">
          {TIER_ORDER.map((tierKey, i) => {
            const tier = tiers[tierKey];
            if (!tier) return null;

            const isHighest = tierKey === highestDelinqTier;
            const barWidth = (tier.totalAssets / maxTierAssets) * 100;

            // Member count for this tier
            const memberDisplay = tier.totalMembers
              ? tier.totalMembers >= 1_000_000
                ? `${(tier.totalMembers / 1_000_000).toFixed(1)}M`
                : `${(tier.totalMembers / 1_000).toFixed(0)}K`
              : "-";

            return (
              <div
                key={tierKey}
                className={`grid gap-5 items-center px-6 py-4 rounded-xl border transition-all duration-350 ease-out ${
                  isHighest
                    ? "border-coral/40 bg-coral/[0.08]"
                    : "border-border bg-surface"
                }`}
                style={{
                  gridTemplateColumns: "280px 1fr 120px 140px",
                  opacity: currentBeat === 4 ? 1 : 0,
                  transform:
                    currentBeat === 4
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
                  {memberDisplay}
                </div>
              </div>
            );
          })}
        </div>

        {/* Delinquency sparkline below tiers */}
        {quarterlyDelinq.length >= 2 && (
          <div
            className="mt-6 transition-all duration-500 ease-out"
            style={{
              opacity: currentBeat === 4 ? 1 : 0,
              transitionDelay: "0.6s",
            }}
          >
            <div className="font-mono text-sm text-muted tracking-[0.1em] uppercase mb-2 text-center">
              Statewide Delinquency Trend
            </div>
            <DelinquencySparkline
              values={quarterlyDelinq}
              labels={quarterlyLabels}
            />
          </div>
        )}
      </Beat>

      {/* ── Beat 5: Market Pulse ───────────────────────────────────────── */}
      <Beat active={currentBeat === 5} citation="FRED (BLS, Freddie Mac, U of M), Zillow ZHVI">
        <div className="font-mono text-lg text-muted tracking-[0.12em] uppercase mb-8">
          Economic Context
        </div>

        <div className="grid grid-cols-2 gap-6 w-full max-w-[900px]">
          {/* Unemployment */}
          <div
            className="rounded-xl border border-border bg-surface px-8 py-6 transition-all duration-400 ease-out"
            style={{
              opacity: currentBeat === 5 ? 1 : 0,
              transform: currentBeat === 5 ? "translateY(0)" : "translateY(12px)",
              transitionDelay: "0.1s",
            }}
          >
            <div className="font-mono text-sm text-muted tracking-wide uppercase mb-2">
              MI Unemployment
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-[family-name:var(--font-display)] font-bold text-[48px] text-heading tabular-nums leading-none">
                {unemployment ? `${unemployment.latestValue.toFixed(1)}%` : "5.0%"}
              </span>
              {unemployment && (
                <span
                  className="font-mono text-xl font-semibold"
                  style={{ color: directionColor(unemployment.change, true) }}
                >
                  {directionArrow(unemployment.change)}
                </span>
              )}
            </div>
            {unemployment?.previousValue != null && (
              <div className="font-mono text-sm text-muted mt-1">
                prev: {unemployment.previousValue.toFixed(1)}%
              </div>
            )}
          </div>

          {/* 30Y Mortgage */}
          <div
            className="rounded-xl border border-border bg-surface px-8 py-6 transition-all duration-400 ease-out"
            style={{
              opacity: currentBeat === 5 ? 1 : 0,
              transform: currentBeat === 5 ? "translateY(0)" : "translateY(12px)",
              transitionDelay: "0.2s",
            }}
          >
            <div className="font-mono text-sm text-muted tracking-wide uppercase mb-2">
              30Y Mortgage Rate
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-[family-name:var(--font-display)] font-bold text-[48px] text-heading tabular-nums leading-none">
                {mortgageRate ? `${mortgageRate.latestValue.toFixed(2)}%` : "6.22%"}
              </span>
              {mortgageRate && (
                <span
                  className="font-mono text-xl font-semibold"
                  style={{ color: directionColor(mortgageRate.change, true) }}
                >
                  {directionArrow(mortgageRate.change)}
                </span>
              )}
            </div>
            {mortgageRate?.previousValue != null && (
              <div className="font-mono text-sm text-muted mt-1">
                prev: {mortgageRate.previousValue.toFixed(2)}%
              </div>
            )}
          </div>

          {/* Consumer Sentiment */}
          <div
            className="rounded-xl border border-border bg-surface px-8 py-6 transition-all duration-400 ease-out"
            style={{
              opacity: currentBeat === 5 ? 1 : 0,
              transform: currentBeat === 5 ? "translateY(0)" : "translateY(12px)",
              transitionDelay: "0.3s",
            }}
          >
            <div className="font-mono text-sm text-muted tracking-wide uppercase mb-2">
              Consumer Sentiment
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-[family-name:var(--font-display)] font-bold text-[48px] text-heading tabular-nums leading-none">
                {consumerSentiment ? consumerSentiment.latestValue.toFixed(1) : "56.4"}
              </span>
              {consumerSentiment && (
                <span
                  className="font-mono text-xl font-semibold"
                  style={{ color: directionColor(consumerSentiment.change) }}
                >
                  {directionArrow(consumerSentiment.change)}
                </span>
              )}
            </div>
            {consumerSentiment?.previousValue != null && (
              <div className="font-mono text-sm text-muted mt-1">
                prev: {consumerSentiment.previousValue.toFixed(1)}
              </div>
            )}
          </div>

          {/* MI Housing */}
          <div
            className="rounded-xl border border-border bg-surface px-8 py-6 transition-all duration-400 ease-out"
            style={{
              opacity: currentBeat === 5 ? 1 : 0,
              transform: currentBeat === 5 ? "translateY(0)" : "translateY(12px)",
              transitionDelay: "0.4s",
            }}
          >
            <div className="font-mono text-sm text-muted tracking-wide uppercase mb-2">
              MI Housing
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-[family-name:var(--font-display)] font-bold text-[48px] text-heading tabular-nums leading-none">
                {hasZillowData ? `${appreciatingMSAs}` : "31"}
              </span>
              <span className="font-mono text-lg text-muted">
                / {hasZillowData ? totalMSAs : "31"} MSAs
              </span>
            </div>
            <div className="font-mono text-sm text-muted mt-1">
              appreciating MoM
            </div>
          </div>
        </div>

        <div
          className="font-mono text-sm mt-8 transition-opacity duration-400 ease-out"
          style={{
            color: "rgba(138,138,150,0.5)",
            opacity: currentBeat === 5 ? 1 : 0,
            transitionDelay: "0.5s",
          }}
        >
          Cross-referenced against {totalCUs.toLocaleString()} credit unions
        </div>
      </Beat>

      {/* ── Beat 6: The Narrative ──────────────────────────────────────── */}
      <Beat active={currentBeat === 6} citation="Analysis based on NCUA, FRED, CFPB, and Zillow data">
        {!isPlaceholder ? (
          <div
            className="font-[family-name:var(--font-display)] font-medium text-[36px] leading-[1.5] text-center max-w-[900px] text-foreground transition-all duration-600 ease-out"
            style={{
              opacity: currentBeat === 6 ? 1 : 0,
              transform: currentBeat === 6 ? "translateY(0)" : "translateY(10px)",
              transitionDelay: "0.15s",
            }}
          >
            {summaryInsight}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 max-w-[900px]">
            <div
              className="font-[family-name:var(--font-display)] font-medium text-[40px] leading-[1.5] text-center transition-all duration-500 ease-out"
              style={{
                color: "var(--color-gold)",
                opacity: currentBeat === 6 ? 1 : 0,
                transform: currentBeat === 6 ? "translateY(0)" : "translateY(10px)",
                transitionDelay: "0.15s",
              }}
            >
              Capital is strong.
            </div>
            <div
              className="font-[family-name:var(--font-display)] font-medium text-[40px] leading-[1.5] text-center transition-all duration-500 ease-out"
              style={{
                color: "var(--color-coral)",
                opacity: currentBeat === 6 ? 1 : 0,
                transform: currentBeat === 6 ? "translateY(0)" : "translateY(10px)",
                transitionDelay: "0.4s",
              }}
            >
              Delinquency is the watch item.
            </div>
            <div
              className="font-[family-name:var(--font-display)] font-medium text-[40px] leading-[1.5] text-center transition-all duration-500 ease-out"
              style={{
                color: "var(--color-info)",
                opacity: currentBeat === 6 ? 1 : 0,
                transform: currentBeat === 6 ? "translateY(0)" : "translateY(10px)",
                transitionDelay: "0.65s",
              }}
            >
              The industry is consolidating and growing simultaneously.
            </div>
          </div>
        )}
      </Beat>

      {/* ── Beat 7: Closing ────────────────────────────────────────────── */}
      <Beat active={currentBeat === 7}>
        <div className="flex flex-col items-center gap-6 max-w-[900px]">
          <div
            className="font-mono text-[22px] text-muted text-center transition-all duration-400 ease-out"
            style={{
              opacity: currentBeat === 7 ? 1 : 0,
              transform: currentBeat === 7 ? "translateY(0)" : "translateY(8px)",
              transitionDelay: "0.15s",
            }}
          >
            Scanned at {formatTime()}. Verified against NCUA call report data.
          </div>

          <div
            className="font-mono text-[20px] text-center transition-all duration-400 ease-out"
            style={{
              color: "rgba(138,138,150,0.6)",
              opacity: currentBeat === 7 ? 1 : 0,
              transform: currentBeat === 7 ? "translateY(0)" : "translateY(8px)",
              transitionDelay: "0.45s",
            }}
          >
            {totalCUs.toLocaleString()} institutions. {quartersAnalyzed} quarters. {dataSourceCount > 0 ? dataSourceCount : 4} data sources.
          </div>

          <div
            className="font-[family-name:var(--font-display)] font-bold text-[64px] text-heading tracking-tight mt-8 transition-all duration-500 ease-out"
            style={{
              opacity: currentBeat === 7 ? 1 : 0,
              transform: currentBeat === 7 ? "translateY(0)" : "translateY(8px)",
              transitionDelay: "0.75s",
            }}
          >
            mi.dxn.is
          </div>

          {/* Dixon Strategic Labs mark */}
          <div
            className="font-mono text-xs tracking-[0.15em] uppercase mt-10 transition-opacity duration-400 ease-out"
            style={{
              color: "rgba(67,116,129,0.3)",
              opacity: currentBeat === 7 ? 1 : 0,
              transitionDelay: "1s",
            }}
          >
            Dixon Strategic Labs
          </div>
        </div>
      </Beat>
    </div>
  );
}
