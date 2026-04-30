"use server";

import { findByPhoneInGym, type DuplicateMatch } from "@/server/queries/members/find-by-phone-in-gym";
import { normalizeIndianPhone } from "@/lib/utils/phone";

export type CheckPhoneResult =
  | { ok: true; available: true }
  | { ok: true; available: false; existing: DuplicateMatch }
  | { ok: false; error: string; code?: string };

/**
 * Live duplicate check used by the Add Member form (TanStack Query, debounced).
 * Returns `available: false` with the existing record so the UI can render an
 * inline pointer. Returns `available: true` if the phone is unused.
 */
export async function checkPhoneAvailable(
  phone: string,
  ignoreMemberId?: string,
): Promise<CheckPhoneResult> {
  const normalised = normalizeIndianPhone(phone);
  if (!normalised) {
    return { ok: false, error: "Invalid phone format.", code: "validation" };
  }

  const existing = await findByPhoneInGym(normalised);
  if (!existing) return { ok: true, available: true };
  if (ignoreMemberId && existing.id === ignoreMemberId) {
    return { ok: true, available: true };
  }
  return { ok: true, available: false, existing };
}
