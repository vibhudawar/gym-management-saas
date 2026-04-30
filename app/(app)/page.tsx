import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/get-session";

export default async function TodayPage() {
  const session = await requireUser();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title={`Welcome, ${session.user.name.split(" ")[0]}`}
        description="Today's view will land in Module 05. Auth, tenancy, and the layout shell are live."
      />
      <div className="bg-card text-muted-foreground rounded-xl border p-6 text-sm">
        Logged in as <span className="text-foreground font-medium">{session.email}</span>{" "}
        ·{" "}
        <span className="text-foreground font-medium">
          {session.user.role.replace("_", " ")}
        </span>{" "}
        @{" "}
        <span className="text-foreground font-medium">{session.gym.name}</span>
        {session.branch ? <> · {session.branch.name}</> : null}
      </div>
    </div>
  );
}
