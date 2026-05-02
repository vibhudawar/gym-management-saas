import "dotenv/config";
import { parseArgs } from "node:util";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { gyms } from "@/lib/db/schema/gyms";
import { users } from "@/lib/db/schema/users";
import { normalisePhone } from "@/lib/utils/phone";

/**
 * Default password for dev/testing when none is provided.
 * Once email is wired up, you can rely on --send-reset true instead.
 */
const DEFAULT_TEST_PASSWORD = "Test@12345";

/**
 * Multi-mode CLI:
 *   --mode tenant : create a new gym + first owner (bootstrap)
 *   --mode branch : add a new branch to an existing gym
 *   --mode staff  : create a branch_manager or receptionist in an existing gym
 *
 * Examples:
 *   pnpm tsx scripts/create-tenant.ts --mode tenant \
 *     --gym-name "Zenith Fitness" --invoice-prefix "ZEN" \
 *     --owner-name "Vibhu" --owner-email "vibhu@zenith.in" --owner-phone "+919876543210"
 *
 *   pnpm tsx scripts/create-tenant.ts --mode branch \
 *     --gym-id <uuid> --name "Saket Branch" [--address "..."] [--phone "..."]
 *
 *   pnpm tsx scripts/create-tenant.ts --mode staff \
 *     --gym-id <uuid> --branch-id <uuid> --role receptionist \
 *     --name "Priya" --email "priya@zenith.in" --phone "+919876543211"
 */

const tenantArgSchema = z.object({
  mode: z.literal("tenant"),
  gymName: z.string().trim().min(1, "--gym-name is required"),
  invoicePrefix: z
    .string()
    .trim()
    .min(1, "--invoice-prefix is required")
    .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, digits, or hyphens"),
  ownerName: z.string().trim().min(1, "--owner-name is required"),
  ownerEmail: z.string().trim().email("--owner-email must be a valid email"),
  ownerPhone: z.string().trim().min(1, "--owner-phone is required"),
  password: z.string().min(8).optional(),
  sendReset: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
});

const staffArgSchema = z.object({
  mode: z.literal("staff"),
  gymId: z.string().uuid("--gym-id must be a valid UUID"),
  branchId: z.string().uuid("--branch-id must be a valid UUID"),
  role: z.enum(["branch_manager", "receptionist"], {
    message: "--role must be 'branch_manager' or 'receptionist' (use --mode tenant for owner)",
  }),
  name: z.string().trim().min(1, "--name is required"),
  email: z.string().trim().email("--email must be a valid email"),
  phone: z.string().trim().min(1, "--phone is required"),
  password: z.string().min(8).optional(),
  sendReset: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
});

const branchArgSchema = z.object({
  mode: z.literal("branch"),
  gymId: z.string().uuid("--gym-id must be a valid UUID"),
  name: z.string().trim().min(1, "--name is required").max(80),
  address: z.string().trim().max(400).optional(),
  phone: z.string().trim().optional(),
});

const argSchema = z.discriminatedUnion("mode", [
  tenantArgSchema,
  branchArgSchema,
  staffArgSchema,
]);
type Args = z.infer<typeof argSchema>;

