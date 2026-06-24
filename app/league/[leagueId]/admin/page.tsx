import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import type { EventType } from "@prisma/client";
import { requireAuth, requireCommissioner } from "@/lib/auth";
import { getSeasonState } from "@/lib/season";
import { getDevNow } from "@/lib/devTime";
import Link from "next/link";
import AddTeamForm from "@/components/AddTeamForm";
import SetupDraftButton from "@/components/SetupDraftButton";
import AutoDraftButton from "@/components/AutoDraftButton";
import InviteLinkButton from "@/components/InviteLinkButton";
import AnnouncementForm from "@/components/AnnouncementForm";
import { RenewLeagueForm } from "@/components/RenewLeagueForm";
import { CommissionerRecoveryTools } from "@/components/CommissionerRecoveryTools";
import { LeagueSettingsEditor } from "@/components/LeagueSettingsEditor";
import TradeSettingsForm from "@/components/TradeSettingsForm";
import NegativeAwardsToggle from "@/components/NegativeAwardsToggle";
import PendingTradeReviewList from "@/components/PendingTradeReviewList";

const COMMISSIONER_EVENT_TYPES = [
  "COMMISSIONER_FORCE_MOVE",
  "COMMISSIONER_UNDO_TRANSACTION",
  "COMMISSIONER_REPLACE_MANAGER",
  "COMMISSIONER_DRAFT_PAUSED",
  "COMMISSIONER_DRAFT_RESUMED",
  "COMMISSIONER_ANNOUNCEMENT",
  "COMMISSIONER_SETTINGS_CHANGED",
] as const;

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams?: Promise<{ welcome?: string; renewed?: string }>;
}

