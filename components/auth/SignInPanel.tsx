"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  signInAnonymous,
  signInMagicLink,
  signInOAuth,
  upgradeAnonymous,
  signOut,
} from "@/lib/auth/client";
import { useAuth } from "@/hooks/useAuth";

export function SignInPanel() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Signed in</CardTitle>
        </CardHeader>
        <div className="space-y-3 text-sm">
          <p className="text-ink">
            {user.displayName}
            {user.email && (
              <span className="text-ink-muted"> · {user.email}</span>
            )}
          </p>
          <Badge tone="neutral">{user.provider}</Badge>
          {user.provider === "anonymous" && (
            <div className="flex flex-wrap gap-2 pt-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email to upgrade"
                className="h-9 flex-1 rounded-lg border border-border bg-canvas px-2 text-sm"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || !email.includes("@")}
                onClick={() => run(() => upgradeAnonymous(email))}
              >
                Upgrade
              </Button>
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <div className="space-y-3">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => run(() => signInAnonymous())}
        >
          Continue as guest
        </Button>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email for magic link"
            className="h-9 min-w-[180px] flex-1 rounded-lg border border-border bg-canvas px-2 text-sm"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !email.includes("@")}
            onClick={() => run(() => signInMagicLink(email))}
          >
            Magic link
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(() =>
                signInOAuth("google", `dev_${Date.now()}`, {
                  email: email || undefined,
                }),
              )
            }
          >
            Google
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(() =>
                signInOAuth("github", `dev_${Date.now()}`, {
                  email: email || undefined,
                }),
              )
            }
          >
            GitHub
          </Button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Card>
  );
}
