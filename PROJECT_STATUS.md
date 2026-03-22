# MCUL Scanner - Project Status

**Updated:** 2026-03-22
**Status:** Michigan map SVG, sparklines, severity bars, and visual richness added.
**URL:** https://mi.dxn.is (not yet deployed)
**Repo:** local only

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
- [x] PresentationView: 9-beat stage deck (Beat, DotAnimation, PresentationView components)
- [x] DashboardView full implementation: dashboard-view, statewide-overview, tier-health, anomaly-flags, emerging-trends, risk-concentrations, market-pulse
- [x] Format helpers (src/lib/format.ts): fmtAssets, fmtMembers, fmtPct, fmtDelinquency, fmtChange, fmtCurrency
- [x] Data endpoint /tmp fallback when BLOB_READ_WRITE_TOKEN not set
- [x] Scan endpoints write to /tmp cache as fallback
- [x] Daily scan loads quarterly baseline from /tmp when Blob unavailable
- [x] Clean empty state UI (no broken skeleton on first load)
- [x] Michigan map SVG component (both peninsulas, metro dots with scan pulse, size variants)
- [x] Michigan map in header, empty state, and background watermark
- [x] Stat tile sparkline decorations
- [x] Flag card severity bars (critical/warning/info gradients)
- [x] Section divider CSS with dots
- [ ] Vercel deployment + domain setup
