import type { ModelModality, ModelSpec } from "@/lib/config";
import {
  buildModelDescriptor,
} from "@/lib/grid/pipeline";
import { loadSafetensorsIndex } from "@/lib/engine/hf/safetensors";
import type { ArchDescriptor } from "@/lib/engine/hf/config";

export interface ValidationResult {
  ok: boolean;
  repo: string;
  error?: string;
  descriptor?: ArchDescriptor;
  /** Rough single-device VRAM estimate (MB) for fit gating. */
  vramMb?: number;
  numLayers?: number;
  family?: string;
  hasSafetensors?: boolean;
}

/** Estimate VRAM for a dense decoder from architecture (matches pipeline heuristics). */
export function estimateVramMb(desc: ArchDescriptor): number {
  const kvCap = 2048;
  const qDim = desc.numAttentionHeads * desc.headDim;
  const kvDim = desc.numKeyValueHeads * desc.headDim;
  const layerWeights =
    desc.hiddenSize * (2 * qDim + 2 * kvDim) +
    3 * desc.intermediateSize * desc.hiddenSize;
  const layerKv = desc.numKeyValueHeads * kvCap * desc.headDim * 2;
  const layerBytes = (layerWeights + layerKv) * 4;
  const embedBytes = desc.vocabSize * desc.hiddenSize * 4;
  const totalBytes = embedBytes + layerBytes * desc.numLayers;
  return Math.ceil(totalBytes / (1024 * 1024));
}

/**
 * Validate an HF repo for TeamThink grid sharding: supported architecture,
 * ungated safetensors weights, WebGPU executor limits.
 */
export async function validateHfRepo(repo: string): Promise<ValidationResult> {
  const trimmed = repo.trim().replace(/^https?:\/\/huggingface\.co\//, "").replace(/\/$/, "");
  if (!/^[\w.-]+\/[\w.-]+/.test(trimmed)) {
    return { ok: false, repo: trimmed, error: "Enter a repo id like org/model-name" };
  }
  try {
    const desc = await buildModelDescriptor(trimmed);
    const index = await loadSafetensorsIndex(trimmed);
    if (index.tensors.size === 0) {
      return {
        ok: false,
        repo: trimmed,
        error: "No safetensors weights found. Grid models need public safetensors files.",
      };
    }
    const vramMb = estimateVramMb(desc);
    return {
      ok: true,
      repo: trimmed,
      descriptor: desc,
      vramMb,
      numLayers: desc.numLayers,
      family: desc.traits.family,
      hasSafetensors: true,
    };
  } catch (err) {
    return {
      ok: false,
      repo: trimmed,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function repoToModelSpec(
  repo: string,
  label?: string,
  modality: ModelModality = "text",
  vramMb = 0,
): ModelSpec {
  const slug = repo.replace(/[^\w]+/g, "-").slice(0, 40);
  return {
    id: `grid-custom-${slug}`,
    label: label ?? repo.split("/").pop() ?? repo,
    engine: "transformers",
    modality,
    modelId: repo,
    vramMb,
    hfRepo: repo,
  };
}
