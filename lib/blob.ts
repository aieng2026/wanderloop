import { get } from "@vercel/blob";

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

  try {
    const result = await get(`itineraries/${sanitized}.json`, {
      access: "private",
      useCache: false,
    });
    if (!result) return null;

    const text = await new Response(result.stream).text();
    return JSON.parse(text) as SavedItinerary;
  } catch (err) {
    console.error(`[loadItinerary] FAIL id=${sanitized}`, err);
    return null;
  }
}
