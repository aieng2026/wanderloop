import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/auth";

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

// Paths anyone may hit without a session cookie.
// Cron routes are excluded because they enforce their own CRON_SECRET bearer check.
// /itinerary/<id> and /api/itinerary/<id>/pdf are share links that must stay public.
const PUBLIC_PREFIXES = [
  "/login",
  "/api/login",
  "/api/logout",
  "/itinerary/",
  "/api/cron/",
];
const PDF_PATTERN = /^\/api\/itinerary\/[^/]+\/pdf$/;

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (PDF_PATTERN.test(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (!isPublicPath(pathname)) {
    const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
    if (!session) {
      if (pathname.startsWith("/api/")) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }

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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.well-known/workflow/).*)",
  ],
};
