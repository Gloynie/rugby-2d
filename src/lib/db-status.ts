import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";

export const DB_OFFLINE_MESSAGE =
  "No database connected – accounts, saved results and competitions are disabled in guest mode. " +
  "Quick matches still work. See README.md (\"Accounts & competitions\") to set up PostgreSQL.";

export const TABLES_MISSING_MESSAGE =
  "Database connected but the tables are missing – run `npx drizzle-kit push` in the project folder, then try again.";

const CONNECTION_CODES = new Set([
  "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "EHOSTUNREACH",
  "3D000", // database does not exist
  "28P01", // password authentication failed
  "28000", // invalid authorization
  "57P03", // cannot connect now (starting up)
]);

export async function dbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

/** Convert a thrown database error into a JSON response the game UI can show. */
/** Drizzle wraps driver errors (DrizzleQueryError → cause). Walk the chain to find the root cause. */
function rootCause(err: unknown): { code?: string; message?: string } {
  let cur = err as { code?: string; message?: string; cause?: unknown; errors?: unknown[] } | null;
  for (let i = 0; i < 6 && cur; i++) {
    if (cur.code) return cur;
    const next = cur.cause ?? (Array.isArray(cur.errors) ? cur.errors[0] : undefined);
    if (!next) break;
    cur = next as typeof cur;
  }
  return (cur ?? {}) as { code?: string; message?: string };
}

export function dbErrorResponse(err: unknown): NextResponse {
  const e = rootCause(err);
  const code = e.code ?? "";
  const message = e.message ?? (err instanceof Error ? err.message : String(err));
  console.error("[rugby2d] database error:", code || "", message);
  if (code === "42P01") return NextResponse.json({ error: TABLES_MISSING_MESSAGE }, { status: 503 });
  if (CONNECTION_CODES.has(code) || /ECONNREFUSED|connect|timeout|terminated unexpectedly/i.test(message)) {
    return NextResponse.json({ error: DB_OFFLINE_MESSAGE }, { status: 503 });
  }
  return NextResponse.json({ error: `Database error: ${message}` }, { status: 500 });
}
