"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Citation } from "@/lib/scrape/types";

/**
 * Lightweight streaming-friendly markdown: paragraphs, emphasis, inline code,
 * fenced code with copy, collapsible thinking/reasoning blocks, and [n] citations.
 */
export function MarkdownMessage({
  text,
  streaming,
  className,
  citations = [],
}: {
  text: string;
  streaming?: boolean;
  className?: string;
  citations?: Citation[];
}) {
  const citeMap = useMemo(
    () => new Map(citations.map((c) => [c.id, c])),
    [citations],
  );
  const blocks = useMemo(() => parseBlocks(text), [text]);

  return (
    <div className={cn("space-y-3 text-sm leading-relaxed text-ink", className)}>
      {blocks.map((b, i) => {
        if (b.type === "think") {
          return <ThinkingBlock key={i} content={b.content} open={streaming && i === blocks.length - 1} />;
        }
        if (b.type === "code") {
          return <CodeBlock key={i} lang={b.lang} code={b.content} />;
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(b.content, citeMap)}
            {streaming && i === blocks.length - 1 && (
              <span className="animate-pulse-soft">▍</span>
            )}
          </p>
        );
      })}
      {citations.length > 0 && !streaming && (
        <ol className="mt-4 space-y-1 border-t border-border pt-3 text-[11px] text-ink-muted">
          {citations.map((c) => (
            <li key={c.id} id={`cite-${c.id}`}>
              <span className="font-mono text-accent">[{c.id}]</span>{" "}
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink hover:underline"
              >
                {c.title}
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ThinkingBlock({ content, open }: { content: string; open?: boolean }) {
  const [expanded, setExpanded] = useState(!!open);
  return (
    <details
      className="rounded-lg border border-border bg-surface px-3 py-2"
      open={expanded}
      onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer select-none text-xs font-medium text-ink-muted">
        Thinking
      </summary>
      <div className="mt-2 whitespace-pre-wrap text-xs text-ink-subtle">{content}</div>
    </details>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[#1b1916] text-[#f1ece2]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] text-white/60">
        <span className="font-mono">{lang || "code"}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
          onClick={() => void copy()}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="scroll-thin overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

type Block =
  | { type: "text"; content: string }
  | { type: "code"; lang: string; content: string }
  | { type: "think"; content: string };

function parseBlocks(raw: string): Block[] {
  const normalized = raw
    .replace(/<think>([\s\S]*?)<\/think>/gi, (_, body: string) => `\n\`\`\`think\n${body.trim()}\n\`\`\`\n`)
    .replace(/<thinking>([\s\S]*?)<\/thinking>/gi, (_, body: string) => `\n\`\`\`think\n${body.trim()}\n\`\`\`\n`);

  const blocks: Block[] = [];
  const fence = /```([^\n`]*)\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(normalized))) {
    if (m.index > last) {
      const chunk = normalized.slice(last, m.index).trim();
      if (chunk) blocks.push({ type: "text", content: chunk });
    }
    const lang = (m[1] || "").trim();
    const content = m[2].replace(/\n$/, "");
    if (lang.toLowerCase() === "think" || lang.toLowerCase() === "reasoning") {
      blocks.push({ type: "think", content });
    } else {
      blocks.push({ type: "code", lang, content });
    }
    last = m.index + m[0].length;
  }
  const tail = normalized.slice(last);
  // Unclosed fence while streaming
  const open = tail.match(/```([^\n`]*)\n([\s\S]*)$/);
  if (open && !tail.slice(open.index! + 3).includes("```")) {
    const before = tail.slice(0, open.index).trim();
    if (before) blocks.push({ type: "text", content: before });
    const lang = (open[1] || "").trim();
    const content = open[2];
    if (lang.toLowerCase() === "think" || lang.toLowerCase() === "reasoning") {
      blocks.push({ type: "think", content });
    } else {
      blocks.push({ type: "code", lang, content });
    }
  } else if (tail.trim()) {
    blocks.push({ type: "text", content: tail.trim() });
  }
  if (blocks.length === 0) blocks.push({ type: "text", content: "" });
  return blocks;
}

function renderInline(text: string, citeMap: Map<number, Citation>): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\[[0-9]+\]|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    const citeMatch = token.match(/^\[([0-9]+)\]$/);
    if (citeMatch) {
      const id = Number(citeMatch[1]);
      const c = citeMap.get(id);
      nodes.push(
        <a
          key={key++}
          href={c ? `#cite-${id}` : undefined}
          className="align-super text-[10px] font-mono text-accent hover:underline"
          title={c?.title}
        >
          [{id}]
        </a>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(
        <em key={key++} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Pretty-print JSON when the whole message is valid JSON. */
export function formatMaybeJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return text;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return text;
  }
}
