import { convertToModelMessages, createUIMessageStreamResponse } from "ai";
import { start } from "workflow/api";
import { planTripWorkflow } from "@/lib/workflows/plan-trip";
import { rateLimitGuard } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(req: Request) {
  const limited = await rateLimitGuard("wanderloop-chat", req);
  if (limited) return limited;

  const country = req.headers.get("x-wanderloop-country") ?? "US";
  const currency = req.headers.get("x-wanderloop-currency") ?? "USD";
  const units =
    (req.headers.get("x-wanderloop-units") as "metric" | "imperial" | null) ??
    "imperial";

  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  const today = new Date().toISOString().slice(0, 10);

  // Chaos toggle: the website sets a `wanderloop-chaos` cookie; when "1" this
  // run injects synthetic tool-step failures (recovered by Workflow retries).
  const chaos = /(?:^|;\s*)wanderloop-chaos=1(?:;|$)/.test(
    req.headers.get("cookie") ?? "",
  );

  const run = await start(planTripWorkflow, [
    modelMessages,
    { country, currency, units },
    today,
    chaos,
  ]);

  return createUIMessageStreamResponse({
    stream: run.getReadable(),
    headers: {
      "x-workflow-run-id": run.runId,
    },
  });
}
