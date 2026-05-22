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

        <form action="/plan" method="get" className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            name="q"
            placeholder="5 days in Lisbon, foodie, mid-budget…"
            defaultValue=""
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

        <div className="flex flex-wrap justify-center gap-2 text-xs text-neutral-500">
          <span>Try:</span>
          <a
            href="/plan?q=5+days+in+Lisbon%2C+foodie%2C+mid-budget"
            className="rounded-full border border-neutral-800 px-3 py-1 hover:border-neutral-600 hover:text-neutral-300"
          >
            5 days in Lisbon, foodie, mid-budget
          </a>
          <a
            href="/plan?q=Long+weekend+in+Tokyo%2C+art+and+ramen"
            className="rounded-full border border-neutral-800 px-3 py-1 hover:border-neutral-600 hover:text-neutral-300"
          >
            Long weekend in Tokyo, art + ramen
          </a>
          <a
            href="/plan?q=4+days+in+Paris%2C+relaxed+pace%2C+museums"
            className="rounded-full border border-neutral-800 px-3 py-1 hover:border-neutral-600 hover:text-neutral-300"
          >
            4 days in Paris, relaxed, museums
          </a>
        </div>

        <div className="pt-2 text-center text-xs text-neutral-600">
          Want it to survive a tab close?{" "}
          <a
            href="/durable-plan"
            className="text-purple-400 underline-offset-2 hover:text-purple-300 hover:underline"
          >
            Try durable mode →
          </a>
        </div>
      </div>
    </main>
  );
}
