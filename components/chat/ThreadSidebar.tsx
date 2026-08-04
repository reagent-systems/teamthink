"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { ChatThread } from "@/lib/chat/types";
import { cn } from "@/lib/cn";

export function ThreadSidebar({
  threads,
  activeId,
  showArchived,
  onSelect,
  onCreate,
  onRename,
  onTogglePin,
  onToggleArchive,
  onExport,
}: {
  threads: ChatThread[];
  activeId: string | null;
  showArchived: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onExport: (id: string, format: "json" | "md" | "html") => void;
}) {
  const visible = threads.filter((t) => (showArchived ? t.archived : !t.archived));

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Threads
        </span>
        <Button type="button" size="sm" variant="secondary" onClick={onCreate}>
          New
        </Button>
      </div>
      <div className="scroll-thin flex-1 space-y-1 overflow-y-auto p-2">
        {visible.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-ink-subtle">
            {showArchived ? "No archived threads" : "No chats yet"}
          </p>
        )}
        {visible.map((t) => (
          <div
            key={t.id}
            className={cn(
              "group rounded-lg border px-2 py-2",
              t.id === activeId
                ? "border-accent/50 bg-accent-soft"
                : "border-transparent hover:bg-surface-sunken",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(t.id)}
              className="w-full text-left"
            >
              <div className="flex items-center gap-1.5">
                {t.pinned && (
                  <span className="text-[10px] text-accent" title="Pinned">
                    ●
                  </span>
                )}
                <span className="truncate text-sm text-ink">{t.title}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-ink-subtle tabular-nums">
                {t.messages.length} msgs ·{" "}
                {new Date(t.updatedAt).toLocaleDateString()}
              </div>
            </button>
            <div className="mt-1.5 flex flex-wrap gap-1 opacity-80 group-hover:opacity-100">
              <MiniBtn
                onClick={() => {
                  const next = window.prompt("Rename thread", t.title);
                  if (next?.trim()) onRename(t.id, next.trim());
                }}
              >
                Rename
              </MiniBtn>
              <MiniBtn onClick={() => onTogglePin(t.id)}>
                {t.pinned ? "Unpin" : "Pin"}
              </MiniBtn>
              <MiniBtn onClick={() => onToggleArchive(t.id)}>
                {t.archived ? "Restore" : "Archive"}
              </MiniBtn>
              <MiniBtn onClick={() => onExport(t.id, "md")}>MD</MiniBtn>
              <MiniBtn onClick={() => onExport(t.id, "json")}>JSON</MiniBtn>
              <MiniBtn onClick={() => onExport(t.id, "html")}>HTML</MiniBtn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniBtn({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-border bg-canvas px-1.5 py-0.5 text-[10px] text-ink-muted hover:text-ink"
    >
      {children}
    </button>
  );
}
