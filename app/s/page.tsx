"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HeadlessComputeView } from "@/components/grid/HeadlessComputeView";
import { SessionView } from "@/components/grid/SessionView";
import { setRoomSecret } from "@/lib/mesh/crypto";

/**
 * Session route. The room id rides in the query string (`/s?r=<id>`) rather
 * than a dynamic path segment so the whole app ships as a static export.
 *
 * Append `headless=1` or `mode=compute` for an always-on compute node.
 * Append `k=<secret>` for a shared E2E room encryption key.
 */
function Session() {
  const params = useSearchParams();
  const roomId = params.get("r")?.trim() ?? "";
  const roomSecret = params.get("k")?.trim() ?? undefined;
  const headless =
    params.get("headless") === "1" ||
    params.get("mode") === "compute";

  useEffect(() => {
    if (roomSecret && roomId) setRoomSecret(roomId, roomSecret);
  }, [roomId, roomSecret]);

  if (!roomId) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="text-center">
          <p className="text-ink-muted">No session in this link.</p>
          <Link
            href="/"
            className="mt-3 inline-block font-display text-lg text-accent-strong"
          >
            Start or join a session
          </Link>
        </div>
      </main>
    );
  }

  if (headless) {
    return <HeadlessComputeView roomId={roomId} />;
  }

  return <SessionView roomId={roomId} />;
}

export default function SessionPage() {
  return (
    <Suspense fallback={null}>
      <Session />
    </Suspense>
  );
}
