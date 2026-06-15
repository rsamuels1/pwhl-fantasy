import { prisma } from "@/lib/db";

const TYPE_COLORS: Record<string, string> = {
  BUG: "#ef4444",
  SUGGESTION: "#6366f1",
  OTHER: "#6b7280",
};

function truncate(str: string, len: number) {
  return str.length > len ? str.slice(0, len) + "…" : str;
}

export default async function FounderFeedbackPage() {
  const submissions = await prisma.feedbackSubmission.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true } },
    },
  });

  return (
    <div style={{ maxWidth: "960px" }}>
      <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ccc", marginBottom: "1.25rem" }}>
        Beta Feedback
        <span style={{ marginLeft: "0.75rem", fontSize: "0.8rem", color: "#666", fontWeight: 400 }}>
          ({submissions.length} submissions)
        </span>
      </h1>

      {submissions.length === 0 ? (
        <div style={{ color: "#555", fontSize: "0.85rem" }}>No feedback submitted yet.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ background: "#0a0a0a" }}>
              {["Type", "User", "League", "Feedback", "Submitted"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "0.5rem 0.75rem",
                    textAlign: "left",
                    color: "#666",
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    borderBottom: "1px solid #222",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                <td style={{ padding: "0.5rem 0.75rem" }}>
                  <span
                    style={{
                      background: `${TYPE_COLORS[s.type] ?? "#555"}22`,
                      color: TYPE_COLORS[s.type] ?? "#888",
                      border: `1px solid ${TYPE_COLORS[s.type] ?? "#555"}44`,
                      borderRadius: 4,
                      padding: "0.15rem 0.5rem",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {s.type}
                  </span>
                </td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#9ca3af", fontFamily: "monospace", fontSize: "0.78rem" }}>
                  {s.user.email}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#555", fontFamily: "monospace", fontSize: "0.72rem" }}>
                  {s.leagueId ? s.leagueId.slice(0, 8) + "…" : "—"}
                </td>
                <td
                  style={{ padding: "0.5rem 0.75rem", color: "#ccc", maxWidth: "360px" }}
                  title={s.body}
                >
                  {truncate(s.body, 100)}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#555", whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                  {s.createdAt.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
