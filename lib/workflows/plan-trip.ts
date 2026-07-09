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
import type { ChaosContext } from "./chaos";

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
    onFinish: ({ totalUsage }) => logRunCost("durable", PRIMARY_MODEL, totalUsage),
  });
}
