import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { matches, tournaments } from "@/db/schema";
import { getCompetition, getStadium } from "@/game/data";
import { getCurrentUser } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/db-status";
import { applyUserResult, nextUserFixture, type TournamentState } from "@/lib/tournament";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function load(idStr: string, userId: number) {
  const id = Number(idStr);
  if (!Number.isFinite(id)) return null;
  const [row] = await db.select().from(tournaments).where(and(eq(tournaments.id, id), eq(tournaments.userId, userId))).limit(1);
  return row ?? null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view this competition." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const row = await load(id, user.id);
    if (!row) return NextResponse.json({ error: "Competition not found." }, { status: 404 });
    return NextResponse.json({ id: row.id, state: row.state as TournamentState, status: row.status });
  } catch (e) {
    return dbErrorResponse(e);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    homeScore?: number; awayScore?: number; homeTries?: number; awayTries?: number; stadiumId?: string;
  } | null;
  if (!body || typeof body.homeScore !== "number" || typeof body.awayScore !== "number") {
    return NextResponse.json({ error: "Invalid result." }, { status: 400 });
  }
  try {
    const row = await load(id, user.id);
    if (!row) return NextResponse.json({ error: "Competition not found." }, { status: 404 });
    const state = row.state as TournamentState;
    const fixture = nextUserFixture(state);
    if (!fixture) return NextResponse.json({ error: "No fixture to play." }, { status: 400 });
    const f = fixture.fixture;
    const next = applyUserResult(state, {
      homeScore: body.homeScore,
      awayScore: body.awayScore,
      homeTries: body.homeTries ?? 0,
      awayTries: body.awayTries ?? 0,
    });
    const status = next.stage === "finished" ? "finished" : "active";
    await db.update(tournaments).set({ state: next, status, updatedAt: new Date() }).where(eq(tournaments.id, row.id));
    const userHome = f.home === state.userTeamId;
    const us = userHome ? body.homeScore : body.awayScore;
    const them = userHome ? body.awayScore : body.homeScore;
    await db.insert(matches).values({
      userId: user.id,
      competition: getCompetition(state.competitionId)?.name ?? state.competitionId,
      homeTeam: f.home,
      awayTeam: f.away,
      homeScore: body.homeScore,
      awayScore: body.awayScore,
      userTeam: state.userTeamId,
      stadium: getStadium(body.stadiumId).name,
      result: us > them ? "W" : us < them ? "L" : "D",
    });
    return NextResponse.json({ id: row.id, state: next, status });
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
    if (!row) return NextResponse.json({ error: "Competition not found." }, { status: 404 });
    await db.delete(tournaments).where(eq(tournaments.id, row.id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbErrorResponse(e);
  }
}