function parse(): Args {
  const { values } = parseArgs({
    options: {
      mode: { type: "string" },
      // tenant-mode args
      "gym-name": { type: "string" },
      "invoice-prefix": { type: "string" },
      "owner-name": { type: "string" },
      "owner-email": { type: "string" },
      "owner-phone": { type: "string" },
      // staff-mode args
      "gym-id": { type: "string" },
      "branch-id": { type: "string" },
      role: { type: "string" },
      name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      // branch-mode args (also reuses --gym-id, --name, --phone above)
      address: { type: "string" },
      // shared args
      password: { type: "string" },
      "send-reset": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });

  const mode = values.mode;
  if (mode !== "tenant" && mode !== "staff" && mode !== "branch") {
    throw new Error("--mode must be 'tenant', 'branch', or 'staff'");
  }

  let raw: unknown;
  if (mode === "tenant") {
    raw = {
      mode,
      gymName: values["gym-name"],
      invoicePrefix: values["invoice-prefix"],
      ownerName: values["owner-name"],
      ownerEmail: values["owner-email"],
      ownerPhone: values["owner-phone"],
      password: values.password,
      sendReset: values["send-reset"],
    };
  } else if (mode === "branch") {
    raw = {
      mode,
      gymId: values["gym-id"],
      name: values.name,
      address: values.address,
      phone: values.phone,
    };
  } else {
    raw = {
      mode,
      gymId: values["gym-id"],
      branchId: values["branch-id"],
      role: values.role,
      name: values.name,
      email: values.email,
      phone: values.phone,
      password: values.password,
      sendReset: values["send-reset"],
    };
  }

  return argSchema.parse(raw);
}

async function runTenantMode(args: Extract<Args, { mode: "tenant" }>) {
  const phone = normalisePhone(args.ownerPhone);
  if (!phone) {
    throw new Error(
      `Invalid phone "${args.ownerPhone}" — expected E.164 or 10-digit Indian number`,
    );
  }

  // Default for dev/testing: predictable password, no email.
  // Override with --password to set a custom one, or --send-reset true once email is wired up.
  const password = args.password ?? DEFAULT_TEST_PASSWORD;
  const sendReset = args.sendReset ?? false;

  const admin = createSupabaseAdminClient();

  console.log(`Creating auth user for ${args.ownerEmail}…`);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: args.ownerEmail,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`Could not create auth user: ${createErr?.message ?? "unknown"}`);
  }
  const authUserId = created.user.id;

  try {
    const { gymId, branchId, userId } = await db.transaction(async (tx) => {
      const [gym] = await tx
        .insert(gyms)
        .values({
          name: args.gymName,
          invoicePrefix: args.invoicePrefix,
          ownerUserId: null,
        })
        .returning({ id: gyms.id });

      const [branch] = await tx
        .insert(branches)
        .values({ gymId: gym.id, name: "Main Branch" })
        .returning({ id: branches.id });

      const [user] = await tx
        .insert(users)
        .values({
          authUserId,
          gymId: gym.id,
          branchId: null, // owners are not branch-scoped
          name: args.ownerName,
          email: args.ownerEmail,
          phone,
          role: "owner",
        })
        .returning({ id: users.id });

      await tx.update(gyms).set({ ownerUserId: user.id }).where(eq(gyms.id, gym.id));

      return { gymId: gym.id, branchId: branch.id, userId: user.id };
    });

    if (sendReset) {
      console.log("Sending password reset email…");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const { error: resetErr } = await admin.auth.resetPasswordForEmail(args.ownerEmail, {
        redirectTo: `${appUrl}/reset-password`,
      });
      if (resetErr) {
        console.warn(`Could not send reset email: ${resetErr.message}`);
      }
    }

    console.log("\n✓ Tenant provisioned");
    console.log("  gym_id     :", gymId);
    console.log("  branch_id  :", branchId);
    console.log("  user_id    :", userId);
    console.log("  auth_user  :", authUserId);
    console.log("  email      :", args.ownerEmail);
    console.log("  password   :", password);
    if (!sendReset) {
      console.log("\n  ↳ Email not sent. Use email + password above to log in.");
    }
  } catch (err) {
    console.error("Provisioning failed — rolling back auth user.", err);
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    throw err;
  }
}

