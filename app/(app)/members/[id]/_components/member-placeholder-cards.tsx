import { CreditCard, ListChecks } from "lucide-react";

export function MembershipPlaceholderCard() {
  return (
    <section className="bg-card rounded-xl border p-5">
      <h2 className="text-foreground mb-3 text-sm font-semibold tracking-tight">
        Current membership
      </h2>
      <div className="text-muted-foreground flex items-start gap-3 text-sm">
        <ListChecks className="size-4 mt-0.5 shrink-0" />
        <p>
          No active membership. Enrolment lands in Module 04.
        </p>
      </div>
    </section>
  );
}

export function PaymentsPlaceholderCard() {
  return (
    <section className="bg-card rounded-xl border p-5">
      <h2 className="text-foreground mb-3 text-sm font-semibold tracking-tight">
        Recent payments
      </h2>
      <div className="text-muted-foreground flex items-start gap-3 text-sm">
        <CreditCard className="size-4 mt-0.5 shrink-0" />
        <p>No payments yet. Payments lands in Module 04.</p>
      </div>
    </section>
  );
}
