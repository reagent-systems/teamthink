"use client";

import type { SamplerSettings } from "@/lib/chat/types";

export function SamplerPanel({
  value,
  onChange,
  open,
}: {
  value: SamplerSettings;
  onChange: (next: SamplerSettings) => void;
  open: boolean;
}) {
  if (!open) return null;

  function set<K extends keyof SamplerSettings>(key: K, v: SamplerSettings[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-surface-sunken p-3 sm:grid-cols-2">
      <Slider
        label="Temperature"
        min={0}
        max={2}
        step={0.05}
        value={value.temperature}
        onChange={(n) => set("temperature", n)}
      />
      <Slider
        label="Top-p"
        min={0.05}
        max={1}
        step={0.05}
        value={value.topP}
        onChange={(n) => set("topP", n)}
      />
      <Slider
        label="Top-k"
        min={0}
        max={100}
        step={1}
        value={value.topK}
        onChange={(n) => set("topK", n)}
      />
      <Slider
        label="Max tokens"
        min={16}
        max={2048}
        step={16}
        value={value.maxTokens}
        onChange={(n) => set("maxTokens", n)}
      />
      <Slider
        label="Repetition penalty"
        min={1}
        max={2}
        step={0.05}
        value={value.repetitionPenalty}
        onChange={(n) => set("repetitionPenalty", n)}
      />
      <Slider
        label="Presence penalty"
        min={0}
        max={2}
        step={0.05}
        value={value.presencePenalty}
        onChange={(n) => set("presencePenalty", n)}
      />
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Seed
        <input
          type="number"
          value={value.seed ?? ""}
          placeholder="random"
          onChange={(e) =>
            set("seed", e.target.value === "" ? null : Number(e.target.value))
          }
          className="h-9 rounded-lg border border-border bg-canvas px-2 text-sm text-ink outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted sm:col-span-2">
        Stop sequences (comma-separated)
        <input
          type="text"
          value={value.stopSequences.join(", ")}
          onChange={(e) =>
            set(
              "stopSequences",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          className="h-9 rounded-lg border border-border bg-canvas px-2 text-sm text-ink outline-none focus:border-accent"
        />
      </label>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-muted">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-ink">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-[var(--accent)]"
      />
    </label>
  );
}
