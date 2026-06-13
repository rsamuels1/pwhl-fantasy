import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  const user = await apiRequireAuth(req);
  if (user instanceof NextResponse) return user;

  if (!user.onboardingCompletedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingCompletedAt: new Date() },
    });
  }

  try {
    trackEvent({ event: "onboarding_welcome_dismissed", userId: user.id });
  } catch {}

  return NextResponse.json({ ok: true });
}
