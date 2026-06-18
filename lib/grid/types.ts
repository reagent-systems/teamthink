import type { ChatMessage } from "@/lib/engine/types";
import type { DeviceCapabilities } from "@/lib/grid/capabilities";

export type TaskStatus =
  | "open"
  | "claimed"
  | "running"
  | "done"
  | "error";

/** A unit of inference work, replicated across peers via the CRDT. */
export interface TaskRecord {
  id: string;
  requester: string;
  modelId: string;
  messages: ChatMessage[];
  status: TaskStatus;
  claimedBy?: string;
  claimedAt?: number;
  result?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/** Gossiped presence/capability heartbeat for a peer. */
export interface PeerPresence {
  peerId: string;
  caps: DeviceCapabilities;
  loadedModels: string[];
  activeJobs: number;
  /** Last heartbeat timestamp (ms). */
  ts: number;
  /** Whether this is the local node. */
  self?: boolean;
}

export interface GridSnapshot {
  selfId: string;
  caps: DeviceCapabilities | null;
  peers: PeerPresence[];
  tasks: TaskRecord[];
  /** Streaming partial output keyed by task id. */
  streams: Record<string, string>;
  connected: boolean;
  activeModelId: string | null;
  modelLoad: { progress: number; text: string } | null;
}
