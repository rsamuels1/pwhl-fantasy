import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "pwhl_user_email";

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const { pathname } = req.nextUrl;

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/league/:path*", "/team/:path*", "/founder/:path*", "/founder", "/api/leagues/:path*", "/api/founder/:path*"],
};
