"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useState } from "react";
import Link from "next/link";
import ToolCallCard from "@/components/tool-call-card";
import ItineraryDisplay from "@/components/itinerary-display";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; id: string; path: string }
  | { kind: "error"; message: string };

export default function Planner({
  initialPrompt,
  locale,
}: {
  initialPrompt: string;
  locale: { currency: string; units: string; country: string };
}) {
  const [input, setInput] = useState("");
  const [hasAutoSent, setHasAutoSent] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  const { messages, sendMessage, status, error, stop, regenerate, setMessages } =
    useChat({
      transport: new DefaultChatTransport({ api: "/api/chat" }),
    });

  useEffect(() => {
    if (initialPrompt && !hasAutoSent) {
      setHasAutoSent(true);
      sendMessage({ text: initialPrompt });
    }
  }, [initialPrompt, hasAutoSent, sendMessage]);

  // Reset save state if user makes new conversation moves
  useEffect(() => {
    if (saveState.kind === "saved" || saveState.kind === "error") {
      setSaveState({ kind: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

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
    setSaveState({ kind: "idle" });
  };

  const firstUserPrompt = (() => {
    const first = messages.find((m) => m.role === "user");
    if (!first) return initialPrompt;
    const part = first.parts.find((p) => p.type === "text");
    return part && "text" in part ? (part.text as string) : initialPrompt;
  })();

  const onSave = async () => {
    setSaveState({ kind: "saving" });
    try {
      const res = await fetch("/api/itinerary/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages, prompt: firstUserPrompt }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaveState({
          kind: "error",
          message: body.error ?? `Save failed (${res.status})`,
        });
        return;
      }
      const data = (await res.json()) as { id: string; path: string };
      setSaveState({ kind: "saved", id: data.id, path: data.path });
    } catch (err) {
      setSaveState({ kind: "error", message: String(err) });
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
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

      <div className="flex-1 space-y-6">
        {messages.length === 0 && !isStreaming && (
          <p className="text-neutral-500">Type a trip below to get started.</p>
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
              <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Agent working…
            </div>
            <button
              type="button"
              onClick={() => stop()}
              className="rounded-md border border-neutral-700 px-3 py-1 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
            >
              Stop
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-300">
            <div className="font-medium">Error</div>
            <div className="mt-1 text-red-400">{error.message}</div>
          </div>
        )}

        {(canRegenerate || isErrored) && (
          <div className="flex items-center justify-end gap-2 text-xs">
            {canRegenerate && saveState.kind === "idle" && (
              <button
                type="button"
                onClick={onSave}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100"
              >
                💾 Save trip
              </button>
            )}
            {saveState.kind === "saving" && (
              <span className="text-neutral-500">Saving…</span>
            )}
            {saveState.kind === "saved" && (
              <Link
                href={saveState.path}
                className="rounded-md border border-emerald-900 bg-emerald-950 px-3 py-1.5 text-emerald-300 hover:border-emerald-700 hover:text-emerald-200"
              >
                ✓ Saved — open share link
              </Link>
            )}
            {saveState.kind === "error" && (
              <span className="text-red-400">Save failed: {saveState.message}</span>
            )}
            <button
              type="button"
              onClick={() => regenerate()}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100"
            >
              ↻ Retry
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
          className="rounded-lg bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </main>
  );
}
