"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatMaybeJson,
  MarkdownMessage,
} from "@/components/chat/MarkdownMessage";
import { SamplerPanel } from "@/components/chat/SamplerPanel";
import { ThreadSidebar } from "@/components/chat/ThreadSidebar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  downloadText,
  exportThreadHtml,
  exportThreadJson,
  exportThreadMarkdown,
} from "@/lib/chat/export";
import {
  appendMessage,
  buildRunMessages,
  clearThreadMessages,
  createThread,
  deleteCustomPreset,
  ensureActiveThread,
  listPresets,
  listThreads,
  mergeSampler,
  saveCustomPreset,
  saveThread,
  setActiveThreadId,
  truncateBeforeMessage,
  updateAssistantByJob,
} from "@/lib/chat/storage";
import {
  DEFAULT_SAMPLER,
  type ChatThread,
  type SamplerSettings,
} from "@/lib/chat/types";
import { getModel } from "@/lib/config";
import {
  isShardedModel,
  isVisionModel,
  listConsoleModels,
} from "@/lib/models/console-models";
import { retrieveContext } from "@/lib/rag/store";
import type { GridNode } from "@/lib/grid/scheduler";
import type { GridSnapshot } from "@/lib/grid/types";

const CUSTOM = "__custom__";

export function InferenceConsole({
  node,
  snapshot,
  roomId,
  pickModelId,
  registryVersion = 0,
  onManualModelChange,
  ragEnabled = false,
}: {
  node: GridNode;
  snapshot: GridSnapshot;
  roomId: string;
  pickModelId?: string | null;
  registryVersion?: number;
  onManualModelChange?: () => void;
  ragEnabled?: boolean;
}) {
  const gridModels = useMemo(
    () => listConsoleModels(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when browser adds models
    [registryVersion],
  );
  const [attachImage, setAttachImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modelId, setModelId] = useState(() => {
    if (typeof window === "undefined") return gridModels[0]?.id ?? CUSTOM;
    const active = ensureActiveThread(roomId);
    return active.modelId && getModel(active.modelId)
      ? active.modelId
      : (gridModels[0]?.id ?? CUSTOM);
  });
  const [customRepo, setCustomRepo] = useState("");
  const [prompt, setPrompt] = useState("");
  const [thread, setThread] = useState<ChatThread | null>(() =>
    typeof window === "undefined" ? null : ensureActiveThread(roomId),
  );
  const [threads, setThreads] = useState<ChatThread[]>(() =>
    typeof window === "undefined" ? [] : listThreads(roomId),
  );
  const [showArchived, setShowArchived] = useState(false);
  const [showSampler, setShowSampler] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [presets, setPresets] = useState(() =>
    typeof window === "undefined" ? [] : listPresets(),
  );

  const isCustom = modelId === CUSTOM;
  const effectiveModelId =
    pickModelId && getModel(pickModelId) ? pickModelId : modelId;
  const model = isCustom ? null : getModel(effectiveModelId);
  const provisioned = snapshot.provisioned;
  const threadRef = useRef<ChatThread | null>(thread);

  useEffect(() => {
    threadRef.current = thread;
  }, [thread]);

  const webgpuPeers = useMemo(
    () => snapshot.peers.filter((p) => p.caps.webgpu).length,
    [snapshot.peers],
  );

  // PipelineView.planId is the job id (see GridNode.pipelineViews).
  useEffect(() => {
    const current = threadRef.current;
    if (!current) return;
    let next = current;
    let dirty = false;
    for (const p of snapshot.pipelines) {
      const assistant = next.messages.find(
        (m) => m.role === "assistant" && m.jobId === p.planId,
      );
      if (!assistant) continue;
      let text = p.status === "error" ? (p.error ?? "failed") : p.text;
      if (next.jsonMode && p.status === "done" && text) {
        text = formatMaybeJson(text);
      }
      if (assistant.content !== text) {
        next = updateAssistantByJob(next, p.planId, text);
        dirty = true;
      }
    }
    if (dirty) {
      setThread(next);
      setThreads(listThreads(roomId));
    }
  }, [snapshot.pipelines, roomId]);

  // Task-based jobs (local / vision models) stream via snapshot.tasks + streams.
  useEffect(() => {
    const current = threadRef.current;
    if (!current) return;
    let next = current;
    let dirty = false;
    for (const task of snapshot.tasks) {
      if (task.requester !== snapshot.selfId) continue;
      const assistant = next.messages.find(
        (m) => m.role === "assistant" && m.jobId === task.id,
      );
      if (!assistant) continue;
      const stream = snapshot.streams[task.id] ?? "";
      let text = stream;
      if (task.status === "error") text = task.error ?? "failed";
      else if (task.status === "done") text = task.result ?? stream;
      if (next.jsonMode && task.status === "done" && text) {
        text = formatMaybeJson(text);
      }
      if (assistant.content !== text) {
        next = updateAssistantByJob(next, task.id, text);
        dirty = true;
      }
    }
    if (dirty) {
      setThread(next);
      setThreads(listThreads(roomId));
    }
  }, [snapshot.tasks, snapshot.streams, snapshot.selfId, roomId]);

  const canHost = !!snapshot.caps?.webgpu;
  const provisionedRef = useRef<string>("");
  useEffect(() => {
    if (isCustom || !model?.hfRepo || !canHost) return;
    const key = `${model.id}:${model.hfRepo}`;
    if (provisionedRef.current === key) return;
    provisionedRef.current = key;
    void node.provision(model.id, model.hfRepo);
  }, [isCustom, model, node, canHost]);

  function refreshThreads(next?: ChatThread) {
    if (next) setThread(next);
    setThreads(listThreads(roomId));
  }

  function patchThread(patch: Partial<ChatThread>) {
    if (!thread) return;
    const next = { ...thread, ...patch, updatedAt: Date.now() };
    saveThread(next);
    refreshThreads(next);
  }

  function loadCustom() {
    const repo = customRepo.trim();
    if (!repo) return;
    provisionedRef.current = `custom:${repo}`;
    void node.provisionRepo(repo);
  }

  function applyPreset(presetId: string) {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset || !thread) return;
    patchThread({
      presetId,
      sampler: mergeSampler(DEFAULT_SAMPLER, {
        ...thread.sampler,
        ...preset.sampler,
      }),
      jsonMode: presetId === "json-agent" ? true : thread.jsonMode,
    });
  }

  async function submit(forcedText?: string) {
    if (!thread || submitting) return;
    const text = (forcedText ?? prompt).trim();
    if (!text) return;

    if (text.startsWith("/")) {
      handleSlash(text);
      setPrompt("");
      return;
    }

    setSubmitting(true);
    try {
      if (isCustom) {
        const repo = customRepo.trim();
        if (!repo) return;
        if (provisionedRef.current !== `custom:${repo}`) loadCustom();
      } else if (model?.hfRepo) {
        void node.provision(model.id, model.hfRepo);
      }

      const ragContext =
        ragEnabled && !isCustom
          ? await retrieveContext(roomId, text)
          : undefined;
      const messages = buildRunMessages(thread, text, {
        image: attachImage ?? undefined,
        ragContext,
      });

      let jobId: string | null = null;
      if (isCustom) {
        jobId = null;
      } else if (model && isShardedModel(model)) {
        jobId = node.runPrompt(messages, {
          temperature: thread.sampler.temperature,
          topP: thread.sampler.topP,
          topK: thread.sampler.topK,
          maxTokens: thread.sampler.maxTokens,
          seed: thread.sampler.seed,
          stopSequences: thread.sampler.stopSequences,
          repetitionPenalty: thread.sampler.repetitionPenalty,
          jsonMode: thread.jsonMode,
        });
      } else if (model) {
        jobId = node.submit(model.id, messages) || null;
      }
      if (!jobId) return;

      let next = appendMessage(thread, {
        role: "user",
        content: text,
        image: attachImage ?? undefined,
      });
      next = appendMessage(next, { role: "assistant", content: "", jobId });
      next = {
        ...next,
        modelId: isCustom ? customRepo.trim() : effectiveModelId,
      };
      saveThread(next);
      refreshThreads(next);
      setPrompt("");
      setAttachImage(null);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSlash(text: string) {
    const [cmd, ...rest] = text.slice(1).trim().split(/\s+/);
    const arg = rest.join(" ").trim();
    switch (cmd.toLowerCase()) {
      case "clear":
        refreshThreads(clearThreadMessages(thread!));
        break;
      case "stop":
        node.stopCurrentJob();
        break;
      case "model": {
        const id = arg || gridModels[0]?.id;
        if (!id) break;
        if (id === CUSTOM || getModel(id)) {
          setModelId(id);
          patchThread({ modelId: id });
          provisionedRef.current = "";
        }
        break;
      }
      default:
        break;
    }
  }

  function regenerateFrom(userText: string, image?: string) {
    if (!thread) return;
    void (async () => {
      const ragContext =
        ragEnabled ? await retrieveContext(roomId, userText) : undefined;
      const messages = buildRunMessages(thread, userText, {
        image,
        ragContext,
      });
      const m = getModel(effectiveModelId);
      let jobId: string | null = null;
      if (m && isShardedModel(m)) {
        jobId = node.runPrompt(messages, {
          temperature: thread.sampler.temperature,
          topP: thread.sampler.topP,
          topK: thread.sampler.topK,
          maxTokens: thread.sampler.maxTokens,
          seed: thread.sampler.seed,
          stopSequences: thread.sampler.stopSequences,
          repetitionPenalty: thread.sampler.repetitionPenalty,
          jsonMode: thread.jsonMode,
        });
      } else if (m) {
        jobId = node.submit(m.id, messages) || null;
      }
      if (!jobId) return;
      let next = appendMessage(thread, { role: "user", content: userText, image });
      next = appendMessage(next, { role: "assistant", content: "", jobId });
      saveThread(next);
      refreshThreads(next);
    })();
  }

  function startEdit(messageId: string, content: string) {
    setEditingId(messageId);
    setEditDraft(content);
  }

  function commitEdit(messageId: string) {
    if (!thread) return;
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    const { thread: trimmedThread } = truncateBeforeMessage(thread, messageId);
    setEditingId(null);
    setEditDraft("");
    refreshThreads(trimmedThread);
    regenerateFrom(trimmed);
  }

  const canSend =
    !!prompt.trim() && !!thread && (!isCustom || !!customRepo.trim());

  function onExport(id: string, format: "json" | "md" | "html") {
    const t = threads.find((x) => x.id === id);
    if (!t) return;
    const base = t.title.replace(/[^\w\-]+/g, "_").slice(0, 40) || "thread";
    if (format === "json")
      downloadText(`${base}.json`, exportThreadJson(t), "application/json");
    else if (format === "md")
      downloadText(`${base}.md`, exportThreadMarkdown(t), "text/markdown");
    else downloadText(`${base}.html`, exportThreadHtml(t), "text/html");
  }

  return (
    <div className="grid h-full gap-4 lg:grid-cols-[220px_1fr]">
      <div className="flex min-h-[240px] flex-col gap-2">
        <ThreadSidebar
          threads={threads}
          activeId={thread?.id ?? null}
          showArchived={showArchived}
          onSelect={(id) => {
            const t = threads.find((x) => x.id === id);
            if (!t) return;
            setActiveThreadId(roomId, id);
            setThread(t);
            if (t.modelId && getModel(t.modelId)) setModelId(t.modelId);
          }}
          onCreate={() => refreshThreads(createThread(roomId))}
          onRename={(id, title) => {
            const t = threads.find((x) => x.id === id);
            if (!t) return;
            const next = { ...t, title, updatedAt: Date.now() };
            saveThread(next);
            refreshThreads(thread?.id === id ? next : (thread ?? undefined));
          }}
          onTogglePin={(id) => {
            const t = threads.find((x) => x.id === id);
            if (!t) return;
            const next = { ...t, pinned: !t.pinned, updatedAt: Date.now() };
            saveThread(next);
            refreshThreads(thread?.id === id ? next : (thread ?? undefined));
          }}
          onToggleArchive={(id) => {
            const t = threads.find((x) => x.id === id);
            if (!t) return;
            const next = { ...t, archived: !t.archived, updatedAt: Date.now() };
            saveThread(next);
            if (thread?.id === id && next.archived) {
              refreshThreads(ensureActiveThread(roomId));
            } else {
              refreshThreads(thread?.id === id ? next : (thread ?? undefined));
            }
          }}
          onExport={onExport}
        />
        <button
          type="button"
          className="text-left text-[11px] text-ink-subtle hover:text-ink-muted"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? "Hide archived" : "Show archived"}
        </button>
      </div>

      <Card className="flex h-full flex-col">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Inference console</CardTitle>
          <Badge tone={webgpuPeers >= 1 ? "positive" : "warning"} dot>
            {webgpuPeers >= 1
              ? `${webgpuPeers} compute ${webgpuPeers === 1 ? "node" : "nodes"}`
              : "needs a compute node"}
          </Badge>
        </CardHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              value={effectiveModelId}
              onChange={(e) => {
                setModelId(e.target.value);
                onManualModelChange?.();
                patchThread({ modelId: e.target.value });
              }}
              className="h-10 rounded-xl border border-border bg-canvas px-3 text-sm text-ink outline-none focus:border-accent"
            >
              {gridModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
              <option value={CUSTOM}>Custom HF repo…</option>
            </select>
            {isCustom && (
              <>
                <input
                  type="text"
                  value={customRepo}
                  onChange={(e) => setCustomRepo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadCustom()}
                  placeholder="org/model-id (e.g. Qwen/Qwen2.5-1.5B-Instruct)"
                  className="h-10 min-w-[16rem] flex-1 rounded-xl border border-border bg-canvas px-3 text-sm text-ink outline-none focus:border-accent"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={loadCustom}
                  disabled={!customRepo.trim()}
                >
                  Load
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={thread?.presetId ?? "default"}
              onChange={(e) => applyPreset(e.target.value)}
              className="h-9 rounded-xl border border-border bg-canvas px-3 text-sm text-ink outline-none focus:border-accent"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.builtin ? "" : " (custom)"}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setShowSampler((v) => !v)}
            >
              {showSampler ? "Hide sampler" : "Sampler"}
            </Button>
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={!!thread?.jsonMode}
                onChange={(e) => patchThread({ jsonMode: e.target.checked })}
              />
              JSON mode
            </label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                if (!thread) return;
                const name = window.prompt("Preset name", "My preset");
                if (!name?.trim()) return;
                const id = `custom_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
                saveCustomPreset({
                  id,
                  name: name.trim(),
                  systemPrompt:
                    presets.find((p) => p.id === thread.presetId)
                      ?.systemPrompt ?? "",
                  sampler: thread.sampler,
                });
                setPresets(listPresets());
                patchThread({ presetId: id });
              }}
            >
              Save preset
            </Button>
            {thread?.presetId &&
              !presets.find((p) => p.id === thread.presetId)?.builtin && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!thread?.presetId) return;
                    deleteCustomPreset(thread.presetId);
                    setPresets(listPresets());
                    applyPreset("default");
                  }}
                >
                  Delete preset
                </Button>
              )}
          </div>

          {thread?.jsonMode && (
            <textarea
              value={thread.jsonSchema}
              onChange={(e) => patchThread({ jsonSchema: e.target.value })}
              rows={3}
              placeholder='Optional JSON Schema, e.g. {"type":"object","properties":{"answer":{"type":"string"}}}'
              className="w-full resize-y rounded-xl border border-border bg-canvas px-3 py-2 font-mono text-xs text-ink outline-none focus:border-accent"
            />
          )}

          {thread && (
            <SamplerPanel
              open={showSampler}
              value={thread.sampler}
              onChange={(sampler: SamplerSettings) => patchThread({ sampler })}
            />
          )}

          {(isVisionModel(model) || attachImage) && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === "string") {
                        setAttachImage(reader.result);
                      }
                    };
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex h-9 items-center rounded-xl border border-border bg-canvas px-3 text-xs text-ink hover:border-accent">
                  Attach image
                </span>
              </label>
              {attachImage && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview */}
                  <img
                    src={attachImage}
                    alt="Attached"
                    className="h-12 w-12 rounded-lg border border-border object-cover"
                  />
                  <button
                    type="button"
                    className="text-xs text-ink-subtle hover:text-danger"
                    onClick={() => setAttachImage(null)}
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
              }}
              rows={2}
              placeholder={
                isVisionModel(model)
                  ? "Ask about the image… (attach above · ⌘/Ctrl+Enter)"
                  : "Ask the grid… (⌘/Ctrl+Enter · /model /clear /stop)"
              }
              className="flex-1 resize-none rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
            <Button onClick={() => void submit()} disabled={!canSend || submitting}>
              {submitting ? "…" : "Send"}
            </Button>
          </div>
        </div>

        <div className="scroll-thin mt-5 flex-1 space-y-4 overflow-y-auto pr-1">
          {thread && thread.messages.length > 0 ? (
            thread.messages.map((m) => {
              if (m.role === "system") return null;
              const pipe = snapshot.pipelines.find((p) => p.planId === m.jobId);
              const task = snapshot.tasks.find((t) => t.id === m.jobId);
              const streaming =
                m.role === "assistant" &&
                ((!!pipe &&
                  (pipe.status === "running" || pipe.status === "queued")) ||
                  (!!task &&
                    (task.status === "running" ||
                      task.status === "claimed" ||
                      task.status === "open")));
              const display =
                m.role === "assistant" && thread.jsonMode && !streaming
                  ? formatMaybeJson(m.content)
                  : m.content;
              return (
                <div
                  key={m.id}
                  className={
                    m.role === "user"
                      ? "ml-8 rounded-xl border border-border bg-surface p-4"
                      : "mr-4 animate-fade-in rounded-xl border border-accent/40 bg-surface-sunken p-4"
                  }
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                      {m.role}
                    </span>
                    <div className="flex items-center gap-2">
                      {m.role === "user" && (
                        <button
                          type="button"
                          className="text-[11px] text-ink-subtle hover:text-ink"
                          onClick={() => startEdit(m.id, m.content)}
                        >
                          Edit
                        </button>
                      )}
                      {m.role === "assistant" && (
                        <button
                          type="button"
                          className="text-[11px] text-ink-subtle hover:text-ink"
                          onClick={() => {
                            const { thread: trimmed, userText, userImage } =
                              truncateBeforeMessage(thread!, m.id);
                            if (!userText) return;
                            refreshThreads(trimmed);
                            regenerateFrom(userText, userImage);
                          }}
                        >
                          Regenerate
                        </button>
                      )}
                      {pipe?.tokensPerSec != null && (
                        <span className="text-[11px] tabular-nums text-ink-subtle">
                          {pipe.tokensPerSec.toFixed(1)} tok/s
                        </span>
                      )}
                    </div>
                  </div>
                  {m.role === "user" && editingId === m.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => commitEdit(m.id)}>
                          Save & rerun
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : m.role === "assistant" ? (
                    display || streaming ? (
                      <MarkdownMessage text={display} streaming={streaming} />
                    ) : (
                      <span className="animate-pulse-soft text-sm text-ink-subtle">
                        waiting for tokens…
                      </span>
                    )
                  ) : (
                    <>
                      {m.image && (
                        // eslint-disable-next-line @next/next/no-img-element -- chat data URL
                        <img
                          src={m.image}
                          alt=""
                          className="mb-2 max-h-40 rounded-lg border border-border object-contain"
                        />
                      )}
                      <p className="whitespace-pre-wrap text-sm text-ink">
                        {m.content}
                      </p>
                    </>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-ink-subtle">
              {provisioned
                ? "Model ready. Send a prompt to run it on the grid."
                : "Pick a model to load it on the grid, then send a prompt."}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
