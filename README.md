# Michigan Credit Union Health Dashboard

A data dashboard that cross-references NCUA quarterly financials, FRED economic indicators, CFPB complaint data, and Zillow housing metrics to paint a picture of credit union health across Michigan.

AI-generated narratives (powered by Anthropic Claude) synthesize the raw data into readable, actionable insights for credit union leaders.

**Live at [mi.dxn.is](https://mi.dxn.is)**

## Background

Built for a live demo at the **MCUL (Michigan Credit Union League) YOU Conference** in March 2026, Grand Rapids, MI. The session ("How to Use AI as a Strategic Thought Partner") showed ~150 credit union executives how AI can turn public data into strategic intelligence.

## What It Does

- Pulls quarterly call report data for every Michigan credit union from the NCUA API
- Fetches 7 FRED economic series (unemployment, mortgage rates, consumer sentiment, jobless claims, building permits, fed funds rate, CPI)
- Aggregates CFPB consumer complaint data by product and company
- Incorporates Zillow housing market indicators for Michigan metros
- Renders an interactive SVG map of Michigan with county-level data
- Groups credit unions into asset tiers for comparative analysis
- Runs a 7-beat presentation mode for conference delivery
- Generates AI narrative summaries via Claude that connect the dots across all data sources

## Tech Stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** for styling
- **Anthropic Claude** for AI-generated narrative synthesis
- **Vercel** for deployment
- Data sources: NCUA, FRED, CFPB, Zillow

## Data Refresh

All data fetches happen on manual button click. The dashboard makes zero automatic API calls on page load. This keeps API usage predictable and avoids rate limiting during demos.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `FRED_API_KEY` | Yes | FRED API key (get one at [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html)) |
| `NEXT_PUBLIC_FRED_API_KEY` | Yes | Same FRED key, exposed to the browser for client-side fallback fetches |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude narrative generation |

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## License

Private repository. All rights reserved.
