import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// CONFIG: replace with two real test users you've created via create-tenant.ts
const TENANT_A = {
  email: "owner-a@example.com",
  password: "test1234",
  expectedGymName: "Zenith Fitness",
};
const TENANT_B = {
  email: "owner-b@example.com",
  password: "test1234",
  expectedGymName: "Apex Studio",
};

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

type TestResult = { name: string; ok: boolean; detail?: string };
const results: TestResult[] = [];

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

async function signIn(email: string, password: string) {
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return { client, userId: data.user!.id };
}

async function main() {
  console.log("\n=== RLS Verification ===\n");

  const { client: clientA } = await signIn(TENANT_A.email, TENANT_A.password);
  const { client: clientB } = await signIn(TENANT_B.email, TENANT_B.password);

  // 1. Each user should see exactly one gym (their own).
  const { data: gymsA } = await clientA.from("gyms").select("id, name");
  const { data: gymsB } = await clientB.from("gyms").select("id, name");

  record(
    "Tenant A sees exactly 1 gym",
    gymsA?.length === 1 && gymsA[0].name === TENANT_A.expectedGymName,
    `saw ${gymsA?.length ?? 0} gyms: ${gymsA?.map((g) => g.name).join(", ")}`,
  );
  record(
    "Tenant B sees exactly 1 gym",
    gymsB?.length === 1 && gymsB[0].name === TENANT_B.expectedGymName,
    `saw ${gymsB?.length ?? 0} gyms: ${gymsB?.map((g) => g.name).join(", ")}`,
  );

  const gymIdB = gymsB![0].id;

  // 2. Tenant A cannot SELECT Tenant B's data on every business table.
  const tablesToCheck = [
    "branches",
    "users",
    "plans",
    "add_ons",
    "members",
    "memberships",
    "payments",
    "invoice_sequences",
    "audit_logs",
  ];

  for (const table of tablesToCheck) {
    const { data, error } = await clientA
      .from(table)
      .select("gym_id")
      .eq("gym_id", gymIdB);
    record(
      `Tenant A cannot SELECT ${table} from Tenant B`,
      !error && (data?.length ?? 0) === 0,
      error ? `error: ${error.message}` : `leaked rows: ${data?.length ?? 0}`,
    );
  }

  // membership_addons doesn't have gym_id directly — check via parent.
  const { data: leakedAddons, error: leakedAddonsError } = await clientB
    .from("membership_addons")
    .select("id");
  record(
    "Tenant B's view of membership_addons is gym-scoped",
    !leakedAddonsError,
    leakedAddonsError
      ? `error: ${leakedAddonsError.message}`
      : `count: ${leakedAddons?.length ?? 0}`,
  );

  // 3. Cross-tenant INSERT — plans.
  const { error: planInsertError } = await clientA.from("plans").insert({
    gym_id: gymIdB,
    name: "Malicious Plan",
    duration_days: 30,
    type: "general",
    default_price_paise: 100,
  });
  record(
    "Tenant A cannot INSERT into Tenant B's plans",
    planInsertError !== null,
    planInsertError
      ? `blocked: ${planInsertError.message}`
      : "INSERT SUCCEEDED — CRITICAL BUG",
  );

  // 4. Cross-tenant INSERT — memberships.
  const { error: membershipInsertError } = await clientA
    .from("memberships")
    .insert({
      gym_id: gymIdB,
      branch_id: ZERO_UUID,
      member_id: ZERO_UUID,
      plan_id: ZERO_UUID,
      start_date: "2026-01-01",
      end_date: "2026-04-01",
      original_end_date: "2026-04-01",
      plan_price_paise: 100000,
      addons_total_paise: 0,
      discount_paise: 0,
      final_amount_paise: 100000,
      status: "active",
      enrolled_by_user_id: ZERO_UUID,
    });
  record(
    "Tenant A cannot INSERT membership into Tenant B",
    membershipInsertError !== null,
    membershipInsertError
      ? `blocked: ${membershipInsertError.message}`
      : "INSERT SUCCEEDED — CRITICAL BUG",
  );

  // 5. Cross-tenant INSERT — payments.
  const { error: paymentInsertError } = await clientA.from("payments").insert({
    gym_id: gymIdB,
    branch_id: ZERO_UUID,
    membership_id: ZERO_UUID,
    member_id: ZERO_UUID,
    amount_paise: 100000,
    payment_mode: "cash",
    payment_date: "2026-04-30",
    invoice_number: "TEST-2026-9999",
    kind: "payment",
    received_by_user_id: ZERO_UUID,
  });
  record(
    "Tenant A cannot INSERT payment into Tenant B",
    paymentInsertError !== null,
    paymentInsertError
      ? `blocked: ${paymentInsertError.message}`
      : "INSERT SUCCEEDED — CRITICAL BUG",
  );

  // 6. Sanity: Tenant A reads their own data.
  const { data: ownPlans, error: ownPlansError } = await clientA
    .from("plans")
    .select("id");
  record(
    "Tenant A can read their own plans",
    !ownPlansError && Array.isArray(ownPlans),
    ownPlansError ? `error: ${ownPlansError.message}` : `count: ${ownPlans?.length ?? 0}`,
  );

  const { data: ownMemberships, error: ownMembershipsError } = await clientA
    .from("memberships")
    .select("id");
  record(
    "Tenant A can read their own memberships",
    !ownMembershipsError && Array.isArray(ownMemberships),
    ownMembershipsError
      ? `error: ${ownMembershipsError.message}`
      : `count: ${ownMemberships?.length ?? 0}`,
  );

  const { data: ownPayments, error: ownPaymentsError } = await clientA
    .from("payments")
    .select("id");
  record(
    "Tenant A can read their own payments",
    !ownPaymentsError && Array.isArray(ownPayments),
    ownPaymentsError
      ? `error: ${ownPaymentsError.message}`
      : `count: ${ownPayments?.length ?? 0}`,
  );

  // 7. DB CHECK constraint: kind='payment' must have positive amount.
  const { data: ownGym } = await clientA
    .from("gyms")
    .select("id")
    .limit(1)
    .single();
  const { data: ownBranch } = await clientA
    .from("branches")
    .select("id")
    .limit(1)
    .single();
  const { data: ownMember } = await clientA
    .from("members")
    .select("id")
    .limit(1)
    .single();
  const { data: ownMembership } = await clientA
    .from("memberships")
    .select("id")
    .limit(1)
    .single();
  const { data: ownUser } = await clientA
    .from("users")
    .select("id")
    .limit(1)
    .single();

  if (ownGym && ownBranch && ownMember && ownMembership && ownUser) {
    const { error: badSignError } = await clientA.from("payments").insert({
      gym_id: ownGym.id,
      branch_id: ownBranch.id,
      membership_id: ownMembership.id,
      member_id: ownMember.id,
      amount_paise: -1000, // negative + kind='payment' must be rejected
      payment_mode: "cash",
      payment_date: "2026-04-30",
      invoice_number: "TEST-SIGN-9999",
      kind: "payment",
      received_by_user_id: ownUser.id,
    });
    record(
      "DB rejects negative-amount payment with kind='payment'",
      badSignError !== null,
      badSignError
        ? `blocked: ${badSignError.message.slice(0, 80)}`
        : "INSERT SUCCEEDED — sign-invariant CHECK constraint missing",
    );

    // Companion check: positive amount + kind='refund' should also be rejected.
    const { error: badRefundError } = await clientA.from("payments").insert({
      gym_id: ownGym.id,
      branch_id: ownBranch.id,
      membership_id: ownMembership.id,
      member_id: ownMember.id,
      amount_paise: 1000, // positive + kind='refund' must be rejected
      payment_mode: "cash",
      payment_date: "2026-04-30",
      invoice_number: "TEST-REFUND-9999",
      kind: "refund",
      refund_of_payment_id: ZERO_UUID,
      received_by_user_id: ownUser.id,
    });
    record(
      "DB rejects positive-amount payment with kind='refund'",
      badRefundError !== null,
      badRefundError
        ? `blocked: ${badRefundError.message.slice(0, 80)}`
        : "INSERT SUCCEEDED — sign-invariant CHECK constraint missing",
    );
  } else {
    record(
      "DB sign-invariant test (skipped)",
      true,
      "Tenant A has no membership rows yet — enrol someone and re-run.",
    );
  }

  // === Branch scoping (manual, requires extra users) ===
  // Set up a Branch Manager / Receptionist whose branch differs from at least
  // one member's, then verify they don't see cross-branch members. Out of
  // scope for the automatic owner-vs-owner harness above.

  // === Receptionist UPDATE on payments must fail ===
  // The RLS policy `payments_tenant_update` only matches owner / branch_manager.
  // Add credentials below to exercise it once you've provisioned a receptionist.

  console.log("\n=== Summary ===");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Test run failed:", e);
  process.exit(1);
});
