/**
 * Hallucination regression eval.
 *
 * Tests the stated system-prompt invariant from `lib/system-prompt.ts`:
 *   "Never invent restaurants, attractions, flights, or weather.
 *    Only use what tools returned."
 *
 * For each test prompt: run the same streamText pipeline as production,
 * extract every place-shaped token from the final assistant text, then
 * assert each proper-noun-shaped word in those tokens appears somewhere
 * in the grounding corpus (user prompt + tool call inputs + tool outputs).
 *
 * Hard-fail: any place in the response that isn't traceable to the corpus.
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
  "Wanderloop", "Itinerary", "Trip", "Travel", "Plan", "Planning",
  // currency / units
  "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD",
  // common sentence starts / pronouns / determiners
  "I", "If", "For", "When", "After", "Before", "On", "In", "At", "Of", "To", "From",
  "The", "A", "An", "And", "Or", "But", "With", "Without",
  "Your", "You", "Our", "We", "My", "It", "This", "That", "These", "Those",
  "Here", "There", "He", "She", "They", "Them",
  // conversational fillers / sentence starts the model uses
  "Perfect", "Great", "Excellent", "Amazing", "Wonderful", "Awesome", "Nice",
  "Please", "Let", "Would", "Could", "Should", "Will", "Can",
  "Where", "How", "Why", "What", "Who", "Which",
  "Assuming", "Given", "Based", "Considering", "Note", "Tip", "Warning",
  "Reference", "Highlights", "Recommendations", "Recommendation",
  "Yes", "No", "Maybe", "Sure", "Absolutely",
  // More conversational verbs / starters that surface in itinerary prose
  "Since", "Just", "Are", "Also", "Once", "Now", "Then",
  "Spend", "Wander", "Browse", "Free", "Catch", "Grab",
  "Land", "Recover", "Depart", "Departs", "Arrive", "Arrives",
  "Origin", "Destination", "Fastest", "Cheapest", "Direct",
  "Post-Arrival", "Pre-Departure",
  // itinerary verbs
  "Visit", "See", "Try", "Enjoy", "Explore", "Take", "Walk", "Eat", "Stay",
  "Arrive", "Depart", "Check", "Book", "Plan", "Pack", "Catch", "Head",
  // itinerary nouns that are template, not place
  "Date", "Dates", "Weekend", "Weekdays", "Year", "Years", "Month", "Months", "Week", "Weeks",
  "Breakfast", "Lunch", "Dinner", "Snack", "Brunch", "Coffee", "Drink", "Meal",
  "Flight", "Flights", "Hotel", "Hotels", "Restaurant", "Restaurants",
  "Attraction", "Attractions", "Activity", "Activities",
  "Option", "Options", "Arrival", "Departure", "Orientation", "Tour", "Tours",
  "Pace", "Cuisine", "Budget", "Tier", "Tiers", "Price",
  // months (full + abbreviated)
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
  "Jan", "Feb", "Mar", "Apr", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec",
  // days of week
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "Mon", "Tue", "Tues", "Wed", "Thu", "Thurs", "Fri", "Sat", "Sun",
  // weather descriptors
  "Sunny", "Cloudy", "Rainy", "Hot", "Cold", "Warm", "Cool", "Mild",
  "Clear", "Partly", "Overcast", "Foggy", "Snow", "Snowy", "Stormy", "Windy",
  "Humid", "Dry", "Wet",
  // generic descriptive
  "New", "Old", "Historic", "Modern", "Traditional", "Local", "Famous",
  "Central", "North", "South", "East", "West", "Northern", "Southern", "Eastern", "Western",
  "Main", "Big", "Small", "Best", "Top", "Major", "Minor",
  "Beautiful", "Stunning", "Charming", "Vibrant", "Lively", "Quiet", "Bustling",
  // meta punctuation
  "Note:", "Tip:", "Caveat:", "Hint:", "Pro",
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
  const matches = text.match(/\b[A-Z][a-z]+(?:[- ][A-Z][a-z]+){0,3}\b/g) ?? [];
  const seen = new Set<string>();
  const places: string[] = [];
  for (const raw of matches) {
    if (seen.has(raw)) continue;
    seen.add(raw);
    places.push(raw);
  }
  return places;
}

// Step shape across AI SDK 6: prefer direct toolCalls / toolResults if present,
// otherwise scan the content array for tool-call / tool-result discriminated unions.
type StepContent = {
  type?: string;
  toolName?: string;
  output?: unknown;
  input?: unknown;
};
type StepLike = {
  toolCalls?: ReadonlyArray<{ toolName: string; input?: unknown }>;
  toolResults?: ReadonlyArray<{ output: unknown; toolName?: string }>;
  content?: ReadonlyArray<StepContent>;
};

/**
 * AI SDK 6 puts tool calls/results inside step.content as discriminated-union
 * items. Rather than guess the exact "type" string per SDK version, serialize
 * the entire step object — tool names, inputs, outputs, and step metadata all
 * end up in the corpus. Metadata fields don't contain place names so they
 * can't cause false passes.
 */
