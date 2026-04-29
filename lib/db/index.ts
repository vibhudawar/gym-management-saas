import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Pooled connection (port 6543, transaction mode).
// `prepare: false` is REQUIRED — Supabase transaction pooler doesn't support prepared statements.
const client = postgres(process.env.DATABASE_POOLED_URL!, { prepare: false });

export const db = drizzle(client, { schema });