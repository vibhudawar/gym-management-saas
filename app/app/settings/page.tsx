import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/get-session";

export default async function SettingsIndexPage() {
  const session = await requireUser();
  // Owners land on the gym profile (most-used config); non-owners can only
  // edit their own account, so we send them there directly.
  if (session.user.role === "owner") redirect("/settings/gym");
  redirect("/settings/account");
}