async function runStaffMode(args: Extract<Args, { mode: "staff" }>) {
  const phone = normalisePhone(args.phone);
  if (!phone) {
    throw new Error(`Invalid phone "${args.phone}" — expected E.164 or 10-digit Indian number`);
  }

  // Pre-flight: verify gym + branch exist and branch belongs to gym (use admin client to bypass RLS).
  const admin = createSupabaseAdminClient();

  const gymRow = await db.query.gyms.findFirst({
    where: and(eq(gyms.id, args.gymId), isNull(gyms.deletedAt)),
  });
  if (!gymRow) {
    throw new Error(`Gym ${args.gymId} not found (or soft-deleted).`);
  }

  const branchRow = await db.query.branches.findFirst({
    where: and(
      eq(branches.id, args.branchId),
      eq(branches.gymId, args.gymId),
      isNull(branches.deletedAt),
    ),
  });
  if (!branchRow) {
    throw new Error(
      `Branch ${args.branchId} not found in gym ${args.gymId} (check both IDs and soft-delete state).`,
    );
  }

  const password = args.password ?? DEFAULT_TEST_PASSWORD;
  const sendReset = args.sendReset ?? false;

  console.log(`Creating auth user for ${args.email}…`);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: args.email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`Could not create auth user: ${createErr?.message ?? "unknown"}`);
  }
  const authUserId = created.user.id;

  try {
    const { userId } = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          authUserId,
          gymId: args.gymId,
          branchId: args.branchId, // required for branch_manager and receptionist
          name: args.name,
          email: args.email,
          phone,
          role: args.role,
        })
        .returning({ id: users.id });

      return { userId: user.id };
    });

    if (sendReset) {
      console.log("Sending password reset email…");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const { error: resetErr } = await admin.auth.resetPasswordForEmail(args.email, {
        redirectTo: `${appUrl}/reset-password`,
      });
      if (resetErr) {
        console.warn(`Could not send reset email: ${resetErr.message}`);
      }
    }

    console.log("\n✓ Staff user created");
    console.log("  role       :", args.role);
    console.log("  gym        :", gymRow.name, `(${args.gymId})`);
    console.log("  branch     :", branchRow.name, `(${args.branchId})`);
    console.log("  user_id    :", userId);
    console.log("  auth_user  :", authUserId);
    console.log("  email      :", args.email);
    console.log("  password   :", password);
    if (!sendReset) {
      console.log("\n  ↳ Email not sent. Use email + password above to log in.");
    }
  } catch (err) {
    console.error("Staff creation failed — rolling back auth user.", err);
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    throw err;
  }
}

async function runBranchMode(args: Extract<Args, { mode: "branch" }>) {
  const gymRow = await db.query.gyms.findFirst({
    where: and(eq(gyms.id, args.gymId), isNull(gyms.deletedAt)),
  });
  if (!gymRow) {
    throw new Error(`Gym ${args.gymId} not found (or soft-deleted).`);
  }

  let normalisedPhone: string | null = null;
  if (args.phone) {
    normalisedPhone = normalisePhone(args.phone);
    if (!normalisedPhone) {
      throw new Error(
        `Invalid phone "${args.phone}" — expected E.164 or 10-digit Indian number`,
      );
    }
  }

  const [branch] = await db
    .insert(branches)
    .values({
      gymId: args.gymId,
      name: args.name,
      address: args.address ?? null,
      phone: normalisedPhone,
    })
    .returning({ id: branches.id });

  console.log("\n✓ Branch created");
  console.log("  gym        :", gymRow.name, `(${args.gymId})`);
  console.log("  branch_id  :", branch.id);
  console.log("  name       :", args.name);
  if (args.address) console.log("  address    :", args.address);
  if (normalisedPhone) console.log("  phone      :", normalisedPhone);
}

async function main() {
  const args = parse();
  if (args.mode === "tenant") {
    await runTenantMode(args);
  } else if (args.mode === "branch") {
    await runBranchMode(args);
  } else {
    await runStaffMode(args);
  }
  process.exit(0);
}

main().catch((e) => {
  if (e instanceof z.ZodError) {
    console.error("Invalid arguments:");
    for (const issue of e.issues) {
      console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
  } else if (e instanceof Error) {
    console.error("Error:", e.message);
  } else {
    console.error(e);
  }
  process.exit(1);
});
