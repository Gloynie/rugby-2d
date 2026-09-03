import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { matches } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/db-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ matches: [] });
  try {
    const rows = await db.select().from(matches).where(eq(matches.userId, user.id)).orderBy(desc(matches.playedAt)).limit(30);
    return NextResponse.json({ matches: rows });
  } catch (e) {
    return dbErrorResponse(e);
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save results." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    competition?: string; homeTeam?: string; awayTeam?: string; homeScore?: number; awayScore?: number;
    userTeam?: string; stadium?: string;
  } | null;
  if (!body || typeof body.homeScore !== "number" || typeof body.awayScore !== "number" || !body.homeTeam || !body.awayTeam || !body.userTeam) {
    return NextResponse.json({ error: "Invalid match payload." }, { status: 400 });
  }
  const userHome = body.userTeam === body.homeTeam;
  const us = userHome ? body.homeScore : body.awayScore;
  const them = userHome ? body.awayScore : body.homeScore;
  const result = us > them ? "W" : us < them ? "L" : "D";
  try {
    const [row] = await db
      .insert(matches)
      .values({
        userId: user.id,
        competition: body.competition ?? "Friendly",
        homeTeam: body.homeTeam,
        awayTeam: body.awayTeam,
        homeScore: body.homeScore,
        awayScore: body.awayScore,
        userTeam: body.userTeam,
        stadium: body.stadium ?? "Unknown",
        result,
      })
      .returning();
    return NextResponse.json({ match: row });
  } catch (e) {
    return dbErrorResponse(e);
  }
}
