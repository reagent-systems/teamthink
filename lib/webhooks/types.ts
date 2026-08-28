/** Webhook event types (ROADMAP #78). */

export type WebhookEvent =
  | "job.completed"
  | "peer.joined"
  | "peer.left"
  | "crawl.finished"
  | "room.created";

export interface WebhookSubscription {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  createdAt: number;
  roomId?: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  at: number;
  status: "pending" | "delivered" | "failed";
}
