/**
 * Hallucination regression eval.
 *
 * Tests the stated system-prompt invariant from `lib/system-prompt.ts`:
 *   "Never invent restaurants, attractions, flights, or weather.
 *    Only use what tools returned."
 *
 * For each test prompt: run the same streamText pipeline as production,
 * extract every place-shaped token from the final assistant text, then
 * assert each token appears somewhere in the tool-call outputs.
 *
 * Hard-fail: any place in the response that isn't in the tool corpus.
 * Soft-warn: missing ## Day N structure, past-dated trips, no check_weather call.
 */

import { gateway } from "@ai-sdk/gateway";
import { stepCountIs, streamText } from "ai";
import { readFileSync } from "node:fs";
import { findFlights } from "../lib/tools/find-flights";
import { findRestaurants } from "../lib/tools/find-restaurants";
import { checkWeather } from "../lib/tools/check-weather";
import { findAttractions } from "../lib/tools/find-attractions";
import { buildSystemPrompt, type LocaleHint } from "../lib/system-prompt";

type TestPrompt = { id: string; text: string };

const DEFAULT_LOCALE: LocaleHint = { country: "US", currency: "USD", units: "imperial" };

const STOPWORDS = new Set<string>([
  // structural / template
  "Day", "Days", "Morning", "Afternoon", "Evening", "Night",
  "Wanderloop", "Itinerary", "Trip", "Travel",
  // currency / units
  "USD", "EUR", "GBP", "JPY",
  // common sentence starts
  "I", "If", "For", "When", "After", "Before", "On", "In", "At", "Of",
  "The", "A", "An", "And", "Or", "But", "With", "Without",
  "Your", "You", "Our", "We", "My", "It", "This", "That", "These", "Those",
  "Here", "There", "Note", "Tip", "Warning", "Reference",
  // common itinerary words
  "Visit", "See", "Try", "Enjoy", "Explore", "Take", "Walk", "Eat",
  "Date", "Dates", "Weekend", "Weekdays", "Year", "Years", "Month", "Months",
  "Breakfast", "Lunch", "Dinner", "Snack", "Brunch",
  "Sunny", "Cloudy", "Rainy", "Hot", "Cold", "Warm", "Cool",
  // meta
  "Note:", "Tip:", "Caveat:",
]);

