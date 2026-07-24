import { Dumbbell } from "lucide-react";
import Link from "next/link";
import { CONTACT, demoMailto, demoWhatsapp, NAV_LINKS } from "./landing-data";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Dumbbell className="size-4" />
              </span>
              <span className="text-base font-semibold tracking-tight">
                GymOS
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Gym management software for the Indian market. Members, payments,
              renewals, and reports — in one place.
            </p>
          </div>

          <div className="flex gap-12">
            <div>
              <p className="text-sm font-semibold text-foreground">Product</p>
              <ul className="mt-3 space-y-2">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
                <li>
                  <Link
                    href="/login"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Login
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">Contact</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <a
                    href={demoMailto}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {CONTACT.email}
                  </a>
                </li>
                <li>
                  <a
                    href={demoWhatsapp}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    WhatsApp {CONTACT.whatsappDisplay}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            © 2026 GymOS. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
