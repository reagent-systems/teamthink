"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ensureAuth,
  joinRoom,
  fetchRoomMembers,
  triggerRoomCreated,
} from "@/lib/auth/client";
import {
  permissionsForRole,
  mergeWithLegacyRole,
  type MembershipRole,
} from "@/lib/rbac/policy";
import type { RoomRole } from "@/lib/grid/types";
import { pullRoomState, startRoomSync } from "@/lib/persistence/sync";
import { fetchRemoteConfig, type RemoteConfig } from "@/lib/remote-config/client";

export function useRoomPlatform(
  roomId: string,
  legacyRole: RoomRole,
  getYjsSnapshot?: () => Uint8Array | null,
) {
  const [membershipRole, setMembershipRole] = useState<MembershipRole | null>(null);
  const [canCompute, setCanCompute] = useState(false);
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfig | null>(null);
  const [members, setMembers] = useState<
    { userId: string; role: string; displayName?: string }[]
  >([]);

  useEffect(() => {
    let stopSync: (() => void) | undefined;
    void (async () => {
      try {
        const user = await ensureAuth();
        const joined = await joinRoom(roomId, {
          compute: legacyRole === "compute" || legacyRole === "owner",
        });
        setMembershipRole(joined.role as MembershipRole);
        setCanCompute(joined.compute);
        if (joined.role === "owner") {
          await triggerRoomCreated(roomId, user.id);
        }
        const m = await fetchRoomMembers(roomId);
        setMembers(m);
        await pullRoomState(roomId);
        const cfg = await fetchRemoteConfig();
        setRemoteConfig(cfg);
        if (getYjsSnapshot) {
          stopSync = startRoomSync(roomId, getYjsSnapshot);
        }
      } catch {
        // platform optional when worker unset
      }
    })();
    return () => stopSync?.();
  }, [roomId, legacyRole, getYjsSnapshot]);

  const effectiveRole = mergeWithLegacyRole(membershipRole, legacyRole);
  const permissions = permissionsForRole(effectiveRole, canCompute);

  const refreshMembers = useCallback(async () => {
    try {
      const m = await fetchRoomMembers(roomId);
      setMembers(m);
    } catch {
      // ignore
    }
  }, [roomId]);

  return {
    membershipRole: effectiveRole,
    permissions,
    members,
    remoteConfig,
    refreshMembers,
  };
}
