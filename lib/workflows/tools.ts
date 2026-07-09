// Tool implementations for the durable workflow.
// Identical synthetic data to lib/tools/*, but wrapped as "use step" functions
// so each call is checkpointed by the Workflow runtime (auto-retry, replay).

import type { Flight, Restaurant, Attraction, WeatherDay } from "@/lib/types";
import { maybeInjectChaos, type ChaosContext } from "./chaos";

// ---------- find_flights ----------

export async function findFlightsStep(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
}, ctx?: ChaosContext) {
  "use step";
  maybeInjectChaos("find_flights", ctx);

  const { origin, destination, departDate } = input;
  const baseHours = pickBaseHours(destination);
  const basePrice = pickBasePrice(destination);

  const flights: Flight[] = [
    makeFlight(origin, destination, departDate, "21:35", baseHours, basePrice, "TAP Portugal", "TP203", 0),
    makeFlight(origin, destination, departDate, "18:10", baseHours + 1, basePrice + 180, "United", "UA964", 0),
    makeFlight(origin, destination, departDate, "16:45", baseHours + 4, basePrice - 120, "Delta + Air France", "DL+AF", 1),
  ];

  return { flights };
}

function makeFlight(
  origin: string,
  destination: string,
  departDate: string,
  departTime: string,
  durationHours: number,
  priceUSD: number,
  airline: string,
  flightNumber: string,
  stops: number,
): Flight {
  const arrive = addHours(departDate, departTime, durationHours);
  return {
    airline,
    flightNumber,
    origin,
    destination,
    departTime: `${departDate}T${departTime}`,
    arriveTime: `${arrive.date}T${arrive.time}`,
    durationHours,
    priceUSD,
    stops,
  };
}

function pickBaseHours(dest: string): number {
  const d = dest.toLowerCase();
  if (d.includes("lisbon") || d.includes("madrid") || d.includes("london")) return 7;
  if (d.includes("paris") || d.includes("rome") || d.includes("amsterdam")) return 8;
  if (d.includes("tokyo") || d.includes("seoul")) return 14;
  if (d.includes("sydney") || d.includes("melbourne")) return 20;
  if (d.includes("rio") || d.includes("buenos aires")) return 11;
  return 9;
}

function pickBasePrice(dest: string): number {
  const d = dest.toLowerCase();
  if (d.includes("tokyo") || d.includes("sydney")) return 1450;
  if (d.includes("london") || d.includes("paris")) return 720;
  if (d.includes("lisbon")) return 680;
  return 850;
}

function addHours(date: string, time: string, hours: number) {
  const d = new Date(`${date}T${time}:00Z`);
  d.setUTCHours(d.getUTCHours() + hours);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return { date: d.toISOString().slice(0, 10), time: `${hh}:${mm}` };
}

// ---------- find_restaurants ----------

export async function findRestaurantsStep(input: {
  city: string;
  cuisine?: string;
  priceLevel?: "budget" | "mid" | "high" | "any";
}, ctx?: ChaosContext) {
  "use step";
  maybeInjectChaos("find_restaurants", ctx);

  const { city, cuisine, priceLevel } = input;
  const all = RESTAURANT_DATA[city.toLowerCase()] ?? RESTAURANT_DATA.default;
  const filtered =
    priceLevel && priceLevel !== "any"
      ? all.filter((r) => matchPrice(r.priceLevel, priceLevel))
      : all;
  return { restaurants: filtered, city, cuisineHint: cuisine ?? null };
}

function matchPrice(level: 1 | 2 | 3 | 4, t: "budget" | "mid" | "high"): boolean {
  if (t === "budget") return level <= 2;
  if (t === "mid") return level === 2 || level === 3;
  if (t === "high") return level >= 3;
  return true;
}

