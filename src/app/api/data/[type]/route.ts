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

  // Try Blob if configured
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { list } = await import("@vercel/blob");

      const blobKey =
        type === "verification"
          ? "mcul-scanner/daily.json"
          : `mcul-scanner/${type}.json`;

      const blobs = await list({ prefix: blobKey });
      if (blobs.blobs.length > 0) {
        const resp = await fetch(blobs.blobs[0].url);
        const data = await resp.json();

        const responseData =
          type === "verification" ? data.verification ?? data : data;

        return Response.json(responseData, {
          headers: {
            "Cache-Control": "public, s-maxage=300",
          },
        });
      }
    } catch (err) {
      console.error(`[data/${type}] Blob fetch error:`, err);
    }
  }

  // No Blob configured or no data in Blob
  return Response.json(
    {
      error: "No server-side data available",
      detail:
        "Data lives in your browser (localStorage). Use the Refresh button to scan, or configure BLOB_READ_WRITE_TOKEN for server-side persistence.",
    },
    { status: 404 }
  );
}
