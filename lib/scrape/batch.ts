import { scrapeUrl, pagesToCitations } from "@/lib/scrape/client";
import { mergeCitations } from "@/lib/scrape/citations";
import { ingestText } from "@/lib/rag/store";
import { getScrapeSettings } from "@/lib/scrape/settings";
import { redactPii } from "@/lib/scrape/pii";

const KEY = "teamthink.scrape.batch.v1";
export const BATCH_EVENT = "teamthink:batch-update";

export interface BatchItemResult {
  url: string;
  status: "ok" | "error";
  title?: string;
  error?: string;
}

export interface BatchJob {
  id: string;
  roomId: string;
  urls: string[];
  status: "queued" | "running" | "done";
  completed: number;
  failed: number;
  results: BatchItemResult[];
  ingestToRag: boolean;
  workspaceId?: string;
  createdAt: number;
}

function read(): BatchJob[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as BatchJob[];
  } catch {
    return [];
  }
}

function write(jobs: BatchJob[]): void {
  localStorage.setItem(KEY, JSON.stringify(jobs));
  window.dispatchEvent(new CustomEvent(BATCH_EVENT));
}

export function listBatchJobs(roomId: string): BatchJob[] {
  return read()
    .filter((j) => j.roomId === roomId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function patchJob(id: string, patch: Partial<BatchJob>): void {
  const jobs = read();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx < 0) return;
  jobs[idx] = { ...jobs[idx]!, ...patch };
  write(jobs);
}

export function enqueueBatchScrape(
  roomId: string,
  urls: string[],
  opts?: { ingestToRag?: boolean; workspaceId?: string },
): BatchJob {
  const job: BatchJob = {
    id: `batch_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
    roomId,
    urls: urls.filter(Boolean).slice(0, 50),
    status: "queued",
    completed: 0,
    failed: 0,
    results: [],
    ingestToRag: opts?.ingestToRag ?? false,
    workspaceId: opts?.workspaceId,
    createdAt: Date.now(),
  };
  write([job, ...read()]);
  void runBatchJob(job.id);
  return job;
}

async function runBatchJob(id: string): Promise<void> {
  const job = read().find((j) => j.id === id);
  if (!job || job.status !== "queued") return;
  patchJob(id, { status: "running" });
  const settings = getScrapeSettings();
  let completed = 0;
  let failed = 0;
  const results: BatchItemResult[] = [];

  for (const url of job.urls) {
    try {
      const page = await scrapeUrl(url);
      let md = page.markdown;
      if (settings.redactPii) md = redactPii(md);
      mergeCitations(job.roomId, pagesToCitations([page]));
      if (job.ingestToRag && md.trim()) {
        await ingestText(job.roomId, page.title || url, md, "paste");
      }
      results.push({ url, status: "ok", title: page.title });
      completed++;
    } catch (err) {
      results.push({
        url,
        status: "error",
        error: err instanceof Error ? err.message : "failed",
      });
      failed++;
    }
    patchJob(id, { completed, failed, results });
  }
  patchJob(id, { status: "done", completed, failed, results });
}
