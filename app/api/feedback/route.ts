import { NextRequest, NextResponse } from "next/server";
import { apiRequireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const VALID_TYPES = ["BUG", "SUGGESTION", "OTHER"] as const;
type FeedbackType = typeof VALID_TYPES[number];

export async function POST(req: NextRequest) {
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, body: feedbackBody, leagueId } = body as Record<string, unknown>;

  if (!VALID_TYPES.includes(type as FeedbackType)) {
    return NextResponse.json(
      { error: "type must be one of: BUG, SUGGESTION, OTHER" },
      { status: 400 }
    );
  }

  if (typeof feedbackBody !== "string" || feedbackBody.trim().length === 0) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  if (feedbackBody.length > 2000) {
    return NextResponse.json({ error: "body must be 2000 characters or fewer" }, { status: 400 });
  }

  try {
    const submission = await prisma.feedbackSubmission.create({
      data: {
        userId: auth.id,
        type: type as FeedbackType,
        body: feedbackBody.trim(),
        url: typeof (body as Record<string, unknown>).url === "string"
          ? (body as Record<string, unknown>).url as string
          : null,
        leagueId: typeof leagueId === "string" && leagueId.length > 0 ? leagueId : null,
      },
    });
    return NextResponse.json({ id: submission.id }, { status: 201 });
  } catch (err) {
    console.error("[/api/feedback] Prisma error:", err);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
