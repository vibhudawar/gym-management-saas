import {db} from "@/lib/db";
import {sql} from "drizzle-orm";
import {NextResponse} from "next/server";

export async function GET() {
 try {
  const result = await db.execute(sql`SELECT 1 AS ok`);
  return NextResponse.json({status: "ok", db: result[0]});
 } catch (e) {
  return NextResponse.json({status: "error", error: String(e)}, {status: 500});
 }
}
