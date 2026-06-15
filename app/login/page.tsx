export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/plan", error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <div className="text-sm font-medium tracking-wider text-neutral-500 uppercase">
          Wanderloop
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-neutral-500">
          This trip planner is restricted to invited users.
        </p>
      </div>

      <form
        action="/api/login"
        method="POST"
        className="flex flex-col gap-4"
        autoComplete="on"
      >
        <input type="hidden" name="next" value={next} />

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-400">Email</span>
          <input
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-neutral-100 outline-none focus:border-neutral-400"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-400">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-neutral-100 outline-none focus:border-neutral-400"
          />
        </label>

        {error === "invalid" && (
          <div className="rounded-md border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-300">
            Invalid email or password.
          </div>
        )}

        <button
          type="submit"
          className="mt-2 rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
