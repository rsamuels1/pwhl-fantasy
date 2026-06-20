import { NextRequest, NextResponse } from "next/server";
import { apiRequireFounder } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const items = await prisma.backlogItem.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      feedback: {
        include: {
          user: { select: { email: true } },
        },
        select: {
          type: true,
          body: true,
          user: true,
        },
      },
    },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { feedbackId, title, userStory, priority, category } = body as {
    feedbackId?: string;
    title: string;
    userStory: string;
    priority?: string;
    category?: string;
  };

  if (!title || !userStory) {
    return NextResponse.json(
      { error: "title and userStory are required" },
      { status: 400 }
    );
  }

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.backlogItem.create({
      data: {
        feedbackId: feedbackId ?? null,
        title,
        userStory,
        priority: priority ?? "P2",
        category: category ?? "FEATURE",
      },
    });

    if (feedbackId) {
      await tx.feedbackSubmission.update({
        where: { id: feedbackId },
        data: { status: "IN_BACKLOG" },
      });
    }

    return created;
  });

  return NextResponse.json({ item }, { status: 201 });
}
