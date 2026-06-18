import type {
  ChatMessage,
  GenerateOptions,
  WorkerRequest,
  WorkerResponse,
} from "@/lib/engine/types";

/**
 * Main-thread wrapper around the inference worker. Manages a single worker and
 * routes responses back to the matching request by reqId.
 */

interface PendingLoad {
  type: "load";
  onProgress?: (progress: number, text: string) => void;
  resolve: () => void;
  reject: (e: Error) => void;
}

interface PendingGenerate {
  type: "generate";
  onToken: (token: string) => void;
  resolve: (text: string) => void;
  reject: (e: Error) => void;
}

type Pending = PendingLoad | PendingGenerate;

export class InferenceClient {
  private worker: Worker | null = null;
  private pending = new Map<string, Pending>();
  private seq = 0;

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    this.worker = new Worker(
      new URL("../../workers/inference.worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) =>
      this.onMessage(e.data);
    this.worker.onerror = (e) => {
      for (const [, p] of this.pending) p.reject(new Error(e.message));
      this.pending.clear();
    };
    return this.worker;
  }

  private nextId(): string {
    return `r${++this.seq}`;
  }

  load(
    modelId: string,
    onProgress?: (progress: number, text: string) => void,
  ): Promise<void> {
    const reqId = this.nextId();
    return new Promise<void>((resolve, reject) => {
      this.pending.set(reqId, { type: "load", onProgress, resolve, reject });
      this.postRequest({ type: "load", reqId, modelId });
    });
  }

  generate(
    modelId: string,
    messages: ChatMessage[],
    options: GenerateOptions,
    onToken: (token: string) => void,
  ): Promise<string> {
    const reqId = this.nextId();
    return new Promise<string>((resolve, reject) => {
      this.pending.set(reqId, { type: "generate", onToken, resolve, reject });
      this.postRequest({ type: "generate", reqId, modelId, messages, options });
    });
  }

  unload(): Promise<void> {
    const reqId = this.nextId();
    return new Promise<void>((resolve, reject) => {
      this.pending.set(reqId, {
        type: "load",
        resolve,
        reject,
      });
      this.postRequest({ type: "unload", reqId });
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }

  private postRequest(req: WorkerRequest): void {
    this.ensureWorker().postMessage(req);
  }

  private onMessage(msg: WorkerResponse): void {
    const p = this.pending.get(msg.reqId);
    if (!p) return;
    switch (msg.type) {
      case "progress":
        if (p.type === "load") p.onProgress?.(msg.progress, msg.text);
        break;
      case "ready":
        if (p.type === "load") {
          p.resolve();
          this.pending.delete(msg.reqId);
        }
        break;
      case "token":
        if (p.type === "generate") p.onToken(msg.token);
        break;
      case "done":
        if (p.type === "generate") {
          p.resolve(msg.text);
          this.pending.delete(msg.reqId);
        }
        break;
      case "error":
        p.reject(new Error(msg.error));
        this.pending.delete(msg.reqId);
        break;
    }
  }
}
