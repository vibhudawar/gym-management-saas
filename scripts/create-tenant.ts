import "dotenv/config";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { gyms } from "@/lib/db/schema/gyms";
import { users } from "@/lib/db/schema/users";
import { normalisePhone } from "@/lib/utils/phone";

const argSchema = z.object({
  gymName: z.string().trim().min(1),
  invoicePrefix: z
    .string()
    .trim()
    .min(1)
    .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, digits, or hyphens"),
  ownerName: z.string().trim().min(1),
  ownerEmail: z.string().trim().email(),
  ownerPhone: z.string().trim(),
  password: z.string().min(8).optional(),
  sendReset: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
});

function parse() {
  const { values } = parseArgs({
    options: {
      "gym-name": { type: "string" },
      "invoice-prefix": { type: "string" },
      "owner-name": { type: "string" },
      "owner-email": { type: "string" },
      "owner-phone": { type: "string" },
      password: { type: "string" },
      "send-reset": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });

  return argSchema.parse({
    gymName: values["gym-name"],
    invoicePrefix: values["invoice-prefix"],
    ownerName: values["owner-name"],
    ownerEmail: values["owner-email"],
    ownerPhone: values["owner-phone"],
    password: values["password"],
    sendReset: values["send-reset"],
  });
}

async function main() {
  const args = parse();

  const phone = normalisePhone(args.ownerPhone);
  if (!phone) {
    throw new Error(`Invalid phone "${args.ownerPhone}" — expected E.164 or 10-digit Indian number`);
  }

  const password = args.password ?? randomBytes(18).toString("base64url");
  const sendReset = args.sendReset ?? args.password === undefined;

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

      await tx
        .update(gyms)
        .set({ ownerUserId: user.id })
        .where(eq(gyms.id, gym.id));

      return { gymId: gym.id, branchId: branch.id, userId: user.id };
    });

    if (sendReset) {
      console.log("Sending password reset email…");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const { error: resetErr } = await admin.auth.resetPasswordForEmail(
        args.ownerEmail,
        { redirectTo: `${appUrl}/reset-password` },
      );
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
    if (!sendReset) {
      console.log("  password   :", password, "  (share securely)");
    }
  } catch (err) {
    console.error("Provisioning failed — rolling back auth user.", err);
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    throw err;
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
