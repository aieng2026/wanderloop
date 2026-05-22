export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-2xl space-y-10 text-center">
        <div className="space-y-3">
          <p className="text-sm font-medium tracking-wider text-neutral-500 uppercase">
            Wanderloop
          </p>
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            Plan a trip in seconds.
          </h1>
          <p className="text-lg text-neutral-400">
            Type what you want. An AI agent builds the itinerary in real time —
            flights, restaurants, weather, photos.
          </p>
        </div>

        <form className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            name="prompt"
            placeholder="5 days in Lisbon, foodie, mid-budget…"
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-neutral-100 placeholder-neutral-500 outline-none focus:border-neutral-400"
            disabled
            aria-label="Describe your trip"
          />
          <button
            type="submit"
            className="rounded-lg bg-neutral-100 px-6 py-3 text-base font-medium text-neutral-900 transition hover:bg-white disabled:opacity-40"
            disabled
          >
            Plan trip →
          </button>
        </form>

        <p className="text-xs text-neutral-600">
          Scaffold deployed. Phase D wires the AI agent. See{" "}
          <code className="rounded bg-neutral-800 px-1.5 py-0.5">
            DESIGN.md
          </code>
          .
        </p>
      </div>
    </main>
  );
}
