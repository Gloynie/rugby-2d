import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { playerCareers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/db-status";
import { createPlayerCareer } from "@/lib/player-career";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ careers: [] });
  try {
    const rows = await db
      .select({ id: playerCareers.id, playerName: playerCareers.playerName, teamId: playerCareers.teamId, competitionId: playerCareers.competitionId, rating: playerCareers.rating, status: playerCareers.status, updatedAt: playerCareers.updatedAt })
      .from(playerCareers)
      .where(eq(playerCareers.userId, user.id))
      .orderBy(desc(playerCareers.updatedAt));
    return NextResponse.json({ careers: rows });
  } catch (e) {
    return dbErrorResponse(e);
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to start a player career." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    playerName?: string;
    position?: number;
    teamId?: string;
    competitionId?: string;
    appearance?: { skin: string; hair: string; hairStyle: "short" | "long" | "spiky" | "bald" };
  } | null;
  if (!body?.playerName || !body?.position || !body?.teamId || !body?.competitionId || !body?.appearance) {
    return NextResponse.json({ error: "Missing required player customization details." }, { status: 400 });
  }
  try {
    const state = createPlayerCareer(body.playerName, body.position, body.teamId, body.competitionId, body.appearance);
    const [row] = await db
      .insert(playerCareers)
      .values({
        userId: user.id,
        playerName: body.playerName,
        position: body.position,
        teamId: body.teamId,
        competitionId: body.competitionId,
        rating: 60,
        xp: 200,
        appearance: body.appearance,
        attributes: state.attributes,
        state,
        status: "active",
      })
      .returning({ id: playerCareers.id });
    return NextResponse.json({ id: row.id, state });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("not in competition") || msg.includes("Unknown competition")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return dbErrorResponse(e);
  }
}
