import { tool } from "ai";
import { z } from "zod";
import type { Flight } from "@/lib/types";

export const findFlights = tool({
  description:
    "Find flight options between two cities. Returns 3 representative options across price tiers. Synthetic data for demo.",
  inputSchema: z.object({
    origin: z
      .string()
      .describe("Origin city, e.g. 'New York' or airport code like 'JFK'"),
    destination: z.string().describe("Destination city or airport code"),
    departDate: z.string().describe("Departure date in YYYY-MM-DD format"),
    returnDate: z
      .string()
      .optional()
      .describe("Return date in YYYY-MM-DD format, if round-trip"),
  }),
  execute: async ({ origin, destination, departDate }) => {
    const baseHours = pickBaseHours(destination);
    const basePrice = pickBasePrice(destination);

    const flights: Flight[] = [
      {
        airline: "TAP Portugal",
        flightNumber: "TP203",
        origin,
        destination,
        departTime: `${departDate}T21:35`,
        arriveTime: `${addHours(departDate, "21:35", baseHours).date}T${addHours(departDate, "21:35", baseHours).time}`,
        durationHours: baseHours,
        priceUSD: basePrice,
        stops: 0,
      },
      {
        airline: "United",
        flightNumber: "UA964",
        origin,
        destination,
        departTime: `${departDate}T18:10`,
        arriveTime: `${addHours(departDate, "18:10", baseHours + 1).date}T${addHours(departDate, "18:10", baseHours + 1).time}`,
        durationHours: baseHours + 1,
        priceUSD: basePrice + 180,
        stops: 0,
      },
      {
        airline: "Delta + Air France",
        flightNumber: "DL+AF",
        origin,
        destination,
        departTime: `${departDate}T16:45`,
        arriveTime: `${addHours(departDate, "16:45", baseHours + 4).date}T${addHours(departDate, "16:45", baseHours + 4).time}`,
        durationHours: baseHours + 4,
        priceUSD: basePrice - 120,
        stops: 1,
      },
    ];

    return { flights };
  },
});

function pickBaseHours(dest: string): number {
  const d = dest.toLowerCase();
  if (d.includes("lisbon") || d.includes("madrid") || d.includes("london"))
    return 7;
  if (d.includes("paris") || d.includes("rome") || d.includes("amsterdam"))
    return 8;
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

function addHours(
  date: string,
  time: string,
  hours: number,
): { date: string; time: string } {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${date}T${time}:00Z`);
  d.setUTCHours(d.getUTCHours() + hours);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return {
    date: d.toISOString().slice(0, 10),
    time: `${hh}:${mm}`,
  };
}
