import { and, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { branches, type Branch } from "@/lib/db/schema/branches";
import { gyms, type Gym } from "@/lib/db/schema/gyms";
import { users, type User } from "@/lib/db/schema/users";
import { createSupabaseServerClient } from "./supabase-server";
import { ALL_ROLES, type Role } from "./roles";

export const ACTIVE_BRANCH_COOKIE = "active_branch_id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SessionContext = {
  authUserId: string;
  email: string;
  user: User;
  gym: Gym;
  /** The user's permanent branch assignment (null for owners). Used for permission checks. */
  branch: Branch | null;
  /**
   * The branch currently in view. Equals `branch` for non-owners. For owners it
   * reflects the cookie-backed selector — `null` means "all branches". Use this
   * for data filters; never for permission checks.
   */
  activeBranch: Branch | null;
};

/**
 * Cryptographically validates the JWT via getClaims() and returns the raw claims.
 * Returns null when there is no session.
 */
export const getClaims = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return data.claims;
});

/**
 * Loads the local users row + gym + branch for the authed user.
 * Returns null if there is no session, the user is soft-deleted, or inactive.
 *
 * Exposed as both `getCurrentSession` and `getCurrentUser` — the latter is
 * the public name used in module specs, the former is more descriptive
 * about what's actually returned.
 */
export const getCurrentSession = cache(async (): Promise<SessionContext | null> => {
  const claims = await getClaims();
  if (!claims) return null;

  const authUserId = claims.sub;
  if (!authUserId) return null;

  // Read up front so the active branch resolves in the same round-trip.
  const cookieStore = await cookies();
  const rawBranchId = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;
  // A non-uuid value would fail the whole query with a 22P02 syntax error.
  const cookieBranchId = rawBranchId && UUID_RE.test(rawBranchId) ? rawBranchId : null;

  const activeBranches = alias(branches, "active_branches");

  const row = await db
    .select({ user: users, gym: gyms, branch: branches, activeBranch: activeBranches })
    .from(users)
    .innerJoin(gyms, eq(gyms.id, users.gymId))
    .leftJoin(branches, eq(branches.id, users.branchId))
    .leftJoin(
      activeBranches,
      cookieBranchId
        ? and(
            eq(activeBranches.id, cookieBranchId),
            // The cookie outlives a session — never resolve another gym's branch.
            eq(activeBranches.gymId, users.gymId),
            eq(activeBranches.isActive, true),
            isNull(activeBranches.deletedAt),
          )
        : sql`false`,
    )
    .where(
      and(
        eq(users.authUserId, authUserId),
        eq(users.isActive, true),
        isNull(users.deletedAt),
        isNull(gyms.deletedAt),
      ),
    )
    .limit(1);

  if (row.length === 0) return null;
  const { user, gym, branch } = row[0];

  // Owners follow the cookie (null = all branches); everyone else their assignment.
  const activeBranch: Branch | null =
    user.role === "owner" ? (row[0].activeBranch ?? null) : (branch ?? null);

  return {
    authUserId,
    email: typeof claims.email === "string" ? claims.email : user.email,
    user,
    gym,
    branch: branch ?? null,
    activeBranch,
  };
});

export const getCurrentUser = getCurrentSession;

/**
 * Redirects to /login if there is no session. Returns the session otherwise.
 */
export async function requireUser(): Promise<SessionContext> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Redirects to /login if no session, to / if the role is not permitted.
 */
export async function requireRole(
  ...roles: readonly Role[]
): Promise<SessionContext> {
  if (roles.length === 0 || roles.some((r) => !ALL_ROLES.includes(r))) {
    throw new Error("requireRole called without a valid role list");
  }
  const session = await requireUser();
  if (!roles.includes(session.user.role)) redirect("/app");
  return session;
}