export default async function AdminPage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const sp = searchParams ? await searchParams : {};
  const isWelcome = sp.welcome === "1";
  const isRenewed = sp.renewed === "1";
  const user = await requireAuth(`/league/${leagueId}/admin`);
  await requireCommissioner(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: {
      teams: {
        orderBy: { draftOrder: "asc" },
        include: {
          owner: { select: { email: true } },
          roster: {
            include: { player: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
      },
      draft: { select: { id: true, status: true, startedAt: true, completedAt: true, pickTimerSecs: true } },
    },
  });

  if (!league) notFound();

  // Pending-review trades (commissioner needs to act)
  const pendingTrades = await prisma.trade.findMany({
    where: { leagueId, status: { in: ["PENDING_REVIEW", "ACCEPTED"] } },
    include: {
      items: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Batch-load player names for pending trades
  const pendingPlayerIds = [...new Set(pendingTrades.flatMap((t) => t.items.map((i) => i.playerId)))];
  const pendingPlayers = pendingPlayerIds.length > 0
    ? await prisma.player.findMany({
        where: { id: { in: pendingPlayerIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];

  // Fetch audit log for commissioner actions (last 50)
  const auditLog = await prisma.leagueEvent.findMany({
    where: {
      leagueId,
      type: { in: [...COMMISSIONER_EVENT_TYPES] as unknown as EventType[] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Build team rows for CommissionerRecoveryTools
  const teamRows = league.teams.map((t) => ({
    id: t.id,
    name: t.name,
    ownerEmail: t.owner.email,
    roster: t.roster.map((r) => ({
      playerId: r.player.id,
      playerName: `${r.player.firstName} ${r.player.lastName}`,
      slot: r.slot,
    })),
  }));

  const isDraftPaused = league.draft?.status === "PAUSED";
  const commTeam = league.teams.find((t) => t.ownerId === user.id);

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
        <p style={{ color: "var(--dim)" }}>{league.name} · Commissioner controls</p>
      </div>

      {/* ── Renewed banner ── */}
      {isRenewed && (
        <div style={{
          padding: "16px 20px", borderRadius: 16,
          background: "rgba(143,193,232,0.07)",
          border: "1px solid rgba(143,193,232,0.2)",
          display: "grid", gap: 12,
        }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--accent-strong)" }}>
            ✓ New season created!
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--faint)" }}>
            Set up the draft to get ready for the next season. Invite returning managers to re-join — they need a new link for this league.
          </p>
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Share invite link
            </p>
            <InviteLinkButton leagueId={leagueId} />
          </div>
        </div>
      )}

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
          <p style={{ margin: 0, fontSize: 13, color: "var(--faint)" }}>
            Follow the checklist below to get ready for draft day. Start by inviting your managers.
          </p>
        </div>
      )}

      {/* ── Draft paused notice ── */}
      {isDraftPaused && (
        <div style={{
          padding: "14px 20px", borderRadius: 16,
          background: "rgba(251,191,36,0.07)",
          border: "1px solid rgba(251,191,36,0.25)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <p style={{ margin: 0, fontSize: 14, color: "#fbbf24", fontWeight: 600 }}>
            ⏸ Draft is currently PAUSED
          </p>
          <Link href={`/draft/${leagueId}`} style={{
            color: "var(--accent-strong)", fontSize: 13, fontWeight: 600,
            background: "rgba(143,193,232,0.1)", padding: "6px 12px", borderRadius: 8,
            textDecoration: "none",
          }}>
            Go to draft room →
          </Link>
        </div>
      )}

      {/* ── Setup checklist — hide once all steps are done ── */}
      {completedCount < checklistSteps.length && <section style={panelStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Setup checklist</h2>
          <span style={{ fontSize: 13, color: progressPct === 100 ? "#34d399" : "var(--dim)", fontWeight: 600 }}>
            {completedCount}/{checklistSteps.length} complete
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, borderRadius: 3, background: "var(--bg-raised)", marginBottom: 20, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 3,
            width: `${progressPct}%`,
            background: progressPct === 100 ? "#34d399" : "linear-gradient(90deg, var(--accent), var(--accent-strong))",
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
                  ? "rgba(143,193,232,0.07)"
                  : "var(--bg-raised)",
                border: `1px solid ${isNext
                  ? "rgba(143,193,232,0.2)"
                  : "var(--border)"}`,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                  background: step.done
                    ? "rgba(52,211,153,0.15)"
                    : isNext
                    ? "rgba(143,193,232,0.15)"
                    : "var(--surface)",
                  color: step.done ? "#34d399" : isNext ? "var(--accent-strong)" : "var(--faint)",
                  border: `1.5px solid ${step.done ? "#34d399" : isNext ? "var(--accent)" : "var(--border)"}`,
                  marginTop: 1,
                }}>
                  {step.done ? "✓" : i + 1}
                </div>
                <div>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: step.done ? "var(--dim)" : "var(--text)",
                    textDecoration: step.done ? "line-through" : "none",
                  }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>{step.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>}

      {/* ── Invite link ── */}
      {!draftDone && (
        <section style={panelStyle}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Invite managers</h2>
          <p style={{ color: "var(--dim)", fontSize: 14, marginBottom: 16 }}>
            Share this link. Anyone who opens it sees your league and can join in one step —
            no league ID needed.
          </p>
          <InviteLinkButton leagueId={leagueId} />
          <p style={{ marginTop: 12, fontSize: 12, color: "var(--faint)" }}>
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
                <span style={{ color: "var(--faint)", fontSize: 13 }}>
                  #{t.draftOrder ?? "—"} draft order
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--dim)", marginBottom: 20 }}>
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
                {/* Plain-language snake draft primer (UX-056) */}
                <div style={{
                  background: "var(--bg-raised)", border: "1px solid var(--border)",
                  borderRadius: 12, padding: "14px 16px", marginBottom: 18,
                }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>
                    How the draft works
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5 }}>
                    {[
                      "Each manager takes turns picking one player — 13 rounds total.",
                      "Round 1: pick 1, pick 2, … pick N. Round 2 reverses: pick N goes first. This is called snake order.",
                      "You have 30 seconds per pick. Miss your turn and the system auto-picks for you.",
                      "Fill 3 Forwards, 2 Defense, 1 Goalie, 1 Utility (any skater), and 6 Bench spots.",
                      "Start the draft from inside the draft room — everyone needs to be connected first.",
                    ].map((tip, i) => (
                      <li key={i} style={{ fontSize: 12, color: "var(--dim)", lineHeight: 1.5 }}>{tip}</li>
                    ))}
                  </ul>
                </div>

                <p style={{ color: "var(--dim)", fontSize: 14, marginBottom: 14 }}>
                  Send each manager their personal draft room link:
                </p>
                <div style={{ display: "grid", gap: 8 }}>
                  {league.teams.map((t) => (
                    <div key={t.id} style={rowStyle}>
                      <span style={{ fontWeight: 600 }}>{t.name}</span>
                      <Link
                        href={`/draft/${leagueId}?team=${t.id}`}
                        style={{
                          color: "var(--accent-strong)", fontSize: 13, fontWeight: 600,
                          textDecoration: "none",
                          background: "rgba(143,193,232,0.1)",
                          padding: "4px 10px", borderRadius: 8,
                        }}
                      >
                        Open draft room →
                      </Link>
                    </div>
                  ))}
                </div>
                {isDev && (
                  <AutoDraftButton leagueId={leagueId} />
                )}
                {!isDev && commTeam && (
                  <Link
                    href={`/draft/${leagueId}?team=${commTeam.id}`}
                    style={{
                      display: "inline-block",
                      marginTop: 12,
                      color: "var(--accent-ink)",
                      fontSize: 14,
                      fontWeight: 600,
                      textDecoration: "none",
                      background: "var(--accent)",
                      padding: "10px 16px",
                      borderRadius: 8,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--accent-deep)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--accent)";
                    }}
                  >
                    ▶ Go to draft room to start →
                  </Link>
                )}
                {!isDev && !commTeam && (
                  <p style={{ marginTop: 12, fontSize: 12, color: "var(--faint)" }}>
                    You start the draft from inside the draft room once everyone is connected.
                  </p>
                )}
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
                <p style={{ margin: "6px 0 0", color: "var(--faint)", fontSize: 13 }}>
                  Start the season below to generate matchups and unlock lineup management.
                </p>
              </div>
            )}
          </div>
        ) : hasEnoughTeams ? (
          <div>
            <p style={{ color: "var(--dim)", marginBottom: 16, fontSize: 14 }}>
              You have {league.teams.length} team{league.teams.length !== 1 ? "s" : ""} ready.
              Create the draft board to generate pick order and enable the draft room.
            </p>
            <SetupDraftButton leagueId={leagueId} />
          </div>
        ) : (
          <p style={{ color: "var(--dim)", fontSize: 14 }}>
            Add at least 2 teams before setting up the draft.
          </p>
        )}
      </section>

      {/* ── League announcement ── */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>League announcement</h2>
        <p style={{ color: "var(--dim)", fontSize: 14, marginBottom: 16 }}>
          Pinned to the top of the league overview for every manager. Leave empty to hide it.
        </p>
        <AnnouncementForm leagueId={leagueId} initial={league.announcement} />
      </section>

      {/* ── Season management ── */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Season management</h2>
        {draftDone ? (
          league.isReplay ? (
            <div>
              <p style={{ color: "var(--dim)", fontSize: 14, marginBottom: 12 }}>
                Use the <strong>Sim →</strong> page to manage replay league progression.
              </p>
              <Link
                href={`/league/${leagueId}/sim`}
                style={{
                  display: "inline-block",
                  padding: "10px 14px",
                  background: "rgba(143,193,232,0.15)",
                  border: "1px solid rgba(143,193,232,0.3)",
                  borderRadius: 8,
                  color: "var(--accent-strong)",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Go to Sim →
              </Link>
            </div>
          ) : (
            <p style={{ color: "var(--dim)", fontSize: 14 }}>
              Live season — players advance automatically through the PWHL schedule.
            </p>
          )
        ) : (
          <p style={{ color: "var(--dim)", fontSize: 14 }}>
            Season controls become available after the draft is complete.
          </p>
        )}
      </section>

      {/* ── League settings editor ── */}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>League settings</h2>
        {draftDone && (
          <p style={{ color: "var(--dim)", fontSize: 14, marginBottom: 16 }}>
            Scoring and roster settings are locked after the draft. You can still update visibility.
          </p>
        )}
        {!draftDone && (
          <p style={{ color: "var(--dim)", fontSize: 14, marginBottom: 16 }}>
            Adjust max teams and draft type before the draft begins. Changes are logged in the audit trail.
          </p>
        )}
        <LeagueSettingsEditor
          leagueId={leagueId}
          maxTeams={league.maxTeams}
          draftType={league.draftType}
          draftDone={draftDone}
          isPublic={league.isPublic}
        />
        {draftDone && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
              Weekly awards
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
              Negative awards (Frozen Stick, Heartbreaker, Collapse) can feel discouraging for casual leagues.
              Turn them off to keep the vibe positive.
            </p>
            <NegativeAwardsToggle
              leagueId={leagueId}
              defaultValue={
                ((league.scoringSettings as Record<string, unknown>)?.showNegativeAwards ?? true) !== false
              }
            />
          </div>
        )}
      </section>

      {/* ── Commissioner recovery tools ── */}
      {draftDone && (
        <section style={panelStyle}>
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Commissioner tools</h2>
          <p style={{ color: "var(--dim)", fontSize: 13, marginBottom: 20 }}>
            Recovery actions for unexpected situations. All actions are logged in the audit trail below.
          </p>
          <CommissionerRecoveryTools
            leagueId={leagueId}
            teams={teamRows}
            isDraftPaused={isDraftPaused}
            isInSeason={league.status === "IN_SEASON"}
          />
        </section>
      )}

      {/* ── Trade settings ── */}
      {draftDone && (
        <section style={panelStyle}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Trade settings</h2>
          <p style={{ color: "var(--dim)", fontSize: 14, marginBottom: 16 }}>
            Control how trades are processed in your league. Changes take effect for new trades immediately.
          </p>
          <TradeSettingsForm
            leagueId={leagueId}
            tradeReviewHours={league.tradeReviewHours}
            requireCommissionerTradeApproval={league.requireCommissionerTradeApproval}
          />
        </section>
      )}

      {/* ── Pending trade review ── */}
      {pendingTrades.length > 0 && (
        <section style={{ ...panelStyle, border: "1px solid rgba(251,191,36,0.25)" }}>
          <h2 style={{ fontSize: 18, marginBottom: 8, color: "#fbbf24" }}>
            Trades pending review ({pendingTrades.length})
          </h2>
          <p style={{ color: "var(--dim)", fontSize: 14, marginBottom: 16 }}>
            These trades have been accepted but require your review before executing.
          </p>
          <PendingTradeReviewList
            leagueId={leagueId}
            trades={pendingTrades}
            playerNames={Object.fromEntries(pendingPlayers.map((p) => [p.id, `${p.firstName} ${p.lastName}`]))}
            teamNames={Object.fromEntries(league.teams.map((t) => [t.id, t.name]))}
          />
        </section>
      )}

      {/* ── Audit log ── */}
      {auditLog.length > 0 && (
        <section style={panelStyle}>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Audit log</h2>
          <div style={{ display: "grid", gap: 6 }}>
            {auditLog.map((entry) => {
              const data = entry.data as Record<string, unknown>;
              const action = String(data.action ?? entry.type).replace(/^COMMISSIONER_/, "").replace(/_/g, " ");
              const target = data.target ? ` · ${data.target}` : "";
              return (
                <div key={entry.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "10px 14px", borderRadius: 10,
                  background: "var(--bg-raised)",
                  border: "1px solid var(--border)",
                  fontSize: 13,
                }}>
                  <span style={{ color: "var(--faint)", flexShrink: 0, minWidth: 120 }}>
                    {new Date(entry.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span style={{ color: "var(--accent-strong)", fontWeight: 600, textTransform: "capitalize" }}>
                    {action.toLowerCase()}{target}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Start next season ── */}
      {league.playoffStatus === "COMPLETE" && (
        <section style={{ ...panelStyle, border: "1px solid rgba(143,193,232,0.25)" }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Start next season</h2>
          <p style={{ color: "var(--dim)", fontSize: 14, marginBottom: 16 }}>
            Create a new league for the next season. Your teams, rosters, and matchup history stay
            in this league. Managers will need to re-join and re-draft for the new season.
          </p>
          <RenewLeagueForm leagueId={leagueId} currentSeason={league.season} />
        </section>
      )}

      {/* ── League settings ── */}
      <section style={{ ...panelStyle, borderColor: "var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, margin: 0, color: "var(--dim)" }}>League settings</h2>
          <Link href={`/league/${leagueId}/settings`} style={{ color: "var(--accent)", fontSize: 13 }}>
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
      <span style={{ color: "var(--faint)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "var(--text)" }}>{value}</span>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bg-raised)", borderRadius: 12, padding: "12px 14px" }}>
      <p style={{ color: "var(--faint)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>
        {label}
      </p>
      <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text)" }}>{value}</p>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: 20,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "10px 14px",
  background: "var(--bg-raised)",
  borderRadius: 12,
};
