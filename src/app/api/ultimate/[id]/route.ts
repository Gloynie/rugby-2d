import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { ultimateClubs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/db-status";
import { claimChallenge, isValidClubState, openPack, quickSell, recordUltimateResult, saveSquad, startCup, type PackId, type UltimateClubState } from "@/lib/ultimate";
import type { MatchResult } from "@/game/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function load(idText: string, userId: number) {
  const id = Number(idText);
  if (!Number.isInteger(id) || id < 1) return null;
  const [club] = await db.select().from(ultimateClubs).where(and(eq(ultimateClubs.id, id), eq(ultimateClubs.userId, userId))).limit(1);
  return club ?? null;
}

function responseState(id: number, state: UltimateClubState, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ id, state, ...extra });
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to use Ultimate Team." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const club = await load(id, user.id);
    if (!club || !isValidClubState(club.state)) return NextResponse.json({ error: "Ultimate Club not found." }, { status: 404 });
    return responseState(club.id, club.state);
  } catch (error) {
    return dbErrorResponse(error);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage Ultimate Team." }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    action?: "open-pack" | "quick-sell" | "save-squad" | "claim-challenge" | "start-cup" | "record-match";
    packId?: PackId;
    cardIds?: string[];
    lineup?: string[];
    bench?: string[];
    challengeId?: "win-3" | "tries-8" | "packs-3" | "trade-5" | "elite-1";
    mode?: "friendly" | "cup";
    result?: MatchResult;
  } | null;
  if (!body?.action) return NextResponse.json({ error: "Missing Ultimate Team action." }, { status: 400 });
  try {
    const club = await load(id, user.id);
    if (!club || !isValidClubState(club.state)) return NextResponse.json({ error: "Ultimate Club not found." }, { status: 404 });
    let state = club.state as UltimateClubState;
    let extra: Record<string, unknown> = {};
    if (body.action === "open-pack") {
      const out = openPack(state, body.packId ?? "bronze");
      if (out.error) return NextResponse.json({ error: out.error }, { status: 400 });
      state = out.state; extra = { packedCards: out.cards };
    } else if (body.action === "quick-sell") {
      const out = quickSell(state, Array.isArray(body.cardIds) ? body.cardIds : []);
      if (out.error) return NextResponse.json({ error: out.error }, { status: 400 });
      state = out.state; extra = { coinsEarned: out.coinsEarned };
    } else if (body.action === "save-squad") {
      const out = saveSquad(state, Array.isArray(body.lineup) ? body.lineup : [], Array.isArray(body.bench) ? body.bench : []);
      if (out.error) return NextResponse.json({ error: out.error }, { status: 400 });
      state = out.state;
    } else if (body.action === "claim-challenge") {
      const out = claimChallenge(state, body.challengeId ?? "win-3");
      if (out.error) return NextResponse.json({ error: out.error }, { status: 400 });
      state = out.state; extra = { reward: out.reward };
    } else if (body.action === "start-cup") {
      const out = startCup(state);
      if (out.error) return NextResponse.json({ error: out.error }, { status: 400 });
      state = out.state;
    } else if (body.action === "record-match") {
      if (!body.result || !body.mode) return NextResponse.json({ error: "Missing completed match result." }, { status: 400 });
      const out = recordUltimateResult(state, body.result, body.mode);
      state = out.state; extra = { reward: out.reward, won: out.won };
    }
    await db.update(ultimateClubs).set({ state, clubName: state.clubName, updatedAt: new Date() }).where(eq(ultimateClubs.id, club.id));
    return responseState(club.id, state, extra);
  } catch (error) {
    return dbErrorResponse(error);
  }
}
