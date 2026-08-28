/** Auth types and token storage for the platform layer. */

export type AuthProvider = "anonymous" | "magic" | "google" | "github";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string;
  provider: AuthProvider;
  createdAt: number;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = "teamthink.auth.token.v1";
const USER_KEY = "teamthink.auth.user.v1";
const APP_CHECK_KEY = "teamthink.appCheck.v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getStoredToken(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function storeSession(session: AuthSession): void {
  if (!canUseStorage()) return;
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAppCheckToken(): string {
  if (!canUseStorage()) return "";
  let t = localStorage.getItem(APP_CHECK_KEY);
  if (!t) {
    t = `ac_${crypto.randomUUID().replace(/-/g, "")}`;
    localStorage.setItem(APP_CHECK_KEY, t);
  }
  return t;
}

export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = getStoredToken();
  if (token) h.Authorization = `Bearer ${token}`;
  const ac = getAppCheckToken();
  if (ac) h["X-TeamThink-App-Check"] = ac;
  return h;
}
