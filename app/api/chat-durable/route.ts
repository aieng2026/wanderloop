import { convertToModelMessages, createUIMessageStreamResponse } from "ai";
import { start } from "workflow/api";
import { planTripWorkflow } from "@/lib/workflows/plan-trip";

export const maxDuration = 60;

export async function POST(req: Request) {
  const country = req.headers.get("x-wanderloop-country") ?? "US";
  const currency = req.headers.get("x-wanderloop-currency") ?? "USD";
  const units =
    (req.headers.get("x-wanderloop-units") as "metric" | "imperial" | null) ??
    "imperial";

  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  const today = new Date().toISOString().slice(0, 10);

  const run = await start(planTripWorkflow, [
    modelMessages,
    { country, currency, units },
    today,
  ]);

  return createUIMessageStreamResponse({
    stream: run.getReadable(),
    headers: {
      "x-workflow-run-id": run.runId,
    },
  });
}
