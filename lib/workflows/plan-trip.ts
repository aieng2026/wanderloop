import { getWritable } from "workflow";
import { tool, stepCountIs } from "ai";
import { z } from "zod";
import type { UIMessageChunk, ModelMessage } from "ai";
import { DurableAgent } from "@workflow/ai/agent";
import {
  findFlightsStep,
  findRestaurantsStep,
  checkWeatherStep,
  findAttractionsStep,
} from "./tools";
import { buildSystemPrompt, type LocaleHint } from "@/lib/system-prompt";
import { PRIMARY_MODEL, gatewayResilience } from "@/lib/models";
import { logRunCost } from "@/lib/cost";
import { recordRun } from "@/lib/telemetry";
import type { ChaosContext } from "./chaos";

// Sum the chaos "faults recovered" across a durable run.
//
// DurableAgent leaves each StepResult.toolResults empty ([]) — it executes
// tools itself outside the model step — so the tool outputs (which carry
// `_chaos`) only survive into onFinish inside the final `messages`
// conversation, not in `steps[].toolResults`. Reading step.toolResults always
// summed 0, which is why /status showed 0 faults even with chaos armed.
//
// The output wrapping varies by SDK code path (output vs output.value, object
// vs JSON string), so scan defensively: walk the structure and, for any
// `_chaos.faults` we encounter, add it. Each tool result appears once in the
// conversation, so there's no double-counting. Strings that look like a
// serialized tool result are parsed and walked too.
function sumRecoveredFaults(root: unknown): number {
  let total = 0;
  const seen = new Set<unknown>();
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (v.includes("_chaos")) {
        try {
          walk(JSON.parse(v));
        } catch {
          /* not JSON — ignore */
        }
      }
      return;
    }
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    const obj = v as Record<string, unknown>;
    const chaos = obj._chaos as { faults?: number } | undefined;
    if (chaos && typeof chaos.faults === "number") total += chaos.faults;
    for (const key of Object.keys(obj)) walk(obj[key]);
  };
  walk(root);
  return total;
}

// Telemetry write must be a step: @vercel/blob uses Node built-ins that don't
// exist in the workflow sandbox (they throw "require is not defined"). As a
// "use step" it runs in the full Node runtime instead.
async function recordDurableRun(input: {
  model: string;
  usage: { inputTokens?: number; outputTokens?: number };
  faults: number;
}) {
  "use step";
  await recordRun({
    path: "durable",
    model: input.model,
    usage: input.usage,
    faults: input.faults,
  });
}

export async function planTripWorkflow(
  messages: ModelMessage[],
  locale: LocaleHint,
  today: string,
  chaos = false,
) {
  "use workflow";

  // Chaos is threaded to each tool step via experimental_context so the
  // website toggle controls fault injection per run, live, with no redeploy.
  const chaosCtx: ChaosContext = { chaos };

  // Non-reasoning model on purpose: the durable UI renders only text and
  // tool parts, so a reasoning model's thinking phase looks like a stall.
  const agent = new DurableAgent({
    model: PRIMARY_MODEL,
    providerOptions: gatewayResilience,
    instructions: buildSystemPrompt({ today, locale, runtime: "durable" }),
    tools: {
      find_flights: tool({
        description:
          "Find flight options between two cities. Returns 3 representative options across price tiers.",
        inputSchema: z.object({
          origin: z.string(),
          destination: z.string(),
          departDate: z.string(),
          returnDate: z.string().optional(),
        }),
        execute: (input, opts) =>
          findFlightsStep(input, opts?.experimental_context as ChaosContext),
      }),
      find_restaurants: tool({
        description:
          "Find restaurant recommendations for a city given preferences. Returns 4-6 picks across price tiers.",
        inputSchema: z.object({
          city: z.string(),
          cuisine: z.string().optional(),
          priceLevel: z.enum(["budget", "mid", "high", "any"]).optional(),
        }),
        execute: (input, opts) =>
          findRestaurantsStep(input, opts?.experimental_context as ChaosContext),
      }),
      check_weather: tool({
        description:
          "Get a multi-day weather forecast for a city. Returns daily highs, lows, and conditions.",
        inputSchema: z.object({
          city: z.string(),
          startDate: z.string(),
          days: z.number().int().min(1).max(14).optional(),
        }),
        execute: (input, opts) =>
          checkWeatherStep(input, opts?.experimental_context as ChaosContext),
      }),
      find_attractions: tool({
        description:
          "Find attractions, neighborhoods, viewpoints, and experiences in a city.",
        inputSchema: z.object({
          city: z.string(),
          interests: z.string().optional(),
          pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
        }),
        execute: (input, opts) =>
          findAttractionsStep(input, opts?.experimental_context as ChaosContext),
      }),
    },
  });

  await agent.stream({
    messages,
    writable: getWritable<UIMessageChunk>(),
    stopWhen: stepCountIs(8),
    experimental_context: chaosCtx,
    // Per-step OTel spans (latency, tokens) — see instrumentation.ts.
    experimental_telemetry: { isEnabled: true, functionId: "chat-durable" },
    onFinish: async (event) => {
      const { totalUsage } = event;
      logRunCost("durable", PRIMARY_MODEL, totalUsage);
      // Sum chaos faults recovered for the /status dashboard. DurableAgent
      // exposes the tool outputs (with `_chaos`) in the onFinish `messages`
      // conversation, not in steps[].toolResults (which are always empty here).
      const messages = (event as { messages?: unknown }).messages;
      const faults = sumRecoveredFaults(messages ?? (event as { steps?: unknown }).steps);
      await recordDurableRun({ model: PRIMARY_MODEL, usage: totalUsage, faults });
    },
  });
}
