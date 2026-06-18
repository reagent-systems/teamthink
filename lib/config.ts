/**
 * Central configuration for the TeamThink grid: ICE servers, signaling TTLs,
 * heartbeat cadence, and the model registry shared across engines.
 */

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Optional public TURN fallback for restrictive NATs. Replace with your own
  // credentials for production reliability.
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [
        {
          urls: process.env.NEXT_PUBLIC_TURN_URL,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME,
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
        } as RTCIceServer,
      ]
    : []),
];

/** Signaling mailbox and room registry time-to-live (seconds). */
export const ROOM_TTL_SECONDS = 60 * 60 * 6; // 6 hours
export const SIGNAL_TTL_SECONDS = 60 * 2; // signaling messages are short-lived

/** Presence heartbeat cadence and the staleness window for re-claiming work. */
export const HEARTBEAT_INTERVAL_MS = 4000;
export const PEER_STALE_MS = 15000;
export const TASK_STALE_MS = 30000;

/** Signaling poll cadence (used when Upstash SSE is unavailable). */
export const SIGNAL_POLL_INTERVAL_MS = 1500;

export type EngineKind = "webllm" | "transformers";

export type ModelModality = "text" | "vision" | "embedding";

export interface ModelSpec {
  /** Stable id used in task routing and CRDT state. */
  id: string;
  /** Human label shown in the UI. */
  label: string;
  engine: EngineKind;
  modality: ModelModality;
  /** Underlying model identifier passed to the engine. */
  modelId: string;
  /** Rough VRAM requirement (MB) used for capability scoring. */
  vramMb: number;
}

/**
 * The model registry. WebLLM ids must match MLC's prebuilt model list; the
 * Transformers.js entries use Hugging Face repo ids with ONNX weights.
 */
export const MODELS: ModelSpec[] = [
  {
    id: "llama-3.2-1b",
    label: "Llama 3.2 1B Instruct",
    engine: "webllm",
    modality: "text",
    modelId: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
    vramMb: 1100,
  },
  {
    id: "llama-3.2-3b",
    label: "Llama 3.2 3B Instruct",
    engine: "webllm",
    modality: "text",
    modelId: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    vramMb: 2300,
  },
  {
    id: "qwen2.5-0.5b",
    label: "Qwen2.5 0.5B Instruct",
    engine: "webllm",
    modality: "text",
    modelId: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    vramMb: 950,
  },
  {
    id: "phi-3.5-mini",
    label: "Phi 3.5 Mini Instruct",
    engine: "webllm",
    modality: "text",
    modelId: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    vramMb: 3700,
  },
  {
    id: "smolvlm-256m",
    label: "SmolVLM 256M (vision)",
    engine: "transformers",
    modality: "vision",
    modelId: "HuggingFaceTB/SmolVLM-256M-Instruct",
    vramMb: 900,
  },
];

export function getModel(id: string): ModelSpec | undefined {
  return MODELS.find((m) => m.id === id);
}

export const DEFAULT_MODEL_ID = "llama-3.2-1b";
