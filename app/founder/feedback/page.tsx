import { prisma } from "@/lib/db";
import FeedbackTable from "./FeedbackTable";

export default async function FounderFeedbackPage() {
  const submissions = await prisma.feedbackSubmission.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { email: true } },
      backlogItem: { select: { id: true } },
    },
  });

  return (
    <div style={{ maxWidth: "1100px" }}>
      <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ccc", marginBottom: "1.25rem" }}>
        Beta Feedback
        <span style={{ marginLeft: "0.75rem", fontSize: "0.8rem", color: "#666", fontWeight: 400 }}>
          ({submissions.length} submissions)
        </span>
      </h1>
      <FeedbackTable submissions={submissions} />
    </div>
  );
}
