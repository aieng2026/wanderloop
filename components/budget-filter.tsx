"use client";

import { useState } from "react";
import type { Place } from "@/lib/extract-places";

const DEFAULT_CODE = `// Receives 'places' (mix of restaurants & attractions).
// Return the array you want to keep.
//
// Each place has: { kind, name, category, neighborhood,
//   priceLevel?, rating?, estimatedHours?, notes? }
//
// priceLevel: 1 (cheap) → 4 (expensive)

places => places.filter(p =>
  // budget-friendly only
  (p.priceLevel ?? 1) <= 2 &&
  // skip 5+ hour day trips
  (p.estimatedHours ?? 0) <= 4
)`;

type FilterState =
  | { kind: "idle" }
  | { kind: "running" }
  | {
      kind: "ok";
      durationMs: number;
      before: number;
      after: number;
      filtered: Place[];
    }
  | {
      kind: "error";
      message: string;
      errorKind?: string;
      durationMs?: number;
    };

export default function BudgetFilter({ places }: { places: Place[] }) {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [state, setState] = useState<FilterState>({ kind: "idle" });
  const [open, setOpen] = useState(false);

  const onRun = async () => {
    setState({ kind: "running" });
    try {
      const res = await fetch("/api/sandbox/budget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, places }),
      });
      const body = await res.json();
      if (body.ok) {
        setState({
          kind: "ok",
          durationMs: body.durationMs,
          before: body.before,
          after: body.after,
          filtered: body.filtered,
        });
      } else {
        setState({
          kind: "error",
          message: body.message ?? "Unknown sandbox error",
          errorKind: body.kind,
          durationMs: body.durationMs,
        });
      }
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <div className="text-sm font-medium text-neutral-100">
            🧪 Custom budget filter
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            Paste a JavaScript filter — runs in a Vercel Sandbox microVM.
            Safe, isolated, killed after 8s.
          </div>
        </div>
        <span className="text-xs text-neutral-500">
          {open ? "Hide ▴" : "Open ▾"}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-neutral-800 px-5 py-4">
          <div className="text-[10px] tracking-wider text-neutral-600 uppercase">
            {places.length} places available from this trip
          </div>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={11}
            spellCheck={false}
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs leading-relaxed text-neutral-200 outline-none focus:border-neutral-600"
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onRun}
              disabled={state.kind === "running" || places.length === 0}
              className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-purple-950 transition hover:bg-purple-400 disabled:opacity-40"
            >
              {state.kind === "running" ? "Running…" : "▷ Run in Sandbox"}
            </button>
            {state.kind === "ok" && (
              <span className="text-xs text-neutral-500">
                {state.before} → <span className="text-neutral-200">{state.after}</span>{" "}
                places · {state.durationMs}ms
              </span>
            )}
            {state.kind === "error" && state.durationMs != null && (
              <span className="text-xs text-neutral-600">
                {state.durationMs}ms
              </span>
            )}
          </div>

          {state.kind === "error" && (
            <div className="rounded-md border border-red-900 bg-red-950 px-3 py-2 text-xs">
              <div className="font-medium text-red-300">
                {state.errorKind === "compile"
                  ? "Code didn't compile"
                  : state.errorKind === "type"
                    ? "Wrong return type"
                    : state.errorKind === "runtime"
                      ? "Runtime error"
                      : "Sandbox error"}
              </div>
              <div className="mt-1 font-mono text-red-400">
                {state.message}
              </div>
            </div>
          )}

          {state.kind === "ok" && state.filtered.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] tracking-wider text-neutral-600 uppercase">
                Filtered results
              </div>
              <ul className="space-y-1">
                {state.filtered.slice(0, 30).map((p, i) => (
                  <li
                    key={i}
                    className="flex items-baseline gap-2 rounded border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs"
                  >
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase ${
                        p.kind === "restaurant"
                          ? "bg-amber-950 text-amber-400"
                          : "bg-sky-950 text-sky-400"
                      }`}
                    >
                      {p.kind === "restaurant" ? "Eat" : "Do"}
                    </span>
                    <span className="text-neutral-200">{p.name}</span>
                    <span className="text-neutral-600">·</span>
                    <span className="text-neutral-500">
                      {p.category} · {p.neighborhood}
                    </span>
                    {p.priceLevel != null && (
                      <span className="ml-auto text-neutral-600">
                        {"$".repeat(p.priceLevel)}
                      </span>
                    )}
                  </li>
                ))}
                {state.filtered.length > 30 && (
                  <li className="px-3 py-1 text-[11px] text-neutral-600">
                    + {state.filtered.length - 30} more…
                  </li>
                )}
              </ul>
            </div>
          )}

          {state.kind === "ok" && state.filtered.length === 0 && (
            <div className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-500">
              No places matched your filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
