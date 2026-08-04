import type { ChatMessage } from "@/lib/engine/types";

/** Generation / sampler knobs shared by presets and the control panel. */
export interface SamplerSettings {
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  repetitionPenalty: number;
  presencePenalty: number;
  frequencyPenalty: number;
  seed: number | null;
  stopSequences: string[];
}

export const DEFAULT_SAMPLER: SamplerSettings = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxTokens: 256,
  repetitionPenalty: 1.1,
  presencePenalty: 0,
  frequencyPenalty: 0,
  seed: null,
  stopSequences: [],
};

export interface PromptPreset {
  id: string;
  name: string;
  systemPrompt: string;
  sampler: Partial<SamplerSettings>;
  /** Built-in presets cannot be deleted. */
  builtin?: boolean;
}

export interface ThreadMessage extends ChatMessage {
  id: string;
  createdAt: number;
  /** Pipeline / task job id when this assistant turn was produced by the grid. */
  jobId?: string;
}

export interface ChatThread {
  id: string;
  roomId: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  messages: ThreadMessage[];
  presetId: string | null;
  sampler: SamplerSettings;
  jsonMode: boolean;
  jsonSchema: string;
  modelId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface RunOptions {
  sampler: SamplerSettings;
  jsonMode: boolean;
  jsonSchema: string;
}
