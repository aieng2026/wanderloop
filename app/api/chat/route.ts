import { gateway } from "@ai-sdk/gateway";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { findFlights } from "@/lib/tools/find-flights";
import { findRestaurants } from "@/lib/tools/find-restaurants";
import { checkWeather } from "@/lib/tools/check-weather";
import { findAttractions } from "@/lib/tools/find-attractions";
import { buildSystemPrompt, type LocaleHint } from "@/lib/system-prompt";
import { PRIMARY_MODEL, gatewayResilience } from "@/lib/models";
import { logRunCost } from "@/lib/cost";

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
    model: gateway(PRIMARY_MODEL),
    system: buildSystemPrompt({ today, locale }),
    messages: await convertToModelMessages(messages),
    tools: {
      find_flights: findFlights,
      find_restaurants: findRestaurants,
      check_weather: checkWeather,
      find_attractions: findAttractions,
    },
    // Gateway degradation chain: fall back across providers on primary failure.
    providerOptions: gatewayResilience,
    // Emit OTel spans per model + tool call (latency, tokens) — see instrumentation.ts.
    experimental_telemetry: { isEnabled: true, functionId: "chat-fast" },
    stopWhen: stepCountIs(8),
    onFinish: ({ usage }) => logRunCost("fast", PRIMARY_MODEL, usage),
  });

  return result.toUIMessageStreamResponse();
}
