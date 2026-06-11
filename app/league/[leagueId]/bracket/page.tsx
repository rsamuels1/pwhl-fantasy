import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { getStandings } from "@/lib/services/standings-service";
import { getBracket, PlayoffNotStartedError } from "@/lib/services/playoff-service";
import PlayoffBracket from "@/components/PlayoffBracket";

export default async function BracketPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const { leagueId } = params;
  const user = await requireAuth(`/league/${leagueId}/bracket`);
  await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, playoffStatus: true },
  });
  if (!league) notFound();

  const [standingsResult, bracketResult] = await Promise.all([
    getStandings(leagueId, prisma),
    league.playoffStatus !== "NOT_STARTED"
      ? getBracket(leagueId, prisma).catch((err) => {
          if (err instanceof PlayoffNotStartedError) return null;
          throw err;
        })
      : Promise.resolve(null),
  ]);

  const { standings } = standingsResult;
  // Find cutoff index: first team that isn't playoff eligible
  const cutoffIdx = standings.findIndex((s) => !s.isPlayoffEligible);
  const playoffCutoff = cutoffIdx >= 0 ? cutoffIdx : null;
  const hasPlayoffs = bracketResult !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>
          {hasPlayoffs ? "Playoff Bracket" : "Standings"}
        </h1>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
          background: hasPlayoffs ? "rgba(52,211,153,0.1)" : "rgba(99,102,241,0.12)",
          color: hasPlayoffs ? "#34d399" : "#a5b4fc",
        }}>
          {league.playoffStatus === "COMPLETE" ? "Complete" : hasPlayoffs ? "In Progress" : "Regular Season"}
        </span>
      </div>

      {/* Bracket (playoffs active) */}
      {hasPlayoffs && bracketResult.bracket && (
        <section style={card}>
          <PlayoffBracket bracket={bracketResult.bracket as Parameters<typeof PlayoffBracket>[0]["bracket"]} />
        </section>
      )}

      {/* Standings */}
      <section style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "#e2e8f0" }}>
          {hasPlayoffs ? "Regular Season Standings" : "Standings"}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
            <thead>
              <tr style={{ color: "#64748b", textAlign: "left", borderBottom: "1px solid rgba(148,163,184,0.2)" }}>
                {["#", "Team", "W–L", "PF", "PA", "Status"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => {
                const inPlayoffs = s.isPlayoffEligible;
                return (
                  <tr
                    key={s.fantasyTeamId}
                    style={{
                      borderBottom: playoffCutoff !== null && i === playoffCutoff - 1
                        ? "2px dashed rgba(99,102,241,0.3)"
                        : "1px solid rgba(148,163,184,0.07)",
                    }}
                  >
                    <td style={{ ...tdStyle, color: "#475569", fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{s.teamName}</td>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>
                      {s.wins}–{s.losses}{s.ties > 0 ? `–${s.ties}` : ""}
                    </td>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>{s.pointsFor.toFixed(1)}</td>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", color: "#64748b" }}>{s.pointsAgainst.toFixed(1)}</td>
                    <td style={tdStyle}>
                      {playoffCutoff !== null && (
                        inPlayoffs
                          ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "rgba(52,211,153,0.1)", color: "#34d399" }}>IN</span>
                          : <span style={{ fontSize: 10, color: "#475569" }}>Out</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {!hasPlayoffs && (
        <p style={{ fontSize: 13, color: "#475569", textAlign: "center" }}>
          Playoffs begin after the regular season ends.
        </p>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 20,
  padding: 20,
};

const thStyle: React.CSSProperties = {
  padding: "10px 8px",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 8px",
  fontSize: 14,
  color: "#e2e8f0",
};
