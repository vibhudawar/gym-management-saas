"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { members } from "@/lib/db/schema/members";
import { recordAudit } from "@/lib/auth/audit";
import { requireRole } from "@/lib/auth/get-session";
import {
  importedRowSchema,
  type ParsedImportRow,
} from "@/lib/csv/members-import";

export type ImportMembersResult =
  | {
      ok: true;
      imported: number;
      skipped: number;
      perRowErrors: Array<{ rowNumber: number; error: string }>;
    }
  | { ok: false; error: string; code?: string };

const BATCH_SIZE = 100;
const MAX_ROWS = 10_000;

export async function importMembers(
  rows: Array<{ rowNumber: number; row: ParsedImportRow }>,
): Promise<ImportMembersResult> {
  if (!Array.isArray(rows)) {
    return { ok: false, error: "Invalid payload.", code: "validation" };
  }
  if (rows.length === 0) {
    return { ok: false, error: "No rows to import.", code: "empty" };
  }
  if (rows.length > MAX_ROWS) {
    return {
      ok: false,
      error: `Import exceeds the ${MAX_ROWS}-row limit.`,
      code: "too_large",
    };
  }

  const session = await requireRole("owner", "branch_manager");
  const isOwner = session.user.role === "owner";

  // Re-validate every row (defense in depth — never trust the client).
  const perRowErrors: Array<{ rowNumber: number; error: string }> = [];
  const cleanRows: Array<{ rowNumber: number; row: ParsedImportRow }> = [];
  for (const r of rows) {
    const parsed = importedRowSchema.safeParse(r.row);
    if (!parsed.success) {
      perRowErrors.push({
        rowNumber: r.rowNumber,
        error: parsed.error.issues[0]?.message ?? "Invalid row",
      });
      continue;
    }
    if (!isOwner && session.branch && parsed.data.branchId !== session.branch.id) {
      perRowErrors.push({
        rowNumber: r.rowNumber,
        error: "You can only import members into your own branch.",
      });
      continue;
    }
    cleanRows.push({ rowNumber: r.rowNumber, row: parsed.data });
  }

  if (cleanRows.length === 0) {
    return { ok: false, error: "Every row failed validation.", code: "all_invalid" };
  }

  // Verify every branch id belongs to the gym.
  const branchIds = Array.from(new Set(cleanRows.map((r) => r.row.branchId)));
  const validBranches = await db
    .select({ id: branches.id })
    .from(branches)
    .where(
      and(
        eq(branches.gymId, session.gym.id),
        inArray(branches.id, branchIds),
        isNull(branches.deletedAt),
      ),
    );
  const validBranchIds = new Set(validBranches.map((b) => b.id));
  const validRows = cleanRows.filter((r) => {
    if (validBranchIds.has(r.row.branchId)) return true;
    perRowErrors.push({
      rowNumber: r.rowNumber,
      error: "Branch does not belong to this gym",
    });
    return false;
  });

  if (validRows.length === 0) {
    return { ok: false, error: "No rows passed branch validation.", code: "all_invalid" };
  }

  let imported = 0;
  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);
    try {
      const insertedRows = await db.transaction(async (tx) =>
        tx
          .insert(members)
          .values(
            batch.map(({ row }) => ({
              gymId: session.gym.id,
              branchId: row.branchId,
              name: row.name,
              phone: row.phone,
              email: row.email,
              gender: row.gender,
              dob: row.dob,
              address: row.address,
              emergencyContactName: row.emergencyContactName,
              emergencyContactPhone: row.emergencyContactPhone,
              notes: row.notes,
              joinedDate: row.joinedDate,
              createdByUserId: session.user.id,
            })),
          )
          .returning(),
      );
      for (const inserted of insertedRows) {
        await recordAudit({
          entityType: "member",
          entityId: inserted.id,
          branchId: inserted.branchId,
          action: "create",
          after: { ...inserted, source: "csv_import" },
        });
      }
      imported += insertedRows.length;
    } catch (err) {
      // If the batch fails (likely a unique violation that slipped through),
      // fall back to inserting one row at a time so we can report the offender.
      console.error("import batch failed, falling back to per-row", err);
      for (const { rowNumber, row } of batch) {
        try {
          const [inserted] = await db
            .insert(members)
            .values({
              gymId: session.gym.id,
              branchId: row.branchId,
              name: row.name,
              phone: row.phone,
              email: row.email,
              gender: row.gender,
              dob: row.dob,
              address: row.address,
              emergencyContactName: row.emergencyContactName,
              emergencyContactPhone: row.emergencyContactPhone,
              notes: row.notes,
              joinedDate: row.joinedDate,
              createdByUserId: session.user.id,
            })
            .returning();
          await recordAudit({
            entityType: "member",
            entityId: inserted.id,
            branchId: inserted.branchId,
            action: "create",
            after: { ...inserted, source: "csv_import" },
          });
          imported += 1;
        } catch (rowErr) {
          const code =
            typeof rowErr === "object" && rowErr !== null && "code" in rowErr
              ? (rowErr as { code: string }).code
              : null;
          perRowErrors.push({
            rowNumber,
            error:
              code === "23505"
                ? "Duplicate phone — another member already has this number"
                : "Failed to insert this row",
          });
        }
      }
    }
  }

  revalidatePath("/app/members");

  return {
    ok: true,
    imported,
    skipped: perRowErrors.length,
    perRowErrors,
  };
}
