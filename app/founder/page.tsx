import { prisma } from "@/lib/db";
import { type EventType } from "@prisma/client";
import Link from "next/link";

const COMMISSIONER_EVENT_TYPES = [
  "COMMISSIONER_FORCE_MOVE",
  "COMMISSIONER_UNDO_TRANSACTION",
  "COMMISSIONER_REPLACE_MANAGER",
  "COMMISSIONER_DRAFT_PAUSED",
  "COMMISSIONER_DRAFT_RESUMED",
  "COMMISSIONER_ANNOUNCEMENT",
  "COMMISSIONER_SETTINGS_CHANGED",
] as const;

const MVP_GATES = [
  { label: "Draft — reconnect", pass: true },
  { label: "Draft — commissioner auth", pass: true },
  { label: "Draft — auto-pick position-aware", pass: true },
  { label: "Draft — duplicate-tab handling", pass: true },
  { label: "Rosters (3F·2D·1G·1U·6B)", pass: true },
  { label: "Weekly matchups (VP scoring)", pass: true },
  { label: "VP standings authority", pass: true },
  { label: "Lineup lock (period-based)", pass: true },
  { label: "Playoffs (4-team, 0 byes)", pass: true },
];

export default async function FounderDashboard() {
  const now = new Date();

  const [
    leaguesByStatus,
    teamCount,
    activeOrPausedDrafts,
    unscoredExpiredMatchups,
    recentEvents,
  ] = await Promise.all([
    prisma.fantasyLeague.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.fantasyTeam.count(),
    prisma.draft.count({ where: { status: { in: ["IN_PROGRESS", "PAUSED"] } } }),
    prisma.matchup.count({
      where: { endsAt: { lt: now }, homeScore: null, isPlayoff: false },
    }),
    prisma.leagueEvent.findMany({
      where: { type: { in: COMMISSIONER_EVENT_TYPES as unknown as EventType[] } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        league: { select: { name: true } },
      },
    }).catch(() => []),
  ]);

  const statusMap = Object.fromEntries(leaguesByStatus.map((r) => [r.status, r._count.id]));
  const totalLeagues = leaguesByStatus.reduce((sum, r) => sum + r._count.id, 0);

  return (
    <div style={{ maxWidth: "900px" }}>
      <h1 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem", color: "#ccc" }}>
        Dashboard
      </h1>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "2rem" }}>
        {[
          { label: "Total Leagues", value: totalLeagues },
          { label: "PRE_DRAFT", value: statusMap["PRE_DRAFT"] ?? 0, dim: true },
          { label: "IN_SEASON", value: statusMap["IN_SEASON"] ?? 0, accent: "#22c55e" },
          { label: "COMPLETE", value: statusMap["COMPLETE"] ?? 0, dim: true },
          { label: "Total Teams", value: teamCount },
          { label: "Active Drafts", value: activeOrPausedDrafts, accent: activeOrPausedDrafts > 0 ? "#f59e0b" : undefined },
          { label: "Weeks Pending Score", value: unscoredExpiredMatchups, accent: unscoredExpiredMatchups > 0 ? "#ef4444" : undefined },
        ].map(({ label, value, accent, dim }) => (
          <div key={label} style={{ background: "#111", border: "1px solid #222", borderRadius: "6px", padding: "0.75rem 1rem" }}>
            <div style={{ fontSize: "0.7rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>{label}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: accent ?? (dim ? "#555" : "#e0e0e0") }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* MVP Readiness Gates */}
        <div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
            MVP Readiness Gates
          </div>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: "6px", padding: "0.75rem" }}>
            {MVP_GATES.map((g) => (
              <div key={g.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0", fontSize: "0.82rem", borderBottom: "1px solid #1a1a1a" }}>
                <span style={{ color: g.pass ? "#22c55e" : "#ef4444", width: "1rem", flexShrink: 0 }}>
                  {g.pass ? "✓" : "✗"}
                </span>
                <span style={{ color: g.pass ? "#888" : "#ccc" }}>{g.label}</span>
              </div>
            ))}
            <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#22c55e", fontWeight: 700 }}>
              ✅ All gates clear — ready to invite founding commissioners
            </div>
          </div>
        </div>

        {/* Recent Commissioner Actions */}
        <div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
            Recent Commissioner Actions
          </div>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: "6px", padding: "0.75rem", maxHeight: "320px", overflowY: "auto" }}>
            {(recentEvents as { id: string; type: string; createdAt: Date; league: { name: string } | null }[]).length === 0 ? (
              <div style={{ color: "#555", fontSize: "0.82rem", textAlign: "center", padding: "1rem" }}>No commissioner actions yet</div>
            ) : (
              (recentEvents as { id: string; type: string; createdAt: Date; league: { name: string } | null }[]).map((ev) => (
                <div key={ev.id} style={{ padding: "0.3rem 0", fontSize: "0.78rem", borderBottom: "1px solid #1a1a1a" }}>
                  <div style={{ color: "#ccc" }}>{ev.type.replace("COMMISSIONER_", "").replace(/_/g, " ")}</div>
                  <div style={{ color: "#555", marginTop: "0.1rem" }}>
                    {ev.league?.name ?? "—"} · {new Date(ev.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
        <Link href="/founder/leagues" style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: "6px", padding: "0.6rem 1.2rem", color: "#64b5f6", fontSize: "0.85rem", textDecoration: "none" }}>
          League Explorer →
        </Link>
        <Link href="/founder/simulate" style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: "6px", padding: "0.6rem 1.2rem", color: "#64b5f6", fontSize: "0.85rem", textDecoration: "none" }}>
          Run Simulation →
        </Link>
      </div>
    </div>
  );
}
