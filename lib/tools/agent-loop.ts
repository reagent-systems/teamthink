import type { ChatMessage } from "@/lib/engine/types";
import type { GridNode } from "@/lib/grid/scheduler";
import { getModel } from "@/lib/config";
import { isShardedModel } from "@/lib/models/console-models";
import {
  BUILTIN_TOOLS,
  parseToolCalls,
  runTool,
  toolsSystemPrompt,
} from "@/lib/tools/builtin";
import type { ToolContext, ToolDefinition } from "@/lib/tools/types";
import { AGENT_MODE_PROMPT, WEB_TOOLS } from "@/lib/tools/web";
import { waitForJobText } from "@/lib/grid/prompt-dispatch";

export interface AgentLoopOptions {
  webToolsEnabled?: boolean;
  agentMode?: boolean;
}

export interface AgentSampler {
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  seed: number | null;
  stopSequences: string[];
  repetitionPenalty: number;
  jsonMode: boolean;
}

export interface AgentRunResult {
  jobId: string;
  text: string;
  toolRounds: number;
}

const DEFAULT_MAX_ROUNDS = 4;
const AGENT_MAX_ROUNDS = 8;

function dispatchJob(
  node: GridNode,
  modelId: string,
  messages: ChatMessage[],
  sampler: AgentSampler,
): string | null {
  const model = getModel(modelId);
  if (!model) return null;
  if (isShardedModel(model)) {
    return node.runPrompt(messages, sampler);
  }
  return node.submit(model.id, messages) || null;
}

/** Run inference with optional tool-call rounds; returns final job id and text. */
export async function runAgentLoop(
  node: GridNode,
  modelId: string,
  baseMessages: ChatMessage[],
  sampler: AgentSampler,
  toolsEnabled: boolean,
  toolCtx: ToolContext,
  extraTools: ToolDefinition[] = [],
  opts: AgentLoopOptions = {},
): Promise<AgentRunResult | null> {
  const maxRounds =
    opts.agentMode || opts.webToolsEnabled ? AGENT_MAX_ROUNDS : DEFAULT_MAX_ROUNDS;
  const webTools = opts.webToolsEnabled ? WEB_TOOLS : [];
  const allTools = [...BUILTIN_TOOLS, ...webTools, ...extraTools];
  let messages = [...baseMessages];
  if (toolsEnabled) {
    const systemIdx = messages.findIndex((m) => m.role === "system");
    const parts = [toolsSystemPrompt(allTools)];
    if (opts.agentMode) parts.unshift(AGENT_MODE_PROMPT);
    const toolsBlock = parts.join("\n\n");
    if (systemIdx >= 0) {
      messages = messages.map((m, i) =>
        i === systemIdx
          ? { ...m, content: `${m.content}\n\n${toolsBlock}` }
          : m,
      );
    } else {
      messages = [{ role: "system", content: toolsBlock }, ...messages];
    }
  }

  let jobId: string | null = null;
  let text = "";
  let toolRounds = 0;

  for (let round = 0; round <= maxRounds; round++) {
    jobId = dispatchJob(node, modelId, messages, sampler);
    if (!jobId) return null;
    text = await waitForJobText(node, jobId);

    if (!toolsEnabled || round >= maxRounds) break;
    const calls = parseToolCalls(text);
    if (!calls?.length) break;

    toolRounds++;
    const results = await Promise.all(calls.map((c) => runTool(c, toolCtx)));
    const toolSummary = results
      .map((r) => `[${r.name}]\n${r.output}`)
      .join("\n\n");
    messages = [
      ...messages,
      { role: "assistant", content: text },
      {
        role: "user",
        content: `Tool results:\n${toolSummary}\n\nAnswer the user using these results. Cite sources as [1], [2], etc.`,
      },
    ];
  }

  return { jobId: jobId!, text, toolRounds };
}
