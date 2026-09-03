import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/db-status";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });
  }
  try {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({
      user: { id: user.id, username: user.username, favouriteTeam: user.favouriteTeam },
    });
  } catch (e) {
    return dbErrorResponse(e);
  }
}