const RESTAURANT_DATA: Record<string, Restaurant[]> = {
  lisbon: [
    { name: "Cervejaria Ramiro", cuisine: "Seafood", neighborhood: "Intendente", priceLevel: 3, rating: 4.7, signature: "Garlic prawns, steak sandwich finisher" },
    { name: "Pastéis de Belém", cuisine: "Bakery", neighborhood: "Belém", priceLevel: 1, rating: 4.5, signature: "Pastéis de nata, original since 1837" },
    { name: "Taberna da Rua das Flores", cuisine: "Modern Portuguese", neighborhood: "Chiado", priceLevel: 3, rating: 4.8, signature: "Changing chalkboard menu, no reservations" },
    { name: "Time Out Market", cuisine: "Food Hall", neighborhood: "Cais do Sodré", priceLevel: 2, rating: 4.4, signature: "Curated stalls from the city's best chefs" },
    { name: "A Cevicheria", cuisine: "Peruvian", neighborhood: "Príncipe Real", priceLevel: 3, rating: 4.6, signature: "Ceviche under a giant octopus sculpture" },
  ],
  tokyo: [
    { name: "Tsuta", cuisine: "Ramen", neighborhood: "Sugamo", priceLevel: 2, rating: 4.7, signature: "Truffle shoyu ramen, the Michelin one" },
    { name: "Sushi Saito", cuisine: "Sushi", neighborhood: "Roppongi", priceLevel: 4, rating: 4.9, signature: "Three-star omakase if you can get in" },
    { name: "Afuri Ebisu", cuisine: "Ramen", neighborhood: "Ebisu", priceLevel: 2, rating: 4.5, signature: "Yuzu shio ramen" },
    { name: "Den", cuisine: "Modern Kaiseki", neighborhood: "Jingūmae", priceLevel: 4, rating: 4.8, signature: "Playful seasonal tasting menu" },
  ],
  paris: [
    { name: "Le Comptoir du Relais", cuisine: "Bistro", neighborhood: "Saint-Germain", priceLevel: 3, rating: 4.6, signature: "Yves Camdeborde's classic bistronomy" },
    { name: "Septime", cuisine: "Modern French", neighborhood: "Charonne", priceLevel: 4, rating: 4.7, signature: "Reservation 3 weeks out, worth it" },
    { name: "Du Pain et des Idées", cuisine: "Bakery", neighborhood: "Canal Saint-Martin", priceLevel: 1, rating: 4.8, signature: "Escargot pistache" },
    { name: "Breizh Café", cuisine: "Crêperie", neighborhood: "Le Marais", priceLevel: 2, rating: 4.5, signature: "Buckwheat galettes, Bordier butter" },
  ],
  default: [
    { name: "Local favorite #1", cuisine: "Regional", neighborhood: "Old town", priceLevel: 2, rating: 4.5, signature: "Hand-picked from local guides" },
    { name: "Local favorite #2", cuisine: "Contemporary", neighborhood: "Downtown", priceLevel: 3, rating: 4.6, signature: "Chef-driven seasonal menu" },
    { name: "Local favorite #3", cuisine: "Casual", neighborhood: "Market district", priceLevel: 1, rating: 4.3, signature: "Grab-and-go market eats" },
  ],
};

// ---------- check_weather ----------

