import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/db-status";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { username?: string; password?: string; favouriteTeam?: string }
    | null;
  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-20 characters (letters, numbers, underscore)." },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  try {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    const [user] = await db
      .insert(users)
      .values({ username, passwordHash: hashPassword(password), favouriteTeam: body?.favouriteTeam ?? null })
      .returning({ id: users.id, username: users.username, favouriteTeam: users.favouriteTeam });
    await createSession(user.id);
    return NextResponse.json({ user });
  } catch (e) {
    return dbErrorResponse(e);
  }
}
