// app/api/auth/verify/route.ts
// Magic link verification endpoint.
// Validates the token, sets the auth cookie, and redirects to returnTo.
// One-time use: clears magicLinkToken immediately after verification.

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { setAuthCookie, createSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const rawToken = req.nextUrl.searchParams.get("token");
  const returnTo = req.nextUrl.searchParams.get("returnTo") ?? "/dashboard";

  if (!rawToken) {
    return NextResponse.redirect(
      new URL("/login?error=missing_token", req.url)
    );
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const user = await prisma.user.findUnique({
    where: { magicLinkToken: tokenHash },
  });

  if (
    !user ||
    !user.magicLinkExpiresAt ||
    user.magicLinkExpiresAt < new Date()
  ) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_token", req.url)
    );
  }

  // One-time use — clear before redirecting so the link can't be replayed
  await prisma.user.update({
    where: { id: user.id },
    data: { magicLinkToken: null, magicLinkExpiresAt: null },
  });

  // Reject open redirects — only allow same-origin paths
  const safePath = returnTo.startsWith("/") ? returnTo : "/dashboard";
  const response = NextResponse.redirect(new URL(safePath, req.url));
  setAuthCookie(response, await createSession(user.id));
  return response;
}
