import { listConsoleModels } from "@/lib/models/console-models";

export interface OpenAiModel {
  id: string;
  object: "model";
  owned_by: string;
}

export function listGatewayModels(): OpenAiModel[] {
  const ids = new Set<string>();
  const out: OpenAiModel[] = [];
  for (const m of listConsoleModels()) {
    if (ids.has(m.id)) continue;
    ids.add(m.id);
    out.push({ id: m.id, object: "model", owned_by: "teamthink" });
  }
  return out;
}

export interface ChatCompletionRequest {
  model: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: {
    index: number;
    message: { role: "assistant"; content: string };
    finish_reason: "stop";
  }[];
}

export interface EmbeddingsRequest {
  model: string;
  input: string | string[];
}

export interface EmbeddingsResponse {
  object: "list";
  data: { object: "embedding"; index: number; embedding: number[] }[];
  model: string;
}
