"use server";

import {
  globalSearchMembers,
  type GlobalSearchHit,
} from "@/server/queries/members/global-search-members";

export async function searchMembersAction(query: string): Promise<GlobalSearchHit[]> {
  return globalSearchMembers(query, 8);
}
