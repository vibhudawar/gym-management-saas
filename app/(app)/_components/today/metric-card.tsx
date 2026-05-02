import { TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "flat";

type Props = {
  /** Label shown small at the top of the card. */
  label: string;
  /** The big tabular-nums figure. */
  bigNumber: string;
  /** Top-right outline pill — the short delta (e.g., "↑ ₹3.2K"). */
  delta?: { text: string; direction: Direction } | null;
  /** First (bold) footer line — short trend phrase. */
  footerHeadline?: string | null;
  /** Direction icon next to the headline. */
  footerDirection?: Direction;
  /** Second (muted) footer line — supporting context. */
  footerSubline?: string | null;
  href?: string;
};

const ARROW_BY_DIRECTION = {
  up: TrendingUp,
  down: TrendingDown,
  flat: null,
} as const;

export function MetricCard({
  label,
  bigNumber,
  delta,
  footerHeadline,
  footerDirection = "flat",
  footerSubline,
  href,
}: Props) {
  const FooterIcon = ARROW_BY_DIRECTION[footerDirection];
  const DeltaIcon = delta ? ARROW_BY_DIRECTION[delta.direction] : null;

  const card = (
    <Card className="@container/card h-full transition-colors hover:ring-foreground/20">
      <CardHeader>
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="text-foreground text-2xl font-semibold tabular-nums tracking-tight @[250px]/card:text-3xl">
          {bigNumber}
        </CardTitle>
        {delta ? (
          <CardAction>
            <Badge variant="outline" className="gap-1 text-xs">
              {DeltaIcon ? <DeltaIcon className="size-3" /> : null}
              {delta.text}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1 border-t-0 bg-transparent pt-0 text-sm">
        {footerHeadline ? (
          <div
            className={cn(
              "flex items-center gap-1.5 font-medium",
              footerDirection === "up" && "text-emerald-700",
              footerDirection === "down" && "text-destructive",
              footerDirection === "flat" && "text-foreground",
            )}
          >
            <span className="line-clamp-1">{footerHeadline}</span>
            {FooterIcon ? <FooterIcon className="size-4 shrink-0" /> : null}
          </div>
        ) : null}
        {footerSubline ? (
          <div className="text-muted-foreground line-clamp-1 text-xs">
            {footerSubline}
          </div>
        ) : null}
      </CardFooter>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none">
        {card}
      </Link>
    );
  }
  return card;
}
