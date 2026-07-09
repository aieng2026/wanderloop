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

export async function planTripWorkflow(
  messages: ModelMessage[],
  locale: LocaleHint,
  today: string,
) {
  "use workflow";

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
        execute: findFlightsStep,
      }),
      find_restaurants: tool({
        description:
          "Find restaurant recommendations for a city given preferences. Returns 4-6 picks across price tiers.",
        inputSchema: z.object({
          city: z.string(),
          cuisine: z.string().optional(),
          priceLevel: z.enum(["budget", "mid", "high", "any"]).optional(),
        }),
        execute: findRestaurantsStep,
      }),
      check_weather: tool({
        description:
          "Get a multi-day weather forecast for a city. Returns daily highs, lows, and conditions.",
        inputSchema: z.object({
          city: z.string(),
          startDate: z.string(),
          days: z.number().int().min(1).max(14).optional(),
        }),
        execute: checkWeatherStep,
      }),
      find_attractions: tool({
        description:
          "Find attractions, neighborhoods, viewpoints, and experiences in a city.",
        inputSchema: z.object({
          city: z.string(),
          interests: z.string().optional(),
          pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
        }),
        execute: findAttractionsStep,
      }),
    },
  });

  await agent.stream({
    messages,
    writable: getWritable<UIMessageChunk>(),
    stopWhen: stepCountIs(8),
    // Per-step OTel spans (latency, tokens) — see instrumentation.ts.
    experimental_telemetry: { isEnabled: true, functionId: "chat-durable" },
    onFinish: ({ totalUsage }) => logRunCost("durable", PRIMARY_MODEL, totalUsage),
  });
}
