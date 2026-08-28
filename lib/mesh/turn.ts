import { WORKER_HTTP_URL } from "@/lib/config";
import { authHeaders } from "@/lib/auth/types";

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const TURN_CACHE_KEY = "teamthink.turn.v1";
const TURN_TTL_MS = 50 * 60 * 1000;

interface TurnCache {
  servers: IceServer[];
  fetchedAt: number;
}

/** Fetch time-limited TURN credentials from the Worker (ROADMAP #73). */
export async function fetchTurnCredentials(): Promise<IceServer[]> {
  const cached = readCache();
  if (cached && Date.now() - cached.fetchedAt < TURN_TTL_MS) {
    return cached.servers;
  }
  if (!WORKER_HTTP_URL) return [];
  try {
    const res = await fetch(`${WORKER_HTTP_URL}/turn/credentials`, {
      headers: authHeaders(),
    });
    const data = (await res.json()) as { servers?: IceServer[] };
    const servers = data.servers ?? [];
    writeCache({ servers, fetchedAt: Date.now() });
    return servers;
  } catch {
    return cached?.servers ?? [];
  }
}

function readCache(): TurnCache | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(TURN_CACHE_KEY) ?? "null") as TurnCache;
  } catch {
    return null;
  }
}

function writeCache(c: TurnCache): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TURN_CACHE_KEY, JSON.stringify(c));
}
