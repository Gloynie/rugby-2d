import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { careers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/db-status";
import { createCareer } from "@/lib/career";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ careers: [] });
  try {
    const rows = await db
      .select({ id: careers.id, teamId: careers.teamId, competitionId: careers.competitionId, mode: careers.mode, week: careers.week, status: careers.status })
      .from(careers)
      .where(eq(careers.userId, user.id))
      .orderBy(desc(careers.updatedAt));
    return NextResponse.json({ careers: rows });
  } catch (e) {
    return dbErrorResponse(e);
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to start a career." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { teamId?: string; competitionId?: string; mode?: "tournament" | "worldcup" | "friendlies" } | null;
  if (!body?.teamId || !body?.competitionId || !body?.mode) {
    return NextResponse.json({ error: "Missing team, competition or mode." }, { status: 400 });
  }
  try {
    const state = createCareer(body.teamId, body.competitionId, body.mode);
    const [row] = await db
      .insert(careers)
      .values({ userId: user.id, teamId: body.teamId, competitionId: body.competitionId, mode: body.mode, state, status: "active" })
      .returning({ id: careers.id });
    return NextResponse.json({ id: row.id, state });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("not in competition") || msg.includes("Unknown competition")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return dbErrorResponse(e);
  }
}
