import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthSplit } from "../_components/auth-split";

export const metadata: Metadata = { title: "Get started" };

const SUPPORT_EMAIL = "support@example.com";
// Set to a real number to enable the WhatsApp button.
const SUPPORT_WHATSAPP: string = "";

export default function SignupPage() {
  const emailSubject = encodeURIComponent("New gym onboarding request");
  const emailBody = encodeURIComponent(
    [
      "Hi, I'd like to set up a new gym account.",
      "",
      "Gym name:",
      "Owner name:",
      "Phone:",
      "City / location:",
      "Number of branches:",
      "Approximate member count:",
      "",
    ].join("\n"),
  );
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${emailSubject}&body=${emailBody}`;
  const whatsappUrl = SUPPORT_WHATSAPP
    ? `https://wa.me/${SUPPORT_WHATSAPP.replace(/^\+/, "")}?text=${encodeURIComponent("Hi, I'd like to set up a new gym account.")}`
    : null;

  return (
    <AuthSplit>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Let&rsquo;s set you up
          </h1>
          <p className="text-muted-foreground text-balance text-sm">
            New gyms are onboarded by us personally so we can pick the right
            plan, branch setup, and invoice prefix on day one.
          </p>
        </div>
        <div className="space-y-3">
          <Button asChild className="w-full">
            <a href={mailto}>
              <Mail className="size-4" />
              Email us
            </a>
          </Button>
          {whatsappUrl ? (
            <Button asChild variant="outline" className="w-full">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" />
                Message on WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground text-balance text-center text-xs">
          We usually respond within a working day. Once your gym is created
          we&rsquo;ll share login details for the owner account.
        </p>
        <div className="text-muted-foreground text-center text-xs">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    </AuthSplit>
  );
}
