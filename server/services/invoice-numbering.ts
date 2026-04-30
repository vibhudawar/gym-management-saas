import { and, eq, sql } from "drizzle-orm";
import type { Transaction } from "@/lib/db/types";
import { gyms } from "@/lib/db/schema/gyms";
import { invoiceSequences } from "@/lib/db/schema/invoice-sequences";

/**
 * Allocate the next invoice number for the gym, locking the per-gym/year row
 * with `FOR UPDATE` so concurrent enrollments cannot collide.
 *
 * Format: `{prefix}-{year}-{seq}` — `prefix` is `gyms.invoice_prefix` with any
 * trailing dashes stripped, `seq` is zero-padded to 4 digits.
 *
 * Must be called inside a `db.transaction(async (tx) => ...)` so the
 * `FOR UPDATE` lock is held for the duration of the enrollment.
 */
export async function allocateInvoiceNumber(
  tx: Transaction,
  gymId: string,
  date: Date = new Date(),
): Promise<string> {
  const year = date.getFullYear();

  const [gymRow] = await tx
    .select({ invoicePrefix: gyms.invoicePrefix })
    .from(gyms)
    .where(eq(gyms.id, gymId))
    .limit(1);
  if (!gymRow) {
    throw new Error("Gym not found while allocating invoice number");
  }
  const prefix = gymRow.invoicePrefix.replace(/-+$/, "");

  // SELECT ... FOR UPDATE to serialize concurrent allocations.
  const locked = await tx
    .select({ lastSeq: invoiceSequences.lastSeq })
    .from(invoiceSequences)
    .where(
      and(eq(invoiceSequences.gymId, gymId), eq(invoiceSequences.year, year)),
    )
    .for("update")
    .limit(1);

  let nextSeq: number;
  if (locked.length === 0) {
    await tx.insert(invoiceSequences).values({ gymId, year, lastSeq: 1 });
    nextSeq = 1;
  } else {
    nextSeq = locked[0].lastSeq + 1;
    await tx
      .update(invoiceSequences)
      .set({ lastSeq: nextSeq, updatedAt: sql`now()` })
      .where(
        and(eq(invoiceSequences.gymId, gymId), eq(invoiceSequences.year, year)),
      );
  }

  return `${prefix}-${year}-${String(nextSeq).padStart(4, "0")}`;
}
