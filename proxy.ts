import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

const IMPERIAL_COUNTRIES = new Set(["US", "LR", "MM"]);

function inferLocale(country: string | null): {
  country: string;
  currency: string;
  units: "metric" | "imperial";
} {
  const cc = (country ?? "").toUpperCase() || "US";
  let currency = "USD";
  if (cc === "GB") currency = "GBP";
  else if (cc === "JP") currency = "JPY";
  else if (cc === "CH") currency = "CHF";
  else if (cc === "CA") currency = "CAD";
  else if (cc === "AU") currency = "AUD";
  else if (EU_COUNTRIES.has(cc)) currency = "EUR";

  const units = IMPERIAL_COUNTRIES.has(cc) ? "imperial" : "metric";
  return { country: cc, currency, units };
}

export function proxy(req: NextRequest) {
  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.cookies.get("wanderloop-geo-override")?.value ??
    null;

  const locale = inferLocale(country);

  // Forward locale to downstream Server Components and API routes
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-wanderloop-country", locale.country);
  requestHeaders.set("x-wanderloop-currency", locale.currency);
  requestHeaders.set("x-wanderloop-units", locale.units);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
