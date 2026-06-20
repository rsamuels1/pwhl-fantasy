import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSeasonState } from "@/lib/season";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";

interface Props {
  params: Promise<{ leagueId: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: "Upcoming",
  ACTIVE: "Active",
  SCORING_PENDING: "Scoring",
  COMPLETE: "Complete",
};

const STATUS_COLOR: Record<string, string> = {
  UPCOMING: "#94a3b8",
  ACTIVE: "#6366f1",
  SCORING_PENDING: "#f59e0b",
  COMPLETE: "#22c55e",
};

export default async function SeasonPage({ params }: Props) {
  const { leagueId } = await params;
  const user = await requireAuth(`/league/${leagueId}/season`);
  await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, isReplay: true, replayCurrentDate: true, playoffStatus: true },
  });
  if (!league) notFound();

  const nowMs = getReplayNow(league, await getDevNow());
  const state = await getSeasonState(leagueId, nowMs, prisma);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#e2e8f0" }}>
        Season Schedule
      </h1>
      <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>
        {state.completedWeeks} of {state.totalWeeks} weeks complete
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "#e2e8f0" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.2)" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>Week</th>
              <th style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>Dates</th>
              <th style={{ padding: "10px 12px", textAlign: "center", color: "#94a3b8", fontWeight: 600 }}>Games</th>
              <th style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {state.periods.map((ps, i) => {
              const isActive = ps.status === "ACTIVE";
              return (
                <tr
                  key={ps.period.startsAt.getTime()}
                  style={{
                    borderBottom: "1px solid rgba(148,163,184,0.1)",
                    background: isActive ? "rgba(99,102,241,0.08)" : undefined,
                  }}
                >
                  <td style={{ padding: "10px 12px", fontWeight: isActive ? 700 : 400 }}>
                    Week {i + 1}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#cbd5e1" }}>
                    {fmt(ps.period.startsAt)} – {fmt(ps.period.endsAt)}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center", color: "#94a3b8" }}>
                    {ps.gamesFinal}/{ps.gamesTotal}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: STATUS_COLOR[ps.status] ?? "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}>
                      {STATUS_LABEL[ps.status] ?? ps.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {state.periods.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "32px 12px", textAlign: "center", color: "#64748b" }}>
                  No scoring periods yet — season hasn&apos;t started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
