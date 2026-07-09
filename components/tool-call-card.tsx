"use client";

type ToolPart = {
  type: string;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

type ChaosMeta = { attempts: number; faults: number };

function readChaos(output: unknown): ChaosMeta | null {
  if (output && typeof output === "object" && "_chaos" in output) {
    const c = (output as { _chaos?: ChaosMeta })._chaos;
    if (c && c.faults > 0) return c;
  }
  return null;
}

const PIP_STAGGER_MS = 800; // slow enough to watch each retry appear

// Retry timeline. The server ran the four tools' retries in parallel and
// reported the final attempt count; the pips reveal one at a time — ✗ per
// injected fault, then ✓ for recovery — via CSS (staggered by inline delay,
// fill-mode forwards so they stay visible). CSS, not React state, so streaming
// re-renders can't stall or reset it.
function ChaosTimeline({ chaos }: { chaos: ChaosMeta }) {
  // [fault, fault, …, recovery]
  const pips = [
    ...Array.from({ length: chaos.faults }, () => false),
    true,
  ];
  return (
    <div className="mt-1.5 ml-4 flex flex-wrap items-center gap-1">
      {pips.map((success, i) => (
        <span
          key={i}
          className={`chaos-pip inline-flex h-4 w-4 items-center justify-center rounded-sm border text-[9px] font-bold ${
            success
              ? "border-emerald-700/70 bg-emerald-950/60 text-emerald-400"
              : "border-amber-700/70 bg-amber-950/60 text-amber-400"
          }`}
          style={{ animationDelay: `${i * PIP_STAGGER_MS}ms` }}
          title={success ? "Step recovered" : "Injected transient fault — retried with backoff"}
        >
          {success ? "✓" : "✗"}
        </span>
      ))}
      <span
        className="chaos-pip ml-1 text-[10px] text-emerald-400/90"
        style={{ animationDelay: `${pips.length * PIP_STAGGER_MS}ms` }}
      >
        recovered · {chaos.attempts} attempts
      </span>
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  "tool-find_flights": "Searching flights",
  "tool-find_restaurants": "Finding restaurants",
  "tool-check_weather": "Checking weather",
  "tool-find_attractions": "Finding attractions",
};

export default function ToolCallCard({ part }: { part: ToolPart }) {
  const label = TOOL_LABELS[part.type] ?? part.type.replace("tool-", "");
  const running =
    part.state === "input-streaming" ||
    part.state === "input-available" ||
    part.state === "executing";
  const failed = part.state === "output-error";
  const done = part.state === "output-available";
  const chaos = done ? readChaos(part.output) : null;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            running
              ? "animate-pulse bg-amber-400"
              : failed
                ? "bg-red-400"
                : "bg-emerald-400"
          }`}
        />
        <span className="font-medium text-neutral-300">{label}</span>
        <span className="text-neutral-600">
          {running ? "…" : failed ? "failed" : done ? "✓" : ""}
        </span>
        {chaos && (
          <span className="ml-auto rounded bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
            chaos
          </span>
        )}
      </div>

      {chaos && <ChaosTimeline chaos={chaos} />}

      {part.input != null && (
        <details className="mt-1 ml-4 text-neutral-500">
          <summary className="cursor-pointer hover:text-neutral-300">
            input
          </summary>
          <pre className="mt-1 overflow-x-auto rounded bg-neutral-900 p-2 text-[10px] text-neutral-400">
            {JSON.stringify(part.input, null, 2)}
          </pre>
        </details>
      )}

      {done && part.output != null && (
        <details className="mt-1 ml-4 text-neutral-500">
          <summary className="cursor-pointer hover:text-neutral-300">
            output
          </summary>
          <pre className="mt-1 max-h-60 overflow-auto rounded bg-neutral-900 p-2 text-[10px] text-neutral-400">
            {JSON.stringify(part.output, null, 2)}
          </pre>
        </details>
      )}

      {failed && part.errorText && (
        <div className="mt-1 ml-4 text-red-400">{part.errorText}</div>
      )}
    </div>
  );
}
