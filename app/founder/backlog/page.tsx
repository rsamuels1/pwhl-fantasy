import { prisma } from "@/lib/db";
import BacklogBoard from "./BacklogBoard";

export default async function FounderBacklogPage() {
  const items = await prisma.backlogItem.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      feedback: {
        include: {
          user: { select: { email: true } },
        },
      },
    },
  });

  return (
    <div style={{ maxWidth: "900px" }}>
      <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ccc", marginBottom: "1.25rem" }}>
        Backlog
        <span style={{ marginLeft: "0.75rem", fontSize: "0.8rem", color: "#666", fontWeight: 400 }}>
          ({items.length} items)
        </span>
      </h1>
      <BacklogBoard items={items} />
    </div>
  );
}
