import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk, ModelMessage } from "ai";
import {
  findFlightsStep,
  findRestaurantsStep,
  checkWeatherStep,
  findAttractionsStep,
} from "./tools";

type LocaleHint = {
  country: string;
  currency: string;
  units: "metric" | "imperial";
};

const BASE_PROMPT = `You are Wanderloop, a senior travel concierge running as a durable workflow.

When the user describes a trip, your job is to assemble a day-by-day itinerary by calling tools — not by inventing data. Always follow this loop:

1. Parse the user's intent: destination, length of stay, dates (assume next month if unspecified), preferences (food, pace, interests, budget).
2. Call check_weather first to ground the recommendations in conditions.
3. Call find_flights with sensible defaults (origin "New York" unless told otherwise).
4. Call find_restaurants with the cuisine / budget signal from the user.
5. Call find_attractions with the interests signal.
6. Synthesize a day-by-day itinerary — morning/afternoon/evening blocks per day. Reference specific places returned by the tools. Be concise: max 2 sentences per block, no marketing fluff.

Rules:
- Never invent restaurants, attractions, flights, or weather. Only use what tools returned.
- If a tool returns thin data, mention the limitation rather than fabricating.
- Final response: a structured itinerary in markdown with one '## Day N — <title>' heading per day. Inside each day, use **Morning:** / **Afternoon:** / **Evening:** prefixes.
- Keep tone direct and useful, not florid.`;

function localeAddendum(locale: LocaleHint): string {
  return `

USER LOCALE:
- Country: ${locale.country}
- Show prices in: ${locale.currency}
- Use ${locale.units} units (${locale.units === "metric" ? "km, °C" : "miles, °F"})
When you see USD prices from the find_flights tool, convert mentally to ${locale.currency} and present in the user's currency. Note distances in ${locale.units} units when describing walkability.`;
}

export async function planTripWorkflow(
  messages: ModelMessage[],
  locale: LocaleHint,
) {
  "use workflow";

  const agent = new DurableAgent({
    model: "anthropic/claude-sonnet-4-5",
    system: BASE_PROMPT + localeAddendum(locale),
    tools: {
      find_flights: {
        description:
          "Find flight options between two cities. Returns 3 representative options across price tiers. Synthetic data for demo.",
        inputSchema: z.object({
          origin: z.string(),
          destination: z.string(),
          departDate: z.string(),
          returnDate: z.string().optional(),
        }),
        execute: findFlightsStep,
      },
      find_restaurants: {
        description:
          "Find restaurant recommendations for a city given preferences. Returns 4-6 picks across price tiers.",
        inputSchema: z.object({
          city: z.string(),
          cuisine: z.string().optional(),
          priceLevel: z.enum(["budget", "mid", "high", "any"]).optional(),
        }),
        execute: findRestaurantsStep,
      },
      check_weather: {
        description:
          "Get a multi-day weather forecast for a city. Returns daily highs, lows, and conditions.",
        inputSchema: z.object({
          city: z.string(),
          startDate: z.string(),
          days: z.number().int().min(1).max(14).optional(),
        }),
        execute: checkWeatherStep,
      },
      find_attractions: {
        description:
          "Find attractions, neighborhoods, viewpoints, and experiences in a city. Returns 5-8 curated picks.",
        inputSchema: z.object({
          city: z.string(),
          interests: z.string().optional(),
          pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
        }),
        execute: findAttractionsStep,
      },
    },
  });

  const result = await agent.stream({
    messages,
    writable: getWritable<UIMessageChunk>(),
    maxSteps: 8,
  });

  return result.messages;
}
