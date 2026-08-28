"use client";

import Link from "next/link";
import { useState } from "react";
import { InviteQr } from "@/components/grid/InviteQr";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  getDisplayName,
  setDisplayName,
} from "@/lib/session/profile";
import type { GridNode } from "@/lib/grid/scheduler";

import type { MembershipRole } from "@/lib/rbac/policy";
import { labelForRole } from "@/lib/rbac/policy";

export function InviteBar({
  roomId,
  connected,
  node,
  membershipRole,
  canInvite = true,
}: {
  roomId: string;
  connected: boolean;
  node?: GridNode;
  membershipRole?: MembershipRole;
  canInvite?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(() => getDisplayName());
  const [showQr, setShowQr] = useState(false);
  const path = `/s?r=${roomId}`;

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${path}`
      : path;

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard failures
    }
  }

  function saveName() {
    const trimmed = name.trim();
    setDisplayName(trimmed);
    node?.setDisplayName(trimmed);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface/70 px-6 py-4 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="font-display text-lg text-ink hover:text-accent-strong"
        >
          TeamThink
        </Link>
        <span className="text-ink-subtle">/</span>
        <span className="font-mono text-sm text-ink-muted" title="Room code">
          {roomId}
        </span>
        <Badge tone={connected ? "positive" : "neutral"} dot>
          {connected ? "connected" : "waiting for peers"}
        </Badge>
        {membershipRole && (
          <Badge tone="neutral">{labelForRole(membershipRole)}</Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && saveName()}
          placeholder="Your name"
          className="h-9 w-28 rounded-lg border border-border bg-canvas px-2 text-sm text-ink outline-none focus:border-accent sm:w-36"
          aria-label="Display name"
        />
        {canInvite && (
          <>
            <code className="hidden max-w-[200px] truncate rounded-lg border border-border bg-canvas px-3 py-1.5 text-xs text-ink-muted lg:block">
              {roomId}
            </code>
            <Button size="sm" variant="secondary" onClick={() => setShowQr((v) => !v)}>
              {showQr ? "Hide QR" : "QR join"}
            </Button>
            <Button size="sm" variant="secondary" onClick={copy}>
              {copied ? "Copied" : "Copy invite"}
            </Button>
          </>
        )}
      </div>
      {showQr && canInvite && (
        <div className="flex w-full items-center gap-4 border-t border-border pt-3 sm:w-auto sm:border-0 sm:pt-0">
          <InviteQr url={inviteUrl} />
          <p className="max-w-xs text-xs text-ink-muted">
            Scan to join room <span className="font-mono">{roomId}</span>
          </p>
        </div>
      )}
    </div>
  );
}
