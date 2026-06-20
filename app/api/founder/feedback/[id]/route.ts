import { NextRequest, NextResponse } from "next/server";
import { apiRequireFounder } from "@/lib/auth";
import { prisma } from "@/lib/db";

const VALID_STATUSES = ["OPEN", "IN_BACKLOG", "RESOLVED", "DISMISSED"] as const;
type FeedbackStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json();
  const { status } = body as { status: unknown };

  if (!status || !VALID_STATUSES.includes(status as FeedbackStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const updated = await prisma.feedbackSubmission.update({
    where: { id },
    data: { status: status as FeedbackStatus },
  });

  return NextResponse.json({ submission: updated });
}
