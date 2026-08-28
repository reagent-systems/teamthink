"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  listNotifications,
  markNotificationsRead,
  type NotificationItem,
} from "@/lib/platform/client";
import { useAuth } from "@/hooks/useAuth";

export function NotificationsPanel() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!user) return;
    void listNotifications().then(setItems).catch(() => {});
    const t = setInterval(() => {
      void listNotifications().then(setItems).catch(() => {});
    }, 60_000);
    return () => clearInterval(t);
  }, [user]);

  if (!user || items.length === 0) return null;

  const unread = items.filter((n) => !n.read).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Notifications</CardTitle>
        {unread > 0 && <Badge tone="positive">{unread} new</Badge>}
      </CardHeader>
      <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
        {items.slice(0, 8).map((n) => (
          <li
            key={n.id}
            className={`rounded-lg border px-3 py-2 ${
              n.read ? "border-border text-ink-muted" : "border-accent/30 bg-canvas"
            }`}
          >
            <p className="font-medium text-ink">{n.title}</p>
            <p className="text-xs text-ink-muted">{n.body}</p>
          </li>
        ))}
      </ul>
      {unread > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-3"
          onClick={() =>
            void markNotificationsRead().then(() => listNotifications().then(setItems))
          }
        >
          Mark all read
        </Button>
      )}
    </Card>
  );
}
