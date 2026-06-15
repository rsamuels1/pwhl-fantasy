"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { StandingRow } from "@/lib/services/standings-service";

interface DraftPick {
  overall: number;
  round: number;
  auto: boolean;
  fantasyTeamId: string;
  teamName: string;
  playerName: string;
}

interface DraftInfo {
  status: string;
  currentPick: number | null;
  startedAt: string | null;
  completedAt: string | null;
  totalPicks: number;
  picks: DraftPick[];
}

interface ScoringSettings {
  skater: Record<string, number>;
  goalie: Record<string, number>;
}

// Serializable subset of SeasonState (dates as ISO strings, safe to pass across server/client boundary)
interface SeasonStateData {
  lifecycleStatus: string;
  completedWeeks: number;
  totalWeeks: number;
  activePeriodWeek: number | null;
  periods: {
    week: number;
    startsAt: string;
    endsAt: string;
    status: string;
  }[];
}

interface Props {
  leagueId: string;
  league: {
    name: string;
    season: string;
    status: string;
    draftType: string;
    scoringMode: string | null;
    maxTeams: number;
    isReplay: boolean;
    playoffStatus: string;
    betaStatus: string;
    scoringSettings: ScoringSettings | null;
    rosterSettings: Record<string, number> | null;
    playoffSettings: Record<string, unknown> | null;
    commissioner: { displayName: string; email: string } | null;
  };
  standings: StandingRow[];
  seasonState: SeasonStateData | null;
  draft: DraftInfo | null;
  teams: { id: string; name: string; owner: { email: string } | null }[];
}

const TABS = ["Config", "Standings", "Season", "Draft", "Beta"] as const;
type Tab = typeof TABS[number];

const BETA_STATUSES = ["NONE", "INVITED", "ACCEPTED", "ACTIVE", "RENEWED"] as const;

