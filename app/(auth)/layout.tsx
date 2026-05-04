import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/get-session";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (session) redirect("/");
  // Each auth page renders its own AuthSplit — the layout just gates access
  // so authenticated users can't land on the login screens.
  return <>{children}</>;
}
