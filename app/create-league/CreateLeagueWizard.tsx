"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import InviteLinkButton from "@/components/InviteLinkButton";
import BetaWelcomeStep from "@/components/BetaWelcomeStep";
import Link from "next/link";

// Beta mode adds step 0 (beta welcome), which is hidden from the progress bar.
// Both replay and live modes show all 6 steps (Name, Size, Season, Rules, Team, Invite).
// TOTAL_STEPS is the internal step count (8 states including step 0 and the final done screen).
const TOTAL_STEPS = 8;
const isBetaMode = typeof process !== "undefined" && process.env.NEXT_PUBLIC_BETA_MODE === "true";

// Both modes now use the same step sequence (6 displayed steps).
function getDisplayStep(step: number): number {
  if (step === 0) return 0;
  return step;
}

function getDisplayTotal(): number {
  return 6;
}

const SIZE_OPTIONS: { value: number; label: string; note: string }[] = [
  { value: 6,  label: "6 teams",  note: "Smaller, more intimate" },
  { value: 8,  label: "8 teams",  note: "Classic size — easy to fill, competitive matchups" },
  { value: 10, label: "10 teams", note: "More variety, deeper waiver wire" },
  { value: 12, label: "12 teams", note: "Large league, requires more coordination" },
];

interface Props {
  userDisplayName: string;
  startAsReplay: boolean;
}

