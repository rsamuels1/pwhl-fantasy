import { NextRequest, NextResponse } from "next/server";
import { apiRequireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const raw = (body as Record<string, unknown>)?.displayName;
  const displayName = typeof raw === "string" ? raw.trim() : "";

  if (!displayName) {
    return NextResponse.json({ error: "Display name is required." }, { status: 400 });
  }
  if (displayName.length > 80) {
    return NextResponse.json({ error: "Display name must be 80 characters or fewer." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: auth.id },
    data: { displayName },
  });

  return NextResponse.json({ ok: true });
}
