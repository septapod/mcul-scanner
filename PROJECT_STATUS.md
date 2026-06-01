# MCUL Scanner - Project Status

**Updated:** 2026-05-31
**Status:** Three presentation mode bugs fixed (empty state, click handler, mobile stats), deployed to prod.
**URL:** https://mi.dxn.is
**Repo:** local only

## Recent Changes

- **Opus 4.8 migration (2026-05-31)** -- narrative model bumped `claude-opus-4-6` -> `claude-opus-4-8` in `src/lib/pipelines/narratives.ts` and the quarterly-scan metadata string. No API-parameter changes were needed (the calls send only model/max_tokens/system/messages). `@anthropic-ai/sdk` stays on 0.80.0. Typecheck clean.

## What's Done

- [x] Next.js 16 scaffold with Tailwind v4
- [x] DXN OS design system tokens (globals.css): colors, fonts, dashboard-bg utility
- [x] Font config: Satoshi (display), Karla (body), JetBrains Mono (code)
- [x] Site config (name, description, URL)
- [x] Root layout with ThemeProvider (next-themes), viewport meta, skip-to-content
- [x] Providers component (dark theme default)
- [x] Anthropic client singleton (src/lib/anthropic.ts)
- [x] Premium landing page: hero metrics, scanner status bar, two-column dashboard, presentation mode toggle
- [x] Visual polish: noise texture overlay, gradient border cards, glow effects, animated gradient line, pulsing status dots
- [x] lucide-react icons installed (Sun, Moon, Settings, Presentation, RefreshCw, Shield, ChevronRight, TrendingUp, Minus, TrendingDown, AlertCircle)
- [x] Theme toggle (next-themes) and Settings button in header
- [x] Responsive layout (375px minimum, single-column mobile, two-column desktop)
- [x] Design review fixes: inline data previews, mobile hero stacking, light mode CSS vars, Satoshi display font on rows, always-visible chevrons, keyboard-accessible rows (button elements), 44px touch targets, coral accents on Anomalies/Risks, present button safe-area positioning, var() refs replacing hardcoded hex, Key Metrics strip, hover:hover media query, font-medium on "Scanned daily."
- [x] Security headers in next.config.ts (X-Frame-Options, HSTS, nosniff)
- [x] serverExternalPackages: jszip
- [x] vercel.json (iad1 region)
- [x] .env.example

## What's Left

