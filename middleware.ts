import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/_next", "/favicon.ico", "/manifest.json", "/sw.js", "/workbox-"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function expectedToken() {
  const secret = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(secret).digest("hex");
}

export function middleware(req: NextRequest) {
  if (isPublic(req.nextUrl.pathname)) return NextResponse.next();

  const token = req.cookies.get("auth-token")?.value;
  if (token && token === expectedToken()) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
