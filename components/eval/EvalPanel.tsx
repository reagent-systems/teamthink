"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { runEvalSuite } from "@/lib/eval/runner";
import { createDataset, listDatasets, exportDatasetJson } from "@/lib/eval/datasets";
import type { GridNode } from "@/lib/grid/scheduler";
import { DEFAULT_MODEL_ID } from "@/lib/config";
import { dispatchPrompt, waitForJobText } from "@/lib/grid/prompt-dispatch";

export function EvalPanel({
  roomId,
  node,
}: {
  roomId: string;
  node: GridNode;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [datasets, setDatasets] = useState(() => listDatasets(roomId));

  async function runSmoke() {
    setRunning(true);
    try {
      const { score: s } = await runEvalSuite(async (prompt) => {
        const jobId = dispatchPrompt(
          node,
          DEFAULT_MODEL_ID,
          [{ role: "user", content: prompt }],
          { temperature: 0.2, topP: 0.9, maxTokens: 64, topK: 40, seed: null, stopSequences: [], repetitionPenalty: 1, jsonMode: false },
        );
        if (!jobId) return "";
        return waitForJobText(node, jobId);
      }, "smoke");
      setScore(s);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evaluation</CardTitle>
      </CardHeader>
      <div className="space-y-3 text-sm">
        <Button size="sm" disabled={running} onClick={() => void runSmoke()}>
          {running ? "Running…" : "Run smoke suite"}
        </Button>
        {score != null && (
          <p className="text-ink-muted">
            Score: {(score * 100).toFixed(0)}% passed
          </p>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              createDataset(roomId, "Golden prompts");
              setDatasets(listDatasets(roomId));
            }}
          >
            New dataset
          </Button>
        </div>
        <ul className="text-xs text-ink-muted">
          {datasets.map((d) => (
            <li key={d.id}>
              {d.name}{" "}
              <button
                type="button"
                className="text-accent-strong"
                onClick={() => {
                  void navigator.clipboard.writeText(exportDatasetJson(d));
                }}
              >
                export
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
