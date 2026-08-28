/** Room RBAC: owner / admin / member / viewer with compute permissions. */

export type MembershipRole = "owner" | "admin" | "member" | "viewer";

export interface RoomPermissions {
  canInvite: boolean;
  canProvision: boolean;
  canSubmitPrompt: boolean;
  canManageMembers: boolean;
  canViewOnly: boolean;
  canDonateCompute: boolean;
}

const ROLE_MATRIX: Record<MembershipRole, RoomPermissions> = {
  owner: {
    canInvite: true,
    canProvision: true,
    canSubmitPrompt: true,
    canManageMembers: true,
    canViewOnly: false,
    canDonateCompute: true,
  },
  admin: {
    canInvite: true,
    canProvision: true,
    canSubmitPrompt: true,
    canManageMembers: true,
    canViewOnly: false,
    canDonateCompute: true,
  },
  member: {
    canInvite: false,
    canProvision: false,
    canSubmitPrompt: true,
    canManageMembers: false,
    canViewOnly: false,
    canDonateCompute: true,
  },
  viewer: {
    canInvite: false,
    canProvision: false,
    canSubmitPrompt: false,
    canManageMembers: false,
    canViewOnly: true,
    canDonateCompute: false,
  },
};

export function permissionsForRole(
  role: MembershipRole,
  compute: boolean,
): RoomPermissions {
  const base = ROLE_MATRIX[role];
  if (!compute) {
    return {
      ...base,
      canDonateCompute: false,
      canProvision: false,
    };
  }
  return base;
}

export function mergeWithLegacyRole(
  membershipRole: MembershipRole | null,
  legacyRole: "owner" | "compute" | "request",
): MembershipRole {
  if (membershipRole) return membershipRole;
  if (legacyRole === "owner") return "owner";
  if (legacyRole === "compute") return "member";
  return "viewer";
}

export function labelForRole(role: MembershipRole): string {
  const labels: Record<MembershipRole, string> = {
    owner: "Owner",
    admin: "Admin",
    member: "Member",
    viewer: "Viewer",
  };
  return labels[role];
}
