import type { PromptPreset } from "@/lib/chat/types";

export const BUILTIN_PRESETS: PromptPreset[] = [
  {
    id: "default",
    name: "Default",
    systemPrompt: "You are a helpful assistant running on a peer-to-peer WebGPU inference grid.",
    sampler: { temperature: 0.7, topP: 0.95, maxTokens: 256 },
    builtin: true,
  },
  {
    id: "concise",
    name: "Concise",
    systemPrompt:
      "You are a concise assistant. Answer in as few words as possible while remaining correct.",
    sampler: { temperature: 0.4, topP: 0.9, maxTokens: 128 },
    builtin: true,
  },
  {
    id: "coder",
    name: "Coder",
    systemPrompt:
      "You are an expert software engineer. Prefer correct, idiomatic code with brief explanations. Use fenced code blocks with language tags.",
    sampler: { temperature: 0.2, topP: 0.9, maxTokens: 512, topK: 40 },
    builtin: true,
  },
  {
    id: "json-agent",
    name: "JSON agent",
    systemPrompt:
      "You are a structured-output agent. Always respond with a single valid JSON object and nothing else — no markdown fences, no commentary.",
    sampler: { temperature: 0.1, topP: 0.9, maxTokens: 256 },
    builtin: true,
  },
  {
    id: "teacher",
    name: "Teacher",
    systemPrompt:
      "You are a patient teacher. Explain concepts step by step with short examples. Ask a check-in question at the end when helpful.",
    sampler: { temperature: 0.6, topP: 0.95, maxTokens: 384 },
    builtin: true,
  },
];

export function getBuiltinPreset(id: string): PromptPreset | undefined {
  return BUILTIN_PRESETS.find((p) => p.id === id);
}
