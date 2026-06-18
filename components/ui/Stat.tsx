import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface StatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}

export function Stat({ label, value, hint, className }: StatProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-sunken px-4 py-3",
        className,
      )}
    >
      <div className="text-xs uppercase tracking-wide text-ink-subtle">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl text-ink tabular-nums">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-ink-muted">{hint}</div>}
    </div>
  );
}
