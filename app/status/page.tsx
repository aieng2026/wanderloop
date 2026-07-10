import Link from "next/link";
import { readRuns, summarize } from "@/lib/telemetry";

// Internal AI/cost ops dashboard. Auth-gated (like /admin) — not a public page.
// Reads the rolling run window and shows the metrics Vercel Observability
// doesn't have: LLM cost per trip, tokens, model mix, and chaos faults
// recovered. Always fresh so it reflects the latest runs.
export const dynamic = "force-dynamic";
export const metadata = { title: "Wanderloop — AI Cost & Reliability" };

function usd(n: number): string {
  return `$${n.toFixed(n < 0.01 ? 5 : 4)}`;
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3">
      <div className="text-xs tracking-wide text-neutral-500 uppercase">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-neutral-100">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

export default async function StatusPage() {
  const runs = await readRuns();
  const s = summarize(runs);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Wanderloop
        </Link>
        <span className="text-xs text-neutral-600">last {runs.length} runs</span>
      </header>

      <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">
        AI Cost &amp; Reliability
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-400">
        The signal Vercel Observability doesn&apos;t have — LLM cost per trip,
        token mix, model routing, and chaos faults recovered. Observability
        covers HTTP latency and errors; this covers the AI economics on top.
        Backed by a rolling window in Blob (at scale → Upstash/Neon).
      </p>

      {s.runs === 0 ? (
        <div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-950 px-5 py-6 text-sm text-neutral-400">
          No runs recorded yet. Plan a trip on{" "}
          <Link href="/plan" className="text-purple-300 hover:text-purple-200">
            /plan
          </Link>{" "}
          or{" "}
          <Link
            href="/durable-plan"
            className="text-purple-300 hover:text-purple-200"
          >
            /durable-plan
          </Link>{" "}
          and this populates.
        </div>
      ) : (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Runs" value={String(s.runs)} sub="rolling window" />
            <Stat label="Total cost" value={usd(s.totalCostUSD)} />
            <Stat
              label="Avg / trip"
              value={usd(s.avgCostUSD)}
              sub="tokens × price"
            />
            <Stat
              label="Faults recovered"
              value={String(s.totalFaultsRecovered)}
              sub="chaos, auto-retried"
            />
          </section>

          <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="mb-2 text-xs tracking-wide text-neutral-500 uppercase">
                Cost by model
              </div>
              {s.byModel.map((m) => (
                <div
                  key={m.model}
                  className="flex items-center justify-between border-b border-neutral-800/60 py-1.5 text-sm last:border-0"
                >
                  <span className="font-mono text-xs text-neutral-300">
                    {m.model}
                  </span>
                  <span className="text-neutral-400">
                    {usd(m.costUSD)}{" "}
                    <span className="text-neutral-600">· {m.runs} runs</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="mb-2 text-xs tracking-wide text-neutral-500 uppercase">
                Tokens
              </div>
              <div className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-neutral-400">Input</span>
                <span className="text-neutral-200">
                  {s.totalInputTokens.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-neutral-400">Output</span>
                <span className="text-neutral-200">
                  {s.totalOutputTokens.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-neutral-800/60 py-1.5 text-sm">
                <span className="text-neutral-500">Path split</span>
                <span className="text-neutral-400">
                  {s.byPath.map((p) => `${p.path}: ${p.runs}`).join(" · ")}
                </span>
              </div>
            </div>
          </section>

          <section className="mt-4 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="mb-2 text-xs tracking-wide text-neutral-500 uppercase">
              Recent runs
            </div>
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-xs tracking-wide text-neutral-500 uppercase">
                  <th className="py-1.5 pr-3 font-medium">When</th>
                  <th className="py-1.5 pr-3 font-medium">Path</th>
                  <th className="py-1.5 pr-3 font-medium">Model</th>
                  <th className="py-1.5 pr-3 font-medium">Tokens (in/out)</th>
                  <th className="py-1.5 pr-3 font-medium">Faults</th>
                  <th className="py-1.5 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 15).map((r, i) => (
                  <tr key={i} className="border-b border-neutral-800/50">
                    <td className="py-1.5 pr-3 text-neutral-500">
                      {new Date(r.ts).toLocaleTimeString()}
                    </td>
                    <td className="py-1.5 pr-3 text-neutral-400">{r.path}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs text-neutral-400">
                      {r.model}
                    </td>
                    <td className="py-1.5 pr-3 text-neutral-400">
                      {r.inputTokens.toLocaleString()} /{" "}
                      {r.outputTokens.toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-3 text-neutral-400">
                      {r.faults > 0 ? (
                        <span className="text-amber-400">{r.faults}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1.5 text-neutral-300">{usd(r.costUSD)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
