import { BUILTIN_PRESETS } from "@/lib/chat/presets";
import {
  DEFAULT_SAMPLER,
  type ChatThread,
  type PromptPreset,
  type SamplerSettings,
  type ThreadMessage,
} from "@/lib/chat/types";
import type { ChatMessage } from "@/lib/engine/types";

const THREADS_KEY = "teamthink.threads.v1";
const PRESETS_KEY = "teamthink.presets.v1";
const ACTIVE_KEY = "teamthink.activeThread.v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!canUseStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function listThreads(roomId: string): ChatThread[] {
  const all = readJson<ChatThread[]>(THREADS_KEY, []);
  return all
    .filter((t) => t.roomId === roomId)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
}

export function saveThread(thread: ChatThread): void {
  const all = readJson<ChatThread[]>(THREADS_KEY, []);
  const idx = all.findIndex((t) => t.id === thread.id);
  if (idx >= 0) all[idx] = thread;
  else all.push(thread);
  writeJson(THREADS_KEY, all);
}

export function deleteThread(threadId: string): void {
  const all = readJson<ChatThread[]>(THREADS_KEY, []);
  writeJson(
    THREADS_KEY,
    all.filter((t) => t.id !== threadId),
  );
}

export function getActiveThreadId(roomId: string): string | null {
  const map = readJson<Record<string, string>>(ACTIVE_KEY, {});
  return map[roomId] ?? null;
}

export function setActiveThreadId(roomId: string, threadId: string): void {
  const map = readJson<Record<string, string>>(ACTIVE_KEY, {});
  map[roomId] = threadId;
  writeJson(ACTIVE_KEY, map);
}

export function createThread(
  roomId: string,
  partial?: Partial<ChatThread>,
): ChatThread {
  const now = Date.now();
  const thread: ChatThread = {
    id: `th_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    roomId,
    title: "New chat",
    pinned: false,
    archived: false,
    messages: [],
    presetId: "default",
    sampler: { ...DEFAULT_SAMPLER },
    jsonMode: false,
    jsonSchema: "",
    modelId: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
  saveThread(thread);
  setActiveThreadId(roomId, thread.id);
  return thread;
}

export function ensureActiveThread(roomId: string): ChatThread {
  const threads = listThreads(roomId).filter((t) => !t.archived);
  const activeId = getActiveThreadId(roomId);
  const existing = threads.find((t) => t.id === activeId) ?? threads[0];
  if (existing) {
    setActiveThreadId(roomId, existing.id);
    return existing;
  }
  return createThread(roomId);
}

export function appendMessage(
  thread: ChatThread,
  message: Omit<ThreadMessage, "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
  },
): ChatThread {
  const next: ChatThread = {
    ...thread,
    messages: [
      ...thread.messages,
      {
        id: message.id ?? `m_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
        createdAt: message.createdAt ?? Date.now(),
        role: message.role,
        content: message.content,
        image: message.image,
        jobId: message.jobId,
      },
    ],
    updatedAt: Date.now(),
  };
  if (thread.title === "New chat" && message.role === "user") {
    next.title = message.content.trim().slice(0, 48) || "New chat";
  }
  saveThread(next);
  return next;
}

export function updateAssistantByJob(
  thread: ChatThread,
  jobId: string,
  content: string,
): ChatThread {
  const messages = thread.messages.map((m) =>
    m.jobId === jobId && m.role === "assistant" ? { ...m, content } : m,
  );
  const next = { ...thread, messages, updatedAt: Date.now() };
  saveThread(next);
  return next;
}

export function listPresets(): PromptPreset[] {
  const custom = readJson<PromptPreset[]>(PRESETS_KEY, []);
  const byId = new Map<string, PromptPreset>();
  for (const p of BUILTIN_PRESETS) byId.set(p.id, p);
  for (const p of custom) byId.set(p.id, { ...p, builtin: false });
  return [...byId.values()];
}

export function saveCustomPreset(preset: PromptPreset): void {
  const custom = readJson<PromptPreset[]>(PRESETS_KEY, []).filter(
    (p) => p.id !== preset.id,
  );
  custom.push({ ...preset, builtin: false });
  writeJson(PRESETS_KEY, custom);
}

export function deleteCustomPreset(id: string): void {
  const custom = readJson<PromptPreset[]>(PRESETS_KEY, []).filter(
    (p) => p.id !== id,
  );
  writeJson(PRESETS_KEY, custom);
}

export function mergeSampler(
  base: SamplerSettings,
  patch: Partial<SamplerSettings>,
): SamplerSettings {
  return { ...base, ...patch };
}

/** Build the message list sent to the grid for a user turn. */
export function buildRunMessages(
  thread: ChatThread,
  userText: string,
  systemExtra?: string,
): ChatMessage[] {
  const parts: ChatMessage[] = [];
  const preset = listPresets().find((p) => p.id === thread.presetId);
  let system = preset?.systemPrompt?.trim() ?? "";
  if (thread.jsonMode) {
    const schema = thread.jsonSchema.trim();
    system = [
      system,
      "Respond with a single valid JSON value only. No markdown fences, no prose.",
      schema ? `Conform to this JSON Schema:\n${schema}` : "",
      systemExtra ?? "",
    ]
      .filter(Boolean)
      .join("\n\n");
  } else if (systemExtra) {
    system = [system, systemExtra].filter(Boolean).join("\n\n");
  }
  if (system) parts.push({ role: "system", content: system });
  for (const m of thread.messages) {
    if (m.role === "system") continue;
    parts.push({ role: m.role, content: m.content, image: m.image });
  }
  parts.push({ role: "user", content: userText });
  return parts;
}
