import { createUIMessageStreamResponse } from "ai";
import { getRun } from "workflow/api";

export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const startIndexParam = searchParams.get("startIndex");
  const startIndex = startIndexParam ? parseInt(startIndexParam, 10) : undefined;

  try {
    const run = getRun(id);
    if (!(await run.exists)) {
      return Response.json(
        { error: "Run not found or expired", runId: id },
        { status: 404 },
      );
    }

    const readable = run.getReadable({ startIndex });
    const tailIndex = await readable.getTailIndex();

    return createUIMessageStreamResponse({
      stream: readable,
      headers: {
        "x-workflow-run-id": id,
        "x-workflow-stream-tail-index": String(tailIndex),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[chat-durable/stream] FAIL id=${id}: ${message}`);
    // Return 404 (not 500) so WorkflowChatTransport stops retrying and the
    // client can fall back to a fresh prompt.
    return Response.json(
      { error: "Run lookup failed", runId: id, details: message },
      { status: 404 },
    );
  }
}
