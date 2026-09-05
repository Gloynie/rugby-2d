import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { ultimateClubs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/db-status";
import { createUltimateClub, isValidClubState } from "@/lib/ultimate";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to use Ultimate Team." }, { status: 401 });
  try {
    const rows = await db
      .select({ id: ultimateClubs.id, clubName: ultimateClubs.clubName, state: ultimateClubs.state, updatedAt: ultimateClubs.updatedAt })
      .from(ultimateClubs)
      .where(eq(ultimateClubs.userId, user.id))
      .orderBy(desc(ultimateClubs.updatedAt));
    return NextResponse.json({
      clubs: rows.map((row) => {
        const state = isValidClubState(row.state) ? row.state : null;
        const starters = state?.cards.filter((card) => state.lineup.includes(card.instanceId)) ?? [];
        return {
          id: row.id,
          clubName: row.clubName,
          updatedAt: row.updatedAt,
          coins: state?.coins ?? 0,
          rating: starters.length ? Math.round(starters.reduce((sum, card) => sum + card.ovr, 0) / starters.length) : 0,
        };
      }),
    });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to create an Ultimate Club." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { clubName?: string; primary?: string; secondary?: string } | null;
  const clubName = body?.clubName?.trim() ?? "";
  if (clubName.length < 3 || clubName.length > 40) return NextResponse.json({ error: "Club name must be 3–40 characters." }, { status: 400 });
  if (!/^#[0-9a-fA-F]{6}$/.test(body?.primary ?? "") || !/^#[0-9a-fA-F]{6}$/.test(body?.secondary ?? "")) {
    return NextResponse.json({ error: "Choose valid club colours." }, { status: 400 });
  }
  try {
    const state = createUltimateClub(clubName, body!.primary!, body!.secondary!);
    const [club] = await db.insert(ultimateClubs).values({ userId: user.id, clubName: state.clubName, state }).returning({ id: ultimateClubs.id });
    return NextResponse.json({ id: club.id, state });
  } catch (error) {
    return dbErrorResponse(error);
  }
}
