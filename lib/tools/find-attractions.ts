import { tool } from "ai";
import { z } from "zod";
import type { Attraction } from "@/lib/types";

export const findAttractions = tool({
  description:
    "Find attractions, neighborhoods, viewpoints, and experiences in a city. Returns 5-8 curated picks across categories. Synthetic data for demo.",
  inputSchema: z.object({
    city: z.string().describe("City name"),
    interests: z
      .string()
      .optional()
      .describe(
        "Interests like 'history', 'foodie', 'art', 'outdoors', 'nightlife'",
      ),
    pace: z
      .enum(["relaxed", "balanced", "packed"])
      .optional()
      .describe("Trip pace preference"),
  }),
  execute: async ({ city, interests, pace }) => {
    const key = city.toLowerCase();
    const all = CITY_ATTRACTIONS[key] ?? CITY_ATTRACTIONS.default;
    return { city, attractions: all, interestsHint: interests ?? null, pace };
  },
});

const CITY_ATTRACTIONS: Record<string, Attraction[]> = {
  lisbon: [
    {
      name: "Castelo de São Jorge",
      category: "viewpoint",
      neighborhood: "Alfama",
      estimatedHours: 2,
      notes: "Best views of the city; go for sunset",
    },
    {
      name: "Mosteiro dos Jerónimos",
      category: "museum",
      neighborhood: "Belém",
      estimatedHours: 1.5,
      notes: "UNESCO World Heritage, Manueline architecture",
    },
    {
      name: "LX Factory",
      category: "neighborhood",
      neighborhood: "Alcântara",
      estimatedHours: 2,
      notes: "Converted industrial complex, shops + bars",
    },
    {
      name: "Tram 28 ride",
      category: "experience",
      neighborhood: "city-wide",
      estimatedHours: 1,
      notes: "Classic yellow tram through Graça, Alfama, Baixa",
    },
    {
      name: "Time Out Market",
      category: "neighborhood",
      neighborhood: "Cais do Sodré",
      estimatedHours: 2,
      notes: "Curated food hall — pair with lunch",
    },
    {
      name: "Sintra day trip",
      category: "experience",
      neighborhood: "(40 min train)",
      estimatedHours: 8,
      notes: "Pena Palace + Quinta da Regaleira",
    },
  ],
  tokyo: [
    {
      name: "TeamLab Planets",
      category: "experience",
      neighborhood: "Toyosu",
      estimatedHours: 2,
      notes: "Immersive digital art, book ahead",
    },
    {
      name: "Senso-ji",
      category: "viewpoint",
      neighborhood: "Asakusa",
      estimatedHours: 1.5,
      notes: "Tokyo's oldest temple, go early for fewer crowds",
    },
    {
      name: "Shimokitazawa",
      category: "neighborhood",
      neighborhood: "Shimokitazawa",
      estimatedHours: 3,
      notes: "Vintage shops, indie cafés, no big chains",
    },
    {
      name: "Meiji Jingu",
      category: "park",
      neighborhood: "Harajuku",
      estimatedHours: 2,
      notes: "Forest shrine, pair with Yoyogi Park",
    },
    {
      name: "Tsukiji Outer Market",
      category: "experience",
      neighborhood: "Tsukiji",
      estimatedHours: 2,
      notes: "Pre-9am for the freshest stalls",
    },
  ],
  paris: [
    {
      name: "Musée d'Orsay",
      category: "museum",
      neighborhood: "7th",
      estimatedHours: 3,
      notes: "Impressionists in a Belle Époque train station",
    },
    {
      name: "Le Marais walk",
      category: "neighborhood",
      neighborhood: "Le Marais",
      estimatedHours: 3,
      notes: "Falafel at L'As, vintage shops, Place des Vosges",
    },
    {
      name: "Sainte-Chapelle",
      category: "viewpoint",
      neighborhood: "Île de la Cité",
      estimatedHours: 1,
      notes: "Stained glass, better than Notre-Dame currently",
    },
    {
      name: "Père Lachaise",
      category: "park",
      neighborhood: "20th",
      estimatedHours: 2,
      notes: "Cemetery + park, Jim Morrison + Oscar Wilde",
    },
    {
      name: "Canal Saint-Martin",
      category: "neighborhood",
      neighborhood: "10th",
      estimatedHours: 2,
      notes: "Picnic-on-the-canal vibe, best in the evening",
    },
  ],
  default: [
    {
      name: "Old Town walking tour",
      category: "neighborhood",
      neighborhood: "Historic center",
      estimatedHours: 3,
      notes: "Get oriented on day 1",
    },
    {
      name: "City museum",
      category: "museum",
      neighborhood: "Cultural quarter",
      estimatedHours: 2,
      notes: "Local history + current exhibits",
    },
    {
      name: "Sunset viewpoint",
      category: "viewpoint",
      neighborhood: "Elevated district",
      estimatedHours: 1,
      notes: "Go at golden hour",
    },
    {
      name: "Local market",
      category: "experience",
      neighborhood: "Market district",
      estimatedHours: 2,
      notes: "Eat your way through breakfast",
    },
  ],
};
