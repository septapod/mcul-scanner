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

  // Try Blob first, then /tmp fallback
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { list } = await import("@vercel/blob");

      const blobKey =
        type === "verification"
          ? "mcul-scanner/daily.json"
          : `mcul-scanner/${type}.json`;

      const blobs = await list({ prefix: blobKey });
      if (blobs.blobs.length === 0) {
        // Fall through to /tmp fallback below
      } else {
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
      }
    } catch (err) {
      console.error(`[data/${type}] Blob fetch error, trying /tmp fallback:`, err);
      // Fall through to /tmp fallback
    }
  }

  // /tmp cache fallback (works without Blob, persists within function execution)
  try {
    const fs = await import("fs/promises");
    const filePath =
      type === "verification"
        ? "/tmp/mcul-scanner/daily.json"
        : `/tmp/mcul-scanner/${type}.json`;

    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw);

    const responseData =
      type === "verification" ? data.verification ?? data : data;

    return Response.json(responseData, {
      headers: {
        "Cache-Control": "public, s-maxage=300",
      },
    });
  } catch {
    return Response.json(
      {
        error: "No data available",
        detail: "Run a scan first using the Refresh button.",
      },
      { status: 404 }
    );
  }
}
