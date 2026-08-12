import Image from "next/image";
import Link from "next/link";

type Props = {
  children: React.ReactNode;
  /** Optional small footer note rendered under the form panel. */
  footer?: React.ReactNode;
};

/**
 * Shared two-column auth shell. Image panel on the LEFT, form panel on the
 * RIGHT — mirrors shadcn's `login-04` block but with positions swapped.
 *
 * Sizing matches login-04: `max-w-3xl` outer, `p-6 md:p-8` form panel. In
 * the original block the image element gives the card its height; we use a
 * gradient instead, so we set `md:min-h-[480px]` to land on roughly the
 * same proportions.
 */
export function AuthSplit({ children, footer }: Props) {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-3xl">
        <div className="bg-card text-card-foreground ring-foreground/10 overflow-hidden rounded-xl ring-1 shadow-sm">
          <div className="grid md:min-h-[480px] md:grid-cols-2">
            {/* Image / brand panel — hidden on mobile to save space. */}
            <div className="from-primary via-primary/95 to-primary/75 relative hidden bg-gradient-to-br md:block">
              <div className="absolute inset-0 flex flex-col p-8 text-white">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-sm font-medium tracking-tight"
                >
                  <Image
                    src="/gym-os-logo.png"
                    alt="GymOS"
                    width={32}
                    height={32}
                    priority
                    className="size-8 rounded-md ring-1 ring-white/30"
                  />
                  GymOS
                </Link>
                <div className="mt-auto space-y-3">
                  <p className="text-balance text-2xl font-semibold leading-[1.2] tracking-tight">
                    Run your gym with calm, professional software built for
                    Indian operators.
                  </p>
                  <p className="text-white/80 text-sm leading-relaxed">
                    Members, payments, freezes, reports — and a tamper-evident
                    audit log for every change.
                  </p>
                </div>
              </div>
            </div>
            {/* Form panel */}
            <div className="flex items-center p-6 md:p-8">
              <div className="w-full">{children}</div>
            </div>
          </div>
        </div>
        {footer ? (
          <p className="text-muted-foreground mt-6 text-center text-xs">
            {footer}
          </p>
        ) : null}
      </div>
    </div>
  );
}
