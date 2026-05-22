import { list, put, get } from "@vercel/blob";
import {
  generateDealsFor,
  inferDestinationFromPrompt,
  type Deal,
} from "@/lib/deals";

export const maxDuration = 60;

function authorized(req: Request): boolean {
  // Vercel Cron sends Authorization: Bearer $CRON_SECRET
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

type DigestEntry = {
  itineraryId: string;
  prompt: string;
  destination: string;
  deals: Deal[];
};

type Digest = {
  generatedAt: string;
  date: string;
  itinerariesScanned: number;
  totalDeals: number;
  entries: DigestEntry[];
};

export async function GET(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "Blob storage not configured" },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const { blobs } = await list({ prefix: "itineraries/" });
    const entries: DigestEntry[] = [];

    for (const blob of blobs) {
      // pathname is "itineraries/{id}.json"
      const idMatch = blob.pathname.match(/^itineraries\/([^/]+)\.json$/);
      if (!idMatch) continue;
      const id = idMatch[1];

      try {
        const result = await get(blob.pathname, {
          access: "private",
          useCache: false,
        });
        if (!result) continue;
        const text = await new Response(result.stream).text();
        const data = JSON.parse(text) as { prompt: string };

        const destination = inferDestinationFromPrompt(data.prompt);
        const deals = generateDealsFor(destination, today, 3);

        entries.push({
          itineraryId: id,
          prompt: data.prompt,
          destination,
          deals,
        });
      } catch (e) {
        console.warn(`[cron] skip ${id}:`, e);
      }
    }

    const digest: Digest = {
      generatedAt: new Date().toISOString(),
      date: today,
      itinerariesScanned: entries.length,
      totalDeals: entries.reduce((n, e) => n + e.deals.length, 0),
      entries,
    };

    await put(`digests/${today}.json`, JSON.stringify(digest, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    await put("digests/latest.json", JSON.stringify(digest, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });

    console.log(
      `[cron/daily-deals] ok scanned=${digest.itinerariesScanned} deals=${digest.totalDeals} durMs=${Date.now() - startedAt}`,
    );

    return Response.json({
      ok: true,
      ...digest,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron/daily-deals] FAIL ${message}`);
    return Response.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
