"use client";

import { useEffect, useRef } from "react";

/** Minimal QR code for invite URLs (no external dependency). */
export function InviteQr({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const QR = await import("qrcode");
      if (cancelled || !canvasRef.current) return;
      await QR.toCanvas(canvasRef.current, url, {
        width: 128,
        margin: 1,
        color: { dark: "#1a1a1a", light: "#ffffff" },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg border border-border bg-white"
      width={128}
      height={128}
      aria-label="QR code for invite link"
    />
  );
}