- [x] Shared TypeScript types for all pipelines (types.ts)
- [x] NCUA quarterly pipeline ported from Python (ncua.ts): download, parse, filter MI, compute metrics, tier breakdown, anomaly detection
- [x] FRED pipeline (fred.ts): 7 economic series with significance flags
- [x] CFPB pipeline (cfpb.ts): MI CU complaints with company matching
- [x] Zillow pipeline (zillow.ts): ZHVI + inventory with MoM/3mo/YoY changes
- [x] Cross-reference engine (crossref.ts): FRED x NCUA, CFPB x NCUA, Zillow x NCUA findings
- [x] Three-layer verification pipeline (verify.ts): data collection, analysis, presentation checks
- [x] AI narrative generation (narratives.ts): quarterly + daily narratives via Claude Sonnet
- [x] API route: POST /api/scan/quarterly (NCUA pipeline + narratives + verification + Blob save)
- [x] API route: POST /api/scan/daily (FRED/CFPB/Zillow + crossref + narratives + verification)
- [x] API route: GET /api/data/[type] (serve quarterly/daily/verification from Blob)
- [x] Shared UI components: StatTile, SeverityBadge, FlagCard, ModeToggle, ThemeToggle, RefreshButton, VerificationBadge
- [x] Main page shell rewrite: data fetching, loading skeleton, keyboard shortcuts, presentation mode routing
- [x] PresentationView: 7-beat stage deck (Beat, DotAnimation, PresentationView components)
- [x] DashboardView full implementation: dashboard-view, statewide-overview, tier-health, anomaly-flags, emerging-trends, risk-concentrations, market-pulse
- [x] Format helpers (src/lib/format.ts): fmtAssets, fmtMembers, fmtPct, fmtDelinquency, fmtChange, fmtCurrency
- [x] Scan endpoints return data directly (no /tmp or Blob writes)
- [x] Frontend uses localStorage for data persistence across page loads
- [x] Daily scan accepts quarterly baseline via request body from frontend
- [x] Data endpoint is thin proxy (Blob if configured, 404 otherwise)
- [x] Clean empty state UI (no broken skeleton on first load)
- [x] Michigan map SVG component (accurate react-usa-map paths, metro dots with scan pulse, size variants)
- [x] Michigan map in header, empty state, and background watermark
- [x] ~~Stat tile sparkline decorations~~ (removed: were static/misleading)
- [x] Flag card severity bars (critical/warning/info gradients)
- [x] Section divider CSS with dots
- [x] Vercel deployment + domain setup (mi.dxn.is)
- [x] Anthropic API key made truly optional (daily scan works without it)
- [x] WCAG AA light mode contrast: gold, coral, accent, muted, success, warning, info all pass 4.5:1
- [x] Net worth ratio displays as percentages (converted from basis points) in statewide, tier health, anomaly cards
- [x] Delinquency trend values formatted as percentages in anomaly detail text
- [x] All dashboard sections render in page.tsx: statewide overview, tier health, anomaly flags, emerging trends, risk concentrations, market pulse
- [x] Hero text spacing fixed (gap between metric groups)
- [x] Narrative system prompt updated for plain-English readability
- [x] P1: Presentation mode fixed (inline placeholder removed, real component imported with correct prop mapping)
- [x] P1: Minimum text sizes enforced (no text below 13px across all dashboard components)
- [x] P2: Removed misleading static sparklines from stat tiles
- [x] CFPB byCompany filtered to Michigan-headquartered CUs only (non-MI CUs excluded from display)
- [x] FRED API key fallback to hardcoded public key, better error logging
- [x] All user-facing "MI" text changed to "Michigan" (presentation, dashboard, FRED series names, crossref headlines)
- [x] Fixed FRED unemployment key lookup in presentation view (MIURN -> MIUR)
- [x] Beat 6 narrative context sentences added (capital, delinquency, consolidation)
- [x] Comprehensive null safety on all toLocaleString calls (safe-format.ts helper + ?? 0 guards across 11 files)
- [x] Deep null safety audit: 35 fixes across format.ts, market-pulse, presentation-view, tier-health, statewide-overview, anomaly-flags, page.tsx (null guards on every format fn, optional chaining on nested property access, fallback defaults on all API-sourced values)
- [x] Placeholder analysis never cached or displayed (model "none", "pending", "API key" text filtered out)
- [x] Emerging Trends and Risk Concentrations sections hidden when no AI analysis available
- [x] Stale localStorage cache auto-cleared after 24 hours
- [x] Shared useProcessedData hook (src/hooks/use-processed-data.ts): centralized null-safe formatting, data-derived trend/risk fallbacks, anomaly formatting, FRED/CFPB processing, narrative placeholder detection
- [x] page.tsx refactored: DashboardView and PresentationView both consume ProcessedData from the hook. Removed duplicated computeTrendsFromData/computeRisksFromData. Dashboard sections use processed fields directly for overview metrics, anomalies, trends, risks, FRED data.
- [x] presentation-view.tsx refactored: accepts ProcessedData instead of raw data shape. Removed all local format helpers and data extraction block. Uses processed fields for hero metrics, tiers, sparkline, FRED, narrative.
- [x] Presentation Beat 6 synced with dashboard data: shows AI summaryInsight when isAIGenerated, appends top trend/risk pills below narrative in both AI and fallback branches.
- [x] Presentation mode empty state: shows fallback UI with "Go to Dashboard" button when no cached data
- [x] Click handler excludes buttons/links/role=button (no longer eats interactive element clicks)
- [x] Beat 1 stats responsive: flex-col on mobile, smaller text (22px/32px), tighter gaps
- [ ] Add Vercel Blob for server-side persistence (when BLOB_READ_WRITE_TOKEN configured)
- [ ] Add real data-driven sparklines to stat tiles
