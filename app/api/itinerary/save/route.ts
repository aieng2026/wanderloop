import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { z } from "zod";

const SaveRequestSchema = z.object({
  messages: z.array(z.unknown()).min(1),
  prompt: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      {
        error:
          "Blob storage not configured. Enable Vercel Blob on this project and add BLOB_READ_WRITE_TOKEN.",
      },
      { status: 503 },
    );
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = SaveRequestSchema.parse(body);
  } catch (err) {
    return Response.json(
      { error: "Invalid request", details: String(err) },
      { status: 400 },
    );
  }

  const id = nanoid(10);
  const payload = {
    id,
    prompt: parsed.prompt,
    messages: parsed.messages,
    savedAt: new Date().toISOString(),
  };

  try {
    const body = JSON.stringify(payload);
    console.log(
      `[itinerary/save] id=${id} bytes=${body.length} prompt=${parsed.prompt.slice(0, 60)}`,
    );

    const { url } = await put(`itineraries/${id}.json`, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });

    console.log(`[itinerary/save] ok id=${id} url=${url}`);
    return Response.json({ id, url, path: `/itinerary/${id}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[itinerary/save] FAIL id=${id} ${message}`, stack);
    return Response.json(
      {
        error: "Save failed",
        details: message,
      },
      { status: 500 },
    );
  }
}
