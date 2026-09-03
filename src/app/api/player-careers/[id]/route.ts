import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { playerCareers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/db-status";
import { advancePlayerCareerWeek, processMatchPerformance, upgradeAttribute, type PlayerCareerState } from "@/lib/player-career";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function load(idStr: string, userId: number) {
  const id = Number(idStr);
  if (!Number.isFinite(id)) return null;
  const [row] = await db.select().from(playerCareers).where(and(eq(playerCareers.id, id), eq(playerCareers.userId, userId))).limit(1);
  return row ?? null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view this career." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const row = await load(id, user.id);
    if (!row) return NextResponse.json({ error: "Career not found." }, { status: 404 });
    return NextResponse.json({ id: row.id, state: row.state as PlayerCareerState, status: row.status });
  } catch (e) {
    return dbErrorResponse(e);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage your career." }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as
    | { action: "match"; fixtureId: string; userTries: number; userTackles: number; userPasses: number; homeScore: number; awayScore: number }
    | { action: "advance" }
    | { action: "upgrade"; attribute: "speed" | "strength" | "tackling" | "handling" | "kicking" | "evasion" }
    | null;
  if (!body?.action) return NextResponse.json({ error: "Missing action." }, { status: 400 });
  try {
    const row = await load(id, user.id);
    if (!row) return NextResponse.json({ error: "Career not found." }, { status: 404 });
    let state = row.state as PlayerCareerState;
    let matchRating = 0;
    let xpEarned = 0;

    if (body.action === "match") {
      const res = processMatchPerformance(state, body.fixtureId, body.userTries, body.userTackles, body.userPasses, body.homeScore, body.awayScore);
      state = res.state;
      matchRating = res.matchRating;
      xpEarned = res.xpEarned;
      // Auto-advance rest of the week's games
      state = advancePlayerCareerWeek(state);
    } else if (body.action === "advance") {
      state = advancePlayerCareerWeek(state);
    } else if (body.action === "upgrade") {
      const res = upgradeAttribute(state, body.attribute);
      if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
      state = res.state;
    }

    const status = state.week >= state.schedule.length && state.schedule.every((f) => f.played) ? "finished" : "active";
    await db
      .update(playerCareers)
      .set({
        state,
        rating: state.rating,
        xp: state.xp,
        attributes: state.attributes,
        status,
        updatedAt: new Date(),
      })
      .where(eq(playerCareers.id, row.id));

    return NextResponse.json({ id: row.id, state, status, matchRating, xpEarned });
  } catch (e) {
    return dbErrorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const row = await load(id, user.id);
    if (!row) return NextResponse.json({ error: "Career not found." }, { status: 404 });
    await db.delete(playerCareers).where(eq(playerCareers.id, row.id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbErrorResponse(e);
  }
}
