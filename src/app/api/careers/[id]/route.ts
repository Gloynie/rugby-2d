import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { careers } from "@/db/schema";
import { getTeam } from "@/game/data";
import { getCurrentUser } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/db-status";
import { applyMatchResult, advanceWeek, playerAction, simulateMatch, teamTalk, trainPlayer, trainTeam, type CareerState } from "@/lib/career";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function load(idStr: string, userId: number) {
  const id = Number(idStr);
  if (!Number.isFinite(id)) return null;
  const [row] = await db.select().from(careers).where(and(eq(careers.id, id), eq(careers.userId, userId))).limit(1);
  return row ?? null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view this career." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const row = await load(id, user.id);
    if (!row) return NextResponse.json({ error: "Career not found." }, { status: 404 });
    return NextResponse.json({ id: row.id, state: row.state as CareerState, status: row.status });
  } catch (e) {
    return dbErrorResponse(e);
  }
}

/** Apply match result for the user's fixture this week */
export async function POST(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage a career." }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as
    | { action: "match"; fixtureId: string; homeScore: number; awayScore: number; homeTries?: number; awayTries?: number; userTeam: 0 | 1; events?: any[] }
    | { action: "sim-match"; fixtureId: string }
    | { action: "advance" }
    | { action: "team-talk"; type: "motivate" | "relax" | "demand" }
    | { action: "player-action"; playerId: number; type: "praise" | "criticise" | "rest" }
    | { action: "train-player"; playerId: number; type: "fitness" | "skills" | "strength" }
    | { action: "train-team"; type: "bonding" | "tactics" | "intense" }
    | null;
  if (!body?.action) return NextResponse.json({ error: "Missing action." }, { status: 400 });
  try {
    const row = await load(id, user.id);
    if (!row) return NextResponse.json({ error: "Career not found." }, { status: 404 });
    let state = row.state as CareerState;
    if (body.action === "match") {
      state = applyMatchResult(state, body.fixtureId, {
        homeScore: body.homeScore, awayScore: body.awayScore, homeTries: body.homeTries ?? 0, awayTries: body.awayTries ?? 0,
        events: body.events ?? [],
      }, body.userTeam);
      // Automatically advance week and simulate other fixtures
      state = advanceWeek(state);
    } else if (body.action === "sim-match") {
      const fixture = state.schedule.find((f) => f.id === body.fixtureId);
      if (!fixture || fixture.played) return NextResponse.json({ error: "No such fixture." }, { status: 400 });
      const home = getTeam(fixture.home);
      const away = getTeam(fixture.away);
      const result = simulateMatch(home, away);
      state = applyMatchResult(state, body.fixtureId, result, fixture.home === state.teamId ? 0 : 1);
      // Automatically advance week and simulate other fixtures
      state = advanceWeek(state);
      // fall through to persist
    } else if (body.action === "advance") {
      state = advanceWeek(state);
    } else if (body.action === "team-talk") {
      state = teamTalk(state, body.type);
    } else if (body.action === "player-action") {
      state = playerAction(state, body.playerId, body.type);
    } else if (body.action === "train-player") {
      const r = trainPlayer(state, body.playerId, body.type);
      if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
      state = r.state;
    } else if (body.action === "train-team") {
      const r = trainTeam(state, body.type);
      if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
      state = r.state;
    } else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    const status = state.week >= state.schedule.length && state.schedule.every((f) => f.played) ? "finished" : "active";
    await db.update(careers).set({ state, week: state.week, status, updatedAt: new Date() }).where(eq(careers.id, row.id));
    return NextResponse.json({ id: row.id, state, status });
  } catch (e) {
    return dbErrorResponse(e);
  }
}
