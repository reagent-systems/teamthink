"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getRecentSpans } from "@/lib/observability/otel";
import { renderPrometheus } from "@/lib/observability/metrics";
import { WORKER_HTTP_URL } from "@/lib/config";

export function ObservabilityPanel() {
  const [prom, setProm] = useState("");
  const spans = getRecentSpans(8);

  async function fetchMetrics() {
    if (WORKER_HTTP_URL) {
      const res = await fetch(`${WORKER_HTTP_URL}/metrics`);
      setProm(await res.text());
    } else {
      setProm(renderPrometheus());
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Observability</CardTitle>
      </CardHeader>
      <div className="space-y-3 text-sm">
        <Button size="sm" variant="secondary" onClick={() => void fetchMetrics()}>
          Fetch Prometheus metrics
        </Button>
        {prom && (
          <pre className="max-h-32 overflow-auto rounded-lg bg-canvas p-2 font-mono text-xs">
            {prom}
          </pre>
        )}
        <p className="font-medium text-ink">Recent traces</p>
        <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-xs text-ink-muted">
          {spans.length === 0 && <li>No spans yet</li>}
          {spans.map((s, i) => (
            <li key={i}>
              {s.name}{" "}
              {s.endMs != null
                ? `${(s.endMs - s.startMs).toFixed(0)}ms`
                : "…"}
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-muted">
          OpenAPI spec:{" "}
          <a href="/openapi.yaml" className="text-accent-strong">
            /openapi.yaml
          </a>
        </p>
      </div>
    </Card>
  );
}
