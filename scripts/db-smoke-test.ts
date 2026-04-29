import "dotenv/config";
import {db} from "@/lib/db";
import {sql} from "drizzle-orm";

async function main() {
 const result = await db.execute(sql`SELECT NOW() AS now`);
 console.log("DB OK:", result);
 process.exit(0);
}
main().catch((e) => {
 console.error(e);
 process.exit(1);
});
