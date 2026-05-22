import { tool } from "ai";
import { z } from "zod";
import type { Restaurant } from "@/lib/types";

export const findRestaurants = tool({
  description:
    "Find restaurant recommendations for a city given preferences. Returns 4-6 picks across price tiers. Synthetic data for demo.",
  inputSchema: z.object({
    city: z.string().describe("City name, e.g. 'Lisbon'"),
    cuisine: z
      .string()
      .optional()
      .describe("Cuisine preference, e.g. 'seafood', 'foodie', 'vegan'"),
    priceLevel: z
      .enum(["budget", "mid", "high", "any"])
      .optional()
      .describe("Price tier"),
  }),
  execute: async ({ city, cuisine, priceLevel }) => {
    const key = city.toLowerCase();
    const all = CITY_DATA[key] ?? CITY_DATA.default;
    const filtered =
      priceLevel && priceLevel !== "any"
        ? all.filter((r) => priceTierMatches(r.priceLevel, priceLevel))
        : all;
    return { restaurants: filtered, city, cuisineHint: cuisine ?? null };
  },
});

function priceTierMatches(
  level: 1 | 2 | 3 | 4,
  target: "budget" | "mid" | "high",
): boolean {
  if (target === "budget") return level <= 2;
  if (target === "mid") return level === 2 || level === 3;
  if (target === "high") return level >= 3;
  return true;
}

const CITY_DATA: Record<string, Restaurant[]> = {
  lisbon: [
    {
      name: "Cervejaria Ramiro",
      cuisine: "Seafood",
      neighborhood: "Intendente",
      priceLevel: 3,
      rating: 4.7,
      signature: "Garlic prawns, steak sandwich finisher",
    },
    {
      name: "Pastéis de Belém",
      cuisine: "Bakery",
      neighborhood: "Belém",
      priceLevel: 1,
      rating: 4.5,
      signature: "Pastéis de nata, original since 1837",
    },
    {
      name: "Taberna da Rua das Flores",
      cuisine: "Modern Portuguese",
      neighborhood: "Chiado",
      priceLevel: 3,
      rating: 4.8,
      signature: "Changing chalkboard menu, no reservations",
    },
    {
      name: "Time Out Market",
      cuisine: "Food Hall",
      neighborhood: "Cais do Sodré",
      priceLevel: 2,
      rating: 4.4,
      signature: "Curated stalls from the city's best chefs",
    },
    {
      name: "A Cevicheria",
      cuisine: "Peruvian",
      neighborhood: "Príncipe Real",
      priceLevel: 3,
      rating: 4.6,
      signature: "Ceviche under a giant octopus sculpture",
    },
  ],
  tokyo: [
    {
      name: "Tsuta",
      cuisine: "Ramen",
      neighborhood: "Sugamo",
      priceLevel: 2,
      rating: 4.7,
      signature: "Truffle shoyu ramen, the Michelin one",
    },
    {
      name: "Sushi Saito",
      cuisine: "Sushi",
      neighborhood: "Roppongi",
      priceLevel: 4,
      rating: 4.9,
      signature: "Three-star omakase if you can get in",
    },
    {
      name: "Afuri Ebisu",
      cuisine: "Ramen",
      neighborhood: "Ebisu",
      priceLevel: 2,
      rating: 4.5,
      signature: "Yuzu shio ramen",
    },
    {
      name: "Den",
      cuisine: "Modern Kaiseki",
      neighborhood: "Jingūmae",
      priceLevel: 4,
      rating: 4.8,
      signature: "Playful seasonal tasting menu",
    },
  ],
  paris: [
    {
      name: "Le Comptoir du Relais",
      cuisine: "Bistro",
      neighborhood: "Saint-Germain",
      priceLevel: 3,
      rating: 4.6,
      signature: "Yves Camdeborde's classic bistronomy",
    },
    {
      name: "Septime",
      cuisine: "Modern French",
      neighborhood: "Charonne",
      priceLevel: 4,
      rating: 4.7,
      signature: "Reservation 3 weeks out, worth it",
    },
    {
      name: "Du Pain et des Idées",
      cuisine: "Bakery",
      neighborhood: "Canal Saint-Martin",
      priceLevel: 1,
      rating: 4.8,
      signature: "Escargot pistache",
    },
    {
      name: "Breizh Café",
      cuisine: "Crêperie",
      neighborhood: "Le Marais",
      priceLevel: 2,
      rating: 4.5,
      signature: "Buckwheat galettes, Bordier butter",
    },
  ],
  default: [
    {
      name: "Local favorite #1",
      cuisine: "Regional",
      neighborhood: "Old town",
      priceLevel: 2,
      rating: 4.5,
      signature: "Hand-picked from local guides",
    },
    {
      name: "Local favorite #2",
      cuisine: "Contemporary",
      neighborhood: "Downtown",
      priceLevel: 3,
      rating: 4.6,
      signature: "Chef-driven seasonal menu",
    },
    {
      name: "Local favorite #3",
      cuisine: "Casual",
      neighborhood: "Market district",
      priceLevel: 1,
      rating: 4.3,
      signature: "Grab-and-go market eats",
    },
  ],
};
