import { DEFAULT_EMBEDDING_MODEL_ID } from "@/lib/config";
import { InferenceClient } from "@/lib/engine/worker-client";
import type { ChatMessage } from "@/lib/engine/types";
import {
  dispatchPrompt,
  waitForJobText,
} from "@/lib/grid/prompt-dispatch";
import type { GridNode } from "@/lib/grid/scheduler";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingsRequest,
  EmbeddingsResponse,
} from "@/lib/gateway/openai-types";
import { listGatewayModels } from "@/lib/gateway/openai-types";
import {
  anthropicToChatMessages,
  chatToAnthropicResponse,
  type MessagesRequest,
} from "@/lib/gateway/anthropic-types";

const DEFAULT_SAMPLER = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxTokens: 512,
  seed: null as number | null,
  stopSequences: [] as string[],
  repetitionPenalty: 1.1,
  jsonMode: false,
};

let embedClient: InferenceClient | null = null;

function embedEngine(): InferenceClient {
  embedClient ??= new InferenceClient();
  return embedClient;
}

export function handleModelsList(): { object: "list"; data: ReturnType<typeof listGatewayModels> } {
  return { object: "list", data: listGatewayModels() };
}

export async function handleChatCompletion(
  node: GridNode,
  body: ChatCompletionRequest,
): Promise<ChatCompletionResponse> {
  if (body.stream) {
    throw new Error("streaming not supported yet");
  }
  const messages: ChatMessage[] = body.messages.map((m) => ({
    role: m.role as ChatMessage["role"],
    content: m.content,
  }));
  const sampler = {
    ...DEFAULT_SAMPLER,
    temperature: body.temperature ?? DEFAULT_SAMPLER.temperature,
    maxTokens: body.max_tokens ?? DEFAULT_SAMPLER.maxTokens,
  };
  const jobId = dispatchPrompt(node, body.model, messages, sampler);
  if (!jobId) throw new Error("model not available or not loaded");
  const text = await waitForJobText(node, jobId);
  return {
    id: `chatcmpl_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: body.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      },
    ],
  };
}

export async function handleEmbeddings(
  body: EmbeddingsRequest,
): Promise<EmbeddingsResponse> {
  const modelId = body.model || DEFAULT_EMBEDDING_MODEL_ID;
  const inputs = Array.isArray(body.input) ? body.input : [body.input];
  const vectors = await embedEngine().embed(modelId, inputs);
  return {
    object: "list",
    model: modelId,
    data: vectors.map((embedding, index) => ({
      object: "embedding" as const,
      index,
      embedding,
    })),
  };
}

export async function handleAnthropicMessages(
  node: GridNode,
  body: MessagesRequest,
) {
  const chatReq: ChatCompletionRequest = {
    model: body.model,
    messages: anthropicToChatMessages(body),
    max_tokens: body.max_tokens,
    temperature: body.temperature,
  };
  const chat = await handleChatCompletion(node, chatReq);
  const text = chat.choices[0]?.message?.content ?? "";
  return chatToAnthropicResponse(
    body.model,
    body.messages,
    body.system,
    text,
  );
}