export function LeagueDetailTabs({ leagueId, league, standings, seasonState, draft, teams }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Config");
  const [simResult, setSimResult] = useState<string | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [betaStatus, setBetaStatus] = useState(league.betaStatus);
  const [betaSaved, setBetaSaved] = useState(false);
  const [betaError, setBetaError] = useState<string | null>(null);

  async function simulate(action: "scoreNextWeek" | "scoreAll") {
    setSimResult(null);
    setSimError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/founder/leagues/${leagueId}/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Unknown error");
        setSimResult(data.message ?? `Scored weeks: ${data.periodsScored?.join(", ") ?? "none"}`);
      } catch (e) {
        setSimError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  async function startPlayoffs() {
    setSimResult(null);
    setSimError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/founder/leagues/${leagueId}/start-playoffs`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Unknown error");
        setSimResult(`Playoffs started — ${data.totalRounds} round(s). Top seeds: ${data.seededTeams?.slice(0, 4).map((t: { teamName: string }) => t.teamName).join(", ")}`);
      } catch (e) {
        setSimError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function handleBetaStatusChange(newStatus: string) {
    setBetaSaved(false);
    setBetaError(null);
    setBetaStatus(newStatus);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/founder/leagues/${leagueId}/beta-status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ betaStatus: newStatus }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error((data as { error?: string }).error ?? "Unknown error");
        setBetaStatus((data as { betaStatus: string }).betaStatus);
        setBetaSaved(true);
      } catch (e) {
        setBetaError(e instanceof Error ? e.message : "Failed to update beta status");
      }
    });
  }

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: "1.5rem", borderBottom: "1px solid #222", marginBottom: "1.5rem" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{ background: "none", border: "none", padding: "0.6rem 0", color: activeTab === t ? "#e0e0e0" : "#666", fontFamily: "monospace", fontSize: "0.85rem", fontWeight: activeTab === t ? 700 : 400, borderBottom: `2px solid ${activeTab === t ? "#f59e0b" : "transparent"}`, cursor: "pointer", marginBottom: "-1px" }}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === "Config" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Section title="League Info">
            <Row label="Name" value={league.name} />
            <Row label="Season" value={league.season} />
            <Row label="Status" value={league.status} />
            <Row label="Playoff Status" value={league.playoffStatus} />
            <Row label="Draft Type" value={league.draftType} />
            <Row label="Scoring Mode" value={league.scoringMode ?? "VP"} />
            <Row label="Max Teams" value={String(league.maxTeams)} />
            <Row label="Replay" value={league.isReplay ? "Yes" : "No"} />
            <Row label="Commissioner" value={`${league.commissioner?.displayName ?? "—"} (${league.commissioner?.email ?? "—"})`} />
          </Section>

          <div>
            <Section title="Scoring Settings">
              {league.scoringSettings ? (
                <>
                  <div style={{ fontSize: "0.72rem", color: "#555", textTransform: "uppercase", marginBottom: "0.25rem" }}>Skater</div>
                  {Object.entries(league.scoringSettings.skater ?? {}).map(([k, v]) => (
                    <Row key={k} label={k} value={String(v)} />
                  ))}
                  <div style={{ fontSize: "0.72rem", color: "#555", textTransform: "uppercase", margin: "0.5rem 0 0.25rem" }}>Goalie</div>
                  {Object.entries(league.scoringSettings.goalie ?? {}).map(([k, v]) => (
                    <Row key={k} label={k} value={String(v)} />
                  ))}
                </>
              ) : <div style={{ color: "#555" }}>—</div>}
            </Section>

            <Section title="Roster Settings">
              {league.rosterSettings
                ? Object.entries(league.rosterSettings).map(([k, v]) => <Row key={k} label={k} value={String(v)} />)
                : <div style={{ color: "#555" }}>—</div>}
            </Section>

            <Section title="Playoff Settings">
              {league.playoffSettings
                ? Object.entries(league.playoffSettings).map(([k, v]) => <Row key={k} label={k} value={String(v)} />)
                : <div style={{ color: "#555" }}>—</div>}
            </Section>
          </div>

          <Section title="Teams">
            {teams.map((t) => (
              <Row key={t.id} label={t.name} value={t.owner?.email ?? "—"} />
            ))}
          </Section>
        </div>
      )}

      {activeTab === "Standings" && (
        <div>
          {standings.length === 0 ? (
            <div style={{ color: "#555", fontSize: "0.85rem" }}>No standings yet — season not started.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "#0a0a0a" }}>
                  {["#", "Team", "VP", "W", "L", "T", "FP", "Playoff"].map((h) => (
                    <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#666", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", borderBottom: "1px solid #222" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.fantasyTeamId} style={{ borderBottom: "1px solid #1a1a1a" }}>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#666" }}>{i + 1}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#ccc" }}>{s.teamName}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#22c55e", fontWeight: 700 }}>{s.totalVP}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#888" }}>{s.wins}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#888" }}>{s.losses}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#888" }}>{s.ties}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#888" }}>{s.pointsFor.toFixed(1)}</td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      {s.isPlayoffEligible ? <span style={{ color: "#22c55e", fontSize: "0.75rem" }}>✓ Seed {s.seed}</span> : <span style={{ color: "#444" }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: "0.75rem" }}>
            <Link href={`/league/${leagueId}/standings`} style={{ color: "#64b5f6", fontSize: "0.8rem" }}>Open standings page →</Link>
          </div>
        </div>
      )}

      {activeTab === "Season" && (
        <div>
          {!seasonState ? (
            <div style={{ color: "#555", fontSize: "0.85rem" }}>No season state available.</div>
          ) : (
            <>
              <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem" }}>
                <Chip label="Lifecycle" value={seasonState.lifecycleStatus} />
                <Chip label="Active Week" value={seasonState.activePeriodWeek != null ? `Week ${seasonState.activePeriodWeek}` : "—"} />
                <Chip label="Completed" value={`${seasonState.completedWeeks} / ${seasonState.totalWeeks} weeks`} />
              </div>

              {/* Period table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", marginBottom: "1.5rem" }}>
                <thead>
                  <tr style={{ background: "#0a0a0a" }}>
                    {["Week", "Starts", "Ends", "Status"].map((h) => (
                      <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#666", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", borderBottom: "1px solid #222" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {seasonState.periods.map((p) => (
                    <tr key={p.week} style={{ borderBottom: "1px solid #1a1a1a" }}>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#888" }}>W{p.week}</td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#888" }}>{new Date(p.startsAt).toLocaleDateString()}</td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#888" }}>{new Date(p.endsAt).toLocaleDateString()}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: p.status === "ACTIVE" ? "#22c55e" : p.status === "SCORING_PENDING" ? "#f59e0b" : p.status === "COMPLETE" ? "#555" : "#888" }}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {seasonState.periods.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: "0.5rem 0.75rem", color: "#555" }}>Season not started</td></tr>
                  )}
                </tbody>
              </table>

              {/* Simulation controls */}
              <div style={{ background: "#0f1a0f", border: "1px solid #2d4a2d", borderRadius: "6px", padding: "1rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#888", marginBottom: "0.75rem" }}>Simulation Controls</div>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button
                    onClick={() => simulate("scoreNextWeek")}
                    disabled={isPending}
                    style={{ background: "#1a2d1a", border: "1px solid #2d4a2d", borderRadius: "4px", padding: "0.5rem 1rem", color: "#22c55e", fontFamily: "monospace", fontSize: "0.82rem", cursor: "pointer", opacity: isPending ? 0.5 : 1 }}
                  >
                    Score Next Week
                  </button>
                  <button
                    onClick={() => simulate("scoreAll")}
                    disabled={isPending}
                    style={{ background: "#1a2d1a", border: "1px solid #2d4a2d", borderRadius: "4px", padding: "0.5rem 1rem", color: "#22c55e", fontFamily: "monospace", fontSize: "0.82rem", cursor: "pointer", opacity: isPending ? 0.5 : 1 }}
                  >
                    Score All Weeks
                  </button>
                  {league.playoffStatus === "NOT_STARTED" && league.status === "COMPLETE" && (
                    <button
                      onClick={startPlayoffs}
                      disabled={isPending}
                      style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: "4px", padding: "0.5rem 1rem", color: "#64b5f6", fontFamily: "monospace", fontSize: "0.82rem", cursor: "pointer", opacity: isPending ? 0.5 : 1 }}
                    >
                      Start Playoffs
                    </button>
                  )}
                </div>
                {isPending && <div style={{ marginTop: "0.5rem", color: "#888", fontSize: "0.8rem" }}>Running…</div>}
                {simResult && <div style={{ marginTop: "0.5rem", color: "#22c55e", fontSize: "0.82rem" }}>✓ {simResult}</div>}
                {simError && <div style={{ marginTop: "0.5rem", color: "#ef4444", fontSize: "0.82rem" }}>✗ {simError}</div>}
              </div>
            </>
          )}

          <div style={{ marginTop: "0.75rem" }}>
            <Link href={`/league/${leagueId}/season`} style={{ color: "#64b5f6", fontSize: "0.8rem" }}>Open season page →</Link>
          </div>
        </div>
      )}

      {activeTab === "Beta" && (
        <div>
          <Section title="Beta Status">
            <div style={{ padding: "0.5rem 0" }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#666", marginBottom: "0.4rem" }}>
                Status for this league
              </label>
              <select
                value={betaStatus}
                onChange={(e) => handleBetaStatusChange(e.target.value)}
                disabled={isPending}
                style={{
                  background: "#0a0a0a",
                  border: "1px solid #333",
                  borderRadius: 4,
                  color: "#ccc",
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  padding: "0.4rem 0.75rem",
                  cursor: "pointer",
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {BETA_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {isPending && (
                <span style={{ marginLeft: "0.75rem", color: "#888", fontSize: "0.78rem" }}>Saving…</span>
              )}
              {betaSaved && !isPending && (
                <span style={{ marginLeft: "0.75rem", color: "#22c55e", fontSize: "0.78rem" }}>Saved</span>
              )}
              {betaError && (
                <div style={{ marginTop: "0.5rem", color: "#ef4444", fontSize: "0.78rem" }}>{betaError}</div>
              )}
            </div>
          </Section>
        </div>
      )}

      {activeTab === "Draft" && (
        <div>
          {!draft ? (
            <div style={{ color: "#555", fontSize: "0.85rem" }}>No draft set up yet.</div>
          ) : (
            <>
              <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <Chip label="Status" value={draft.status} />
                <Chip label="Pick" value={`${draft.currentPick ?? "—"} / ${draft.totalPicks}`} />
                <Chip label="Started" value={draft.startedAt ? new Date(draft.startedAt).toLocaleString() : "—"} />
                <Chip label="Completed" value={draft.completedAt ? new Date(draft.completedAt).toLocaleString() : "—"} />
              </div>

              {/* Auto-pick stats per team */}
              {draft.picks.length > 0 && (() => {
                const byTeam = new Map<string, { total: number; auto: number; name: string }>();
                for (const p of draft.picks) {
                  if (!byTeam.has(p.fantasyTeamId)) byTeam.set(p.fantasyTeamId, { total: 0, auto: 0, name: p.teamName });
                  const t = byTeam.get(p.fantasyTeamId)!;
                  t.total++;
                  if (p.auto) t.auto++;
                }
                return (
                  <Section title="Auto-pick Rates">
                    {[...byTeam.values()].map((t) => (
                      <Row key={t.name} label={t.name} value={`${t.auto}/${t.total} auto (${t.total > 0 ? Math.round(t.auto / t.total * 100) : 0}%)`} />
                    ))}
                  </Section>
                );
              })()}

              {/* Last 10 picks */}
              <div style={{ marginTop: "1rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#888", marginBottom: "0.5rem" }}>Last 10 Picks</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "#0a0a0a" }}>
                      {["Pick", "Rd", "Team", "Player", "Auto"].map((h) => (
                        <th key={h} style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "#666", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", borderBottom: "1px solid #222" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {draft.picks.slice(-10).reverse().map((p) => (
                      <tr key={p.overall} style={{ borderBottom: "1px solid #1a1a1a" }}>
                        <td style={{ padding: "0.4rem 0.75rem", color: "#888" }}>{p.overall}</td>
                        <td style={{ padding: "0.4rem 0.75rem", color: "#888" }}>{p.round}</td>
                        <td style={{ padding: "0.4rem 0.75rem", color: "#ccc" }}>{p.teamName}</td>
                        <td style={{ padding: "0.4rem 0.75rem", color: "#ccc" }}>{p.playerName}</td>
                        <td style={{ padding: "0.4rem 0.75rem", color: p.auto ? "#f59e0b" : "#555" }}>{p.auto ? "auto" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div style={{ marginTop: "0.75rem" }}>
            <Link href={`/draft/${leagueId}`} style={{ color: "#64b5f6", fontSize: "0.8rem" }}>Open draft room →</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: "6px", padding: "0.75rem", marginBottom: "0.75rem" }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0", fontSize: "0.82rem", borderBottom: "1px solid #1a1a1a" }}>
      <span style={{ color: "#666" }}>{label}</span>
      <span style={{ color: "#ccc" }}>{value}</span>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: "4px", padding: "0.3rem 0.6rem", fontSize: "0.78rem" }}>
      <span style={{ color: "#555" }}>{label}: </span>
      <span style={{ color: "#ccc", fontWeight: 600 }}>{value}</span>
    </div>
  );
}
