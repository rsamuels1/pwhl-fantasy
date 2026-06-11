import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const displayName = String(body.displayName || "").trim() || email.split("@")[0];
    const password = String(body.password || "");
    const returnTo = String(body.returnTo || "").trim();

    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, displayName, passwordHash },
    });

    let redirectTo = "/dashboard";
    if (returnTo && returnTo.startsWith("/")) {
      redirectTo = returnTo;
    }

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
      redirectTo,
    });
    setAuthCookie(response, user.email);
    return response;
  } catch (error) {
    console.error("Register failed:", error);
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}
