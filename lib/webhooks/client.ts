import { WORKER_HTTP_URL } from "@/lib/config";
import { authHeaders } from "@/lib/auth/types";
import type { WebhookEvent, WebhookSubscription } from "@/lib/webhooks/types";

async function platformFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!WORKER_HTTP_URL) throw new Error("Set NEXT_PUBLIC_SIGNAL_WS_URL");
  const res = await fetch(`${WORKER_HTTP_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string>) },
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

export async function listWebhooks(): Promise<WebhookSubscription[]> {
  const data = await platformFetch<{ webhooks: WebhookSubscription[] }>("/webhooks");
  return data.webhooks;
}

export async function createWebhook(
  url: string,
  events: WebhookEvent[],
  roomId?: string,
): Promise<WebhookSubscription> {
  const data = await platformFetch<{ webhook: WebhookSubscription }>("/webhooks", {
    method: "POST",
    body: JSON.stringify({ url, events, roomId }),
  });
  return data.webhook;
}

export async function deleteWebhook(id: string): Promise<void> {
  await platformFetch(`/webhooks/${id}`, { method: "DELETE" });
}

export async function emitWebhookEvent(
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  await platformFetch("/webhooks/dispatch", {
    method: "POST",
    body: JSON.stringify({ event, payload }),
  });
}
