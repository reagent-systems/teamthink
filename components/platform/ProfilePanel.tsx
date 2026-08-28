"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  fetchQuotas,
  createOrg,
  addLocalGatewayKey,
  type ApiKeyInfo,
  type QuotaInfo,
} from "@/lib/platform/client";
import { useAuth } from "@/hooks/useAuth";
import { labelForRole, type MembershipRole } from "@/lib/rbac/policy";

export function ProfilePanel({
  membershipRole,
}: {
  membershipRole?: MembershipRole;
}) {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [quotas, setQuotas] = useState<QuotaInfo | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void listApiKeys().then(setKeys).catch(() => {});
    void fetchQuotas().then(setQuotas).catch(() => {});
  }, [user]);

  if (!user) return null;

  async function mintKey() {
    setError(null);
    try {
      const { secret } = await createApiKey("Gateway");
      addLocalGatewayKey(secret);
      setNewSecret(secret);
      setKeys(await listApiKeys());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Profile & API keys</CardTitle>
        {membershipRole && (
          <Badge tone="neutral">{labelForRole(membershipRole)}</Badge>
        )}
      </CardHeader>
      <div className="space-y-4 text-sm">
        <p className="text-ink-muted">
          {user.displayName}
          {user.email ? ` · ${user.email}` : ""}
        </p>

        {quotas && (
          <div className="rounded-lg border border-border bg-canvas p-3 text-xs">
            <p className="font-medium text-ink">Usage this period</p>
            <p className="text-ink-muted">
              Tokens {quotas.usage.tokens.toLocaleString()} /{" "}
              {quotas.limits.tokens.toLocaleString()}
            </p>
            <p className="text-ink-muted">
              Scrapes {quotas.usage.scrapes} / {quotas.limits.scrapes}
            </p>
          </div>
        )}

        <div>
          <p className="mb-2 font-medium text-ink">Gateway API keys</p>
          <Button size="sm" variant="secondary" onClick={() => void mintKey()}>
            Create key
          </Button>
          {newSecret && (
            <p className="mt-2 break-all font-mono text-xs text-accent-strong">
              {newSecret}
            </p>
          )}
          <ul className="mt-2 space-y-1">
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between gap-2 text-xs text-ink-muted"
              >
                <span>
                  {k.label} · {k.prefix}…
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void revokeApiKey(k.id).then(() => listApiKeys().then(setKeys))
                  }
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 font-medium text-ink">Team workspace</p>
          <div className="flex gap-2">
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Org name"
              className="h-9 flex-1 rounded-lg border border-border bg-canvas px-2 text-sm"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void createOrg(orgName || "My team").catch((e) =>
                  setError(e instanceof Error ? e.message : "Failed"),
                )
              }
            >
              Create
            </Button>
          </div>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Card>
  );
}
