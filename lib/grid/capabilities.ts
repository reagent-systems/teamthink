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

  const memoryEstimateMb = estimateMemoryMb(adapter, deviceMemoryGb);
  const compatibleModelIds = MODELS.filter((m) =>
    modelFits(m, memoryEstimateMb),
  ).map((m) => m.id);

  return {
    webgpu: true,
    gpuVendor: info.vendor || undefined,
    gpuArchitecture: info.architecture || undefined,
    memoryEstimateMb,
    deviceMemoryGb,
    role: "compute",
    compatibleModelIds,
  };
}

/**
 * Heuristic usable-memory estimate. WebGPU exposes no true VRAM figure, so we
 * combine adapter buffer limits with system memory hints and clamp to a sane
 * range. This is intentionally conservative; it only gates model selection.
 */
function estimateMemoryMb(
  adapter: GPUAdapter | undefined,
  deviceMemoryGb: number | undefined,
): number {
  let estimate = 2048; // baseline assumption
  if (deviceMemoryGb) {
    // Browsers cap deviceMemory at 8; assume roughly half is usable for models.
    estimate = Math.max(estimate, deviceMemoryGb * 1024 * 0.5);
  }
  if (adapter) {
    const maxBuffer = adapter.limits?.maxBufferSize;
    if (typeof maxBuffer === "number" && maxBuffer > 0) {
      // maxBufferSize correlates loosely with available GPU memory.
      estimate = Math.max(estimate, (maxBuffer / (1024 * 1024)) * 1.5);
    }
  }
  return Math.round(Math.min(estimate, 16384));
}

export function modelFits(model: ModelSpec, memoryEstimateMb: number): boolean {
  return memoryEstimateMb >= model.vramMb;
}
