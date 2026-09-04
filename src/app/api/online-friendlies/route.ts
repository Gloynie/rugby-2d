import { desc, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { onlineMatches, users } from "@/db/schema";
import { getStadium, getTeam } from "@/game/data";
import { getCurrentUser } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/db-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to use Online Friendlies." }, { status: 401 });
  try {
    const rows = await db
      .select({
        id: onlineMatches.id,
        hostUserId: onlineMatches.hostUserId,
        guestUserId: onlineMatches.guestUserId,
        hostTeamId: onlineMatches.hostTeamId,
        guestTeamId: onlineMatches.guestTeamId,
        stadiumId: onlineMatches.stadiumId,
        halfSeconds: onlineMatches.halfSeconds,
        status: onlineMatches.status,
        createdAt: onlineMatches.createdAt,
        hostUsername: users.username,
      })
      .from(onlineMatches)
      .innerJoin(users, eq(onlineMatches.hostUserId, users.id))
      .where(or(eq(onlineMatches.hostUserId, user.id), eq(onlineMatches.guestUserId, user.id)))
      .orderBy(desc(onlineMatches.updatedAt))
      .limit(30);
    return NextResponse.json({ matches: rows, userId: user.id });
  } catch (e) {
    return dbErrorResponse(e);
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to invite another player." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    opponentUsername?: string;
    hostTeamId?: string;
    guestTeamId?: string;
    stadiumId?: string;
    halfSeconds?: number;
  } | null;
  const opponentUsername = body?.opponentUsername?.trim() ?? "";
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(opponentUsername)) {
    return NextResponse.json({ error: "Enter the opponent's exact 3–20 character username." }, { status: 400 });
  }
  if (opponentUsername.toLowerCase() === user.username.toLowerCase()) {
    return NextResponse.json({ error: "You cannot invite yourself." }, { status: 400 });
  }
  try {
    const hostTeam = getTeam(body?.hostTeamId ?? "");
    const guestTeam = getTeam(body?.guestTeamId ?? "");
    getStadium(body?.stadiumId);
    if (hostTeam.id === guestTeam.id) return NextResponse.json({ error: "Choose two different teams." }, { status: 400 });
    const [guest] = await db.select({ id: users.id, username: users.username }).from(users).where(eq(users.username, opponentUsername)).limit(1);
    if (!guest) return NextResponse.json({ error: `No PixelRuggas account called “${opponentUsername}” was found.` }, { status: 404 });
    const halfSeconds = Math.max(60, Math.min(600, Math.round(body?.halfSeconds ?? 180)));
    const [match] = await db
      .insert(onlineMatches)
      .values({
        hostUserId: user.id,
        guestUserId: guest.id,
        hostTeamId: hostTeam.id,
        guestTeamId: guestTeam.id,
        stadiumId: body?.stadiumId ?? "twickenham",
        halfSeconds,
        status: "invited",
        hostInput: {},
        guestInput: {},
        snapshot: {},
      })
      .returning({ id: onlineMatches.id });
    return NextResponse.json({ id: match.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("Unknown team") || msg.startsWith("Unknown stadium")) {
      return NextResponse.json({ error: "Choose valid teams and stadium." }, { status: 400 });
    }
    return dbErrorResponse(e);
  }
}
