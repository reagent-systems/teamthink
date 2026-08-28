"use client";

import { useEffect, useState } from "react";
import { getStoredUser, type AuthUser } from "@/lib/auth/types";
import { onAuthStateChanged } from "@/lib/auth/client";

export function useAuth(): {
  user: AuthUser | null;
  loading: boolean;
} {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return { user, loading };
}
