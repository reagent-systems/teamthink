"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import type { GridSnapshot } from "@/lib/grid/types";
import {
  filterByMaxParams,
  filterByQuant,
  paramLabelToBillions,
  quantHint,
  searchHfModels,
  type HfModalityFilter,
  type HfModelHit,
} from "@/lib/models/hf-api";
import {
  addCustomModel,
  isCustomModelId,
  listCustomModels,
  removeCustomModel,
} from "@/lib/models/registry";
import { validateHfRepo } from "@/lib/models/validate";

type QuantFilter = "all" | "q4" | "q8" | "f16";

export function ModelBrowser({
  snapshot,
  onSelect,
  selectedId,
}: {
  snapshot: GridSnapshot;
  onSelect: (modelId: string, hfRepo: string) => void;
  selectedId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"browse" | "import">("browse");
  const [query, setQuery] = useState("instruct");
  const [modality, setModality] = useState<HfModalityFilter>("text");
  const [maxParamsB, setMaxParamsB] = useState<number | null>(3);
  const [quant, setQuant] = useState<QuantFilter>("all");
  const [hits, setHits] = useState<HfModelHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [importRepo, setImportRepo] = useState("");
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<Awaited<
    ReturnType<typeof validateHfRepo>
  > | null>(null);

  const custom = listCustomModels();
  const deviceMb = snapshot.vramEstimateMb;

  const runSearch = useCallback(async () => {
    setLoading(true);
    setSearchError(null);
    try {
      let results = await searchHfModels({
        query,
        modality,
        safetensorsOnly: true,
        limit: 30,
      });
      results = filterByMaxParams(results, maxParamsB);
      results = filterByQuant(results, quant);
      setHits(results);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, [query, modality, maxParamsB, quant]);

  async function validateImport() {
    setValidating(true);
    setValidation(null);
    try {
      const result = await validateHfRepo(importRepo);
      setValidation(result);
    } finally {
      setValidating(false);
    }
  }

  function addHit(hit: HfModelHit) {
    const spec = addCustomModel({
      hfRepo: hit.modelId,
      label: hit.modelId.split("/").pop() ?? hit.modelId,
      modality: modality === "all" ? "text" : modality,
      vramMb: 0,
    });
    onSelect(spec.id, hit.modelId);
  }

  function addValidated() {
    if (!validation?.ok) return;
    const spec = addCustomModel({
      hfRepo: validation.repo,
      vramMb: validation.vramMb ?? 0,
    });
    onSelect(spec.id, validation.repo);
    setImportRepo("");
    setValidation(null);
  }

  function fitsDevice(vramMb: number | undefined): boolean | null {
    if (vramMb == null || vramMb === 0 || deviceMb == null) return null;
    return deviceMb >= vramMb;
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Model hub</CardTitle>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Browse HF"}
        </Button>
      </CardHeader>

      {open && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-lg px-2 py-1 text-xs ${tab === "browse" ? "bg-accent/15 text-accent-strong" : "text-ink-muted"}`}
              onClick={() => setTab("browse")}
            >
              Search
            </button>
            <button
              type="button"
              className={`rounded-lg px-2 py-1 text-xs ${tab === "import" ? "bg-accent/15 text-accent-strong" : "text-ink-muted"}`}
              onClick={() => setTab("import")}
            >
              Import repo
            </button>
          </div>

          {tab === "browse" && (
            <>
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void runSearch()}
                  placeholder="Search Hugging Face…"
                  className="h-9 flex-1 rounded-xl border border-border bg-canvas px-3 text-sm text-ink outline-none focus:border-accent"
                />
                <Button size="sm" onClick={() => void runSearch()} disabled={loading}>
                  {loading ? "…" : "Search"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <select
                  value={modality}
                  onChange={(e) =>
                    setModality(e.target.value as HfModalityFilter)
                  }
                  className="rounded-lg border border-border bg-canvas px-2 py-1 text-ink"
                >
                  <option value="text">Text</option>
                  <option value="vision">Vision</option>
                  <option value="embedding">Embedding</option>
                  <option value="all">All</option>
                </select>
                <select
                  value={maxParamsB ?? ""}
                  onChange={(e) =>
                    setMaxParamsB(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="rounded-lg border border-border bg-canvas px-2 py-1 text-ink"
                >
                  <option value="">Any size</option>
                  <option value="0.5">≤ 0.5B</option>
                  <option value="1">≤ 1B</option>
                  <option value="3">≤ 3B</option>
                  <option value="7">≤ 7B</option>
                </select>
                <select
                  value={quant}
                  onChange={(e) => setQuant(e.target.value as QuantFilter)}
                  className="rounded-lg border border-border bg-canvas px-2 py-1 text-ink"
                >
                  <option value="all">Any quant</option>
                  <option value="q4">q4-ish</option>
                  <option value="q8">q8-ish</option>
                  <option value="f16">f16</option>
                </select>
              </div>
              {searchError && (
                <p className="text-xs text-danger">{searchError}</p>
              )}
              <ul className="max-h-52 space-y-1 overflow-y-auto text-sm">
                {hits.map((hit) => {
                  const q = quantHint(hit);
                  const paramsB = paramLabelToBillions(hit.paramLabel);
                  return (
                    <li
                      key={hit.modelId}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-sunken px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-ink">
                          {hit.modelId}
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {hit.paramLabel && (
                            <Badge tone="neutral">{hit.paramLabel}</Badge>
                          )}
                          {q && <Badge tone="neutral">{q}</Badge>}
                          {paramsB != null && paramsB > 3 && (
                            <Badge tone="warning">large</Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => addHit(hit)}
                      >
                        Add
                      </Button>
                    </li>
                  );
                })}
                {!loading && hits.length === 0 && (
                  <li className="py-4 text-center text-xs text-ink-subtle">
                    Search to find models
                  </li>
                )}
              </ul>
            </>
          )}

          {tab === "import" && (
            <>
              <input
                value={importRepo}
                onChange={(e) => {
                  setImportRepo(e.target.value);
                  setValidation(null);
                }}
                placeholder="org/model-id"
                className="h-9 w-full rounded-xl border border-border bg-canvas px-3 text-sm text-ink outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void validateImport()}
                  disabled={!importRepo.trim() || validating}
                >
                  {validating ? "Checking…" : "Validate"}
                </Button>
                {validation?.ok && (
                  <Button size="sm" onClick={addValidated}>
                    Add to grid
                  </Button>
                )}
              </div>
              {validation && !validation.ok && (
                <p className="text-xs text-danger">{validation.error}</p>
              )}
              {validation?.ok && (
                <div className="rounded-lg border border-positive/30 bg-positive/5 p-2 text-xs text-ink-muted">
                  <p>
                    {validation.family} · {validation.numLayers} layers · ~
                    {validation.vramMb} MB est.
                  </p>
                  {fitsDevice(validation.vramMb) === false && (
                    <p className="mt-1 text-warning">
                      May not fit on this device alone — mesh sharding can still
                      work across peers.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {custom.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-subtle">
                Your models
              </p>
              <ul className="space-y-1">
                {custom.map((c) => (
                  <li
                    key={c.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1 text-xs ${
                      selectedId === c.id
                        ? "border-accent bg-accent/5"
                        : "border-border"
                    }`}
                  >
                    <button
                      type="button"
                      className="min-w-0 truncate text-left text-ink hover:text-accent-strong"
                      onClick={() => onSelect(c.id, c.hfRepo)}
                    >
                      {c.label}
                    </button>
                    {isCustomModelId(c.id) && (
                      <button
                        type="button"
                        className="shrink-0 text-ink-subtle hover:text-danger"
                        onClick={() => removeCustomModel(c.id)}
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
