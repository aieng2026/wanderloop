import { headers } from "next/headers";

export type Locale = {
  country: string;
  currency: string;
  units: "metric" | "imperial";
};

export async function getLocale(): Promise<Locale> {
  const h = await headers();
  return {
    country: h.get("x-wanderloop-country") ?? "US",
    currency: h.get("x-wanderloop-currency") ?? "USD",
    units:
      (h.get("x-wanderloop-units") as "metric" | "imperial" | null) ?? "imperial",
  };
}
