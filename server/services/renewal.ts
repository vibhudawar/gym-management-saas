import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberships } from "@/lib/db/schema/memberships";
import type { SessionContext } from "@/lib/auth/get-session";
import { enroll, type EnrollmentInput, type EnrollmentResult } from "./enrollment";

export type StartMode = "from_today" | "from_previous_end" | "custom";

export type RenewalInput = Omit<
  EnrollmentInput,
  "startDate" | "previousMembershipId"
> & {
  startMode: StartMode;
  customStartDate?: string; // required when startMode = "custom"
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function renew(
  session: SessionContext,
  input: RenewalInput,
): Promise<EnrollmentResult> {
  // Find the most recent membership for this member.
  const [previous] = await db
    .select({
      id: memberships.id,
      endDate: memberships.endDate,
      status: memberships.status,
    })
    .from(memberships)
    .where(
      and(
        eq(memberships.memberId, input.memberId),
        eq(memberships.gymId, session.gym.id),
        isNull(memberships.deletedAt),
      ),
    )
    .orderBy(desc(memberships.startDate))
    .limit(1);

  let startDate: string;
  switch (input.startMode) {
    case "from_today":
      startDate = todayIso();
      break;
    case "from_previous_end":
      if (!previous) {
        return {
          ok: false,
          code: "INVALID_START_DATE",
          message: "No previous membership to extend from.",
        };
      }
      startDate = addDays(previous.endDate, 1);
      break;
    case "custom":
      if (!input.customStartDate) {
        return {
          ok: false,
          code: "INVALID_START_DATE",
          message: "Custom start date is required.",
        };
      }
      startDate = input.customStartDate;
      break;
  }

  return enroll(session, {
    ...input,
    startDate,
    previousMembershipId: previous?.id ?? null,
  });
}
