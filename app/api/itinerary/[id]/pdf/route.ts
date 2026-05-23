import { renderToBuffer } from "@react-pdf/renderer";
import { loadItinerary } from "@/lib/blob";
import { ItineraryPDF } from "@/components/itinerary-pdf";

export const maxDuration = 30;

type UIPart = { type: string; text?: string };
type UIMessage = { id?: string; role: string; parts: UIPart[] };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await loadItinerary(id);

  if (!data) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const messages = data.messages as UIMessage[];
  const finalAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const itineraryText =
    finalAssistant?.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("\n\n") ?? "";

  if (!itineraryText) {
    return Response.json(
      { error: "No itinerary text to render" },
      { status: 422 },
    );
  }

  try {
    const buffer = await renderToBuffer(
      ItineraryPDF({
        prompt: data.prompt,
        itineraryText,
        savedAt: data.savedAt,
      }),
    );

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="wanderloop-${id}.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[itinerary/pdf] FAIL id=${id}: ${message}`);
    return Response.json(
      { error: "PDF render failed", details: message },
      { status: 500 },
    );
  }
}
