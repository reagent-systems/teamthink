/** Task priority classes for fair queues (ROADMAP #68). */

export type TaskPriority = "owner" | "member" | "guest";

const PRIORITY_RANK: Record<TaskPriority, number> = {
  owner: 0,
  member: 1,
  guest: 2,
};

export function priorityForRole(
  roomRole: "owner" | "compute" | "request",
  membershipRole?: string,
): TaskPriority {
  if (roomRole === "owner" || membershipRole === "owner" || membershipRole === "admin") {
    return "owner";
  }
  if (roomRole === "compute" || membershipRole === "member") return "member";
  return "guest";
}

export function comparePriority(a: TaskPriority, b: TaskPriority): number {
  return PRIORITY_RANK[a] - PRIORITY_RANK[b];
}

/** Anti-starvation: boost waiting time weight after 30s in queue. */
export function effectivePriority(
  base: TaskPriority,
  enqueuedAt: number,
): number {
  const waitSec = (Date.now() - enqueuedAt) / 1000;
  const boost = Math.floor(waitSec / 30);
  return PRIORITY_RANK[base] - boost * 0.1;
}
