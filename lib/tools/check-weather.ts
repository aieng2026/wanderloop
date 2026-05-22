import { tool } from "ai";
import { z } from "zod";
import type { WeatherDay } from "@/lib/types";

export const checkWeather = tool({
  description:
    "Get a multi-day weather forecast for a city. Returns daily highs, lows, and conditions. Synthetic data for demo.",
  inputSchema: z.object({
    city: z.string().describe("City name"),
    startDate: z.string().describe("Start date in YYYY-MM-DD"),
    days: z
      .number()
      .int()
      .min(1)
      .max(14)
      .default(5)
      .describe("Number of days to forecast"),
  }),
  execute: async ({ city, startDate, days }) => {
    const profile = climateProfile(city);
    const forecast: WeatherDay[] = Array.from({ length: days }, (_, i) => {
      const d = new Date(`${startDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);
      return {
        date,
        highC: profile.highC + jitter(i, 2),
        lowC: profile.lowC + jitter(i, 2),
        condition: profile.pattern[i % profile.pattern.length],
        precipitationPct:
          profile.pattern[i % profile.pattern.length] === "rain" ? 70 : 10,
      };
    });
    return { city, forecast };
  },
});

function climateProfile(city: string): {
  highC: number;
  lowC: number;
  pattern: WeatherDay["condition"][];
} {
  const c = city.toLowerCase();
  if (c.includes("lisbon"))
    return {
      highC: 24,
      lowC: 16,
      pattern: ["sunny", "sunny", "partly cloudy", "sunny", "sunny"],
    };
  if (c.includes("tokyo"))
    return {
      highC: 22,
      lowC: 14,
      pattern: ["partly cloudy", "rain", "sunny", "sunny", "partly cloudy"],
    };
  if (c.includes("paris"))
    return {
      highC: 18,
      lowC: 11,
      pattern: ["partly cloudy", "rain", "partly cloudy", "sunny", "cloudy"],
    };
  if (c.includes("london"))
    return {
      highC: 16,
      lowC: 9,
      pattern: ["cloudy", "rain", "partly cloudy", "rain", "cloudy"],
    };
  return {
    highC: 22,
    lowC: 14,
    pattern: ["sunny", "partly cloudy", "sunny", "partly cloudy", "sunny"],
  };
}

function jitter(seed: number, amplitude: number): number {
  return ((seed * 9301 + 49297) % 233280) / 233280 < 0.5
    ? -Math.floor(amplitude / 2)
    : Math.floor(amplitude / 2);
}
