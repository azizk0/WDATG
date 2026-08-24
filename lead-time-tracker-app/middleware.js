import { NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/api/login", "/api/logout"]);
const COOKIE_NAME = "site_auth";

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const expected = process.env.SITE_PASSWORD;
  const cookie = request.cookies.get(COOKIE_NAME)?.value;

  if (expected && cookie === expected) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
