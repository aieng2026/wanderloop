"use client";

type ToolPart = {
  type: string;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

const TOOL_LABELS: Record<string, string> = {
  "tool-find_flights": "Searching flights",
  "tool-find_restaurants": "Finding restaurants",
  "tool-check_weather": "Checking weather",
  "tool-find_attractions": "Finding attractions",
};

export default function ToolCallCard({ part }: { part: ToolPart }) {
  const label = TOOL_LABELS[part.type] ?? part.type.replace("tool-", "");
  const running =
    part.state === "input-streaming" ||
    part.state === "input-available" ||
    part.state === "executing";
  const failed = part.state === "output-error";
  const done = part.state === "output-available";

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            running
              ? "animate-pulse bg-amber-400"
              : failed
                ? "bg-red-400"
                : "bg-emerald-400"
          }`}
        />
        <span className="font-medium text-neutral-300">{label}</span>
        <span className="text-neutral-600">
          {running ? "…" : failed ? "failed" : done ? "✓" : ""}
        </span>
      </div>

      {part.input != null && (
        <details className="mt-1 ml-4 text-neutral-500">
          <summary className="cursor-pointer hover:text-neutral-300">
            input
          </summary>
          <pre className="mt-1 overflow-x-auto rounded bg-neutral-900 p-2 text-[10px] text-neutral-400">
            {JSON.stringify(part.input, null, 2)}
          </pre>
        </details>
      )}

      {done && part.output != null && (
        <details className="mt-1 ml-4 text-neutral-500">
          <summary className="cursor-pointer hover:text-neutral-300">
            output
          </summary>
          <pre className="mt-1 max-h-60 overflow-auto rounded bg-neutral-900 p-2 text-[10px] text-neutral-400">
            {JSON.stringify(part.output, null, 2)}
          </pre>
        </details>
      )}

      {failed && part.errorText && (
        <div className="mt-1 ml-4 text-red-400">{part.errorText}</div>
      )}
    </div>
  );
}
