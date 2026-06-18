/// <reference lib="webworker" />
import { getModel } from "@/lib/config";
import { TransformersEngine } from "@/lib/engine/transformers";
import type {
  InferenceEngine,
  WorkerRequest,
  WorkerResponse,
} from "@/lib/engine/types";
import { WebLLMEngine } from "@/lib/engine/webllm";

/**
 * Inference worker. Runs the active engine off the main thread and streams
 * progress/tokens back to the page. One engine per kind is cached so reloading
 * the same model is cheap.
 */

const engines: Partial<Record<InferenceEngine["kind"], InferenceEngine>> = {};

function engineFor(kind: InferenceEngine["kind"]): InferenceEngine {
  let engine = engines[kind];
  if (!engine) {
    engine = kind === "webllm" ? new WebLLMEngine() : new TransformersEngine();
    engines[kind] = engine;
  }
  return engine;
}

function post(msg: WorkerResponse) {
  (self as unknown as Worker).postMessage(msg);
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === "load") {
      const model = getModel(req.modelId);
      if (!model) throw new Error(`unknown model ${req.modelId}`);
      const engine = engineFor(model.engine);
      await engine.load(model, (p) =>
        post({
          type: "progress",
          reqId: req.reqId,
          progress: p.progress,
          text: p.text,
        }),
      );
      post({ type: "ready", reqId: req.reqId });
    } else if (req.type === "generate") {
      const model = getModel(req.modelId);
      if (!model) throw new Error(`unknown model ${req.modelId}`);
      const engine = engineFor(model.engine);
      const text = await engine.generate(
        model,
        req.messages,
        req.options,
        (token) => post({ type: "token", reqId: req.reqId, token }),
      );
      post({ type: "done", reqId: req.reqId, text });
    } else if (req.type === "unload") {
      await Promise.all(
        Object.values(engines).map((eng) => eng?.unload()),
      );
      post({ type: "ready", reqId: req.reqId });
    }
  } catch (err) {
    post({
      type: "error",
      reqId: req.reqId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
