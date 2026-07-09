import DestinationGallery from "@/components/destination-gallery";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12 sm:py-20">
      <header className="mb-12 flex items-center justify-between">
        <span className="text-sm font-medium tracking-wider text-neutral-500 uppercase">
          Wanderloop
        </span>
        <a
          href="/durable-plan"
          className="rounded-full border border-purple-800 px-3 py-1 text-xs text-purple-300 hover:border-purple-600 hover:text-purple-200"
        >
          Try durable mode →
        </a>
      </header>

      <section className="mb-16 flex w-full max-w-3xl flex-col self-center text-center">
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          Plan a trip in seconds.
        </h1>
        <p className="mt-4 text-lg text-neutral-400">
          Type what you want. An AI agent builds the itinerary in real time —
          flights, restaurants, weather, and a day-by-day plan.
        </p>

        <form
          action="/plan"
          method="get"
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            name="q"
            placeholder="5 days in Lisbon, foodie, mid-budget…"
            required
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-neutral-100 placeholder-neutral-500 outline-none focus:border-neutral-400"
            aria-label="Describe your trip"
          />
          <button
            type="submit"
            className="rounded-lg bg-neutral-100 px-6 py-3 text-base font-medium text-neutral-900 transition hover:bg-white"
          >
            Plan trip →
          </button>
        </form>
      </section>

      <DestinationGallery />

      <footer className="mt-20 flex flex-col items-center gap-2 text-xs text-neutral-600">
        <div>
          Built on Vercel — AI SDK · Workflow DevKit · Sandbox · Blob · Cron
        </div>
        <div className="flex gap-3 text-neutral-700">
          <a
            href="https://github.com/aieng2026/wanderloop"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-400"
          >
            GitHub →
          </a>
          <a href="/architecture" className="hover:text-neutral-400">
            Architecture teardown →
          </a>
        </div>
      </footer>
    </main>
  );
}
