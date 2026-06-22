import { NextRequest, NextResponse } from "next/server";
import { apiRequireFounder } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/founder/beta-signups
// Returns all beta signup rows ordered by createdAt ASC.
export async function GET(req: NextRequest) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const signups = await prisma.betaSignup.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      wantsToCommission: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ signups });
}
