import type { EngineKind } from "@/lib/config";
import { TransformersEngine } from "@/lib/engine/transformers";

/**
 * GGUF-class WASM CPU path — runs Transformers.js ONNX models on the WASM
 * backend for peers without WebGPU or as a low-VRAM fallback.
 */
export class GgufEngine extends TransformersEngine {
  override readonly kind: EngineKind = "gguf";

  protected inferDevice(): "webgpu" | "wasm" {
    return "wasm";
  }
}
