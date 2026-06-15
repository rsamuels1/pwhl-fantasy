import { NextRequest, NextResponse } from "next/server";
import { apiRequireFounder } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const submissions = await prisma.feedbackSubmission.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true } },
    },
  });

  return NextResponse.json({ submissions });
}
