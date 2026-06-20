import { NextRequest, NextResponse } from "next/server";
import { apiRequireFounder } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json();
  const { title, userStory, priority, category } = body as {
    title?: string;
    userStory?: string;
    priority?: string;
    category?: string;
  };

  const updated = await prisma.backlogItem.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(userStory !== undefined && { userStory }),
      ...(priority !== undefined && { priority }),
      ...(category !== undefined && { category }),
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  await prisma.$transaction(async (tx) => {
    const item = await tx.backlogItem.findUnique({ where: { id } });
    if (!item) return;

    await tx.backlogItem.delete({ where: { id } });

    if (item.feedbackId) {
      await tx.feedbackSubmission.update({
        where: { id: item.feedbackId },
        data: { status: "OPEN" },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
