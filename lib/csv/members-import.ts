import { z } from "zod";
import { memberGenders } from "@/lib/db/schema/members";
import { todayIstIso } from "@/lib/utils/dates";
import { normalizeIndianPhone } from "@/lib/utils/phone";

export const IMPORT_COLUMNS = [
  "name",
  "phone",
  "email",
  "gender",
  "dob",
  "address",
  "emergency_contact_name",
  "emergency_contact_phone",
  "joined_date",
  "branch",
  "notes",
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export type RawCsvRow = Partial<Record<ImportColumn, string>>;

export type ImportStatus = "valid" | "warning" | "error" | "duplicate";

export type ParsedImportRow = {
  branchId: string;
  name: string;
  phone: string;
  email: string | null;
  gender: (typeof memberGenders)[number] | null;
  dob: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  joinedDate: string;
  notes: string | null;
};

export type ImportRow = {
  rowNumber: number;
  raw: RawCsvRow;
  status: ImportStatus;
  messages: string[];
  parsed: ParsedImportRow | null;
};

export type ValidateOptions = {
  branches: ReadonlyArray<{ id: string; name: string }>;
  existingPhones: ReadonlySet<string>;
  defaultBranchId?: string;
};

export const MAX_ROWS = 10_000;

const GENDER_ALIASES: Record<string, (typeof memberGenders)[number]> = {
  m: "male",
  male: "male",
  f: "female",
  female: "female",
  o: "other",
  other: "other",
  pnts: "prefer_not_to_say",
  prefer_not_to_say: "prefer_not_to_say",
  "prefer not to say": "prefer_not_to_say",
};

const NAME_RE = /^.{2,80}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function normaliseBranchKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildBranchIndex(
  branches: ReadonlyArray<{ id: string; name: string }>,
): Map<string, string> {
  const idx = new Map<string, string>();
  for (const b of branches) idx.set(normaliseBranchKey(b.name), b.id);
  return idx;
}

function parseDate(input: string | undefined): {
  iso: string | null;
  warning?: string;
} {
  if (!input || !input.trim()) return { iso: null };
  const trimmed = input.trim();
  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return { iso: trimmed };
  }
  // DD/MM/YYYY
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const day = dd.padStart(2, "0");
    const month = mm.padStart(2, "0");
    const iso = `${yyyy}-${month}-${day}`;
    const d = new Date(`${iso}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return { iso };
  }
  return { iso: null, warning: `Date "${trimmed}" not recognised (use YYYY-MM-DD)` };
}

function parseGender(
  input: string | undefined,
): (typeof memberGenders)[number] | null {
  if (!input || !input.trim()) return null;
  const key = input.trim().toLowerCase();
  return GENDER_ALIASES[key] ?? null;
}

export type ValidationSummary = {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  duplicates: number;
};

export function validateImportRows(
  rawRows: RawCsvRow[],
  options: ValidateOptions,
): { rows: ImportRow[]; summary: ValidationSummary } {
  const branchIndex = buildBranchIndex(options.branches);
  const seenPhones = new Set<string>();
  const rows: ImportRow[] = [];
  const summary: ValidationSummary = {
    total: rawRows.length,
    valid: 0,
    warnings: 0,
    errors: 0,
    duplicates: 0,
  };

  rawRows.forEach((raw, i) => {
    const rowNumber = i + 2; // header is line 1
    const messages: string[] = [];
    let warning = false;
    const errors: string[] = [];

    const name = (raw.name ?? "").trim();
    if (!NAME_RE.test(name)) {
      errors.push(`Name "${name || "(empty)"}" must be 2–80 characters`);
    }

    const phoneRaw = (raw.phone ?? "").trim();
    const phone = normalizeIndianPhone(phoneRaw);
    if (!phone) {
      errors.push(`Phone "${phoneRaw || "(empty)"}" is not a valid Indian mobile number`);
    }

    const emailRaw = (raw.email ?? "").trim();
    let email: string | null = null;
    if (emailRaw) {
      const lower = emailRaw.toLowerCase();
      if (EMAIL_RE.test(lower)) email = lower;
      else messages.push(`Email "${emailRaw}" looks invalid — saved as blank`);
      warning = warning || email === null;
    }

    const genderRaw = (raw.gender ?? "").trim();
    let gender: (typeof memberGenders)[number] | null = null;
    if (genderRaw) {
      gender = parseGender(genderRaw);
      if (!gender) {
        messages.push(`Gender "${genderRaw}" not recognised — saved as blank`);
        warning = true;
      }
    }

    const dobParsed = parseDate(raw.dob);
    if (dobParsed.warning) {
      messages.push(`${dobParsed.warning} — saved as blank`);
      warning = true;
    }
    const dob = dobParsed.iso;

    const joinedParsed = parseDate(raw.joined_date);
    if (raw.joined_date?.trim() && joinedParsed.warning) {
      messages.push(`${joinedParsed.warning} — using today's date`);
      warning = true;
    }
    const joinedDate = joinedParsed.iso ?? todayIstIso();

    const address = (raw.address ?? "").trim() || null;
    if (address && address.length > 500) {
      errors.push(`Address exceeds 500 characters`);
    }
    const emergencyName = (raw.emergency_contact_name ?? "").trim() || null;
    if (emergencyName && emergencyName.length > 80) {
      errors.push(`Emergency contact name exceeds 80 characters`);
    }
    const emergencyPhoneRaw = (raw.emergency_contact_phone ?? "").trim();
    let emergencyPhone: string | null = null;
    if (emergencyPhoneRaw) {
      emergencyPhone = normalizeIndianPhone(emergencyPhoneRaw);
      if (!emergencyPhone) {
        messages.push(
          `Emergency contact phone "${emergencyPhoneRaw}" invalid — saved as blank`,
        );
        warning = true;
      }
    }
    const notes = (raw.notes ?? "").trim() || null;
    if (notes && notes.length > 1000) {
      errors.push(`Notes exceed 1000 characters`);
    }

    let branchId: string | undefined = undefined;
    const branchRaw = (raw.branch ?? "").trim();
    if (branchRaw) {
      const matched = branchIndex.get(normaliseBranchKey(branchRaw));
      if (matched) branchId = matched;
      else
        errors.push(
          `Branch "${branchRaw}" not found. Available: ${options.branches.map((b) => b.name).join(", ")}`,
        );
    } else if (options.defaultBranchId) {
      branchId = options.defaultBranchId;
      if (options.branches.length > 1) {
        messages.push(
          `Branch column empty — defaulting to ${options.branches.find((b) => b.id === branchId)?.name ?? "default branch"}`,
        );
        warning = true;
      }
    } else {
      errors.push("Branch column is required (multiple branches in this gym)");
    }

    let status: ImportStatus = "valid";
    let parsed: ParsedImportRow | null = null;

    if (errors.length > 0) {
      status = "error";
      summary.errors += 1;
    } else if (phone && (seenPhones.has(phone) || options.existingPhones.has(phone))) {
      status = "duplicate";
      summary.duplicates += 1;
      messages.unshift(
        seenPhones.has(phone)
          ? `Duplicate phone in this CSV (already on a previous row)`
          : `Phone already exists in your gym`,
      );
    } else if (warning) {
      status = "warning";
      summary.warnings += 1;
    } else {
      summary.valid += 1;
    }

    if (status !== "error" && status !== "duplicate" && phone && branchId) {
      seenPhones.add(phone);
      parsed = {
        branchId,
        name,
        phone,
        email,
        gender,
        dob,
        address,
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
        joinedDate,
        notes,
      };
    }

    if (status === "error" && messages.length === 0) {
      messages.push(...errors);
    }
    if (errors.length > 0 && messages.length === 0) {
      messages.push(...errors);
    }
    rows.push({
      rowNumber,
      raw,
      status,
      messages: status === "error" ? errors : messages,
      parsed,
    });
  });

  return { rows, summary };
}

/** Server-side strict schema for re-validation of a single row before insert. */
export const importedRowSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  email: z.string().email().max(120).nullable(),
  gender: z.enum(memberGenders).nullable(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  address: z.string().max(500).nullable(),
  emergencyContactName: z.string().max(80).nullable(),
  emergencyContactPhone: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable(),
  joinedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).nullable(),
});
