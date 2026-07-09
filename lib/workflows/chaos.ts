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

/**
 * Throw a synthetic transient fault with the configured probability.
 * Call at the top of a "use step" function; the Workflow runtime retries the
 * step on throw, so the run recovers automatically.
 */
export function maybeInjectChaos(stepName: string): void {
  const p = chaosFaultProbability();
  if (p > 0 && Math.random() < p) {
    console.warn(
      `[chaos] injected transient failure in "${stepName}" (p=${p}) — Workflow will retry the step`,
    );
    throw new Error(`[chaos] synthetic transient failure in ${stepName}`);
  }
}
