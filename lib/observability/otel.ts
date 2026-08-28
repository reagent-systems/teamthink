/**
 * Lightweight OpenTelemetry-style tracing (ROADMAP #85).
 * Spans around claim → shard hops → tokens.
 */

export interface Span {
  name: string;
  startMs: number;
  endMs?: number;
  attributes: Record<string, string | number>;
  children: Span[];
}

const traceStore: Span[] = [];
const MAX_SPANS = 200;

export function startSpan(name: string, attrs: Record<string, string | number> = {}): Span {
  const span: Span = { name, startMs: performance.now(), attributes: attrs, children: [] };
  traceStore.unshift(span);
  if (traceStore.length > MAX_SPANS) traceStore.pop();
  return span;
}

export function endSpan(span: Span): void {
  span.endMs = performance.now();
}

export function getRecentSpans(limit = 50): Span[] {
  return traceStore.slice(0, limit);
}

export function traceClaim(taskId: string, modelId: string): Span {
  return startSpan("claim", { taskId, modelId });
}

export function traceShardHop(jobId: string, fromPeer: string, toPeer: string): Span {
  return startSpan("shard_hop", { jobId, fromPeer, toPeer });
}

export function traceTokens(jobId: string, count: number): Span {
  const s = startSpan("tokens", { jobId, count });
  endSpan(s);
  return s;
}
