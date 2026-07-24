import type { Metadata } from "next";
import { Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/get-session";

export const metadata: Metadata = { title: "Data export · Settings" };

const SUPPORT_EMAIL = "support@example.com";
// Set to your support WhatsApp number, e.g. "+919876543210". Empty disables the button.
const SUPPORT_WHATSAPP: string = "";

const INCLUDES = [
  "All members (active + deleted)",
  "All memberships (current + history)",
  "All payments (incl. refunds)",
  "All plans & add-ons",
];

export default async function DataExportPage() {
  const session = await requireRole("owner");

  const emailSubject = encodeURIComponent(
    `Data export request — ${session.gym.name}`,
  );
  const emailBody = encodeURIComponent(
    [
      `Gym: ${session.gym.name}`,
      "",
      "What I'm trying to do (filing taxes / migrating / backup / other):",
      "",
      "When I'd ideally have the file:",
      "",
      "Anything specific I need (date range, particular sheets):",
      "",
    ].join("\n"),
  );
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${emailSubject}&body=${emailBody}`;
  const whatsappUrl = SUPPORT_WHATSAPP
    ? `https://wa.me/${SUPPORT_WHATSAPP.replace(/^\+/, "")}?text=${encodeURIComponent(`Hi, I'd like to request a data export for ${session.gym.name}.`)}`
    : null;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Data export
        </h2>
        <p className="text-muted-foreground text-xs">
          A copy of every member, membership, payment, freeze, and audit
          entry — packaged for backup, accounting handover, or platform
          migration.
        </p>
      </header>

      <div
        data-slot="card"
        className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card rounded-xl p-6 ring-1 shadow-xs"
      >
        <p className="text-foreground text-sm">
          Right now, exports are handled by us personally. Email or message
          us with what you need and we&rsquo;ll send a multi-sheet workbook
          back, usually within a working day.
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          Why not self-serve? Knowing what owners need exports for — taxes,
          a switch to another platform, an audit, a partner&rsquo;s spreadsheet
          — helps us improve the product. We&rsquo;ll automate this once
          we&rsquo;ve seen enough requests to know the right defaults.
        </p>

        <p className="text-muted-foreground mt-6 text-xs font-medium uppercase tracking-wide">
          What we&rsquo;ll send you
        </p>
        <ul className="text-foreground/90 mt-2 space-y-1 text-sm">
          {INCLUDES.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span className="text-muted-foreground mt-1 size-1 rounded-full bg-current" />
              {line}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild>
            <a href={mailto}>
              <Mail className="size-4" />
              Email us
            </a>
          </Button>
          {whatsappUrl ? (
            <Button asChild variant="outline">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" />
                Message on WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
