import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, wantsToCommission } = body as Record<string, unknown>;

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const commissionar = wantsToCommission === true;

  try {
    const existing = await prisma.betaSignup.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ alreadyRegistered: true }, { status: 200 });
    }

    await prisma.betaSignup.create({
      data: { email: normalizedEmail, wantsToCommission: commissionar },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to save signup" }, { status: 500 });
  }
}
