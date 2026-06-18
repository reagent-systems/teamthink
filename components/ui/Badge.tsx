import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type Tone = "neutral" | "accent" | "positive" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-ink-muted border-border",
  accent: "bg-accent-soft text-accent-strong border-transparent",
  positive: "bg-positive/15 text-positive border-transparent",
  warning: "bg-warning/15 text-warning border-transparent",
  danger: "bg-danger/15 text-danger border-transparent",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export function Badge({
  className,
  tone = "neutral",
  dot,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "positive" && "bg-positive",
            tone === "accent" && "bg-accent",
            tone === "warning" && "bg-warning",
            tone === "danger" && "bg-danger",
            tone === "neutral" && "bg-ink-subtle",
          )}
        />
      )}
      {children}
    </span>
  );
}