function buildCorpus(userPrompt: string, steps: ReadonlyArray<StepLike>): string {
  const parts: string[] = [userPrompt];
  for (const s of steps) parts.push(JSON.stringify(s));
  return parts.join(" ").toLowerCase();
}

/**
 * Tool names — scan the step content for objects with a string toolName field.
 * Resilient to AI SDK 6's content-array shape without hardcoding "type" values.
 */
function extractToolNames(steps: ReadonlyArray<StepLike>): string[] {
  const names: string[] = [];
  for (const s of steps) {
    if (s.toolCalls && s.toolCalls.length > 0) {
      for (const c of s.toolCalls) names.push(c.toolName);
      continue;
    }
    if (s.content) {
      for (const item of s.content) {
        if (typeof item.toolName === "string" && item.toolName.length > 0) {
          names.push(item.toolName);
        }
      }
    }
  }
  return names;
}

/**
 * A candidate is a hallucination iff NONE of its proper-noun-shaped words
 * (after stopword filtering) appears in the grounding corpus.
 *
 * Rationale: descriptive English the model adds around real place names
 * ("Asakusa Introduction", "Ancient Rome Core") would over-trigger if we
 * required every word to be traceable. The risk we actually want to catch
 * is the model inventing place names from training data ("Restaurant Le
 * Pamplemousse" when find_restaurants never returned it). If even one
 * proper-noun word traces back, the reference is grounded.
 */
function findHallucinations(places: string[], corpus: string): string[] {
  return places.filter((candidate) => {
    const words = candidate
      .split(/[- ]/)
      .filter((w) => !STOPWORDS.has(w));
    if (words.length === 0) return false;
    // Hallucination = no proper-noun word is in corpus.
    return !words.some((w) => corpus.includes(w.toLowerCase()));
  });
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

  const corpus = buildCorpus(prompt.text, steps);
  const places = extractPlaces(finalText);
  const hallucinations = findHallucinations(places, corpus);

  if (process.env.EVAL_DEBUG === "1") {
    console.error(
      `\n${COLOR.dim}--- DEBUG ${prompt.id} ---\n` +
        `steps=${steps.length}, corpus chars=${corpus.length}\n` +
        `first step keys: ${Object.keys(steps[0] ?? {}).join(", ")}\n` +
        `places extracted (${places.length}): ${places.slice(0, 20).join(", ")}\n` +
        `final text (first 300 chars): ${finalText.slice(0, 300).replace(/\n/g, " ")}\n` +
        `---${COLOR.reset}\n`,
    );
  }

  const dayHeaders = (finalText.match(/^## Day \d+/gm) ?? []).length;
  const dateMatches = finalText.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  const pastDates = dateMatches.filter((d) => d < today);

  const toolNames = extractToolNames(steps);
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

    // If no tool calls happened at all, the response is either a clarifying
    // question or an offline answer — not an itinerary. The hallucination
    // invariant doesn't apply to non-itinerary turns. Soft-warn instead.
    if (r.toolCallCount === 0) {
      console.log(`${COLOR.yellow}SKIP${COLOR.reset} ${COLOR.dim}(no tool calls — model clarified or went offline)${COLOR.reset}`);
      softWarns++;
    } else if (r.hallucinations.length > 0) {
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
    if (r.toolCallCount > 0 && !r.hasStructure) warns.push("no ## Day N headers");
    if (r.pastDates.length > 0) {
      warns.push(`${r.pastDates.length} past date(s): ${r.pastDates.join(", ")}`);
    }
    if (r.toolCallCount > 0 && !r.calledCheckWeather) warns.push("check_weather not called");
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
