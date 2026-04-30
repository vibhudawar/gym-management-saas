import { Badge } from "@/components/ui/badge";
import type { MembershipStatus } from "@/lib/db/schema/memberships";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<MembershipStatus, string> = {
  active: "Active",
  expired: "Expired",
  frozen: "Frozen",
  cancelled: "Cancelled",
};

const STATUS_CLASSES: Record<MembershipStatus, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  expired: "border-destructive/30 bg-destructive/5 text-destructive",
  frozen: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  cancelled: "border-muted bg-muted text-muted-foreground",
};

type Props = {
  status: MembershipStatus;
  className?: string;
};

export function MembershipStatusBadge({ status, className }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", STATUS_CLASSES[status], className)}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}
