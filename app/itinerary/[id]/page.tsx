import { notFound } from "next/navigation";
import Link from "next/link";
import { loadItinerary } from "@/lib/blob";
import ItineraryDisplay from "@/components/itinerary-display";

type UIPart = { type: string; text?: string };
type UIMessage = { id?: string; role: string; parts: UIPart[] };

export default async function ItineraryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadItinerary(id);

  if (!data) notFound();

  const messages = data.messages as UIMessage[];
  const finalAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const itineraryText =
    finalAssistant?.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("\n\n") ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-300"
        >
          ← Wanderloop
        </Link>
        <span className="text-xs text-neutral-600">
          Saved {new Date(data.savedAt).toLocaleString()}
        </span>
      </header>

      <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900/40 px-5 py-3 text-sm">
        <div className="mb-1 text-xs tracking-wider text-neutral-500 uppercase">
          Original prompt
        </div>
        <div className="text-neutral-200">{data.prompt}</div>
      </div>

      {itineraryText ? (
        <ItineraryDisplay text={itineraryText} />
      ) : (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-4 text-sm text-neutral-500">
          No itinerary content found in this saved trip.
        </div>
      )}

      <div className="mt-10 flex items-center justify-between text-xs text-neutral-600">
        <Link
          href="/"
          className="rounded-md border border-neutral-800 px-3 py-1.5 hover:border-neutral-600 hover:text-neutral-300"
        >
          ← Plan a new trip
        </Link>
        <button
          type="button"
          onClick={undefined}
          className="cursor-default text-neutral-700"
          aria-hidden
        />
        <ShareButton id={id} />
      </div>
    </main>
  );
}

function ShareButton({ id }: { id: string }) {
  return (
    <a
      href={`/itinerary/${id}`}
      className="rounded-md border border-neutral-800 px-3 py-1.5 hover:border-neutral-600 hover:text-neutral-300"
    >
      Share link: /itinerary/{id}
    </a>
  );
}
