import { MODELS, type ModelSpec } from "@/lib/config";

/**
 * Device capability detection. Determines whether the browser can act as a
 * compute node (WebGPU present) and produces a rough memory estimate used to
 * decide which models it can host and to score task claims.
 */

export type NodeRole = "compute" | "consume";

export interface DeviceCapabilities {
  webgpu: boolean;
  gpuVendor?: string;
  gpuArchitecture?: string;
  /** Whether the adapter exposes the WebGPU `shader-f16` feature. */
  shaderF16: boolean;
  /** Coarse usable-memory estimate (MB) for model fit decisions. */
  memoryEstimateMb: number;
  /** navigator.deviceMemory in GB if exposed (coarse, capped by browsers). */
  deviceMemoryGb?: number;
  role: NodeRole;
  compatibleModelIds: string[];
}

interface AdapterInfoLike {
  vendor?: string;
  architecture?: string;
}

export async function detectCapabilities(): Promise<DeviceCapabilities> {
  const deviceMemoryGb =
    typeof navigator !== "undefined" &&
    "deviceMemory" in navigator &&
    typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory ===
      "number"
      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      : undefined;

  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  if (!gpu) {
    return {
      webgpu: false,
      shaderF16: false,
      memoryEstimateMb: estimateMemoryMb(undefined, deviceMemoryGb),
      deviceMemoryGb,
      role: "consume",
      compatibleModelIds: [],
    };
  }

  let adapter: GPUAdapter | null = null;
  try {
    adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
  } catch {
    adapter = null;
  }

  if (!adapter) {
    return {
      webgpu: false,
      shaderF16: false,
      memoryEstimateMb: estimateMemoryMb(undefined, deviceMemoryGb),
      deviceMemoryGb,
      role: "consume",
      compatibleModelIds: [],
    };
  }

  let info: AdapterInfoLike = {};
  try {
    // requestAdapterInfo is being folded into adapter.info across browsers.
    const adapterWithInfo = adapter as GPUAdapter & {
      info?: AdapterInfoLike;
      requestAdapterInfo?: () => Promise<AdapterInfoLike>;
    };
    if (adapterWithInfo.info) info = adapterWithInfo.info;
    else if (adapterWithInfo.requestAdapterInfo)
      info = await adapterWithInfo.requestAdapterInfo();
  } catch {
    info = {};
  }

  const shaderF16 = adapter.features?.has("shader-f16") ?? false;
  const memoryEstimateMb = estimateMemoryMb(adapter, deviceMemoryGb);
  const compatibleModelIds = MODELS.filter(
    (m) =>
      modelFits(m, memoryEstimateMb) && (!m.requiresShaderF16 || shaderF16),
  ).map((m) => m.id);

  return {
    webgpu: true,
    gpuVendor: info.vendor || undefined,
    gpuArchitecture: info.architecture || undefined,
    shaderF16,
    memoryEstimateMb,
    deviceMemoryGb,
    role: "compute",
    compatibleModelIds,
  };
}

/**
 * Floor for any WebGPU-capable adapter and ceiling for the estimate. The
 * ceiling is generous so high-end discrete GPUs aren't all flattened to the
 * same value (the old 16 GB cap made a 24 GB card look identical to a 16 GB one).
 */
const COMPUTE_FLOOR_MB = 2048;
const ESTIMATE_CEILING_MB = 49152; // 48 GB

/**
 * The adapter buffer/binding limits report the largest single allocation, which
 * is a fraction of the device's usable memory. Scaling the limit up approximates
 * total usable capacity well enough for model-fit gating and relative ranking.
 */
const LIMIT_TO_USABLE_MULTIPLIER = 2;

/**
 * Heuristic usable-memory estimate. WebGPU deliberately exposes no true VRAM
 * figure (it's a fingerprinting vector), so for a compute node the only
 * per-GPU signal available is the adapter's buffer/binding limits — these do
 * track hardware class (discrete ~2-4 GB, Apple/M ~1-2 GB, integrated
 * ~256 MB-1 GB). We base the estimate on those limits.
 *
 * `navigator.deviceMemory` reports *system* RAM, is capped at 8 GB, and is
 * coarsely quantized, so it is NOT a GPU figure: using it would flatten every
 * machine with >=8 GB RAM to the same number and mask real GPU differences.
 * It is therefore only used as a fallback for non-GPU (request-only) nodes.
 */
function estimateMemoryMb(
  adapter: GPUAdapter | undefined,
  deviceMemoryGb: number | undefined,
): number {
  if (!adapter) {
    // Request-only node: no GPU to size, so fall back to a coarse system-RAM
    // hint. This figure only labels the node; it doesn't host models.
    const systemMb = deviceMemoryGb ? deviceMemoryGb * 1024 * 0.5 : 1024;
    return Math.round(Math.min(Math.max(1024, systemMb), ESTIMATE_CEILING_MB));
  }

  // Take the larger of the two limits; some implementations allow buffers
  // larger than a single storage binding. Coerce defensively (GPUSize64).
  const maxBuffer = Number(adapter.limits?.maxBufferSize ?? 0);
  const maxBinding = Number(adapter.limits?.maxStorageBufferBindingSize ?? 0);
  const limitBytes = Math.max(maxBuffer, maxBinding);

  let estimate = COMPUTE_FLOOR_MB;
  if (limitBytes > 0) {
    estimate = (limitBytes / (1024 * 1024)) * LIMIT_TO_USABLE_MULTIPLIER;
  }
  return Math.round(
    Math.min(Math.max(COMPUTE_FLOOR_MB, estimate), ESTIMATE_CEILING_MB),
  );
}

export function modelFits(model: ModelSpec, memoryEstimateMb: number): boolean {
  return memoryEstimateMb >= model.vramMb;
}
