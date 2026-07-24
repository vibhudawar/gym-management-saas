import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { DateRange } from "@/lib/utils/date-presets";

type Props = {
  range: DateRange;
};

const TARGETS = [
  { tab: "revenue", label: "Detailed revenue breakdown" },
  { tab: "plans", label: "Plan performance" },
  { tab: "discounts", label: "Discount details" },
] as const;

export function DigDeeperLinks({ range }: Props) {
  return (
    <section>
      <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        Dig deeper
      </h3>
      <ul className="mt-2 space-y-1">
        {TARGETS.map((t) => (
          <li key={t.tab}>
            <Link
              href={`/app/reports?tab=${t.tab}&from=${range.from}&to=${range.to}`}
              className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
            >
              <ArrowRight className="size-3.5" />
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
