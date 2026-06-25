import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setAuthCookie, generateMagicLinkToken } from "@/lib/auth";
import { sendMagicLink } from "@/lib/services/email-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = body.password ? String(body.password) : null;
    const returnTo = String(body.returnTo || "").trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    // ── Dev bypass: @dev.local accounts get an immediate cookie, no email sent ──
    if (process.env.NODE_ENV !== "production" && email.endsWith("@dev.local")) {
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, displayName: email.split("@")[0] },
      });
      const redirectTo = returnTo && returnTo.startsWith("/") ? returnTo : "/dashboard";
      const response = NextResponse.json({ redirectTo });
      setAuthCookie(response, user.email);
      return response;
    }

    // ── Password fallback ────────────────────────────────────────────────────
    if (password) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }
      const redirectTo = returnTo && returnTo.startsWith("/") ? returnTo : "/dashboard";
      const response = NextResponse.json({
        user: { id: user.id, email: user.email, displayName: user.displayName },
        redirectTo,
      });
      setAuthCookie(response, user.email);
      return response;
    }

    // ── Magic link path ──────────────────────────────────────────────────────
    // Don't reveal whether an account exists — always return { sent: true }
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const { rawToken, tokenHash, expiresAt } = generateMagicLinkToken();
      await prisma.user.update({
        where: { id: user.id },
        data: { magicLinkToken: tokenHash, magicLinkExpiresAt: expiresAt },
      });
      void sendMagicLink(email, user.displayName, rawToken, returnTo || undefined).catch(() => {});
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Unable to log in." }, { status: 500 });
  }
}