const COLOR = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function extractPlaces(text: string): string[] {
  // 1–4 capitalized words, allowing internal hyphens (e.g. "Saint-Germain").
  // Filter to noun-shaped tokens by stripping leading stopwords.
  const matches = text.match(/\b[A-Z][a-z]+(?:[- ][A-Z][a-z]+){0,3}\b/g) ?? [];
  const seen = new Set<string>();
  const places: string[] = [];
  for (const raw of matches) {
    const first = raw.split(/[- ]/)[0];
    if (STOPWORDS.has(first)) continue;
    if (STOPWORDS.has(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    places.push(raw);
  }
  return places;
}

type StepLike = {
  toolCalls?: ReadonlyArray<{ toolName: string }>;
  toolResults?: ReadonlyArray<{ output: unknown }>;
};

function buildToolCorpus(steps: ReadonlyArray<StepLike>): string {
  return steps
    .flatMap((s) => s.toolResults ?? [])
    .map((r) => JSON.stringify(r.output))
    .join(" ")
    .toLowerCase();
}

type PromptResult = {
  id: string;
  hallucinations: string[];
  hasStructure: boolean;
  dayHeaders: number;
  pastDates: string[];
  calledCheckWeather: boolean;
  toolCallCount: number;
};

async function runPrompt(prompt: TestPrompt): Promise<PromptResult> {
  const today = new Date().toISOString().slice(0, 10);

  const result = streamText({
    model: gateway("anthropic/claude-haiku-4-5"),
    system: buildSystemPrompt({ today, locale: DEFAULT_LOCALE }),
    messages: [{ role: "user", content: prompt.text }],
    tools: {
      find_flights: findFlights,
      find_restaurants: findRestaurants,
      check_weather: checkWeather,
      find_attractions: findAttractions,
    },
    stopWhen: stepCountIs(8),
  });

  const finalText = await result.text;
  const steps = (await result.steps) as ReadonlyArray<StepLike>;

  const corpus = buildToolCorpus(steps);
  const places = extractPlaces(finalText);
  const hallucinations = places.filter((p) => !corpus.includes(p.toLowerCase()));

  const dayHeaders = (finalText.match(/^## Day \d+/gm) ?? []).length;
  const dateMatches = finalText.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  const pastDates = dateMatches.filter((d) => d < today);

  const toolNames = steps.flatMap((s) => (s.toolCalls ?? []).map((c) => c.toolName));
  const calledCheckWeather = toolNames.includes("check_weather");

  return {
    id: prompt.id,
    hallucinations,
    hasStructure: dayHeaders > 0,
    dayHeaders,
    pastDates,
    calledCheckWeather,
    toolCallCount: toolNames.length,
  };
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    console.error(
      `${COLOR.red}error:${COLOR.reset} AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN must be set in env.`,
    );
    console.error(`  Run: vercel env pull .env.local && pnpm eval`);
    process.exit(2);
  }

  const prompts: TestPrompt[] = JSON.parse(
    readFileSync("evals/test-prompts.json", "utf-8"),
  );

  console.log(
    `\n${COLOR.bold}Hallucination regression eval${COLOR.reset} — ${prompts.length} prompts`,
  );
  console.log(
    `${COLOR.dim}Model: anthropic/claude-haiku-4-5 via @ai-sdk/gateway${COLOR.reset}\n`,
  );

  // Free-tier Gateway rate-limits burst. Configurable inter-prompt delay (ms).
  const delayMs = Number(process.env.EVAL_DELAY_MS ?? 4000);

  let hardFails = 0;
  let softWarns = 0;

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    if (i > 0 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    process.stdout.write(`${COLOR.dim}[ ${prompt.id} ]${COLOR.reset} ... `);
    let r: PromptResult;
    try {
      r = await runPrompt(prompt);
    } catch (err) {
      console.log(`${COLOR.red}ERROR${COLOR.reset}`);
      console.error(`     ${err instanceof Error ? err.message : String(err)}`);
      hardFails++;
      continue;
    }

    if (r.hallucinations.length > 0) {
      const preview = r.hallucinations.slice(0, 3).join(", ");
      const more = r.hallucinations.length > 3 ? `, +${r.hallucinations.length - 3} more` : "";
      console.log(
        `${COLOR.red}FAIL${COLOR.reset} ${r.hallucinations.length} hallucination(s): ${preview}${more}`,
      );
      hardFails++;
    } else {
      console.log(`${COLOR.green}PASS${COLOR.reset} ${COLOR.dim}(${r.toolCallCount} tool calls)${COLOR.reset}`);
    }

    const warns: string[] = [];
    if (!r.hasStructure) warns.push("no ## Day N headers");
    if (r.pastDates.length > 0) {
      warns.push(`${r.pastDates.length} past date(s): ${r.pastDates.join(", ")}`);
    }
    if (!r.calledCheckWeather) warns.push("check_weather not called");
    if (warns.length > 0) {
      console.log(`     ${COLOR.yellow}warn:${COLOR.reset} ${warns.join("; ")}`);
      softWarns += warns.length;
    }
  }

  const passCount = prompts.length - hardFails;
  const passSummary = hardFails === 0 ? `${COLOR.green}PASS${COLOR.reset}` : `${COLOR.red}FAIL${COLOR.reset}`;

  console.log(`\n${COLOR.bold}Summary${COLOR.reset}`);
  console.log(`  Hallucination check: ${passSummary} (${passCount}/${prompts.length})`);
  console.log(`  Soft warnings: ${softWarns}\n`);

  process.exit(hardFails > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${COLOR.red}error:${COLOR.reset}`, err);
  process.exit(2);
});
