"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useState } from "react";
import Link from "next/link";
import ToolCallCard from "@/components/tool-call-card";

export default function Planner({ initialPrompt }: { initialPrompt: string }) {
  const [input, setInput] = useState(initialPrompt);
  const [hasAutoSent, setHasAutoSent] = useState(false);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  useEffect(() => {
    if (initialPrompt && !hasAutoSent) {
      setHasAutoSent(true);
      sendMessage({ text: initialPrompt });
    }
  }, [initialPrompt, hasAutoSent, sendMessage]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  };

  const isStreaming = status === "submitted" || status === "streaming";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Wanderloop
        </Link>
        <span className="text-xs text-neutral-600">Powered by AI SDK + Anthropic</span>
      </header>

      <div className="flex-1 space-y-6">
        {messages.length === 0 && !isStreaming && (
          <p className="text-neutral-500">
            Type a trip below to get started.
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="space-y-3">
            {msg.role === "user" && (
              <div className="rounded-lg bg-neutral-900 px-4 py-3 text-sm text-neutral-200">
                <span className="mr-2 text-neutral-500">You</span>
                {msg.parts.map((part, i) =>
                  part.type === "text" ? <span key={i}>{part.text}</span> : null,
                )}
              </div>
            )}

            {msg.role === "assistant" && (
              <div className="space-y-3">
                {msg.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <div
                        key={i}
                        className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-neutral-100"
                      >
                        {part.text}
                      </div>
                    );
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
          <div className="text-xs text-neutral-500">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400 mr-2" />
            Agent working…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-300">
            Error: {error.message}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-8 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a follow-up, or describe a new trip…"
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
