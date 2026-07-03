import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiRequireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const password = body.password ? String(body.password) : null;

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: auth.id },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("set-password failed:", error);
    return NextResponse.json({ error: "Unable to set password." }, { status: 500 });
  }
}
