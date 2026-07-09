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
 * Throw a synthetic transient fault with the configured probability.
 * Call at the top of a "use step" function; the Workflow runtime retries the
 * step on throw, so the run recovers automatically.
 */
export function maybeInjectChaos(stepName: string, ctx?: ChaosContext): void {
  if (!chaosEnabled(ctx)) return;
  // When armed via the UI toggle (env unset), use a sensible default rate.
  const p = chaosFaultProbability() || 0.5;
  if (Math.random() < p) {
    console.warn(
      `[chaos] injected transient failure in "${stepName}" (p=${p}) — Workflow will retry the step`,
    );
    throw new Error(`[chaos] synthetic transient failure in ${stepName}`);
  }
}
