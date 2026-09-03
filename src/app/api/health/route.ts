import { dbReachable } from "@/lib/db-status";

export const dynamic = "force-dynamic";

/** ok = the app server is up; db = PostgreSQL is reachable (false = guest mode). */
export async function GET() {
  const db = await dbReachable();
  return Response.json({ ok: true, db });
}
