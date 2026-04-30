import type { Member } from "@/lib/db/schema/members";
import { memberGenders } from "@/lib/db/schema/members";
import { formatCalendarDate } from "@/lib/utils/dates";
import { formatPhoneForDisplay } from "@/lib/utils/phone";

const GENDER_LABELS: Record<(typeof memberGenders)[number], string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

export function MemberProfileCard({ member }: { member: Member }) {
  return (
    <Card title="Profile">
      <Field label="Phone" value={formatPhoneForDisplay(member.phone)} />
      <Field label="Email" value={member.email} />
      <Field
        label="Gender"
        value={member.gender ? GENDER_LABELS[member.gender] : null}
      />
      <Field
        label="Date of birth"
        value={member.dob ? formatCalendarDate(member.dob) : null}
      />
      <Field label="Joined" value={formatCalendarDate(member.joinedDate)} />
    </Card>
  );
}

export function MemberExtrasCard({ member }: { member: Member }) {
  const hasAddress = !!member.address;
  const hasEmergency =
    !!member.emergencyContactName || !!member.emergencyContactPhone;
  if (!hasAddress && !hasEmergency) return null;

  return (
    <Card title="Address & emergency contact">
      <Field label="Address" value={member.address} multiline />
      <Field label="Emergency name" value={member.emergencyContactName} />
      <Field
        label="Emergency phone"
        value={
          member.emergencyContactPhone
            ? formatPhoneForDisplay(member.emergencyContactPhone)
            : null
        }
      />
    </Card>
  );
}

export function MemberNotesCard({ member }: { member: Member }) {
  if (!member.notes) return null;
  return (
    <Card title="Notes">
      <p className="text-foreground text-sm whitespace-pre-wrap">{member.notes}</p>
    </Card>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-xl border p-5">
      <h2 className="text-foreground mb-4 text-sm font-semibold tracking-tight">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </span>
      <span
        className={
          value
            ? multiline
              ? "text-foreground whitespace-pre-wrap"
              : "text-foreground"
            : "text-muted-foreground"
        }
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
