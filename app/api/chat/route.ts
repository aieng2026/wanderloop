import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { findFlights } from "@/lib/tools/find-flights";
import { findRestaurants } from "@/lib/tools/find-restaurants";
import { checkWeather } from "@/lib/tools/check-weather";
import { findAttractions } from "@/lib/tools/find-attractions";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are Wanderloop, a senior travel concierge.

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
- Final response: a structured itinerary in markdown with one heading per day.
- Keep tone direct and useful, not florid.`;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-5"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      find_flights: findFlights,
      find_restaurants: findRestaurants,
      check_weather: checkWeather,
      find_attractions: findAttractions,
    },
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}
