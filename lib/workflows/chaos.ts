// Chaos fault injection for the durable path — an in-app analogue of an AWS
// FIS (Fault Injection Simulator) experiment.
//
// When WANDERLOOP_CHAOS is enabled, each durable tool step throws a synthetic
// transient error with the configured probability. The Workflow runtime's
// automatic step retry then recovers the run with no user-visible failure —
// the point of the demo: durability handles injected faults, and I did not
// write the retry loop, the platform did.
//
// Default-OFF. Prod is unaffected unless the env var is explicitly set, so
// this ships safely and is armed only for a demo (WANDERLOOP_CHAOS=1 locally
// or on a preview deployment).

/**
 * Resolve the per-step fault probability from WANDERLOOP_CHAOS.
 * - unset / "0" / "false"  → 0 (disabled)
 * - "1" / "true" / "on"    → 0.5 (default injection rate)
 * - "0.3" (any 0<p<1)      → that probability
 */
export function chaosFaultProbability(): number {
  const raw = process.env.WANDERLOOP_CHAOS?.trim().toLowerCase();
  if (!raw || raw === "0" || raw === "false") return 0;
  if (raw === "1" || raw === "true" || raw === "on") return 0.5;
  const p = Number(raw);
  return Number.isFinite(p) && p > 0 && p < 1 ? p : 0;
}

// Per-run chaos context, threaded from the request (UI toggle) into each step.
export type ChaosContext = { chaos?: boolean };

// Retry metadata attached to a tool output so the UI can show the recovery.
export type ChaosResult = { attempts: number; faults: number };

const BACKOFF_MS = 450;

/**
 * Whether chaos is armed for this step. A runtime flag (the website toggle,
 * passed via ChaosContext) wins when present; otherwise fall back to the
 * WANDERLOOP_CHAOS env var. So the demo can flip it live without a redeploy.
 */
export function chaosEnabled(ctx?: ChaosContext): boolean {
  if (ctx && typeof ctx.chaos === "boolean") return ctx.chaos;
  return chaosFaultProbability() > 0;
}

/**
 * How many transient faults this tool call will take before it succeeds.
 * When armed, always ≥1 (so the demo reliably shows a retry) and always
 * recovers. Returns 0 when chaos is off.
 */
export function plannedChaosFaults(ctx?: ChaosContext): number {
  if (!chaosEnabled(ctx)) return 0;
  return 1 + Math.floor(Math.random() * 2); // 1–2 faults, then success
}

/**
 * Simulate transient failures with visible backoff, then report the attempt
 * count. Runs inside a "use step" so its result is journaled — the recovery is
 * a real retry-with-backoff at the tool boundary, and the count is stable
 * across workflow replays. Vercel Workflow's durable step retry is the same
 * mechanism underneath for genuine infra faults (visible in the OTel traces).
 */
export async function runChaosDelay(
  toolName: string,
  ctx?: ChaosContext,
): Promise<ChaosResult> {
  const faults = plannedChaosFaults(ctx);
  for (let i = 1; i <= faults; i++) {
    console.warn(
      `[chaos] "${toolName}": transient failure ${i}/${faults} — retrying with backoff`,
    );
    await new Promise((r) => setTimeout(r, BACKOFF_MS));
  }
  return { attempts: faults + 1, faults };
}
