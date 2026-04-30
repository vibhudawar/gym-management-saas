import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

// Pooled connection (Supabase Supavisor, port 6543, transaction mode).
//
// Tuned for Vercel serverless:
// - prepare: false      — required by Supavisor's transaction mode (no
//                         per-connection prepared statement cache).
// - max: 1              — one PG connection per Lambda. Supavisor handles
//                         the actual pooling; fan-out across many lambda
//                         connections just churns Supavisor sessions.
// - idle_timeout: 20    — release idle PG sessions back to Supavisor sooner
//                         so warm Lambdas don't hoard connection slots.
// - connect_timeout: 10 — fail fast on cold-start network glitches instead
//                         of stretching the request to the platform timeout.
const client = postgres(process.env.DATABASE_POOLED_URL!, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
