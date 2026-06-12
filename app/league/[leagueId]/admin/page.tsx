import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireCommissioner } from "@/lib/auth";
import { getSeasonState } from "@/lib/season";
import { getDevNow } from "@/lib/devTime";
import Link from "next/link";
import AddTeamForm from "@/components/AddTeamForm";
import SetupDraftButton from "@/components/SetupDraftButton";
import InviteLinkButton from "@/components/InviteLinkButton";
import AnnouncementForm from "@/components/AnnouncementForm";
import SeasonView from "../season/SeasonView";

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams?: Promise<{ welcome?: string }>;
}

export default async function AdminPage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const sp = searchParams ? await searchParams : {};
  const isWelcome = sp.welcome === "1";
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

  const devNow = await getDevNow();
  const nowMs = (league.isReplay && league.replayCurrentDate)
    ? league.replayCurrentDate.getTime()
    : devNow;
  const state = await getSeasonState(leagueId, nowMs, prisma);
  const isDev = process.env.NODE_ENV !== "production" || league.isReplay;

  // Derive setup checklist state
  const hasEnoughTeams = league.teams.length >= 2;
  const draftReady = hasEnoughTeams && !!league.draft;
  const draftDone = league.draft?.status === "COMPLETE";
  const seasonStarted = league.status === "IN_SEASON" || league.status === "COMPLETE";

  const checklistSteps: { label: string; detail: string; done: boolean }[] = [
    {
      label: "League created",
      detail: `"${league.name}" · Season ${league.season}${league.isReplay ? " · ⏪ Replay" : ""}`,
      done: true,
    },
    {
      label: `Teams joined`,
      detail: hasEnoughTeams
        ? `${league.teams.length} team${league.teams.length !== 1 ? "s" : ""} ready`
        : `${league.teams.length} of ${league.maxTeams} joined — need at least 2 to draft`,
      done: hasEnoughTeams,
    },
    {
      label: "Draft set up",
      detail: draftDone
        ? "Draft complete"
        : draftReady
        ? "Draft board created — start when everyone's ready"
        : "Set up the draft board once you have your teams",
      done: draftDone || draftReady,
    },
    {
      label: "Draft complete",
      detail: draftDone
        ? league.draft?.completedAt
          ? `Completed ${new Date(league.draft.completedAt).toLocaleDateString()}`
          : "All picks made"
        : "Draft hasn't started yet",
      done: draftDone,
    },
    {
      label: "Season started",
      detail: seasonStarted ? "Season is live" : "Start the season after the draft",
      done: seasonStarted,
    },
  ];

  const completedCount = checklistSteps.filter((s) => s.done).length;
  const progressPct = Math.round((completedCount / checklistSteps.length) * 100);

  // Determine the "next action" step to highlight
  const nextStepIdx = checklistSteps.findIndex((s) => !s.done);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>League setup</h1>
        <p style={{ color: "#94a3b8" }}>{league.name} · Commissioner controls</p>
      </div>

      {/* ── Welcome banner ── */}
      {isWelcome && (
        <div style={{
          padding: "16px 20px", borderRadius: 16,
          background: "rgba(52,211,153,0.07)",
          border: "1px solid rgba(52,211,153,0.2)",
        }}>
          <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#34d399" }}>
            ✓ League created!
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Follow the checklist below to get ready for draft day. Start by inviting your managers.
          </p>
        </div>
      )}

      {/* ── Setup checklist ── */}
      <section style={panelStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Setup checklist</h2>
          <span style={{ fontSize: 13, color: progressPct === 100 ? "#34d399" : "#94a3b8", fontWeight: 600 }}>
            {completedCount}/{checklistSteps.length} complete
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.07)", marginBottom: 20, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 3,
            width: `${progressPct}%`,
            background: progressPct === 100 ? "#34d399" : "linear-gradient(90deg, #6366f1, #818cf8)",
            transition: "width 0.4s ease",
          }} />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {checklistSteps.map((step, i) => {
            const isNext = i === nextStepIdx;
            return (
              <div key={step.label} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "12px 14px", borderRadius: 12,
                background: isNext
                  ? "rgba(99,102,241,0.07)"
                  : "rgba(255,255,255,0.02)",
                border: `1px solid ${isNext
                  ? "rgba(99,102,241,0.2)"
                  : "rgba(148,163,184,0.07)"}`,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                  background: step.done
                    ? "rgba(52,211,153,0.15)"
                    : isNext
                    ? "rgba(99,102,241,0.15)"
                    : "rgba(255,255,255,0.05)",
                  color: step.done ? "#34d399" : isNext ? "#a5b4fc" : "#475569",
                  border: `1.5px solid ${step.done ? "#34d399" : isNext ? "#6366f1" : "rgba(148,163,184,0.15)"}`,
                  marginTop: 1,
                }}>
                  {step.done ? "✓" : i + 1}
                </div>
                <div>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: step.done ? "#94a3b8" : "#e2e8f0",
                    textDecoration: step.done ? "line-through" : "none",
                  }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{step.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Invite link ── */}
      {!draftDone && (
        <section style={panelStyle}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Invite managers</h2>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16 }}>
            Share this link. Anyone who opens it sees your league and can join in one step —
            no league ID needed.
          </p>
          <InviteLinkButton leagueId={leagueId} />
          <p style={{ marginTop: 12, fontSize: 12, color: "#475569" }}>
            {league.teams.length}/{league.maxTeams} spots filled
            {league.maxTeams - league.teams.length > 0
              ? ` · ${league.maxTeams - league.teams.length} remaining`
              : " · league full"}
          </p>
        </section>
      )}

      {/* ── Teams ── */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>
          Teams ({league.teams.length}/{league.maxTeams})
        </h2>
        {league.teams.length > 0 ? (
          <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
            {league.teams.map((t) => (
              <div key={t.id} style={rowStyle}>
                <span style={{ fontWeight: 600 }}>{t.name}</span>
                <span style={{ color: "#64748b", fontSize: 13 }}>
                  #{t.draftOrder ?? "—"} draft order
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "#94a3b8", marginBottom: 20 }}>
            No teams yet — share the invite link above to get managers to join.
          </p>
        )}
        {!draftDone && <AddTeamForm leagueId={leagueId} />}
      </section>

      {/* ── Draft ── */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Draft</h2>
        {league.draft ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <StatTile label="Status" value={league.draft.status.replace("_", " ")} />
              <StatTile label="Pick timer" value={`${league.draft.pickTimerSecs}s`} />
              {league.draft.startedAt && (
                <StatTile label="Started" value={new Date(league.draft.startedAt).toLocaleDateString()} />
              )}
              {league.draft.completedAt && (
                <StatTile label="Completed" value={new Date(league.draft.completedAt).toLocaleDateString()} />
              )}
            </div>

            {!draftDone && (
              <div>
                <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 14 }}>
                  Send each manager their personal draft room link:
                </p>
                <div style={{ display: "grid", gap: 8 }}>
                  {league.teams.map((t) => (
                    <div key={t.id} style={rowStyle}>
                      <span style={{ fontWeight: 600 }}>{t.name}</span>
                      <Link
                        href={`/draft/${leagueId}?team=${t.id}`}
                        style={{
                          color: "#a5b4fc", fontSize: 13, fontWeight: 600,
                          textDecoration: "none",
                          background: "rgba(99,102,241,0.1)",
                          padding: "4px 10px", borderRadius: 8,
                        }}
                      >
                        Open draft room →
                      </Link>
                    </div>
                  ))}
                </div>
                <p style={{ marginTop: 12, fontSize: 12, color: "#475569" }}>
                  You start the draft from inside the draft room once everyone is connected.
                </p>
              </div>
            )}

            {draftDone && (
              <div style={{
                padding: "14px 16px", borderRadius: 12,
                background: "rgba(52,211,153,0.07)",
                border: "1px solid rgba(52,211,153,0.2)",
              }}>
                <p style={{ margin: 0, color: "#34d399", fontWeight: 600, fontSize: 14 }}>
                  ✓ Draft complete — all rosters are set.
                </p>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
                  Start the season below to generate matchups and unlock lineup management.
                </p>
              </div>
            )}
          </div>
        ) : hasEnoughTeams ? (
          <div>
            <p style={{ color: "#94a3b8", marginBottom: 16, fontSize: 14 }}>
              You have {league.teams.length} team{league.teams.length !== 1 ? "s" : ""} ready.
              Create the draft board to generate pick order and enable the draft room.
            </p>
            <SetupDraftButton leagueId={leagueId} />
          </div>
        ) : (
          <p style={{ color: "#94a3b8", fontSize: 14 }}>
            Add at least 2 teams before setting up the draft.
          </p>
        )}
      </section>

      {/* ── League announcement ── */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>League announcement</h2>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16 }}>
          Pinned to the top of the league overview for every manager. Leave empty to hide it.
        </p>
        <AnnouncementForm leagueId={leagueId} initial={league.announcement} />
      </section>

      {/* ── Season management ── */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Season management</h2>
        {draftDone ? (
          <SeasonView
            leagueId={leagueId}
            initialState={state}
            isDev={isDev}
            isReplay={league.isReplay}
            replayCurrentDate={league.replayCurrentDate?.toISOString()}
          />
        ) : (
          <p style={{ color: "#94a3b8", fontSize: 14 }}>
            Season controls become available after the draft is complete.
          </p>
        )}
      </section>

      {/* ── League settings ── */}
      <section style={{ ...panelStyle, borderColor: "rgba(148,163,184,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, margin: 0, color: "#94a3b8" }}>League settings</h2>
          <Link href={`/league/${leagueId}/settings`} style={{ color: "#6366f1", fontSize: 13 }}>
            View / edit →
          </Link>
        </div>
        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          <Row label="Season" value={league.season} />
          <Row label="Draft type" value={league.draftType} />
          <Row label="Max teams" value={String(league.maxTeams)} />
          <Row label="Playoff status" value={league.playoffStatus.replace("_", " ")} />
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 14 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{value}</span>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px" }}>
      <p style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>
        {label}
      </p>
      <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#e2e8f0" }}>{value}</p>
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
