import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "pwhl_user_email";
const BETA_HOST = process.env.BETA_HOST ?? "fantasy.dykedb.org";

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  // On the beta domain, only /beta and its API are accessible
  if (host === BETA_HOST) {
    const allowed =
      pathname === "/beta" ||
      pathname.startsWith("/api/beta-signup") ||
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/favicon");
    if (!allowed) {
      const url = req.nextUrl.clone();
      url.pathname = "/beta";
      url.search = "";
      return NextResponse.redirect(url, 307);
    }
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
  }

  // League / team / founder pages — redirect to login with returnTo
  if (
    pathname.startsWith("/league/") ||
    pathname.startsWith("/team/") ||
    pathname.startsWith("/founder")
  ) {
    if (!cookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(url);
    }
  }

  // League + founder API routes — return 401
  if (pathname.startsWith("/api/leagues/") || pathname.startsWith("/api/founder/")) {
    if (!cookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);
  return res;
}

export const config = {
  matcher: [
    // Existing auth-guard routes
    "/league/:path*",
    "/team/:path*",
    "/founder/:path*",
    "/founder",
    "/api/leagues/:path*",
    "/api/founder/:path*",
    // Catch-all for beta-domain lockdown (excludes static files and /beta)
    "/((?!_next/static|_next/image|favicon.ico|beta).*)",
  ],
};
