import type { ChatMessage } from "@/lib/engine/types";
import type { GridNode } from "@/lib/grid/scheduler";
import { getModel } from "@/lib/config";
import { isShardedModel } from "@/lib/models/console-models";

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Poll grid snapshot until a pipeline or task job finishes. */
export async function waitForJobText(
  node: GridNode,
  jobId: string,
  timeoutMs = 120_000,
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = node.getSnapshot();
    const pipe = snap.pipelines.find((p) => p.planId === jobId);
    if (pipe?.status === "done") return pipe.text;
    if (pipe?.status === "error") throw new Error(pipe.error ?? "job failed");
    const task = snap.tasks.find((t) => t.id === jobId);
    if (task?.status === "done") return task.result ?? snap.streams[jobId] ?? "";
    if (task?.status === "error") throw new Error(task.error ?? "task failed");
    await sleep(250);
  }
  throw new Error("job timed out");
}

export function dispatchPrompt(
  node: GridNode,
  modelId: string,
  messages: ChatMessage[],
  sampler: {
    temperature: number;
    topP: number;
    topK: number;
    maxTokens: number;
    seed: number | null;
    stopSequences: string[];
    repetitionPenalty: number;
    jsonMode: boolean;
  },
): string | null {
  const model = getModel(modelId);
  if (!model) return null;
  if (isShardedModel(model)) {
    return node.runPrompt(messages, sampler);
  }
  return node.submit(model.id, messages) || null;
}

