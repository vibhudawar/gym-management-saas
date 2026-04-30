import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/get-session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (session) redirect("/");

  return (
    <main className="from-background via-background relative flex min-h-screen flex-col items-center justify-center bg-linear-to-b to-blue-50/40 px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-1.5">
        <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-md text-sm font-semibold tracking-tight">
          GM
        </div>
        <span className="text-foreground text-base font-semibold tracking-tight">
          Gym Management
        </span>
      </div>
      {children}
    </main>
  );
}
