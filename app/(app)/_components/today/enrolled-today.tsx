"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import type { PaymentMode } from "@/lib/db/schema/payments";
import { formatMoney } from "@/lib/utils/money";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import { cn } from "@/lib/utils";
import type { EnrolledTodayRow } from "@/server/queries/today/get-today-snapshot";

type Props = {
  rows: EnrolledTodayRow[];
  total: number;
  currentUserId: string;
  highlightOwnRows: boolean;
  todayIstIso: string;
};

const MODE_LABEL: Record<PaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank",
};

function formatTimeIst(isoTimestamp: Date | string): string {
  const date =
    typeof isoTimestamp === "string" ? new Date(isoTimestamp) : isoTimestamp;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function EnrolledToday({
  rows,
  total,
  currentUserId,
  highlightOwnRows,
  todayIstIso,
}: Props) {
  const router = useRouter();
  const hasOverflow = total > rows.length;

  return (
    <section
      id="enrolled-today"
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card scroll-mt-24 overflow-hidden rounded-xl ring-1 shadow-xs"
    >
      <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
        <div>
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            Enrolled today
          </h2>
        </div>
        {total > 0 ? (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {total}
          </Badge>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <div className="text-muted-foreground px-5 py-4 text-sm">
          No enrolments yet today.
        </div>
      ) : (
        <>
          <ul>
            {rows.map((row) => {
              const isOwn =
                highlightOwnRows && row.enrolledByUserId === currentUserId;
              return (
                <li key={row.membershipId}>
                  <button
                    type="button"
                    onClick={() => router.push(`/members/${row.memberId}`)}
                    className={cn(
                      "border-border hover:bg-muted/40 grid w-full grid-cols-[1fr_1fr_auto_auto] items-center gap-4 border-b px-5 py-3 text-left text-sm transition-colors last:border-0",
                      isOwn && "bg-blue-50/40 dark:bg-blue-500/5",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-sm font-medium">
                        {row.memberName}
                      </p>
                      <p className="text-muted-foreground font-mono text-xs tabular-nums">
                        {formatPhoneForDisplay(row.memberPhone)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground/90 truncate text-sm">
                        {row.planName}
                      </p>
                      {row.isFirstEnrollment ? (
                        <Badge
                          variant="secondary"
                          className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50 mt-0.5 text-[10px]"
                        >
                          New member
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-foreground tabular-nums text-sm font-medium">
                        {formatMoney(row.amountPaise)}
                      </p>
                      {row.paymentMode ? (
                        <p className="text-muted-foreground text-[10px]">
                          {MODE_LABEL[row.paymentMode as PaymentMode] ??
                            row.paymentMode}
                        </p>
                      ) : null}
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-foreground tabular-nums text-sm">
                        {formatTimeIst(row.enrolledAt)}
                      </p>
                      {row.enrolledByUserName ? (
                        <p className="text-muted-foreground text-[10px]">
                          by {row.enrolledByUserName.split(" ")[0]}
                        </p>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {hasOverflow ? (
            <div className="border-border border-t px-5 py-3">
              <Link
                href={`/members?joinedFrom=${todayIstIso}`}
                className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
              >
                Show all {total.toLocaleString("en-IN")} today
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
