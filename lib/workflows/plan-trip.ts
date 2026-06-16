import { getWritable } from "workflow";
import { streamText, tool, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import type { UIMessageChunk, ModelMessage } from "ai";
import {
  findFlightsStep,
  findRestaurantsStep,
  checkWeatherStep,
  findAttractionsStep,
} from "./tools";
import { buildSystemPrompt, type LocaleHint } from "@/lib/system-prompt";

async function runChatStep(
  messages: ModelMessage[],
  system: string,
  writable: WritableStream<UIMessageChunk>,
) {
  "use step";

  const result = streamText({
    model: gateway("anthropic/claude-haiku-4-5"),
    system,
    messages,
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
    stopWhen: stepCountIs(8),
  });

  const writer = writable.getWriter();
  try {
    for await (const chunk of result.toUIMessageStream()) {
      await writer.write(chunk);
    }
  } finally {
    writer.releaseLock();
    try {
      await writable.close();
    } catch {
      // already closed
    }
  }
}

export async function planTripWorkflow(
  messages: ModelMessage[],
  locale: LocaleHint,
  today: string,
) {
  "use workflow";

  await runChatStep(
    messages,
    buildSystemPrompt({ today, locale, runtime: "durable" }),
    getWritable<UIMessageChunk>(),
  );
}
