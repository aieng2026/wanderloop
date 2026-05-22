type Restaurant = {
  name: string;
  cuisine: string;
  neighborhood: string;
  priceLevel: 1 | 2 | 3 | 4;
  rating: number;
  signature: string;
};

type Attraction = {
  name: string;
  category: string;
  neighborhood: string;
  estimatedHours: number;
  notes: string;
};

export type Place = {
  kind: "restaurant" | "attraction";
  name: string;
  category: string;
  neighborhood: string;
  priceLevel?: 1 | 2 | 3 | 4;
  rating?: number;
  estimatedHours?: number;
  notes?: string;
};

type UIMessage = {
  role: string;
  parts: Array<{
    type: string;
    state?: string;
    output?: unknown;
  }>;
};

export function extractPlacesFromMessages(messages: UIMessage[]): Place[] {
  const places: Place[] = [];

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      if (part.state !== "output-available" || !part.output) continue;

      if (part.type === "tool-find_restaurants") {
        const output = part.output as { restaurants?: Restaurant[] };
        for (const r of output.restaurants ?? []) {
          places.push({
            kind: "restaurant",
            name: r.name,
            category: r.cuisine,
            neighborhood: r.neighborhood,
            priceLevel: r.priceLevel,
            rating: r.rating,
            notes: r.signature,
          });
        }
      }

      if (part.type === "tool-find_attractions") {
        const output = part.output as { attractions?: Attraction[] };
        for (const a of output.attractions ?? []) {
          places.push({
            kind: "attraction",
            name: a.name,
            category: a.category,
            neighborhood: a.neighborhood,
            estimatedHours: a.estimatedHours,
            notes: a.notes,
          });
        }
      }
    }
  }

  return places;
}
