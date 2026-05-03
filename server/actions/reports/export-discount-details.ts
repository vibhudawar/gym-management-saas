"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth/get-session";
import { getDiscountLeakageReport } from "@/server/queries/reports/get-discount-leakage-report";
import { isValidDateRange } from "@/lib/utils/date-presets";
import { formatCalendarDate } from "@/lib/utils/dates";

const inputSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Server-action variant of the discount leakage query that returns the FULL
 * detail list (no 500-row cap). Used only by the Excel export so the CA gets
 * every row.
 */
export async function exportDiscountDetails(input: unknown): Promise<
  Array<{
    Date: string;
    Member: string;
    Plan: string;
    "Discount (₹)": number;
    Reason: string;
    "Enrolled by": string;
  }>
> {
  await requireRole("owner", "branch_manager");
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return [];
  if (!isValidDateRange(parsed.data)) return [];

  const report = await getDiscountLeakageReport(parsed.data, {
    capDetails: false,
  });
  return report.details.map((d) => ({
    Date: formatCalendarDate(d.createdDate),
    Member: d.memberName,
    Plan: d.planName,
    "Discount (₹)": d.discountPaise / 100,
    Reason: d.reason ?? "",
    "Enrolled by": d.enrolledByUserName ?? "",
  }));
}
