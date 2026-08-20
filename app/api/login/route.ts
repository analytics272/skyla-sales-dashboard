import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const expectedUsername = process.env.SHARED_USERNAME;
  const expectedPasswordHash = process.env.SHARED_PASSWORD_HASH;

  if (!expectedUsername || !expectedPasswordHash) {
    return NextResponse.json({ error: "Server auth is not configured" }, { status: 500 });
  }

  const usernameMatches = username === expectedUsername;
  const passwordMatches = password.length > 0 && (await bcrypt.compare(password, expectedPasswordHash));

  if (!usernameMatches || !passwordMatches) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const token = await createSessionToken(username);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
