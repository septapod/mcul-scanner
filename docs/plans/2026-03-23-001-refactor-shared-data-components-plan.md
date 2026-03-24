---
title: "Refactor: Shared Data Components for Dashboard + Presentation"
type: refactor
status: active
date: 2026-03-23
---

# Shared Data Components for Dashboard + Presentation

## Problem

Dashboard and presentation modes are two completely separate codebases rendering the same data. Every fix, null safety check, formatting change, and data-derived fallback must be manually duplicated. This has already caused repeated bugs where one mode works and the other doesn't.

## Solution

Create a shared data layer that both views consume. The data processing, formatting, and fallback logic lives in ONE place. Each view mode is just a LAYOUT of the same processed data.

## Architecture

```
[Raw API Data] → [useProcessedData hook] → { sections, metrics, narratives }
                                                    ↓
                                    ┌───────────────┴───────────────┐
                                    ↓                               ↓
                            [DashboardLayout]               [PresentationLayout]
                            (scrollable, all sections)      (full-screen beats)
                                    ↓                               ↓
                            Same components,                Same components,
                            normal size                     large size via props
```

## Implementation

### Step 1: Create `useProcessedData` hook

**File:** `src/hooks/use-processed-data.ts`

This hook takes raw `ScannerData` and returns fully processed, null-safe, display-ready data. ALL formatting, fallback computation, and null handling happens here. Components never touch raw data.

```typescript
interface ProcessedData {
  // Statewide metrics (always have values, even if fallback)
  totalCUs: number;
  totalAssets: number;
  totalMembers: number;
  avgNetWorthRatio: string; // already formatted "12.78%"
  weightedDelinquency: string; // already formatted "0.85%"
  totalNetIncome: string; // already formatted "$0"

  // Changes (QoQ)
  cuChange: { text: string; type: "positive" | "negative" | "neutral" };
  assetChange: { text: string; type: "positive" | "negative" | "neutral" };
  // ... etc

  // Tiers (always an array, never null)
  tiers: ProcessedTier[];

  // Anomalies (always an array)
  anomalies: ProcessedAnomaly[];

  // Trends (AI or data-derived, always populated when quarterly data exists)
  trends: ProcessedTrend[];

  // Risks (AI or data-derived, always populated)
  risks: ProcessedRisk[];

  // Market pulse
  fred: ProcessedFREDSeries[];
  cfpb: ProcessedCFPB | null;
  zillow: ProcessedZillow | null;

  // Narrative (AI summary or data-derived)
  narrative: {
    overview: string;
    summaryInsight: string;
    isAIGenerated: boolean;
  };

  // Meta
  lastRefresh: string | null;
  verificationPassed: boolean;
  verificationCount: string;
  hasData: boolean;
  hasAnalysis: boolean;
}
```

Every field is guaranteed non-null and pre-formatted. No component ever calls `.toLocaleString()`, `.toFixed()`, or accesses nested properties. The hook handles all of that.

### Step 2: Create shared section components with `variant` prop

Each section component accepts a `variant: "dashboard" | "presentation"` prop that controls sizing and layout.

**Example: `src/components/sections/trends-section.tsx`**
```typescript
interface TrendsSectionProps {
  trends: ProcessedTrend[];
  variant: "dashboard" | "presentation";
}

export function TrendsSection({ trends, variant }: TrendsSectionProps) {
  if (variant === "presentation") {
    // Full-screen, one trend per view, large text
    return <PresentationTrendCard trend={trends[0]} />;
  }
  // Dashboard: list all trends in cards
  return <div className="grid gap-3">{trends.map(t => <TrendCard key={t.name} trend={t} />)}</div>;
}
```

Sections to create:
- `hero-section.tsx` (big numbers)
- `overview-section.tsx` (stat tiles)
- `tier-section.tsx` (tier breakdown)
- `anomaly-section.tsx` (flags)
- `trends-section.tsx` (emerging trends)
- `risks-section.tsx` (risk concentrations)
- `market-pulse-section.tsx` (FRED + CFPB + Zillow)
- `narrative-section.tsx` (summary)
- `heat-map-section.tsx` (Michigan map)

### Step 3: Rewrite DashboardView to use shared components

```typescript
function DashboardView({ data }: { data: ProcessedData }) {
  return (
    <main className="space-y-6">
      <HeroSection data={data} variant="dashboard" />
      <OverviewSection data={data} variant="dashboard" />
      <TierSection data={data} variant="dashboard" />
      <AnomalySection data={data} variant="dashboard" />
      <TrendsSection trends={data.trends} variant="dashboard" />
      <RisksSection risks={data.risks} variant="dashboard" />
      <MarketPulseSection data={data} variant="dashboard" />
    </main>
  );
}
```

### Step 4: Rewrite PresentationView to use shared components

```typescript
function PresentationView({ data }: { data: ProcessedData }) {
  const [beat, setBeat] = useState(1);
  return (
    <div className="fixed inset-0">
      <Beat active={beat === 1}><HeroSection data={data} variant="presentation" /></Beat>
      <Beat active={beat === 2}><OverviewSection data={data} variant="presentation" /></Beat>
      <Beat active={beat === 3}><HeatMapSection data={data} variant="presentation" /></Beat>
      <Beat active={beat === 4}><TierSection data={data} variant="presentation" /></Beat>
      <Beat active={beat === 5}><MarketPulseSection data={data} variant="presentation" /></Beat>
      <Beat active={beat === 6}><NarrativeSection data={data} variant="presentation" /></Beat>
      <Beat active={beat === 7}><ClosingSection data={data} variant="presentation" /></Beat>
    </div>
  );
}
```

### Step 5: Delete old separate code

Remove:
- The inline `DashboardView` function from page.tsx
- `src/components/presentation/presentation-view.tsx` (replaced by shared components)
- `src/components/dashboard/*.tsx` (replaced by shared section components)

## Acceptance Criteria

- [ ] `useProcessedData` hook handles ALL null safety, formatting, and fallbacks
- [ ] No component ever calls `.toLocaleString()`, `.toFixed()`, or accesses raw nested data
- [ ] Dashboard and presentation modes render the same processed data
- [ ] A fix to any section component automatically applies to both views
- [ ] All data-derived fallbacks (trends, risks) live in the hook, not in components
- [ ] No "pending", "N/A", or placeholder text appears when quarterly data exists
- [ ] Build passes, no type errors
- [ ] Both views render correctly with: full data, partial data (no daily), no data at all
