import { checkRateLimit } from "@vercel/firewall";

// Fail-open rate-limit guard for the expensive routes (LLM calls, sandbox
// exec). A rate limiter must never take down the service it protects, so any
// error — a misconfigured rule, an SDK hiccup — is swallowed and the request
// proceeds. Returns a 429 Response when the caller is over the limit, else null.
//
// The limit itself (requests per window, keyed by IP) is a Vercel Firewall
// rate-limit rule — enforced at the edge before the function even runs. This
// in-route check is the second layer and the place to attach a custom key
// (e.g. per authenticated user) if you outgrow IP-based limiting.
export async function rateLimitGuard(
  id: string,
  request: Request,
): Promise<Response | null> {
  try {
    const { rateLimited } = await checkRateLimit(id, { request });
    if (rateLimited) {
      return Response.json(
        { error: "Rate limit exceeded — please slow down." },
        { status: 429, headers: { "retry-after": "60" } },
      );
    }
  } catch {
    // Fail open: never let the limiter break the route it guards.
  }
  return null;
}
