// Per-run cost telemetry (FinOps). Turns raw token usage into an estimated
// USD cost per planned trip and emits it as a structured log line — the kind
// of signal a spend dashboard or a CloudWatch-style metric would consume.
//
// Rates are approximate USD per 1M tokens, meant for cost *visibility*, not
// billing accuracy. Replace with live Gateway pricing
// (gateway.getAvailableModels().pricing) if you need exact figures.

import { PRIMARY_MODEL } from "./models";

const PRICING_PER_M: Record<string, { input: number; output: number }> = {
  "anthropic/claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "zai/glm-5.2": { input: 0.6, output: 2.2 },
  "openai/gpt-5.5": { input: 1.25, output: 10.0 },
};

type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export function estimateCostUSD(model: string, usage: Usage): number {
  const rate = PRICING_PER_M[model] ?? PRICING_PER_M[PRIMARY_MODEL];
  const input = ((usage.inputTokens ?? 0) / 1_000_000) * rate.input;
  const output = ((usage.outputTokens ?? 0) / 1_000_000) * rate.output;
  return input + output;
}

/**
 * Emit a structured per-run cost log line. On Vercel this lands in runtime
 * logs and can be shipped to any log drain / metrics pipeline.
 */
export function logRunCost(
  path: "fast" | "durable",
  model: string,
  usage: Usage,
): void {
  const costUSD = estimateCostUSD(model, usage);
  console.log(
    JSON.stringify({
      evt: "run_cost",
      path,
      model,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      costUSD: Number(costUSD.toFixed(5)),
    }),
  );
}
