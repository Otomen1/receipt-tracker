import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const secret = process.env.AUTH_SECRET;

    if (!secret || password !== secret) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = createHash("sha256").update(secret).digest("hex");
    const res = NextResponse.json({ ok: true });
    res.cookies.set("auth-token", token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
