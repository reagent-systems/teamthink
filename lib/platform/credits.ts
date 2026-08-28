/** Credit ledger for compute donation incentives (ROADMAP #70). */

const CREDITS_KEY = "teamthink.credits.v1";

export interface CreditBalance {
  earned: number;
  spent: number;
}

function readAll(): Record<string, CreditBalance> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CREDITS_KEY) ?? "{}") as Record<
      string,
      CreditBalance
    >;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, CreditBalance>): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CREDITS_KEY, JSON.stringify(map));
}

export function getCredits(userId: string): CreditBalance {
  return readAll()[userId] ?? { earned: 0, spent: 0 };
}

export function earnCredits(userId: string, amount: number): CreditBalance {
  const all = readAll();
  const cur = all[userId] ?? { earned: 0, spent: 0 };
  cur.earned += amount;
  all[userId] = cur;
  writeAll(all);
  return cur;
}

export function spendCredits(userId: string, amount: number): boolean {
  const all = readAll();
  const cur = all[userId] ?? { earned: 0, spent: 0 };
  if (cur.earned - cur.spent < amount) return false;
  cur.spent += amount;
  all[userId] = cur;
  writeAll(all);
  return true;
}

export function balance(userId: string): number {
  const c = getCredits(userId);
  return c.earned - c.spent;
}
