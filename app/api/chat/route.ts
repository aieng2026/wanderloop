import { gateway } from "@ai-sdk/gateway";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { findFlights } from "@/lib/tools/find-flights";
import { findRestaurants } from "@/lib/tools/find-restaurants";
import { checkWeather } from "@/lib/tools/check-weather";
import { findAttractions } from "@/lib/tools/find-attractions";
import { buildSystemPrompt, type LocaleHint } from "@/lib/system-prompt";

export const maxDuration = 60;

export async function POST(req: Request) {
  const country = req.headers.get("x-wanderloop-country") ?? "US";
  const currency = req.headers.get("x-wanderloop-currency") ?? "USD";
  const units: LocaleHint["units"] =
    req.headers.get("x-wanderloop-units") === "metric" ? "metric" : "imperial";
  const locale: LocaleHint = { country, currency, units };
  const today = new Date().toISOString().slice(0, 10);

  const { messages } = await req.json();

  const result = streamText({
    model: gateway("zai/glm-5.2"),
    system: buildSystemPrompt({ today, locale }),
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
