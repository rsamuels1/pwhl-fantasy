import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setAuthCookie, createSession, generateMagicLinkToken } from "@/lib/auth";
import { sendMagicLink } from "@/lib/services/email-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const displayName =
      String(body.displayName || "").trim() || email.split("@")[0];
    const password = body.password ? String(body.password) : null;

    if (body.displayName && String(body.displayName).trim().length > 80) {
      return NextResponse.json(
        { error: "Display name must be 80 characters or fewer." },
        { status: 400 }
      );
    }
    const returnTo = String(body.returnTo || "").trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    // ── Dev bypass: @dev.local accounts get an immediate cookie, no email sent ──
    // ALLOW_DEV_LOGIN=true enables this on production Vercel deployments (e.g. pwhl-gm-beta)
    const devLoginAllowed = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_LOGIN === "true";
    if (devLoginAllowed && email.endsWith("@dev.local")) {
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, displayName },
      });
      const redirectTo = returnTo && returnTo.startsWith("/") ? returnTo : "/dashboard";
      const response = NextResponse.json({ redirectTo });
      setAuthCookie(response, await createSession(user.id));
      return response;
    }

    // ── Password path ────────────────────────────────────────────────────────
    if (password) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters." },
          { status: 400 }
        );
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json(
          { error: "An account with that email already exists." },
          { status: 409 }
        );
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email, displayName, passwordHash },
      });

      const redirectTo = returnTo && returnTo.startsWith("/") ? returnTo : "/dashboard";
      const response = NextResponse.json({
        user: { id: user.id, email: user.email, displayName: user.displayName },
        redirectTo,
      });
      setAuthCookie(response, await createSession(user.id));
      return response;
    }

    // ── Magic link path (no password) ────────────────────────────────────────
    // Upsert the user so registration is idempotent for passwordless accounts.
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, displayName },
    });

    const { rawToken, tokenHash, expiresAt } = generateMagicLinkToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { magicLinkToken: tokenHash, magicLinkExpiresAt: expiresAt },
    });
    void sendMagicLink(email, user.displayName, rawToken, returnTo || undefined).catch(() => {});

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error("Register failed:", error);
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}
