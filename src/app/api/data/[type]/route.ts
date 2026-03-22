export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;

  const validTypes = ["quarterly", "daily", "verification"];
  if (!validTypes.includes(type)) {
    return Response.json(
      {
        error: "Invalid data type",
        detail: `Valid types: ${validTypes.join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      {
        error: "Blob storage not configured",
        detail:
          "Set BLOB_READ_WRITE_TOKEN to enable data persistence. Run the scan endpoints first to generate data.",
      },
      { status: 404 }
    );
  }

  try {
    const { list } = await import("@vercel/blob");

    const blobKey =
      type === "verification"
        ? "mcul-scanner/daily.json"
        : `mcul-scanner/${type}.json`;

    const blobs = await list({ prefix: blobKey });
    if (blobs.blobs.length === 0) {
      return Response.json(
        {
          error: "No data available",
          detail: `No ${type} data found. Run the /api/scan/${type === "verification" ? "daily" : type} endpoint first.`,
        },
        { status: 404 }
      );
    }

    const resp = await fetch(blobs.blobs[0].url);
    const data = await resp.json();

    // For verification type, extract just the verification report from daily data
    const responseData =
      type === "verification" ? data.verification ?? data : data;

    return Response.json(responseData, {
      headers: {
        "Cache-Control": "public, s-maxage=300",
      },
    });
  } catch (err) {
    console.error(`[data/${type}] Fetch error:`, err);
    return Response.json(
      {
        error: `Failed to fetch ${type} data`,
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
