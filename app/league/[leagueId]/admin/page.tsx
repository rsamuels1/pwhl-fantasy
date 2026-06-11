import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireCommissioner } from "@/lib/auth";
import { getSeasonState } from "@/lib/season";
import { getDevNow } from "@/lib/devTime";
import Link from "next/link";
import AddTeamForm from "@/components/AddTeamForm";
import SetupDraftButton from "@/components/SetupDraftButton";
import SeasonView from "../season/SeasonView";

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function AdminPage({ params }: Props) {
  const { leagueId } = await params;
  const user = await requireAuth(`/league/${leagueId}/admin`);
  await requireCommissioner(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: {
      teams: { orderBy: { draftOrder: "asc" } },
      draft: { select: { id: true, status: true, startedAt: true, completedAt: true, pickTimerSecs: true } },
    },
  });

  if (!league) notFound();

  const nowMs = await getDevNow();
  const state = await getSeasonState(leagueId, nowMs, prisma);
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>Admin panel</h1>
        <p style={{ color: "#94a3b8" }}>{league.name} · Commissioner controls</p>
      </div>

      {/* League info */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>League settings</h2>
        <div style={{ display: "grid", gap: 10, color: "#e2e8f0" }}>
          <Row label="Name" value={league.name} />
          <Row label="Season" value={league.season} />
          <Row label="Status" value={league.status.replace("_", " ")} />
          <Row label="Draft type" value={league.draftType} />
          <Row label="Max teams" value={String(league.maxTeams)} />
          <Row label="Playoff status" value={league.playoffStatus.replace("_", " ")} />
        </div>
        <p style={{ marginTop: 16, color: "#64748b", fontSize: 13 }}>
          Edit scoring, roster, and playoff rules via{" "}
          <Link href={`/league/${leagueId}/settings`} style={{ color: "#a5b4fc" }}>settings</Link>.
        </p>
      </section>

      {/* Team management */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Teams ({league.teams.length})</h2>
        {league.teams.length > 0 ? (
          <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            {league.teams.map((t) => (
              <div key={t.id} style={rowStyle}>
                <span>{t.name}</span>
                <span style={{ color: "#64748b", fontSize: 13 }}>#{t.draftOrder ?? "—"} draft order</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "#94a3b8", marginBottom: 20 }}>No teams yet.</p>
        )}
        <AddTeamForm leagueId={leagueId} />
      </section>

      {/* Draft management */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Draft</h2>
        {league.draft ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <StatTile label="Status" value={league.draft.status.replace("_", " ")} />
              <StatTile label="Pick timer" value={`${league.draft.pickTimerSecs}s`} />
              {league.draft.startedAt && (
                <StatTile label="Started" value={new Date(league.draft.startedAt).toLocaleDateString()} />
              )}
              {league.draft.completedAt && (
                <StatTile label="Completed" value={new Date(league.draft.completedAt).toLocaleDateString()} />
              )}
            </div>
            {league.draft.status !== "COMPLETE" && (
              <div>
                <p style={{ color: "#94a3b8", marginBottom: 12 }}>Team join links:</p>
                <div style={{ display: "grid", gap: 8 }}>
                  {league.teams.map((t) => (
                    <div key={t.id} style={rowStyle}>
                      <span>{t.name}</span>
                      <Link
                        href={`/draft/${leagueId}?team=${t.id}`}
                        style={{ color: "#a5b4fc", fontSize: 13 }}
                      >
                        Join draft →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : league.teams.length >= 2 ? (
          <div>
            <p style={{ color: "#94a3b8", marginBottom: 16 }}>
              Ready to draft? Set up the draft board and start making picks.
            </p>
            <SetupDraftButton leagueId={leagueId} />
          </div>
        ) : (
          <p style={{ color: "#94a3b8" }}>Add at least 2 teams to set up a draft.</p>
        )}
      </section>

      {/* Season management */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Season management</h2>
        <SeasonView leagueId={leagueId} initialState={state} isDev={isDev} />
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "12px 16px" }}>
      <p style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 20,
  padding: 20,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "10px 14px",
  background: "rgba(255,255,255,0.03)",
  borderRadius: 12,
};