export default function CreateLeagueWizard({ userDisplayName, startAsReplay }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(isBetaMode ? 0 : 1);
  const [name, setName] = useState("My PWHL League");
  const [maxTeams, setMaxTeams] = useState(8);
  const [isReplay, setIsReplay] = useState(startAsReplay);
  const [draftDate, setDraftDate] = useState("");
  const [draftTime, setDraftTime] = useState("19:00");
  const [teamName, setTeamName] = useState(`${userDisplayName}'s Team`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLeagueId, setCreatedLeagueId] = useState<string | null>(null);
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null);
  const [vpOpen, setVpOpen] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  // Mark onboarding seen on mount (idempotent)
  useEffect(() => {
    fetch("/api/user/onboarding", { method: "POST" }).catch(() => {});
  }, []);

  const goNext = () => {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };
  const goBack = () => {
    const minStep = isBetaMode ? 0 : 1;
    setStep((s) => Math.max(s - 1, minStep));
  };

  const handleCancel = () => {
    // If league was created but team wasn't, warn before leaving
    if (createdLeagueId && !createdTeamId) {
      const confirmed = window.confirm(
        "Your league was already created but no one has joined yet. You can still use it — find it on your dashboard.\n\nLeave the setup wizard?"
      );
      if (!confirmed) return;
    }
    router.push("/dashboard");
  };

  // Replay mode creates league at step 3 (Season), then shows step 4 (Rules) before team creation
  const handleReplayCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueName: name || "My Replay League", maxTeams, useLastSeasonSimulation: true }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || "Failed to create league"); setLoading(false); return; }
      setCreatedLeagueId(data.leagueId);
      setStep(4);
    } catch {
      setError("Unable to create league. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Create the live league (called at step 4)
  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      let draftStartsAt: string | undefined;
      if (draftDate) {
        draftStartsAt = new Date(`${draftDate}T${draftTime}:00`).toISOString();
      }
      const res = await fetch("/api/leagues/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueName: name, maxTeams, draftStartsAt, isPublic }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || "Failed to create league"); setLoading(false); return; }
      setCreatedLeagueId(data.leagueId);
      setStep(5);
    } catch {
      setError("Unable to create league. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 4 button handler: idempotent for both modes
  // Live: creates league, advances to step 5
  // Replay: if league already created, just advances to step 5; else creates league first
  const handleCreateOrAdvance = async () => {
    if (createdLeagueId) {
      // Already created (replay flow), just advance
      setStep(5);
      return;
    }
    // Not yet created, call handleCreate
    await handleCreate();
  };

  // Create the commissioner's team (called at step 5)
  const handleCreateTeam = async () => {
    if (!createdLeagueId || !teamName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: createdLeagueId,
          teamName: teamName.trim(),
          ownerEmail: "", // Will be filled by backend from auth
          ownerName: userDisplayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || "Failed to create team"); setLoading(false); return; }
      setCreatedTeamId(data.teamId);
      setStep(6);
    } catch {
      setError("Unable to create team. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const nameValid = name.trim().length > 0 && name.trim().length <= 50;
  const teamNameValid = teamName.trim().length > 0 && teamName.trim().length <= 50;

  return (
    <div className="page-width" style={{ padding: "32px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Progress indicator — filled bar (hidden when step === 0) */}
        {step > 0 && (() => {
          const displayTotal = getDisplayTotal();
          const displayStep = getDisplayStep(Math.min(step, TOTAL_STEPS - 1));
          const stepLabels = ["Name", "Size", "Season", "Rules", "Team", "Invite"];
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>
                  Step {displayStep} of {displayTotal}
                </p>
                {step < TOTAL_STEPS && (
                  <button
                    onClick={handleCancel}
                    style={{ fontSize: 12, color: "#475569", textDecoration: "none", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {Array.from({ length: displayTotal }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      background: i < Math.min(displayStep - 1, displayTotal) ? "#6366f1" : "rgba(255,255,255,0.08)",
                      transition: "background 0.3s ease",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}>
                {stepLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="dashboard-panel" style={{ minHeight: "60vh" }}>

          {/* ── Step 0: Beta welcome (only when NEXT_PUBLIC_BETA_MODE=true) ── */}
          {isBetaMode && step === 0 && (
            <BetaWelcomeStep onContinue={() => setStep(1)} />
          )}

          {/* ── Step 1: League name ── */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Name your league</h1>
                <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                  Hi {userDisplayName}! Let&apos;s set up your league. You can change this anytime.
                </p>
              </div>
              <label className="form-label">
                League name
                <input
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  placeholder="e.g. Friday Night Hockey League"
                  autoFocus
                />
                <span style={{ fontSize: 11, color: name.length > 45 ? "#f59e0b" : "#475569", marginTop: 4, display: "block" }}>
                  {name.length}/50
                </span>
              </label>
              {/* isPublic toggle */}
              <button
                type="button"
                onClick={() => setIsPublic((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: "none", border: "none", cursor: "pointer",
                  padding: "10px 0", textAlign: "left",
                }}
              >
                <span style={{
                  width: 36, height: 20, borderRadius: 99, flexShrink: 0,
                  background: isPublic ? "#6366f1" : "rgba(255,255,255,0.08)",
                  display: "inline-flex", alignItems: "center",
                  padding: "0 3px", transition: "background 0.2s",
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: "50%", background: "#fff",
                    transform: isPublic ? "translateX(16px)" : "translateX(0)",
                    transition: "transform 0.2s",
                  }} />
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                    List on public league directory
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    Your league name and invite link will appear on the Leagues page so new players can find it.
                  </div>
                </div>
              </button>

              <button
                className="button-primary"
                onClick={goNext}
                disabled={!nameValid}
                style={{ width: "100%", marginTop: 8 }}
              >
                Next →
              </button>
            </div>
          )}

          {/* ── Step 2: League size ── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>How many teams?</h1>
                <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                  Choose a size that matches your friend group. You&apos;re not locked in until the draft.
                </p>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {SIZE_OPTIONS.map((opt) => {
                  const selected = maxTeams === opt.value;
                  const recommended = opt.value === 8;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setMaxTeams(opt.value)}
                      style={{
                        padding: "14px 18px",
                        borderRadius: 14,
                        border: `1.5px solid ${selected ? "#6366f1" : "rgba(148,163,184,0.18)"}`,
                        background: selected ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.02)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                        border: `2px solid ${selected ? "#6366f1" : "rgba(148,163,184,0.3)"}`,
                        background: selected ? "#6366f1" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {selected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: selected ? "#a5b4fc" : "#e2e8f0" }}>
                            {opt.label}
                          </span>
                          {recommended && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
                              background: "rgba(95,169,140,0.15)", color: "#5fa98c",
                              border: "1px solid rgba(95,169,140,0.25)",
                            }}>
                              Recommended
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{opt.note}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
                <button className="button-secondary" onClick={goBack} style={{ flex: 1 }}>← Back</button>
                <button className="button-primary" onClick={goNext} style={{ flex: 1 }}>Next →</button>
              </div>
            </div>
          )}

          {/* ── Step 3: Season / draft date ── */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Season & draft date</h1>
                <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                  Choose whether to play the live 2026-27 season or try a completed replay season.
                </p>
              </div>

              {/* Mode toggle */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { value: false, icon: "🏒", label: "Live season", desc: "Play the real 2026-27 PWHL season as it happens." },
                  { value: true,  icon: "⏪", label: "Replay (2025-26)", desc: "Draft and compete using a completed season — start right now without filling a full league." },
                ].map(({ value, icon, label, desc }) => {
                  const sel = isReplay === value;
                  return (
                    <button
                      key={String(value)}
                      onClick={() => setIsReplay(value)}
                      style={{
                        padding: "16px 14px",
                        borderRadius: 14,
                        border: `1.5px solid ${sel ? "#6366f1" : "rgba(148,163,184,0.18)"}`,
                        background: sel ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.02)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: sel ? "#a5b4fc" : "#e2e8f0" }}>{label}</span>
                      <span style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mode explanations */}
              <div style={{ display: "grid", gap: 10 }}>
                {!isReplay && (
                  <div style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: "rgba(99,102,241,0.06)",
                    border: "1px solid rgba(99,102,241,0.15)",
                    fontSize: 12, color: "#94a3b8", lineHeight: 1.5,
                  }}>
                    <strong style={{ color: "#a78bfa" }}>🏒 Live season</strong> — draft this fall, compete all season long with real-time games and standings.
                  </div>
                )}
                {isReplay && (
                  <div style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: "rgba(245,158,11,0.06)",
                    border: "1px solid rgba(245,158,11,0.2)",
                    fontSize: 12, color: "#94a3b8", lineHeight: 1.5,
                  }}>
                    <strong style={{ color: "#fbbf24" }}>⏪ Replay mode</strong> — your league is a sandbox using a completed 2025-26 season.
                    You control the pace (advance by day or week). Great for trying the app or playing with a friend.
                  </div>
                )}
              </div>

              {/* Draft date — only for live leagues */}
              {!isReplay && (
                <div style={{ display: "grid", gap: 12 }}>
                  <label className="form-label">
                    Draft date (optional)
                    <input
                      className="form-input"
                      type="date"
                      value={draftDate}
                      onChange={(e) => setDraftDate(e.target.value)}
                    />
                    <span style={{ fontSize: 12, color: "#475569", marginTop: 4, display: "block" }}>
                      Try late November 2026 (when the PWHL season opens). You can always change this from the admin panel.
                    </span>
                  </label>
                  {draftDate && (
                    <label className="form-label">
                      Draft time
                      <input
                        className="form-input"
                        type="time"
                        value={draftTime}
                        onChange={(e) => setDraftTime(e.target.value)}
                      />
                    </label>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
                <button className="button-secondary" onClick={goBack} style={{ flex: 1 }}>← Back</button>
                {isReplay ? (
                  <button className="button-primary" onClick={handleReplayCreate} disabled={loading} style={{ flex: 1 }}>
                    {loading ? "Creating…" : "Create replay league →"}
                  </button>
                ) : (
                  <button className="button-primary" onClick={goNext} style={{ flex: 1 }}>Next →</button>
                )}
              </div>
              {error && <p style={{ color: "#d18b7f", fontSize: 13, margin: 0 }}>{error}</p>}
            </div>
          )}

          {/* ── Step 4: Rules confirmation ── */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Standard rules</h1>
                <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                  Your league uses these defaults. They&apos;re the most competitive settings for the PWHL.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <RuleRow icon="👥" label="Roster" value="3 F · 2 D · 1 Flex (any skater) · 1 G · 6 Bench = 13 slots, all drafted" />
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  <RuleRow icon="📊" label="Standings" value="Victory Points (VP) — win your matchup AND score more than anyone else" />
                  <button
                    type="button"
                    onClick={() => setVpOpen((v) => !v)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#7c6af7", fontSize: 11, fontWeight: 600,
                      textAlign: "left", padding: "2px 0 0 28px",
                    }}
                  >
                    {vpOpen ? "▲ Hide VP details" : "▼ How does VP work?"}
                  </button>
                  {vpOpen && (
                    <div style={{
                      margin: "6px 0 0 28px", padding: "10px 12px", borderRadius: 8,
                      background: "rgba(124,106,247,0.07)", border: "1px solid rgba(124,106,247,0.18)",
                      fontSize: 12, color: "#94a3b8", lineHeight: 1.6,
                    }}>
                      Each week you earn VP two ways:
                      <ul style={{ margin: "4px 0 4px 16px", padding: 0 }}>
                        <li><strong style={{ color: "#c4b5fd" }}>Win your matchup</strong> — +2 VP; tie — +1 VP</li>
                        <li><strong style={{ color: "#c4b5fd" }}>Highest score in the league</strong> — +2 VP bonus; 2nd highest — +1 VP</li>
                      </ul>
                      Maximum 4 VP per week. At season end, the top 4 VP totals make the playoffs — not just who won the most matchups.
                    </div>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem", color: "#94a3b8" }}>
                    Goals and assists score the most — you don&apos;t need to memorize this.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowScoring((s) => !s)}
                    style={{ fontSize: "0.8rem", color: "var(--accent, #6366f1)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "0.5rem" }}
                  >
                    {showScoring ? "▴ Hide scoring details" : "▾ See full scoring breakdown"}
                  </button>
                  {showScoring && (
                    <div style={{
                      padding: "12px 14px", borderRadius: 12,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(148,163,184,0.08)",
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                        Scoring
                      </div>
                      <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>
                        <strong>Skaters:</strong> Goal = 2 pts, Assist = 1.5 pts, Power Play = +0.5 pts, SOG = 0.5 pts, Hit = 0.25 pts, Block = 0.5 pts
                        <br/>
                        <strong>Goalies:</strong> Win = 5 pts, Shutout = 3 pts, Save = 0.25 pts, Goal Against = -1 pt
                      </div>
                    </div>
                  )}
                </div>
                <RuleRow icon="🏒" label="Playoffs" value="Top 4 teams, single-elimination, no byes" />
                <RuleRow icon="📅" label="Season" value={`2026-27 live PWHL season · ${maxTeams} teams`} />
              </div>

              <div style={{
                padding: "12px 16px", borderRadius: 12,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(148,163,184,0.1)",
                fontSize: 13, color: "#475569",
              }}>
                Scoring, roster slots, and playoff format can be adjusted from the admin panel before the draft.
              </div>

              <div style={{
                padding: "12px 16px", borderRadius: 12,
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.15)",
                fontSize: 13, color: "#94a3b8",
              }}>
                💡 Clicking &ldquo;Create league&rdquo; will set up your league — then you&apos;ll create your team name and become the commissioner.
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
                <button className="button-secondary" onClick={goBack} style={{ flex: 1 }}>← Back</button>
                <button className="button-primary" onClick={handleCreateOrAdvance} disabled={loading} style={{ flex: 1 }}>
                  {loading ? (createdLeagueId ? "Continuing…" : "Creating league…") : (createdLeagueId ? "Continue →" : "Create league →")}
                </button>
              </div>
              {error && <p style={{ color: "#d18b7f", fontSize: 13, margin: 0 }}>{error}</p>}
            </div>
          )}

          {/* ── Step 5: Commissioner creates their team ── */}
          {step === 5 && createdLeagueId && !createdTeamId && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Create your team</h1>
                <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                  You&apos;ll be the commissioner, but you also need a team to draft and play. Choose your team name.
                </p>
              </div>

              <label className="form-label">
                Team name
                <input
                  className="form-input"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  maxLength={50}
                  placeholder="e.g. Poulin Power Play"
                  autoFocus
                />
                <span style={{ fontSize: 11, color: teamName.length > 45 ? "#f59e0b" : "#475569", marginTop: 4, display: "block" }}>
                  {teamName.length}/50
                </span>
              </label>

              <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
                <button className="button-secondary" onClick={goBack} style={{ flex: 1 }}>← Back</button>
                <button
                  className="button-primary"
                  onClick={handleCreateTeam}
                  disabled={loading || !teamNameValid}
                  style={{ flex: 1 }}
                >
                  {loading ? "Creating team…" : "Create my team →"}
                </button>
              </div>
              {error && <p style={{ color: "#d18b7f", fontSize: 13, margin: 0 }}>{error}</p>}
            </div>
          )}

          {/* ── Step 6: Invite managers ── */}
          {step === 6 && createdLeagueId && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{
                padding: "14px 16px", borderRadius: 12,
                background: "rgba(52,211,153,0.07)",
                border: "1px solid rgba(52,211,153,0.2)",
              }}>
                <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#34d399" }}>
                  ✓ League created!
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                  {name} is ready. Invite your managers below.
                </p>
              </div>

              <div>
                <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Invite managers</h2>
                <p style={{ margin: "0 0 14px", color: "#64748b", fontSize: 14 }}>
                  Share this link. Anyone who opens it can join your league in one step — no league ID needed.
                </p>
                <InviteLinkButton leagueId={createdLeagueId} />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="button-primary" onClick={goNext}>
                  Continue to draft prep →
                </button>
                <button
                  className="button-secondary"
                  onClick={() => router.push(`/league/${createdLeagueId}/admin`)}
                >
                  Go to admin panel
                </button>
              </div>
            </div>
          )}

          {/* ── Step 7: Done → draft prep ── */}
          {step === 7 && createdLeagueId && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <p style={{ fontSize: 28, margin: "0 0 8px" }}>🎉</p>
                <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>You&apos;re all set!</h1>
                <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                  {name} is created. Here&apos;s how to get ready for draft day.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <PrepStep num={1} label="Invite managers" desc="Share your league invite link so everyone can join." done />
                <PrepStep num={2} label="Set up the draft" desc="Go to the admin panel → Draft → set up the draft board." />
                <PrepStep num={3} label="Draft!" desc="The commissioner starts the draft from inside the draft room. All managers pick on the clock." />
                <PrepStep num={4} label="Set your lineup" desc="After the draft, set your active starters before the first game." />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href={`/league/${createdLeagueId}/admin`} className="button-primary">
                  Go to admin panel →
                </Link>
                <Link href={`/league/${createdLeagueId}`} className="button-secondary">
                  View league
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RuleRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "12px 14px", borderRadius: 12,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(148,163,184,0.08)",
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: "#e2e8f0" }}>{value}</div>
      </div>
    </div>
  );
}

function PrepStep({ num, label, desc, done }: { num: number; label: string; desc: string; done?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "12px 14px", borderRadius: 12,
      background: done ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${done ? "rgba(52,211,153,0.15)" : "rgba(148,163,184,0.08)"}`,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700,
        background: done ? "rgba(52,211,153,0.15)" : "rgba(99,102,241,0.1)",
        color: done ? "#34d399" : "#a5b4fc",
        border: `1.5px solid ${done ? "#34d399" : "#6366f1"}`,
        marginTop: 1,
      }}>
        {done ? "✓" : num}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: done ? "#64748b" : "#e2e8f0", textDecoration: done ? "line-through" : "none" }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}
