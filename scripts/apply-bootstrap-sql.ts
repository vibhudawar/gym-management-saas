import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

const FILES = [
  "lib/db/migrations/_functions.sql",
  "lib/db/migrations/_triggers.sql",
  "lib/db/migrations/_indexes.sql",
  "lib/db/migrations/_policies.sql",
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const sql = postgres(url, { prepare: false, onnotice: () => {} });

  try {
    for (const rel of FILES) {
      const path = resolve(process.cwd(), rel);
      const body = await readFile(path, "utf8");
      console.log(`Applying ${rel}…`);
      await sql.unsafe(body);
    }
    console.log("Bootstrap SQL applied.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
