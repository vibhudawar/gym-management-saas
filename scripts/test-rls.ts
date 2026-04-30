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

  // 1. Sign in as Tenant A
  const { client: clientA } = await signIn(TENANT_A.email, TENANT_A.password);
  const { client: clientB } = await signIn(TENANT_B.email, TENANT_B.password);

  // 2. Each user should see exactly one gym (their own)
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

  // 3. Tenant A cannot see Tenant B's data
  const tablesToCheck = [
    "branches",
    "users",
    "plans",
    "add_ons",
    "members",
    "audit_logs",
    "memberships",
    "payments",
  ];

  for (const table of tablesToCheck) {
    const { data, error } = await clientA.from(table).select("gym_id").eq("gym_id", gymIdB);
    record(
      `Tenant A cannot SELECT ${table} from Tenant B`,
      !error && (data?.length ?? 0) === 0,
      error ? `error: ${error.message}` : `leaked rows: ${data?.length ?? 0}`,
    );
  }

  // 4. Tenant A cannot INSERT into Tenant B
  const { error: insertError } = await clientA.from("plans").insert({
    gym_id: gymIdB,
    name: "Malicious Plan",
    duration_days: 30,
    type: "general",
    default_price_paise: 100,
  });
  record(
    "Tenant A cannot INSERT into Tenant B's plans",
    insertError !== null,
    insertError ? `blocked: ${insertError.message}` : "INSERT SUCCEEDED — CRITICAL BUG",
  );

  // 5. Tenant A cannot UPDATE Tenant B's row
  // (using a known plan id from B — fetch via service role separately, or skip if you don't have ids handy)
  // Optional: if you have at least one plan in Tenant B, paste its id here:
  // const knownPlanIdB = "...";
  // const { error: updateError } = await clientA.from("plans").update({ name: "hacked" }).eq("id", knownPlanIdB);
  // record("Tenant A cannot UPDATE Tenant B's plan", updateError !== null || /* row count was 0 */, ...)

  // 6. Tenant A's queries on their own gym still work (sanity)
  const { data: ownPlans, error: ownError } = await clientA.from("plans").select("id");
  record(
    "Tenant A can read their own plans",
    !ownError && Array.isArray(ownPlans),
    ownError ? `error: ${ownError.message}` : `count: ${ownPlans?.length ?? 0}`,
  );

  // === Branch scoping test ===
  // Requires: a Branch Manager user in Tenant A whose branch_id is Branch X,
  // and Tenant A has at least one member in Branch Y (a different branch).
  // Sign in as that branch manager and confirm they see Branch X members but NOT Branch Y members.
  // Add this once you have a multi-branch setup.

  // === Summary ===
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
