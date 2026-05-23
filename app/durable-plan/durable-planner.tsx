"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ToolCallCard from "@/components/tool-call-card";
import ItineraryDisplay from "@/components/itinerary-display";
import BudgetFilter from "@/components/budget-filter";
import { extractPlacesFromMessages } from "@/lib/extract-places";

const RUN_ID_STORAGE_KEY = "wanderloop:active-durable-run-id";
const MESSAGES_STORAGE_KEY = "wanderloop:durable-messages";

export default function DurablePlanner({
  initialPrompt,
  locale,
}: {
  initialPrompt: string;
  locale: { currency: string; units: string; country: string };
}) {
  const [input, setInput] = useState("");
  const [hasAutoSent, setHasAutoSent] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | undefined>(undefined);

  // Read the previous active runId on mount. If the URL has a fresh ?q=
  // prompt, treat it as authoritative and clear stale resume state — this
  // avoids trying to reconnect to dead runs from prior deployments.
  const initialRunId = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    if (initialPrompt) {
      localStorage.removeItem(RUN_ID_STORAGE_KEY);
      localStorage.removeItem(MESSAGES_STORAGE_KEY);
      return undefined;
    }
    return localStorage.getItem(RUN_ID_STORAGE_KEY) ?? undefined;
  }, [initialPrompt]);

  // Rehydrate the conversation from localStorage on refresh so the user's
  // prompt + already-streamed assistant content is visible immediately.
  // The workflow stream then resumes any remaining chunks via WorkflowChatTransport.
  const initialMessages = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    if (initialPrompt) return undefined;
    const raw = localStorage.getItem(MESSAGES_STORAGE_KEY);
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
    } catch {
      return undefined;
    }
  }, [initialPrompt]);

  const transport = useMemo(
    () =>
      new WorkflowChatTransport({
        api: "/api/chat-durable",
        // Public reconnectToStream (used by useChat({ resume: true }) on mount)
        // falls back to the AI SDK chat-id if no workflowRunId is in scope —
        // that produces 16-char ids that the workflow API rejects. Override
        // the URL with the runId we stashed in localStorage.
        prepareReconnectToStreamRequest: async (config) => {
          const runId =
            typeof window !== "undefined"
              ? localStorage.getItem(RUN_ID_STORAGE_KEY)
              : null;
          return {
            ...config,
            api: runId ? `/api/chat-durable/${runId}/stream` : config.api,
          };
        },
        onChatSendMessage: (response) => {
          const runId = response.headers.get("x-workflow-run-id");
          if (runId) {
            localStorage.setItem(RUN_ID_STORAGE_KEY, runId);
            setActiveRunId(runId);
          }
        },
        onChatEnd: () => {
          localStorage.removeItem(RUN_ID_STORAGE_KEY);
        },
      }),
    [],
  );

  const { messages, sendMessage, status, error, stop, regenerate, setMessages } =
    useChat({
      messages: initialMessages,
      resume: Boolean(initialRunId),
      transport,
    });

  // Persist messages on every change so a refresh restores the conversation.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (messages.length === 0) {
      localStorage.removeItem(MESSAGES_STORAGE_KEY);
      return;
    }
    try {
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // localStorage full / disabled — fail silently
    }
  }, [messages]);

  useEffect(() => {
    if (initialRunId) setActiveRunId(initialRunId);
  }, [initialRunId]);

  useEffect(() => {
    // Don't auto-send if we're resuming an existing run
    if (initialPrompt && !hasAutoSent && !initialRunId) {
      setHasAutoSent(true);
      sendMessage({ text: initialPrompt });
    }
  }, [initialPrompt, hasAutoSent, initialRunId, sendMessage]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  };

  const isStreaming = status === "submitted" || status === "streaming";
  const hasAssistantReply = messages.some((m) => m.role === "assistant");
  const isErrored = status === "error";
  const canRegenerate = !isStreaming && hasAssistantReply;

  const resetConversation = () => {
    setMessages([]);
    setHasAutoSent(true);
    setInput("");
    setActiveRunId(undefined);
    localStorage.removeItem(RUN_ID_STORAGE_KEY);
    localStorage.removeItem(MESSAGES_STORAGE_KEY);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-300"
        >
          ← Wanderloop
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <span
            className="rounded-md border border-neutral-800 px-2 py-1 text-neutral-400"
            title={`Detected region: ${locale.country}`}
          >
            {locale.currency} · {locale.units}
          </span>
          <button
            type="button"
            onClick={resetConversation}
            disabled={isStreaming || messages.length === 0}
            className="text-neutral-500 hover:text-neutral-300 disabled:opacity-30 disabled:hover:text-neutral-500"
          >
            New trip
          </button>
        </div>
      </header>

      <div className="mb-6 rounded-lg border border-purple-900/60 bg-purple-950/30 px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-purple-300">
            <span className="font-medium">Durable mode</span>
            <span className="ml-2 text-purple-400">
              · Workflow DevKit · resumes if you refresh, retries on failure
            </span>
          </div>
          {activeRunId && (
            <code className="rounded bg-purple-950 px-2 py-0.5 font-mono text-[10px] text-purple-300">
              run: {activeRunId.slice(0, 16)}…
            </code>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-6">
        {messages.length === 0 && !isStreaming && (
          <p className="text-neutral-500">
            Type a trip below to kick off a durable run.
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="space-y-3">
            {msg.role === "user" && (
              <div className="rounded-lg bg-neutral-900 px-4 py-3 text-sm text-neutral-200">
                <span className="mr-2 text-neutral-500">You</span>
                {msg.parts.map((part, i) =>
                  part.type === "text" ? (
                    <span key={i}>{part.text}</span>
                  ) : null,
                )}
              </div>
            )}

            {msg.role === "assistant" && (
              <div className="space-y-3">
                {msg.parts.map((part, i) => {
                  if (part.type === "text") {
                    return <ItineraryDisplay key={i} text={part.text} />;
                  }
                  if (
                    typeof part.type === "string" &&
                    part.type.startsWith("tool-")
                  ) {
                    return <ToolCallCard key={i} part={part} />;
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        ))}

        {isStreaming && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center text-neutral-500">
              <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-purple-400" />
              Workflow running…
            </div>
            <button
              type="button"
              onClick={() => stop()}
              className="rounded-md border border-neutral-700 px-3 py-1 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
            >
              Disconnect
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-300">
            <div className="font-medium">Error</div>
            <div className="mt-1 text-red-400">{error.message}</div>
          </div>
        )}

        {canRegenerate && (
          <BudgetFilter places={extractPlacesFromMessages(messages)} />
        )}

        {(canRegenerate || isErrored) && (
          <div className="flex items-center justify-end text-xs">
            <button
              type="button"
              onClick={() => regenerate()}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
            >
              ↻ Retry last response
            </button>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-8 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            messages.length === 0 ? "Describe a trip…" : "Ask a follow-up…"
          }
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-neutral-400"
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded-lg bg-purple-500 px-5 py-3 text-sm font-medium text-purple-950 transition hover:bg-purple-400 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </main>
  );
}
