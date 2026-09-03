import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { getCompetition } from "@/game/data";
import { getCurrentUser } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/db-status";
import { createTournament } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ tournaments: [] });
  try {
    const rows = await db
      .select({ id: tournaments.id, competitionId: tournaments.competitionId, teamId: tournaments.teamId, status: tournaments.status, updatedAt: tournaments.updatedAt })
      .from(tournaments)
      .where(eq(tournaments.userId, user.id))
      .orderBy(desc(tournaments.updatedAt));
    return NextResponse.json({ tournaments: rows });
  } catch (e) {
    return dbErrorResponse(e);
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to start a competition." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { competitionId?: string; teamId?: string } | null;
  const comp = body?.competitionId ? getCompetition(body.competitionId) : undefined;
  if (!comp || !body?.teamId || !comp.teamIds.includes(body.teamId)) {
    return NextResponse.json({ error: "Pick a valid competition and team." }, { status: 400 });
  }
  try {
    const state = createTournament(comp, body.teamId);
    const [row] = await db
      .insert(tournaments)
      .values({ userId: user.id, competitionId: comp.id, teamId: body.teamId, state, status: state.stage === "finished" ? "finished" : "active" })
      .returning({ id: tournaments.id });
    return NextResponse.json({ id: row.id });
  } catch (e) {
    return dbErrorResponse(e);
  }
}