export async function checkWeatherStep(input: {
  city: string;
  startDate: string;
  days?: number;
}, ctx?: ChaosContext) {
  "use step";
  maybeInjectChaos("check_weather", ctx);

  const { city, startDate } = input;
  const days = input.days ?? 5;
  const profile = climateProfile(city);
  const forecast: WeatherDay[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(`${startDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    return {
      date,
      highC: profile.highC,
      lowC: profile.lowC,
      condition: profile.pattern[i % profile.pattern.length],
      precipitationPct: profile.pattern[i % profile.pattern.length] === "rain" ? 70 : 10,
    };
  });
  return { city, forecast };
}

function climateProfile(city: string): {
  highC: number;
  lowC: number;
  pattern: WeatherDay["condition"][];
} {
  const c = city.toLowerCase();
  if (c.includes("lisbon"))
    return { highC: 24, lowC: 16, pattern: ["sunny", "sunny", "partly cloudy", "sunny", "sunny"] };
  if (c.includes("tokyo"))
    return { highC: 22, lowC: 14, pattern: ["partly cloudy", "rain", "sunny", "sunny", "partly cloudy"] };
  if (c.includes("paris"))
    return { highC: 18, lowC: 11, pattern: ["partly cloudy", "rain", "partly cloudy", "sunny", "cloudy"] };
  if (c.includes("london"))
    return { highC: 16, lowC: 9, pattern: ["cloudy", "rain", "partly cloudy", "rain", "cloudy"] };
  return { highC: 22, lowC: 14, pattern: ["sunny", "partly cloudy", "sunny", "partly cloudy", "sunny"] };
}

// ---------- find_attractions ----------

export async function findAttractionsStep(input: {
  city: string;
  interests?: string;
  pace?: "relaxed" | "balanced" | "packed";
}, ctx?: ChaosContext) {
  "use step";
  maybeInjectChaos("find_attractions", ctx);

  const all = ATTRACTION_DATA[input.city.toLowerCase()] ?? ATTRACTION_DATA.default;
  return {
    city: input.city,
    attractions: all,
    interestsHint: input.interests ?? null,
    pace: input.pace,
  };
}

const ATTRACTION_DATA: Record<string, Attraction[]> = {
  lisbon: [
    { name: "Castelo de São Jorge", category: "viewpoint", neighborhood: "Alfama", estimatedHours: 2, notes: "Best views of the city; go for sunset" },
    { name: "Mosteiro dos Jerónimos", category: "museum", neighborhood: "Belém", estimatedHours: 1.5, notes: "UNESCO World Heritage, Manueline architecture" },
    { name: "LX Factory", category: "neighborhood", neighborhood: "Alcântara", estimatedHours: 2, notes: "Converted industrial complex, shops + bars" },
    { name: "Tram 28 ride", category: "experience", neighborhood: "city-wide", estimatedHours: 1, notes: "Classic yellow tram through Graça, Alfama, Baixa" },
    { name: "Time Out Market", category: "neighborhood", neighborhood: "Cais do Sodré", estimatedHours: 2, notes: "Curated food hall — pair with lunch" },
    { name: "Sintra day trip", category: "experience", neighborhood: "(40 min train)", estimatedHours: 8, notes: "Pena Palace + Quinta da Regaleira" },
  ],
  tokyo: [
    { name: "TeamLab Planets", category: "experience", neighborhood: "Toyosu", estimatedHours: 2, notes: "Immersive digital art, book ahead" },
    { name: "Senso-ji", category: "viewpoint", neighborhood: "Asakusa", estimatedHours: 1.5, notes: "Tokyo's oldest temple, go early for fewer crowds" },
    { name: "Shimokitazawa", category: "neighborhood", neighborhood: "Shimokitazawa", estimatedHours: 3, notes: "Vintage shops, indie cafés, no big chains" },
    { name: "Meiji Jingu", category: "park", neighborhood: "Harajuku", estimatedHours: 2, notes: "Forest shrine, pair with Yoyogi Park" },
    { name: "Tsukiji Outer Market", category: "experience", neighborhood: "Tsukiji", estimatedHours: 2, notes: "Pre-9am for the freshest stalls" },
  ],
  paris: [
    { name: "Musée d'Orsay", category: "museum", neighborhood: "7th", estimatedHours: 3, notes: "Impressionists in a Belle Époque train station" },
    { name: "Le Marais walk", category: "neighborhood", neighborhood: "Le Marais", estimatedHours: 3, notes: "Falafel at L'As, vintage shops, Place des Vosges" },
    { name: "Sainte-Chapelle", category: "viewpoint", neighborhood: "Île de la Cité", estimatedHours: 1, notes: "Stained glass, better than Notre-Dame currently" },
    { name: "Père Lachaise", category: "park", neighborhood: "20th", estimatedHours: 2, notes: "Cemetery + park, Jim Morrison + Oscar Wilde" },
    { name: "Canal Saint-Martin", category: "neighborhood", neighborhood: "10th", estimatedHours: 2, notes: "Picnic-on-the-canal vibe, best in the evening" },
  ],
  default: [
    { name: "Old Town walking tour", category: "neighborhood", neighborhood: "Historic center", estimatedHours: 3, notes: "Get oriented on day 1" },
    { name: "City museum", category: "museum", neighborhood: "Cultural quarter", estimatedHours: 2, notes: "Local history + current exhibits" },
    { name: "Sunset viewpoint", category: "viewpoint", neighborhood: "Elevated district", estimatedHours: 1, notes: "Go at golden hour" },
    { name: "Local market", category: "experience", neighborhood: "Market district", estimatedHours: 2, notes: "Eat your way through breakfast" },
  ],
};
