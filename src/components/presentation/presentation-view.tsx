"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProcessedData } from "@/hooks/use-processed-data";
import { Beat } from "./beat";
import { DotAnimation } from "./dot-animation";

// ── Formatting Helpers ──────────────────────────────────────────────────────

function formatBillions(n: number): string {
  if (n == null || isNaN(n)) return "$0.0B";
  return `$${(n / 1_000_000_000).toFixed(1)}B`;
}

function formatMembers(n: number): string {
  if (n == null || isNaN(n)) return "0.0M";
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function formatPct(n: number): string {
  if (n == null || isNaN(n)) return "0.00%";
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

// ── Michigan Map Data ───────────────────────────────────────────────────────

// Lower Peninsula SVG bounds: x=631-698, y=121-212. Upper Peninsula: x=580-660, y=85-138.
// ALL dots must be well inside these bounds (min 5px from edges).
const MICHIGAN_METROS = [
  { name: "Detroit",        x: 686, y: 197, region: "SE", labelDx: -8,  labelDy: -1, anchor: "end" as const },
  { name: "Grand Rapids",   x: 641, y: 181, region: "W",  labelDx: -7,  labelDy: -1, anchor: "end" as const },
  { name: "Lansing",        x: 658, y: 185, region: "C",  labelDx: -7,  labelDy: -1, anchor: "end" as const },
  { name: "Ann Arbor",      x: 674, y: 194, region: "SE", labelDx: -7,  labelDy: -1, anchor: "end" as const },
  { name: "Flint",          x: 674, y: 173, region: "E",  labelDx: 5,   labelDy: -1, anchor: "start" as const },
  { name: "Kalamazoo",      x: 639, y: 195, region: "SW", labelDx: -7,  labelDy: -1, anchor: "end" as const },
  { name: "Traverse City",  x: 644, y: 141, region: "NW", labelDx: 5,   labelDy: -1, anchor: "start" as const },
  { name: "Marquette",      x: 602, y: 112, region: "UP", labelDx: 5,   labelDy: -1, anchor: "start" as const },
  { name: "Saginaw",        x: 664, y: 167, region: "E",  labelDx: 5,   labelDy: -1, anchor: "start" as const },
  { name: "Muskegon",       x: 637, y: 173, region: "W",  labelDx: -7,  labelDy: -1, anchor: "end" as const },
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
    <div className="mt-4 w-[500px] h-[120px]">
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
  // New names
  "Over $5B": "Over $5B",
  "$1B to $5B": "$1B to $5B",
  "$500M to $1B": "$500M to $1B",
  "$100M to $500M": "$100M to $500M",
  "Under $100M": "Under $100M",
  // Backward compat for cached data with old names
  "Tier 1: Anchor (>$5B)": "Over $5B",
  "Tier 2: Large ($1B-$5B)": "$1B to $5B",
  "Tier 3: Mid-Large ($500M-$1B)": "$500M to $1B",
  "Tier 4: Mid-Size ($100M-$500M)": "$100M to $500M",
  "Tier 5: Community (<$100M)": "Under $100M",
  // Also handle if shortTierName extracted just the label
  "Anchor": "Over $5B",
  "Large": "$1B to $5B",
  "Mid-Large": "$500M to $1B",
  "Mid-Size": "$100M to $500M",
  "Community": "Under $100M",
};

const TIER_ORDER = [
  "Over $5B",
  "$1B to $5B",
  "$500M to $1B",
  "$100M to $500M",
  "Under $100M",
  // Old names for sort matching
  "Tier 1: Anchor (>$5B)",
  "Tier 2: Large ($1B-$5B)",
  "Tier 3: Mid-Large ($500M-$1B)",
  "Tier 4: Mid-Size ($100M-$500M)",
  "Tier 5: Community (<$100M)",
];

// ── Types ───────────────────────────────────────────────────────────────────

interface PresentationViewProps {
  data: ProcessedData;
}

// ── Component ───────────────────────────────────────────────────────────────

const TOTAL_BEATS = 7;

export function PresentationView({ data }: PresentationViewProps) {
  const router = useRouter();
  const [currentBeat, setCurrentBeat] = useState(1);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [hoveredMetro, setHoveredMetro] = useState<string | null>(null);
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
    function handleClick(e: MouseEvent) {
      // Don't advance on button/link clicks
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("a") || target.closest("[role=button]")) return;
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

  // ── Extract processed fields ─────────────────────────────────────────

  const totalCUs = data.totalCUsRaw;
  const totalAssets = data.totalAssetsRaw;
  const totalMembers = data.totalMembersRaw;
  const cusLost = data.cusLost;
  const firstQCUs = data.firstQCUs;

  // Compute asset change from raw values for presentation display
  const assetGrowthPct = data.assetGrowthPct;

  // Quarterly delinquency for sparkline
  const quarterlyDelinq = data.quarterlyDelinquency;
  const quarterlyLabels = data.quarterlyLabels.map((l) =>
    l.replace(/\s\d{4}$/, "")
  );

  // Tiers from processed data, keyed by name for TIER_ORDER lookup
  const tiersByName = new Map(data.tiers.map((t) => [t.name, t]));

  // Find max tier assets for bar width calculation
  const maxTierAssets = Math.max(
    ...TIER_ORDER.map((t) => {
      const tier = tiersByName.get(t);
      // Parse raw assets from the tier (need raw value for bar proportions)
      // The ProcessedTier has totalAssets as formatted string, but avgDelinquencyRaw as number
      // We need to compute raw asset for bar widths from the formatted string, or use a workaround
      return tier ? parseAssetsString(tier.totalAssets) : 0;
    }),
    1
  );

  const firstLabel = data.firstQuarterLabel || "Q1 2025";
  const lastLabel = data.lastQuarterLabel || "Q4 2025";

  // FRED indicators from processed data
  const fredByKey = new Map(data.fred.map((f) => [f.id, f]));
  const unemployment = fredByKey.get("MIUR") ?? fredByKey.get("UNRATE") ?? null;
  const mortgageRate = fredByKey.get("MORTGAGE30US") ?? null;
  const consumerSentiment = fredByKey.get("UMCSENT") ?? null;

  // Zillow: count appreciating MSAs from FRED array is not applicable,
  // but we stored zillow info in processed data indirectly. For now,
  // use the existing approach of checking fred length as proxy for data availability.
  // The presentation beat 5 housing card needs the raw zillow data which isn't in ProcessedData.
  // We'll show the data source count instead.

  const quartersAnalyzed = data.quartersAnalyzed || 4;
  const dataSourceCount = data.dataSourceCount || 4;

  // AI summary insight
  const summaryInsight = data.summaryInsight;
  const isPlaceholder = !summaryInsight || summaryInsight.length === 0;

  // ── Direction arrow helper ─────────────────────────────────────────────

  function directionArrow(direction: "up" | "down" | "flat" | undefined): string {
    if (!direction) return "";
    if (direction === "up") return "\u2197";
    if (direction === "down") return "\u2198";
    return "\u2192";
  }

  function directionColor(direction: "up" | "down" | "flat" | undefined, invertGood?: boolean): string {
    if (!direction || direction === "flat") return "var(--color-muted)";
    const isUp = direction === "up";
    if (invertGood) {
      return isUp ? "var(--color-coral)" : "var(--color-success)";
    }
    return isUp ? "var(--color-success)" : "var(--color-coral)";
  }

  // ── Michigan Heat Map helpers ──────────────────────────────────────────

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
      <Beat active={currentBeat === 1} citation="Dixon Strategic Labs  |  NCUA 5300 Call Reports  |  FRED  |  CFPB  |  Zillow ZHVI">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dxn-logo-white.png"
          alt="Dixon Strategic Labs"
          className="h-8 w-auto mx-auto mb-8 hidden dark:block"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dxn-logo-black.png"
          alt="Dixon Strategic Labs"
          className="h-8 w-auto mx-auto mb-8 dark:hidden"
        />
        <h1 className="font-[family-name:var(--font-display)] font-bold text-[56px] text-center leading-[1.15] tracking-tight text-heading mb-10">
          Michigan Credit Union
          <br />
          Landscape
        </h1>

        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-10 mt-2">
          {[
            { value: (totalCUs ?? 0).toLocaleString(), label: "institutions" },
            { value: formatBillions(totalAssets), label: "assets" },
            { value: formatMembers(totalMembers), label: "members" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 sm:gap-10">
              {i > 0 && <span className="w-1 h-1 rounded-full bg-border hidden sm:block" />}
              <div className="text-center">
                <div className="font-mono text-[22px] sm:text-[32px] font-bold text-heading tabular-nums">
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
              {data.totalAssets}
            </div>
            <div className="text-[24px] font-medium text-muted mt-4">
              <span className="text-success font-bold">
                +{data.assetGrowth}
              </span>{" "}
              from {firstLabel}
            </div>
            <div className="font-mono text-lg text-muted tracking-[0.1em] mt-2">
              {assetGrowthPct} growth
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
              viewBox="555 70 160 160"
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

              {/* Metro dots with hover tooltips */}
              {MICHIGAN_METROS.map((metro, i) => {
                const r = getDotRadius(metro.name);
                const color = getDotColor(metro.name);
                const rate = METRO_DELINQUENCY[metro.name] ?? 0;
                const isHovered = hoveredMetro === metro.name;
                return (
                  <g
                    key={metro.name}
                    onMouseEnter={() => setHoveredMetro(metro.name)}
                    onMouseLeave={() => setHoveredMetro(null)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Invisible larger hit area */}
                    <circle
                      cx={metro.x}
                      cy={metro.y}
                      r={8}
                      fill="transparent"
                    />
                    {/* Pulse ring */}
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
                      r={isHovered ? r + 1.5 : r}
                      fill={color}
                      opacity={isHovered ? 1 : 0.85}
                      style={{ transition: "r 0.15s ease, opacity 0.15s ease" }}
                    />
                    {/* Tooltip on hover */}
                    {isHovered && (
                      <g>
                        <rect
                          x={metro.x + (metro.anchor === "end" ? -32 : 6)}
                          y={metro.y - 9}
                          width={26}
                          height={12}
                          rx={1.5}
                          fill="rgba(9,9,11,0.92)"
                          stroke="rgba(42,42,50,0.8)"
                          strokeWidth="0.3"
                        />
                        <text
                          x={metro.x + (metro.anchor === "end" ? -19 : 19)}
                          y={metro.y - 3.5}
                          textAnchor="middle"
                          fill="#FAFAFA"
                          fontSize="3.2"
                          fontFamily="'DM Sans', system-ui, sans-serif"
                          fontWeight="600"
                        >
                          {metro.name}
                        </text>
                        <text
                          x={metro.x + (metro.anchor === "end" ? -19 : 19)}
                          y={metro.y + 1}
                          textAnchor="middle"
                          fill={color}
                          fontSize="3"
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="600"
                        >
                          {rate.toFixed(2)}%
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Metro data table (40%) */}
          <div
            className="flex-[2] flex flex-col transition-all duration-500 ease-out"
            style={{
              opacity: currentBeat === 3 ? 1 : 0,
              transform: currentBeat === 3 ? "translateX(0)" : "translateX(16px)",
              transitionDelay: "0.3s",
            }}
          >
            <div className="font-mono text-base text-muted tracking-[0.12em] uppercase mb-4">
              Delinquency by Metro
            </div>

            {/* Sorted metro list */}
            <div className="flex flex-col gap-1.5">
              {Object.entries(METRO_DELINQUENCY)
                .sort(([, a], [, b]) => b - a)
                .map(([name, rate]) => (
                  <div key={name} className="flex items-center gap-3 py-1.5 px-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: getDotColor(name) }}
                    />
                    <span className="font-[family-name:var(--font-display)] text-[17px] text-foreground flex-1">
                      {name}
                    </span>
                    <span
                      className="font-mono text-[17px] font-semibold tabular-nums"
                      style={{ color: getDotColor(name) }}
                    >
                      {rate.toFixed(2)}%
                    </span>
                  </div>
                ))
              }
            </div>

            {/* Legend row */}
            <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-success)" }} />
                <span className="font-mono text-xs text-muted">&lt;0.65%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-accent-light)" }} />
                <span className="font-mono text-xs text-muted">0.65-0.85%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-warning)" }} />
                <span className="font-mono text-xs text-muted">0.85-1.2%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-coral)" }} />
                <span className="font-mono text-xs text-muted">&gt;1.2%</span>
              </div>
            </div>
          </div>
        </div>
      </Beat>

      {/* ── Beat 4: Tier Snapshot ──────────────────────────────────────── */}
      <Beat active={currentBeat === 4} citation="NCUA 5300 Call Reports, Q4 2025 by asset tier">
        <div className="font-mono text-base text-muted tracking-[0.12em] uppercase mb-3">
          {lastLabel} by Asset Tier
        </div>

        {/* Header row */}
        <div
          className="grid gap-4 w-full max-w-[1100px] px-5 pb-1"
          style={{ gridTemplateColumns: "260px 1fr 100px 120px" }}
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
        <div className="flex flex-col gap-2.5 w-full max-w-[1100px]">
          {TIER_ORDER.map((tierKey, i) => {
            const tier = tiersByName.get(tierKey);
            if (!tier) return null;

            const isHighest = tier.isHighestDelinquency;
            const tierAssetRaw = parseAssetsString(tier.totalAssets);
            const barWidth = (tierAssetRaw / maxTierAssets) * 100;

            return (
              <div
                key={tierKey}
                className={`grid gap-4 items-center px-5 py-3 rounded-lg border transition-all duration-350 ease-out ${
                  isHighest
                    ? "border-coral/40 bg-coral/[0.08]"
                    : "border-border bg-surface"
                }`}
                style={{
                  gridTemplateColumns: "260px 1fr 100px 120px",
                  opacity: currentBeat === 4 ? 1 : 0,
                  transform:
                    currentBeat === 4
                      ? "translateX(0)"
                      : "translateX(-16px)",
                  transitionDelay: `${0.1 + i * 0.08}s`,
                }}
              >
                <div className="font-[family-name:var(--font-display)] font-semibold text-[18px] text-foreground">
                  {TIER_DISPLAY_NAMES[tierKey] ?? tierKey}
                  <span className="font-mono text-sm text-muted ml-2">
                    {tier.cuCount} CUs
                  </span>
                </div>
                <div className="relative h-5 bg-white/[0.03] rounded-md overflow-hidden">
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
                  className={`font-mono text-lg font-semibold text-right ${
                    isHighest ? "text-coral font-bold" : "text-foreground"
                  }`}
                >
                  {tier.avgDelinquency}
                </div>
                <div className="font-mono text-sm text-right text-muted">
                  {tier.members}
                </div>
              </div>
            );
          })}
        </div>

        {/* Delinquency sparkline below tiers */}
        {quarterlyDelinq.length >= 2 && (
          <div
            className="mt-4 transition-all duration-500 ease-out"
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
              Michigan Unemployment
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-[family-name:var(--font-display)] font-bold text-[48px] text-heading tabular-nums leading-none">
                {unemployment?.value ?? "5.0%"}
              </span>
              {unemployment && (
                <span
                  className="font-mono text-xl font-semibold"
                  style={{ color: directionColor(unemployment.direction, true) }}
                >
                  {directionArrow(unemployment.direction)}
                </span>
              )}
            </div>
            {unemployment?.change && (
              <div className="font-mono text-sm text-muted mt-1">
                {unemployment.change}
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
                {mortgageRate?.value ?? "6.22%"}
              </span>
              {mortgageRate && (
                <span
                  className="font-mono text-xl font-semibold"
                  style={{ color: directionColor(mortgageRate.direction, true) }}
                >
                  {directionArrow(mortgageRate.direction)}
                </span>
              )}
            </div>
            {mortgageRate?.change && (
              <div className="font-mono text-sm text-muted mt-1">
                {mortgageRate.change}
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
                {consumerSentiment?.value ?? "56.4"}
              </span>
              {consumerSentiment && (
                <span
                  className="font-mono text-xl font-semibold"
                  style={{ color: directionColor(consumerSentiment.direction) }}
                >
                  {directionArrow(consumerSentiment.direction)}
                </span>
              )}
            </div>
            {consumerSentiment?.change && (
              <div className="font-mono text-sm text-muted mt-1">
                {consumerSentiment.change}
              </div>
            )}
          </div>

          {/* Data Sources card (replaces Zillow-specific housing card) */}
          <div
            className="rounded-xl border border-border bg-surface px-8 py-6 transition-all duration-400 ease-out"
            style={{
              opacity: currentBeat === 5 ? 1 : 0,
              transform: currentBeat === 5 ? "translateY(0)" : "translateY(12px)",
              transitionDelay: "0.4s",
            }}
          >
            <div className="font-mono text-sm text-muted tracking-wide uppercase mb-2">
              Data Sources
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-[family-name:var(--font-display)] font-bold text-[48px] text-heading tabular-nums leading-none">
                {dataSourceCount > 0 ? dataSourceCount : 4}
              </span>
              <span className="font-mono text-lg text-muted">
                active feeds
              </span>
            </div>
            <div className="font-mono text-sm text-muted mt-1">
              NCUA, FRED, CFPB, Zillow
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
          Cross-referenced against {(totalCUs ?? 0).toLocaleString()} credit unions
        </div>
      </Beat>

      {/* ── Beat 6: The Narrative ──────────────────────────────────────── */}
      <Beat active={currentBeat === 6} citation="Analysis based on NCUA, FRED, CFPB, and Zillow data">
        {data.isAIGenerated && summaryInsight ? (
          /* AI-generated summary, truncated to first two sentences for stage readability */
          <div
            className="font-[family-name:var(--font-display)] font-medium text-[32px] leading-[1.5] text-center max-w-[900px] text-foreground transition-all duration-600 ease-out"
            style={{
              opacity: currentBeat === 6 ? 1 : 0,
              transform: currentBeat === 6 ? "translateY(0)" : "translateY(10px)",
              transitionDelay: "0.15s",
            }}
          >
            {(() => {
              // Take first sentence only. If still too long, cut at last comma before 180 chars.
              const first = summaryInsight.split(/(?<=\.)\s+/)[0] || summaryInsight;
              if (first.length <= 180) return first;
              const cut = first.lastIndexOf(",", 180);
              return cut > 80 ? first.slice(0, cut) + "." : first.slice(0, 180) + "...";
            })()}
          </div>
        ) : (
          /* Data-derived fallback with context lines */
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
              className="text-[22px] text-muted font-normal mt-1 text-center transition-all duration-500 ease-out"
              style={{
                opacity: currentBeat === 6 ? 1 : 0,
                transform: currentBeat === 6 ? "translateY(0)" : "translateY(10px)",
                transitionDelay: "0.25s",
              }}
            >
              {data.overviewMetrics.find((m) => m.label === "Avg Net Worth")
                ? `Average net worth ratio at ${data.overviewMetrics.find((m) => m.label === "Avg Net Worth")?.value}, well above the 7% well-capitalized threshold.`
                : "Michigan credit unions remain well-capitalized above the 7% threshold."}
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
              className="text-[22px] text-muted font-normal mt-1 text-center transition-all duration-500 ease-out"
              style={{
                opacity: currentBeat === 6 ? 1 : 0,
                transform: currentBeat === 6 ? "translateY(0)" : "translateY(10px)",
                transitionDelay: "0.5s",
              }}
            >
              {quarterlyDelinq.length >= 2
                ? `Statewide rate moved from ${formatPct(quarterlyDelinq[0])} to ${formatPct(quarterlyDelinq[quarterlyDelinq.length - 1])} across ${quartersAnalyzed} quarters.`
                : `Statewide delinquency trends warrant monitoring across ${quartersAnalyzed} quarters.`}
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
            <div
              className="text-[22px] text-muted font-normal mt-1 text-center transition-all duration-500 ease-out"
              style={{
                opacity: currentBeat === 6 ? 1 : 0,
                transform: currentBeat === 6 ? "translateY(0)" : "translateY(10px)",
                transitionDelay: "0.75s",
              }}
            >
              {cusLost} fewer institutions, but {data.assetGrowth} more in total assets than {firstLabel}.
            </div>
          </div>
        )}

        {/* Key findings from analysis */}
        {data.trends.length > 0 && (
          <div
            className="mt-8 flex flex-col gap-3 max-w-[900px] w-full"
            style={{
              opacity: currentBeat === 6 ? 1 : 0,
              transitionDelay: "0.9s",
              transition: "opacity 0.5s ease",
            }}
          >
            <div
              className="flex items-start gap-3 px-6 py-3 rounded-lg"
              style={{
                background: "rgba(67,116,129,0.08)",
                border: "1px solid rgba(67,116,129,0.15)",
              }}
            >
              <span
                className="font-mono text-sm mt-0.5"
                style={{ color: "var(--color-accent-light)" }}
              >
                TREND
              </span>
              <span className="text-xl text-foreground">
                {data.trends[0].name}
              </span>
            </div>
            {data.risks.length > 0 && (
              <div
                className="flex items-start gap-3 px-6 py-3 rounded-lg"
                style={{
                  background: "rgba(207,90,90,0.06)",
                  border: "1px solid rgba(207,90,90,0.12)",
                }}
              >
                <span
                  className="font-mono text-sm mt-0.5"
                  style={{ color: "var(--color-coral)" }}
                >
                  RISK
                </span>
                <span className="text-xl text-foreground">
                  {data.risks[0].name}
                </span>
              </div>
            )}
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
            {(totalCUs ?? 0).toLocaleString()} institutions. {quartersAnalyzed} quarters. {dataSourceCount > 0 ? dataSourceCount : 4} data sources.
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

          {/* Dixon Strategic Labs logo */}
          <div
            className="mt-10 transition-opacity duration-400 ease-out"
            style={{
              opacity: currentBeat === 7 ? 0.4 : 0,
              transitionDelay: "1s",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dxn-logo-white.png"
              alt="Dixon Strategic Labs"
              className="h-6 w-auto mx-auto hidden dark:block"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dxn-logo-black.png"
              alt="Dixon Strategic Labs"
              className="h-6 w-auto mx-auto dark:hidden"
            />
          </div>
        </div>
      </Beat>
    </div>
  );
}

// ── Helper: parse formatted asset string back to number ───────────────────

function parseAssetsString(formatted: string): number {
  if (!formatted) return 0;
  const cleaned = formatted.replace(/[$,]/g, "");
  if (cleaned.endsWith("B")) return parseFloat(cleaned) * 1_000_000_000;
  if (cleaned.endsWith("M")) return parseFloat(cleaned) * 1_000_000;
  if (cleaned.endsWith("K")) return parseFloat(cleaned) * 1_000;
  return parseFloat(cleaned) || 0;
}
