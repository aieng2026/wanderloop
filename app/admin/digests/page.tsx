import Link from "next/link";
import { get, list } from "@vercel/blob";

export const dynamic = "force-dynamic";

type Deal = {
  kind: "flight" | "hotel" | "experience";
  destination: string;
  title: string;
  discountPct: number;
  validUntil: string;
};

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

async function loadLatestDigest(): Promise<Digest | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const result = await get("digests/latest.json", {
      access: "private",
      useCache: false,
    });
    if (!result) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as Digest;
  } catch (err) {
    console.error("[admin/digests] load failed:", err);
    return null;
  }
}

async function listPriorDigests(): Promise<string[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  try {
    const { blobs } = await list({ prefix: "digests/" });
    return blobs
      .map((b) => b.pathname)
      .filter((p) => p !== "digests/latest.json")
      .sort()
      .reverse()
      .slice(0, 10);
  } catch {
    return [];
  }
}

const KIND_LABEL: Record<Deal["kind"], string> = {
  flight: "✈️ Flight",
  hotel: "🏨 Hotel",
  experience: "🎟 Experience",
};

export default async function DigestsPage() {
  const [digest, priors] = await Promise.all([
    loadLatestDigest(),
    listPriorDigests(),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-300"
        >
          ← Wanderloop
        </Link>
        <span className="text-xs text-neutral-600">Admin · Daily deals</span>
      </header>

      {!digest && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-4 text-sm text-neutral-400">
          <div className="font-medium text-neutral-100">
            No digest yet
          </div>
          <div className="mt-1 text-neutral-500">
            The cron runs daily at 06:00 UTC. To generate one now, hit{" "}
            <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-neutral-300">
              GET /api/cron/daily-deals
            </code>{" "}
            with the{" "}
            <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-neutral-300">
              Authorization: Bearer $CRON_SECRET
            </code>{" "}
            header.
          </div>
        </div>
      )}

      {digest && (
        <div className="space-y-6">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-xs tracking-wider text-neutral-500 uppercase">
                  Digest for {digest.date}
                </div>
                <div className="mt-1 text-sm text-neutral-300">
                  Generated{" "}
                  {new Date(digest.generatedAt).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-4 text-xs text-neutral-400">
                <span>
                  <span className="text-neutral-100">
                    {digest.itinerariesScanned}
                  </span>{" "}
                  itineraries scanned
                </span>
                <span>
                  <span className="text-neutral-100">
                    {digest.totalDeals}
                  </span>{" "}
                  total deals
                </span>
              </div>
            </div>
          </div>

          {digest.entries.length === 0 && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-4 text-sm text-neutral-500">
              No saved itineraries yet — save one from the planner and re-run
              the cron to see deals here.
            </div>
          )}

          {digest.entries.map((entry) => (
            <div
              key={entry.itineraryId}
              className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950"
            >
              <div className="border-b border-neutral-800 bg-neutral-900/60 px-5 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs tracking-wider text-neutral-500 uppercase">
                      {entry.destination}
                    </div>
                    <div className="truncate text-sm text-neutral-200">
                      {entry.prompt}
                    </div>
                  </div>
                  <Link
                    href={`/itinerary/${entry.itineraryId}`}
                    className="shrink-0 text-xs text-neutral-500 hover:text-neutral-300"
                  >
                    Open →
                  </Link>
                </div>
              </div>
              <ul className="divide-y divide-neutral-900">
                {entry.deals.map((deal, i) => (
                  <li
                    key={i}
                    className="flex items-baseline gap-3 px-5 py-3 text-sm"
                  >
                    <span className="shrink-0 text-xs text-neutral-500">
                      {KIND_LABEL[deal.kind]}
                    </span>
                    <span className="flex-1 text-neutral-200">
                      {deal.title}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      valid → {deal.validUntil}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {priors.length > 0 && (
        <div className="mt-10">
          <div className="mb-2 text-xs tracking-wider text-neutral-600 uppercase">
            Prior digests
          </div>
          <ul className="text-xs text-neutral-500">
            {priors.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
