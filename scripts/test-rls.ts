import "dotenv/config";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

type Login = { label: string; email: string; password: string };

function parse(): Login[] {
  const { values } = parseArgs({
    options: {
      a: { type: "string" }, // "email:password"
      b: { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });

  const a = values.a;
  const b = values.b;
  if (!a || !b) {
    throw new Error(
      'Pass two tenants: --a "email:password" --b "email:password"',
    );
  }
  return ["A", "B"].map((label, i) => {
    const raw = i === 0 ? a : b;
    const idx = raw.lastIndexOf(":");
    if (idx <= 0) throw new Error(`Bad --${label.toLowerCase()} value`);
    return {
      label: `Tenant ${label}`,
      email: raw.slice(0, idx),
      password: raw.slice(idx + 1),
    };
  });
}

async function probe(login: Login) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase URL / publishable key missing");

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: signErr } = await client.auth.signInWithPassword({
    email: login.email,
    password: login.password,
  });
  if (signErr) throw new Error(`${login.label}: sign-in failed — ${signErr.message}`);

  const [{ data: gymRows, error: gymErr }, { data: userRows, error: userErr }] =
    await Promise.all([
      client.from("gyms").select("id, name"),
      client.from("users").select("id, gym_id, role"),
    ]);
  if (gymErr) throw new Error(`${login.label}: gyms query — ${gymErr.message}`);
  if (userErr) throw new Error(`${login.label}: users query — ${userErr.message}`);

  await client.auth.signOut();

  return { login, gyms: gymRows ?? [], users: userRows ?? [] };
}

async function main() {
  const [a, b] = parse();
  const [resA, resB] = await Promise.all([probe(a), probe(b)]);

  const summarise = (label: string, r: typeof resA) => {
    const gymIds = new Set(r.users.map((u) => u.gym_id));
    console.log(
      `${label}: ${r.gyms.length} gym(s) visible, ${r.users.length} user(s); gym_ids=${[...gymIds].join(", ") || "—"}`,
    );
  };

  summarise(resA.login.label, resA);
  summarise(resB.login.label, resB);

  const aIds = new Set(resA.gyms.map((g) => g.id));
  const bIds = new Set(resB.gyms.map((g) => g.id));
  const overlap = [...aIds].filter((id) => bIds.has(id));

  if (overlap.length > 0) {
    console.error(`\n✗ RLS LEAK: tenants share gym ids: ${overlap.join(", ")}`);
    process.exit(1);
  }
  if (resA.gyms.length !== 1 || resB.gyms.length !== 1) {
    console.error("\n✗ Each tenant should see exactly one gym row.");
    process.exit(1);
  }
  console.log("\n✓ RLS isolation verified.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
