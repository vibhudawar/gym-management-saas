"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/get-session";
import {
  unfreezeEarlyService,
  type UnfreezeEarlyResult,
} from "@/server/services/unfreeze";

const inputSchema = z.object({
  freezeId: z.string().uuid(),
  unfreezeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  earlyUnfreezeReason: z.string().trim().min(10).max(500),
  memberId: z.string().uuid().optional(),
});

export async function unfreezeEarlyAction(
  input: unknown,
): Promise<UnfreezeEarlyResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_DATE",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const session = await requireRole("owner", "branch_manager");
  const result = await unfreezeEarlyService(session, parsed.data);
  if (result.ok) {
    revalidatePath("/app");
    revalidatePath("/app/members");
    if (parsed.data.memberId) {
      revalidatePath(`/app/members/${parsed.data.memberId}`);
    }
  }
  return result;
}
