"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  hasCompletedOnboarding,
  markOnboardingComplete,
} from "@/lib/session/onboarding";

const STEPS = [
  {
    title: "Welcome to TeamThink",
    body: "Create or join a room, then invite devices to share GPU compute across a peer mesh.",
  },
  {
    title: "Pick a model",
    body: "Choose a model in the inference console. It loads across the grid before you send a prompt.",
  },
  {
    title: "Invite peers",
    body: "Copy the invite link or scan the QR code so other machines join as compute nodes.",
  },
  {
    title: "Send a prompt",
    body: "Use ⌘/Ctrl+Enter to send. Slash commands: /model, /clear, /stop.",
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(() => !hasCompletedOnboarding());
  const [step, setStep] = useState(0);

  if (!open) return null;

  const current = STEPS[step];
  const last = step >= STEPS.length - 1;

  function finish() {
    markOnboardingComplete();
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl"
        role="dialog"
        aria-labelledby="onboarding-title"
      >
        <p className="text-[11px] uppercase tracking-wide text-ink-subtle">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 id="onboarding-title" className="mt-2 font-display text-xl text-ink">
          {current.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {current.body}
        </p>
        <div className="mt-6 flex justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={finish}
          >
            Skip
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setStep((s) => s - 1)}
              >
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => (last ? finish() : setStep((s) => s + 1))}
            >
              {last ? "Get started" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
