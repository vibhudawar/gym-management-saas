import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { members } from "@/lib/db/schema/members";
import {
  payments,
  type PaymentKind,
  type PaymentMode,
} from "@/lib/db/schema/payments";
import { plans } from "@/lib/db/schema/plans";
import { memberships } from "@/lib/db/schema/memberships";
import { users } from "@/lib/db/schema/users";
import { requireUser } from "@/lib/auth/get-session";

export type ListPaymentsInput = {
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  mode?: PaymentMode;
  kind?: PaymentKind | "all";
  search?: string;
  page?: number;
  pageSize?: number;
};

export type PaymentRow = {
  id: string;
  invoiceNumber: string;
  paymentDate: string;
  memberId: string;
  memberName: string;
  planName: string;
  amountPaise: number;
  paymentMode: PaymentMode;
  branchName: string;
  receivedByName: string | null;
  kind: PaymentKind;
};

export type ListPaymentsResult = {
  rows: PaymentRow[];
  total: number;
  netPaise: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function listPayments(
  input: ListPaymentsInput = {},
): Promise<ListPaymentsResult> {
  const session = await requireUser();
  const isOwner = session.user.role === "owner";

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
  );

  const conditions = [
    eq(payments.gymId, session.gym.id),
    isNull(payments.deletedAt),
  ];
  if (!isOwner && session.branch) {
    conditions.push(eq(payments.branchId, session.branch.id));
  }
  if (input.branchId && input.branchId !== "all") {
    conditions.push(eq(payments.branchId, input.branchId));
  }
  if (input.dateFrom) {
    conditions.push(gte(payments.paymentDate, input.dateFrom));
  }
  if (input.dateTo) {
    conditions.push(lte(payments.paymentDate, input.dateTo));
  }
  if (input.mode) {
    conditions.push(eq(payments.paymentMode, input.mode));
  }
  if (input.kind && input.kind !== "all") {
    conditions.push(eq(payments.kind, input.kind));
  }
  if (input.search && input.search.trim().length >= 2) {
    const pattern = `%${input.search.trim()}%`;
    const clause = or(
      ilike(members.name, pattern),
      ilike(payments.invoiceNumber, pattern),
    );
    if (clause) conditions.push(clause);
  }

  const where = and(...conditions);

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: payments.id,
        invoiceNumber: payments.invoiceNumber,
        paymentDate: payments.paymentDate,
        memberId: members.id,
        memberName: members.name,
        planName: plans.name,
        amountPaise: payments.amountPaise,
        paymentMode: payments.paymentMode,
        branchName: branches.name,
        receivedByName: users.name,
        kind: payments.kind,
      })
      .from(payments)
      .innerJoin(members, eq(members.id, payments.memberId))
      .innerJoin(branches, eq(branches.id, payments.branchId))
      .innerJoin(memberships, eq(memberships.id, payments.membershipId))
      .innerJoin(plans, eq(plans.id, memberships.planId))
      .leftJoin(users, eq(users.id, payments.receivedByUserId))
      .where(where)
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({
        total: sql<number>`count(*)::int`,
        netPaise: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::int`,
      })
      .from(payments)
      .innerJoin(members, eq(members.id, payments.memberId))
      .where(where),
  ]);

  return {
    rows,
    total: totals[0]?.total ?? 0,
    netPaise: totals[0]?.netPaise ?? 0,
    page,
    pageSize,
  };
}
