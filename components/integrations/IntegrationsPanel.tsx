"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  listWebhooks,
  createWebhook,
  deleteWebhook,
} from "@/lib/webhooks/client";
import type { WebhookEvent, WebhookSubscription } from "@/lib/webhooks/types";
import { embedIframeHtml } from "@/lib/sdk/embed";

const EVENTS: WebhookEvent[] = [
  "job.completed",
  "peer.joined",
  "peer.left",
  "crawl.finished",
  "room.created",
];

export function IntegrationsPanel({ roomId }: { roomId: string }) {
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [url, setUrl] = useState("");
  const embed = useMemo(
    () => embedIframeHtml({ roomId, height: 400 }),
    [roomId],
  );

  useEffect(() => {
    void listWebhooks().then(setWebhooks).catch(() => {});
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
      </CardHeader>
      <div className="space-y-4 text-sm">
        <div>
          <p className="mb-2 font-medium text-ink">Webhooks</p>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.example.com/teamthink"
              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-canvas px-2 font-mono text-xs"
            />
            <Button
              size="sm"
              onClick={() =>
                void createWebhook(url, EVENTS, roomId)
                  .then(() => listWebhooks().then(setWebhooks))
                  .then(() => setUrl(""))
              }
            >
              Add
            </Button>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-ink-muted">
            {webhooks.map((w) => (
              <li key={w.id} className="flex justify-between gap-2">
                <span className="truncate">{w.url}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void deleteWebhook(w.id).then(() => listWebhooks().then(setWebhooks))
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 font-medium text-ink">Embed widget</p>
          <textarea
            readOnly
            value={embed}
            rows={3}
            className="w-full rounded-lg border border-border bg-canvas p-2 font-mono text-xs"
          />
        </div>

        <div>
          <p className="mb-2 font-medium text-ink">No-code connectors</p>
          <p className="text-xs text-ink-muted">
            Zapier, n8n, and Make templates in{" "}
            <code className="font-mono">integrations/</code> — trigger on webhook events
            or call the OpenAI gateway at{" "}
            <code className="font-mono">127.0.0.1:11434</code>.
          </p>
        </div>
      </div>
    </Card>
  );
}
