import * as Y from "yjs";
import {
  DEFAULT_MODEL_ID,
  getModel,
  HEARTBEAT_INTERVAL_MS,
  PEER_STALE_MS,
  TASK_STALE_MS,
} from "@/lib/config";
import type { ChatMessage, GenerateOptions } from "@/lib/engine/types";
import { InferenceClient } from "@/lib/engine/worker-client";
import {
  detectCapabilities,
  modelFits,
  type DeviceCapabilities,
} from "@/lib/grid/capabilities";
import type { GridSnapshot, PeerPresence, TaskRecord } from "@/lib/grid/types";
import { CHANNEL_APP, MeshClient } from "@/lib/mesh/peer";
import { MeshYjsProvider } from "@/lib/mesh/yjs-provider";
import { generatePeerId } from "@/lib/id";

const enc = new TextEncoder();
const dec = new TextDecoder();

type AppMessage =
  | { t: "presence"; p: PeerPresence }
  | { t: "token"; jobId: string; token: string }
  | { t: "stage"; jobId: string; stage: string; progress: number };

const MAX_CONCURRENT = 1;
/** Window to let CRDT claims converge before committing to run. */
const CLAIM_SETTLE_MS = 350;

/**
 * GridNode ties the mesh, CRDT, presence gossip, and inference worker together.
 * It implements decentralized task scheduling: capable peers locally project
 * who should claim each open task (no central scheduler), claim via the CRDT,
 * run inference, and stream tokens directly to the requester.
 */
export class GridNode {
  readonly peerId: string;
  private mesh: MeshClient;
  private doc = new Y.Doc();
  private provider: MeshYjsProvider;
  private tasks: Y.Map<TaskRecord>;
  private inference = new InferenceClient();

  private caps: DeviceCapabilities | null = null;
  private presence = new Map<string, PeerPresence>();
  private streams = new Map<string, string>();
  private loadedModels = new Set<string>();
  private activeJobs = 0;
  private activeModelId: string | null = null;
  private modelLoad: { progress: number; text: string } | null = null;
  private runningTasks = new Set<string>();

  private listeners = new Set<() => void>();
  private snapshot: GridSnapshot;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  constructor(readonly roomId: string) {
    this.peerId = generatePeerId();
    this.mesh = new MeshClient(roomId, this.peerId, {
      onPeerOpen: (peerId) => this.onPeerOpen(peerId),
      onPeerClose: () => this.recompute(),
      onPeersChange: () => this.recompute(),
    });
    this.provider = new MeshYjsProvider(this.mesh, this.doc);
    this.tasks = this.doc.getMap<TaskRecord>("tasks");
    this.snapshot = this.emptySnapshot();
    this.tasks.observeDeep(() => this.onTasksChanged());
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    this.caps = await detectCapabilities();

    // Load any persisted CRDT snapshot for late joiners / cold start.
    await this.loadSnapshot();

    this.mesh.on(CHANNEL_APP, (peerId, payload) =>
      this.onAppMessage(peerId, payload),
    );

    await this.mesh.start();

    this.updateSelfPresence();
    this.heartbeatTimer = setInterval(
      () => this.heartbeat(),
      HEARTBEAT_INTERVAL_MS,
    );
    this.watchdogTimer = setInterval(() => this.watchdog(), 5000);
    this.recompute();
  }

  stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.provider.destroy();
    this.mesh.stop();
    this.inference.terminate();
  }

  // --- public API for the UI ------------------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): GridSnapshot {
    return this.snapshot;
  }

  /** Submit an inference request to the grid. Returns the task id. */
  submit(modelId: string, messages: ChatMessage[]): string {
    const id = `t_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const now = Date.now();
    const task: TaskRecord = {
      id,
      requester: this.peerId,
      modelId,
      messages,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(id, task);
    this.streams.set(id, "");
    this.recompute();
    return id;
  }

  /** Preload a model so this device advertises itself as a provider for it. */
  async setActiveModel(modelId: string): Promise<void> {
    if (!this.caps?.webgpu) return;
    const model = getModel(modelId);
    if (!model || !modelFits(model, this.caps.memoryEstimateMb)) return;
    this.activeModelId = modelId;
    this.modelLoad = { progress: 0, text: "starting" };
    this.recompute();
    try {
      await this.inference.load(modelId, (progress, text) => {
        this.modelLoad = { progress, text };
        this.recompute();
      });
      this.loadedModels.add(modelId);
      this.modelLoad = null;
      this.updateSelfPresence();
    } catch (err) {
      this.modelLoad = {
        progress: 0,
        text: err instanceof Error ? err.message : "load failed",
      };
    }
    this.recompute();
  }

  // --- presence / heartbeat -------------------------------------------------

  private updateSelfPresence(): void {
    if (!this.caps) return;
    const self: PeerPresence = {
      peerId: this.peerId,
      caps: this.caps,
      loadedModels: [...this.loadedModels],
      activeJobs: this.activeJobs,
      ts: Date.now(),
      self: true,
    };
    this.presence.set(this.peerId, self);
    this.recompute();
  }

  private heartbeat(): void {
    this.updateSelfPresence();
    const self = this.presence.get(this.peerId);
    if (self) this.broadcastApp({ t: "presence", p: { ...self, self: false } });
    this.prunePresence();
  }

  private prunePresence(): void {
    const cutoff = Date.now() - PEER_STALE_MS;
    let changed = false;
    for (const [id, p] of this.presence) {
      if (!p.self && p.ts < cutoff) {
        this.presence.delete(id);
        changed = true;
      }
    }
    if (changed) this.recompute();
  }

  private onPeerOpen(peerId: string): void {
    // Sync CRDT state and announce ourselves to the new peer.
    this.provider.syncWithPeer(peerId);
    const self = this.presence.get(this.peerId);
    if (self)
      this.mesh.sendTo(
        peerId,
        CHANNEL_APP,
        encodeApp({ t: "presence", p: { ...self, self: false } }),
      );
    this.recompute();
  }

  private onAppMessage(peerId: string, payload: Uint8Array): void {
    let msg: AppMessage;
    try {
      msg = JSON.parse(dec.decode(payload)) as AppMessage;
    } catch {
      return;
    }
    if (msg.t === "presence") {
      this.presence.set(msg.p.peerId, { ...msg.p, self: false });
      this.recompute();
    } else if (msg.t === "token") {
      const prev = this.streams.get(msg.jobId) ?? "";
      this.streams.set(msg.jobId, prev + msg.token);
      this.recompute();
    } else if (msg.t === "stage") {
      this.recompute();
    }
  }

  // --- scheduling -----------------------------------------------------------

  private onTasksChanged(): void {
    this.recompute();
    void this.evaluateOpenTasks();
    this.maybePersistSnapshot();
  }

  /**
   * Local projection of who should claim each open task. Each node computes the
   * best candidate from its presence view and only claims when it wins.
   */
  private async evaluateOpenTasks(): Promise<void> {
    if (!this.caps?.webgpu) return;
    if (this.activeJobs >= MAX_CONCURRENT) return;

    for (const [id, task] of this.tasks.entries()) {
      if (task.status !== "open") continue;
      if (this.runningTasks.has(id)) continue;
      const winner = this.bestCandidate(task);
      if (winner === this.peerId) {
        await this.claimAndRun(id);
        if (this.activeJobs >= MAX_CONCURRENT) return;
      }
    }
  }

  /** Pick the best capable peer for a task, or null if none are capable. */
  private bestCandidate(task: TaskRecord): string | null {
    const model = getModel(task.modelId);
    if (!model) return null;
    let best: { id: string; score: number } | null = null;
    for (const p of this.presence.values()) {
      if (!p.caps.webgpu) continue;
      if (!modelFits(model, p.caps.memoryEstimateMb)) continue;
      if (p.activeJobs >= MAX_CONCURRENT) continue;
      const score = this.scoreCandidate(p, task);
      if (
        !best ||
        score > best.score ||
        (score === best.score && p.peerId < best.id)
      ) {
        best = { id: p.peerId, score };
      }
    }
    return best?.id ?? null;
  }

  private scoreCandidate(p: PeerPresence, task: TaskRecord): number {
    let score = 0;
    if (p.loadedModels.includes(task.modelId)) score += 1000;
    score += p.caps.memoryEstimateMb / 100;
    score -= p.activeJobs * 500;
    return score;
  }

  private async claimAndRun(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (!task || task.status !== "open") return;

    this.runningTasks.add(id);
    this.activeJobs += 1;
    this.updateSelfPresence();

    this.patchTask(id, {
      status: "claimed",
      claimedBy: this.peerId,
      claimedAt: Date.now(),
    });

    // Let concurrent claims converge, then verify we still hold the claim.
    await sleep(CLAIM_SETTLE_MS);
    const after = this.tasks.get(id);
    if (!after || after.claimedBy !== this.peerId) {
      this.runningTasks.delete(id);
      this.activeJobs = Math.max(0, this.activeJobs - 1);
      this.updateSelfPresence();
      return;
    }

    await this.runTask(after);
  }

  private async runTask(task: TaskRecord): Promise<void> {
    const id = task.id;
    try {
      this.patchTask(id, { status: "running" });

      this.activeModelId = task.modelId;
      if (!this.loadedModels.has(task.modelId)) {
        this.modelLoad = { progress: 0, text: "loading model" };
        this.recompute();
        await this.inference.load(task.modelId, (progress, text) => {
          this.modelLoad = { progress, text };
          this.sendToRequester(task, {
            t: "stage",
            jobId: id,
            stage: text,
            progress,
          });
          this.recompute();
        });
        this.loadedModels.add(task.modelId);
        this.modelLoad = null;
        this.updateSelfPresence();
      }

      const options: GenerateOptions = { maxTokens: 512, temperature: 0.7 };
      const text = await this.inference.generate(
        task.modelId,
        task.messages,
        options,
        (token) => {
          // Stream to the requester (or locally if we are the requester).
          if (task.requester === this.peerId) {
            const prev = this.streams.get(id) ?? "";
            this.streams.set(id, prev + token);
            this.recompute();
          } else {
            this.sendToRequester(task, { t: "token", jobId: id, token });
          }
        },
      );

      this.patchTask(id, { status: "done", result: text });
    } catch (err) {
      this.patchTask(id, {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.runningTasks.delete(id);
      this.activeJobs = Math.max(0, this.activeJobs - 1);
      this.updateSelfPresence();
      void this.evaluateOpenTasks();
    }
  }

  private sendToRequester(task: TaskRecord, msg: AppMessage): void {
    this.mesh.sendTo(task.requester, CHANNEL_APP, encodeApp(msg));
  }

  /** Revert tasks claimed by peers that have gone stale. */
  private watchdog(): void {
    const now = Date.now();
    for (const [id, task] of this.tasks.entries()) {
      if (task.status !== "claimed" && task.status !== "running") continue;
      if (task.claimedBy === this.peerId) continue;
      const claimer = task.claimedBy
        ? this.presence.get(task.claimedBy)
        : undefined;
      const claimerAlive = claimer && now - claimer.ts < PEER_STALE_MS;
      const stale = now - (task.updatedAt ?? 0) > TASK_STALE_MS;
      if (!claimerAlive && stale) {
        this.patchTask(id, {
          status: "open",
          claimedBy: undefined,
          claimedAt: undefined,
        });
      }
    }
  }

  private patchTask(id: string, patch: Partial<TaskRecord>): void {
    const current = this.tasks.get(id);
    if (!current) return;
    this.tasks.set(id, { ...current, ...patch, updatedAt: Date.now() });
  }

  // --- snapshot persistence (cold start for late joiners) -------------------

  private snapshotDebounce: ReturnType<typeof setTimeout> | null = null;
  private maybePersistSnapshot(): void {
    if (this.snapshotDebounce) clearTimeout(this.snapshotDebounce);
    this.snapshotDebounce = setTimeout(() => void this.persistSnapshot(), 2000);
  }

  private async persistSnapshot(): Promise<void> {
    try {
      const update = Y.encodeStateAsUpdate(this.doc);
      const b64 = bytesToBase64(update);
      await fetch("/api/signal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "snapshot:save",
          roomId: this.roomId,
          snapshot: b64,
        }),
      });
    } catch {
      // best-effort
    }
  }

  private async loadSnapshot(): Promise<void> {
    try {
      const res = await fetch("/api/signal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "snapshot:load",
          roomId: this.roomId,
        }),
      });
      const { snapshot } = (await res.json()) as { snapshot: string | null };
      if (snapshot) Y.applyUpdate(this.doc, base64ToBytes(snapshot));
    } catch {
      // best-effort
    }
  }

  // --- snapshot / notification ---------------------------------------------

  private broadcastApp(msg: AppMessage): void {
    this.mesh.broadcast(CHANNEL_APP, encodeApp(msg));
  }

  private recompute(): void {
    const tasks = [...this.tasks.values()].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    const streams: Record<string, string> = {};
    for (const [id, text] of this.streams) streams[id] = text;
    this.snapshot = {
      selfId: this.peerId,
      caps: this.caps,
      peers: [...this.presence.values()].sort((a, b) =>
        a.peerId === this.peerId ? -1 : b.peerId === this.peerId ? 1 : 0,
      ),
      tasks,
      streams,
      connected: this.mesh.connectedPeers.length > 0,
      activeModelId: this.activeModelId,
      modelLoad: this.modelLoad,
    };
    for (const l of this.listeners) l();
  }

  private emptySnapshot(): GridSnapshot {
    return {
      selfId: this.peerId,
      caps: null,
      peers: [],
      tasks: [],
      streams: {},
      connected: false,
      activeModelId: null,
      modelLoad: null,
    };
  }
}

function encodeApp(msg: AppMessage): Uint8Array {
  return enc.encode(JSON.stringify(msg));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const FALLBACK_MODEL_ID = DEFAULT_MODEL_ID;
