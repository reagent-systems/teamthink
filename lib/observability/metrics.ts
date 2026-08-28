/**
 * Prometheus-style metrics exposition (ROADMAP #85).
 */

const counters: Record<string, number> = {};
const gauges: Record<string, number> = {};

export function incCounter(name: string, labels = "", delta = 1): void {
  const key = labels ? `${name}{${labels}}` : name;
  counters[key] = (counters[key] ?? 0) + delta;
}

export function setGauge(name: string, value: number, labels = ""): void {
  const key = labels ? `${name}{${labels}}` : name;
  gauges[key] = value;
}

export function renderPrometheus(): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(counters)) {
    lines.push(`# TYPE ${k.split("{")[0]} counter`);
    lines.push(`${k} ${v}`);
  }
  for (const [k, v] of Object.entries(gauges)) {
    lines.push(`# TYPE ${k.split("{")[0]} gauge`);
    lines.push(`${k} ${v}`);
  }
  return lines.join("\n") + "\n";
}

export function recordJobComplete(tokens: number, latencyMs: number): void {
  incCounter("teamthink_jobs_total");
  incCounter("teamthink_tokens_total", "", tokens);
  setGauge("teamthink_last_job_latency_ms", latencyMs);
}
