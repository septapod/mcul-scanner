/**
 * Client-side FRED proxy. The FRED API blocks Vercel's server IPs,
 * so this endpoint lets the browser fetch FRED data via a lightweight proxy.
 * The browser calls this endpoint, which fetches from FRED.
 *
 * Actually, since this is still a Vercel serverless function, it will
 * also be blocked. The real fix: fetch FRED data client-side directly
 * from the browser. FRED's API supports CORS.
 *
 * This route is a backup/diagnostic endpoint.
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const seriesId = url.searchParams.get("series_id") || "MIUR";
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "FRED_API_KEY environment variable is not set" },
      { status: 500 }
    );
  }

  const fredUrl = new URL(
    "https://api.stlouisfed.org/fred/series/observations"
  );
  fredUrl.searchParams.set("series_id", seriesId);
  fredUrl.searchParams.set("api_key", apiKey);
  fredUrl.searchParams.set("file_type", "json");
  fredUrl.searchParams.set("sort_order", "desc");
  fredUrl.searchParams.set("limit", "24");

  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  fredUrl.searchParams.set("observation_start", d.toISOString().slice(0, 10));

  try {
    const resp = await fetch(fredUrl.toString());
    const data = await resp.json();
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return Response.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
