import type { Role } from "@/lib/db/schema/users";

export const ROLES = {
  OWNER: "owner",
  BRANCH_MANAGER: "branch_manager",
  RECEPTIONIST: "receptionist",
} as const satisfies Record<string, Role>;

export const ALL_ROLES: readonly Role[] = [
  ROLES.OWNER,
  ROLES.BRANCH_MANAGER,
  ROLES.RECEPTIONIST,
] as const;

export function isOwner(role: Role): boolean {
  return role === ROLES.OWNER;
}

export function isManagerOrOwner(role: Role): boolean {
  return role === ROLES.OWNER || role === ROLES.BRANCH_MANAGER;
}

export function canSeeRevenueReports(role: Role): boolean {
  return isManagerOrOwner(role);
}

export function canSeeAuditLog(role: Role): boolean {
  return isManagerOrOwner(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  branch_manager: "Branch Manager",
  receptionist: "Receptionist",
};

export type { Role };
