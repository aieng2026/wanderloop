import { list } from "@vercel/blob";

export type SavedItinerary = {
  id: string;
  prompt: string;
  messages: unknown[];
  savedAt: string;
};

export async function loadItinerary(
  id: string,
): Promise<SavedItinerary | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitized) return null;

  const { blobs } = await list({ prefix: `itineraries/${sanitized}.json` });
  const blob = blobs.find((b) => b.pathname === `itineraries/${sanitized}.json`);
  if (!blob) return null;

  const res = await fetch(blob.url, { cache: "no-store" });
  if (!res.ok) return null;

  const data = (await res.json()) as SavedItinerary;
  return data;
}
