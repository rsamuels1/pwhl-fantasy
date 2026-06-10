import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const displayName = String(body.displayName || "").trim() || email.split("@")[0];

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { displayName },
      create: { email, displayName },
    });

    const response = NextResponse.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
    setAuthCookie(response, user.email);
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Unable to log in." }, { status: 500 });
  }
}
