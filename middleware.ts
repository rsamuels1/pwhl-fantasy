import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "pwhl_user_email";

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const { pathname } = req.nextUrl;

  // League / team pages — redirect to login with returnTo
  if (pathname.startsWith("/league/") || pathname.startsWith("/team/")) {
    if (!cookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(url);
    }
  }

  // League API routes — return 401
  if (pathname.startsWith("/api/leagues/")) {
    if (!cookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/league/:path*", "/team/:path*", "/api/leagues/:path*"],
};
