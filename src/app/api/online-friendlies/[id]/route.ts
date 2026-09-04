import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { onlineMatches, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/db-status";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

type InputPacket = { seq?: number; frame?: unknown };

async function load(idText: string, userId: number) {
  const id = Number(idText);
  if (!Number.isInteger(id) || id < 1) return null;
  const [row] = await db
    .select({
      id: onlineMatches.id,
      hostUserId: onlineMatches.hostUserId,
      guestUserId: onlineMatches.guestUserId,
      hostTeamId: onlineMatches.hostTeamId,
      guestTeamId: onlineMatches.guestTeamId,
      stadiumId: onlineMatches.stadiumId,
      halfSeconds: onlineMatches.halfSeconds,
      status: onlineMatches.status,
      hostInput: onlineMatches.hostInput,
      guestInput: onlineMatches.guestInput,
      snapshot: onlineMatches.snapshot,
      hostSeenAt: onlineMatches.hostSeenAt,
      guestSeenAt: onlineMatches.guestSeenAt,
      createdAt: onlineMatches.createdAt,
      updatedAt: onlineMatches.updatedAt,
    })
    .from(onlineMatches)
    .where(and(eq(onlineMatches.id, id), eq(onlineMatches.hostUserId, userId)))
    .limit(1);
  if (row) return row;
  const [guestRow] = await db
    .select({
      id: onlineMatches.id,
      hostUserId: onlineMatches.hostUserId,
      guestUserId: onlineMatches.guestUserId,
      hostTeamId: onlineMatches.hostTeamId,
      guestTeamId: onlineMatches.guestTeamId,
      stadiumId: onlineMatches.stadiumId,
      halfSeconds: onlineMatches.halfSeconds,
      status: onlineMatches.status,
      hostInput: onlineMatches.hostInput,
      guestInput: onlineMatches.guestInput,
      snapshot: onlineMatches.snapshot,
      hostSeenAt: onlineMatches.hostSeenAt,
      guestSeenAt: onlineMatches.guestSeenAt,
      createdAt: onlineMatches.createdAt,
      updatedAt: onlineMatches.updatedAt,
    })
    .from(onlineMatches)
    .where(and(eq(onlineMatches.id, id), eq(onlineMatches.guestUserId, userId)))
    .limit(1);
  return guestRow ?? null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view this online friendly." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const row = await load(id, user.id);
    if (!row) return NextResponse.json({ error: "Online friendly not found." }, { status: 404 });
    const opponentId = row.hostUserId === user.id ? row.guestUserId : row.hostUserId;
    const [opponent] = await db.select({ username: users.username }).from(users).where(eq(users.id, opponentId)).limit(1);
    return NextResponse.json({
      ...row,
      role: row.hostUserId === user.id ? "host" : "guest",
      opponentUsername: opponent?.username ?? "Opponent",
      userId: user.id,
    });
  } catch (e) {
    return dbErrorResponse(e);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    action?: "accept" | "decline" | "start" | "input" | "snapshot" | "finish" | "cancel";
    packet?: InputPacket;
    snapshot?: unknown;
  } | null;
  if (!body?.action) return NextResponse.json({ error: "Missing action." }, { status: 400 });
  try {
    const row = await load(id, user.id);
    if (!row) return NextResponse.json({ error: "Online friendly not found." }, { status: 404 });
    const isHost = row.hostUserId === user.id;
    const now = new Date();
    if (body.action === "accept") {
      if (isHost || row.status !== "invited") return NextResponse.json({ error: "This invitation cannot be accepted." }, { status: 400 });
      await db.update(onlineMatches).set({ status: "ready", guestSeenAt: now, updatedAt: now }).where(eq(onlineMatches.id, row.id));
    } else if (body.action === "decline") {
      if (isHost || row.status !== "invited") return NextResponse.json({ error: "This invitation cannot be declined." }, { status: 400 });
      await db.update(onlineMatches).set({ status: "declined", guestSeenAt: now, updatedAt: now }).where(eq(onlineMatches.id, row.id));
    } else if (body.action === "start") {
      if (!isHost || row.status !== "ready") return NextResponse.json({ error: "Waiting for the invited player to accept." }, { status: 400 });
      await db.update(onlineMatches).set({ status: "live", hostSeenAt: now, updatedAt: now }).where(eq(onlineMatches.id, row.id));
    } else if (body.action === "input") {
      const packet = body.packet ?? {};
      if (isHost) await db.update(onlineMatches).set({ hostInput: packet, hostSeenAt: now, updatedAt: now }).where(eq(onlineMatches.id, row.id));
      else await db.update(onlineMatches).set({ guestInput: packet, guestSeenAt: now, updatedAt: now }).where(eq(onlineMatches.id, row.id));
    } else if (body.action === "snapshot") {
      if (!isHost || row.status !== "live") return NextResponse.json({ error: "Only the host can publish live match state." }, { status: 403 });
      await db.update(onlineMatches).set({ snapshot: body.snapshot ?? {}, hostSeenAt: now, updatedAt: now }).where(eq(onlineMatches.id, row.id));
    } else if (body.action === "finish") {
      if (!isHost) return NextResponse.json({ error: "Only the host can finish this match." }, { status: 403 });
      await db.update(onlineMatches).set({ status: "finished", snapshot: body.snapshot ?? row.snapshot, hostSeenAt: now, updatedAt: now }).where(eq(onlineMatches.id, row.id));
    } else if (body.action === "cancel") {
      if (!isHost || !["invited", "ready"].includes(row.status)) return NextResponse.json({ error: "This invitation can no longer be cancelled." }, { status: 400 });
      await db.update(onlineMatches).set({ status: "cancelled", hostSeenAt: now, updatedAt: now }).where(eq(onlineMatches.id, row.id));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbErrorResponse(e);
  }
}
