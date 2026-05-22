"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type DaySection = {
  title: string;
  body: string;
};

function parseIntoDays(text: string): {
  preamble: string;
  days: DaySection[];
  postamble: string;
} {
  const lines = text.split("\n");
  const days: DaySection[] = [];
  let preamble: string[] = [];
  let postamble: string[] = [];
  let current: DaySection | null = null;
  let seenAnyDay = false;

  for (const line of lines) {
    const dayMatch = line.match(/^##\s+(.*)$/);
    if (dayMatch) {
      if (current) days.push(current);
      current = { title: dayMatch[1].trim(), body: "" };
      seenAnyDay = true;
      continue;
    }
    if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else if (!seenAnyDay) {
      preamble.push(line);
    } else {
      postamble.push(line);
    }
  }
  if (current) days.push(current);

  return {
    preamble: preamble.join("\n").trim(),
    days: days.map((d) => ({ ...d, body: d.body.trim() })),
    postamble: postamble.join("\n").trim(),
  };
}

const MD_COMPONENTS = {
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-sm leading-relaxed text-neutral-200" {...props} />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-neutral-100" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="ml-4 list-disc space-y-1 text-sm text-neutral-200" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="ml-4 list-decimal space-y-1 text-sm text-neutral-200" {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-relaxed" {...props} />
  ),
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mt-4 text-lg font-semibold text-neutral-100" {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mt-4 text-base font-semibold text-neutral-100" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mt-3 text-sm font-semibold text-neutral-100" {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="text-neutral-100 underline underline-offset-2 hover:text-white"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code
      className="rounded bg-neutral-900 px-1.5 py-0.5 text-[0.85em] text-neutral-300"
      {...props}
    />
  ),
};

export default function ItineraryDisplay({ text }: { text: string }) {
  const { preamble, days, postamble } = parseIntoDays(text);

  if (days.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
          {text}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {preamble && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-3 text-sm text-neutral-300">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
            {preamble}
          </ReactMarkdown>
        </div>
      )}

      {days.map((day, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950"
        >
          <div className="border-b border-neutral-800 bg-neutral-900/60 px-5 py-2.5">
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-neutral-800 px-2 py-0.5 text-[10px] font-medium tracking-wider text-neutral-400 uppercase">
                Day {i + 1}
              </span>
              <h3 className="text-sm font-medium text-neutral-100">
                {day.title.replace(/^Day\s*\d+\s*[—\-:]\s*/i, "")}
              </h3>
            </div>
          </div>
          <div className="space-y-2 px-5 py-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
              {day.body}
            </ReactMarkdown>
          </div>
        </div>
      ))}

      {postamble && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-5 py-3 text-sm text-neutral-300">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
            {postamble}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
