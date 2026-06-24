"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import InviteLinkButton from "@/components/InviteLinkButton";
import BetaWelcomeStep from "@/components/BetaWelcomeStep";
import Link from "next/link";
import { VpExplainer } from "@/components/VpExplainer";

// Beta mode adds step 0 (beta welcome), which is hidden from the progress bar.
// Beta mode collapses the wizard to 4 displayed steps: Name → Rules → Team → Invite.
// Internal steps are still 0-7; beta mode skips steps 2 (size) and 3 (season mode).
// TOTAL_STEPS is the internal step count (8 states including step 0 and the final done screen).
const TOTAL_STEPS = 8;
const isBetaMode = typeof process !== "undefined" && process.env.NEXT_PUBLIC_BETA_MODE === "true";

// Beta mode: internal steps 1→4→5→6 map to display steps 1→2→3→4.
function getDisplayStep(step: number): number {
  if (step === 0) return 0;
  if (isBetaMode) {
    if (step <= 1) return 1;
    if (step <= 4) return 2;
    if (step === 5) return 3;
    return 4;
  }
  return step;
}

function getDisplayTotal(): number {
  return isBetaMode ? 4 : 6;
}

function getStepLabels(): string[] {
  return isBetaMode
    ? ["Name", "Rules", "Team", "Invite"]
    : ["Name", "Size", "Season", "Rules", "Team", "Invite"];
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
        "Your league was created. Canceling will leave it in your account without a team or members. You can finish setup later from your dashboard.\n\nContinue anyway?"
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
        credentials: "include",
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

  // Create the live (or beta) league (called at step 4)
  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Beta mode always creates a beta replay league.
      if (isBetaMode) {
        const res = await fetch("/api/leagues/create", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leagueName: name || "My Beta League", useBetaReplay: true }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data?.error || "Failed to create league"); setLoading(false); return; }
        setCreatedLeagueId(data.leagueId);
        setStep(5);
        return;
      }
      let draftStartsAt: string | undefined;
      if (draftDate) {
        draftStartsAt = new Date(`${draftDate}T${draftTime}:00`).toISOString();
      }
      const res = await fetch("/api/leagues/create", {
        method: "POST",
        credentials: "include",
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
        credentials: "include",
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
          const stepLabels = getStepLabels();
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>
                  Step {displayStep} of {displayTotal}
                </p>
                {step < TOTAL_STEPS && (
                  <button
                    onClick={handleCancel}
                    style={{ fontSize: 12, color: "var(--faint)", textDecoration: "none", background: "none", border: "none", cursor: "pointer" }}
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
                      background: i < Math.min(displayStep - 1, displayTotal) ? "var(--accent)" : "var(--border)",
                      transition: "background 0.3s ease",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--faint)" }}>
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
                <p style={{ margin: 0, color: "var(--faint)", fontSize: 14 }}>
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
                <span style={{ fontSize: 11, color: name.length > 45 ? "var(--amber)" : "var(--faint)", marginTop: 4, display: "block" }}>
                  {name.length}/50
                </span>
              </label>
              {/* isPublic toggle — hidden in beta mode (beta leagues are invite-only) */}
              {!isBetaMode && (
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
                    background: isPublic ? "var(--accent)" : "var(--bg-raised)",
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
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                      List on public league directory
                    </div>
                    <div style={{ fontSize: 11, color: "var(--faint)" }}>
                      Your league name and invite link will appear on the Leagues page so new players can find it.
                    </div>
                  </div>
                </button>
              )}

              <button
                className="button-primary"
                onClick={() => isBetaMode ? setStep(4) : goNext()}
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
                <p style={{ margin: 0, color: "var(--faint)", fontSize: 14 }}>
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
                        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected ? "rgba(143,193,232,0.1)" : "var(--bg-raised)",
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
                        border: `2px solid ${selected ? "var(--accent)" : "rgba(148,163,184,0.3)"}`,
                        background: selected ? "var(--accent)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {selected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: selected ? "var(--accent-strong)" : "var(--text)" }}>
                            {opt.label}
                          </span>
                          {recommended && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
                              background: "rgba(81,216,138,0.12)", color: "var(--green)",
                              border: "1px solid rgba(81,216,138,0.25)",
                            }}>
                              Recommended
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>{opt.note}</div>
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
                <p style={{ margin: 0, color: "var(--faint)", fontSize: 14 }}>
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
                        border: `1.5px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                        background: sel ? "rgba(143,193,232,0.1)" : "var(--bg-raised)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: sel ? "var(--accent-strong)" : "var(--text)" }}>{label}</span>
                      <span style={{ fontSize: 12, color: "var(--faint)", lineHeight: 1.4 }}>{desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mode explanations */}
              <div style={{ display: "grid", gap: 10 }}>
                {!isReplay && (
                  <div style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: "rgba(143,193,232,0.06)",
                    border: "1px solid rgba(143,193,232,0.15)",
                    fontSize: 12, color: "var(--dim)", lineHeight: 1.5,
                  }}>
                    <strong style={{ color: "var(--accent-strong)" }}>🏒 Live season</strong> — draft this fall, compete all season long with real-time games and standings.
                  </div>
                )}
                {isReplay && (
                  <div style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: "rgba(245,201,123,0.06)",
                    border: "1px solid rgba(245,201,123,0.2)",
                    fontSize: 12, color: "var(--dim)", lineHeight: 1.5,
                  }}>
                    <strong style={{ color: "var(--gold)" }}>⏪ Replay mode</strong> — your league is a sandbox using a completed 2025-26 season.
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
                    <span style={{ fontSize: 12, color: "var(--faint)", marginTop: 4, display: "block" }}>
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
              {error && <WizardError message={error} />}
            </div>
          )}

          {/* ── Step 4: Rules confirmation ── */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {isBetaMode ? (
                <>
                  <div>
                    <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Your beta replay league</h1>
                    <p style={{ margin: 0, color: "var(--faint)", fontSize: 14 }}>
                      Everything is pre-configured. Here&apos;s what you&apos;re getting into.
                    </p>
                  </div>

                  {/* Beta timeline callout */}
                  <div style={{
                    padding: "14px 16px", borderRadius: 12,
                    background: "rgba(245,201,123,0.06)",
                    border: "1px solid rgba(245,201,123,0.2)",
                    fontSize: 13, color: "var(--dim)", lineHeight: 1.6,
                  }}>
                    <div style={{ fontWeight: 700, color: "var(--gold)", marginBottom: 6 }}>⏱ How it works</div>
                    <div>
                      <strong style={{ color: "var(--text)" }}>Draft</strong> — starts right away. You pick players from the 2025-26 roster.
                    </div>
                    <div>
                      <strong style={{ color: "var(--text)" }}>Week 1</strong> — kicks off the day after your draft ends.
                    </div>
                    <div>
                      <strong style={{ color: "var(--text)" }}>2-week regular season</strong> — all vs. all VP scoring using real 2025-26 game data.
                    </div>
                    <div>
                      <strong style={{ color: "var(--text)" }}>4-team playoffs</strong> — semi-final week, then championship week.
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <RuleRow icon="👥" label="Roster" value="3 F · 2 D · 1 UTIL (any skater) · 1 G · 6 Bench = 13 slots, all drafted" />
                    <RuleRow icon="📊" label="Standings" value={<>Victory Points (VP) — win your matchup AND score more than anyone else<VpExplainer /></>} />
                    <RuleRow icon="🏆" label="Scoring" value={
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
                        {["Goal = 2 pts", "Assist = 1.5 pts", "PPP = +0.5 pts", "Win (G) = 5 pts", "Shutout (G) = 3 pts"].map(lbl => (
                          <span key={lbl} style={{
                            padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                            background: "var(--bg-raised)", border: "1px solid var(--border)",
                            color: "var(--dim)",
                          }}>{lbl}</span>
                        ))}
                      </div>
                    } />
                    <RuleRow icon="🏒" label="Playoffs" value="Top 4 teams · semi-final week · championship week · no byes" />
                    <RuleRow icon="👥" label="League size" value="Up to 6 teams · invite-only" />
                    <RuleRow icon="📅" label="Data source" value="4 randomly chosen weeks from the 2025-26 PWHL regular season" />
                  </div>

                  <div style={{
                    padding: "12px 16px", borderRadius: 12,
                    background: "rgba(143,193,232,0.06)",
                    border: "1px solid rgba(143,193,232,0.15)",
                    fontSize: 13, color: "var(--dim)",
                  }}>
                    💡 Next, you&apos;ll name your own team before inviting others.
                  </div>

                  <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
                    <button className="button-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>← Back</button>
                    <button className="button-primary" onClick={handleCreateOrAdvance} disabled={loading} style={{ flex: 1 }}>
                      {loading ? "Creating league…" : "Create my beta league →"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Standard rules</h1>
                    <p style={{ margin: 0, color: "var(--faint)", fontSize: 14 }}>
                      Your league uses these defaults — the most competitive settings for the PWHL.
                    </p>
                  </div>

                  {/* Rule sheet card */}
                  <div style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>

                    {/* Roster */}
                    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-soft)" }}>
                      <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 8 }}>Roster</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                        {[["3", "F"], ["2", "D"], ["1", "UTIL"], ["1", "G"], ["6", "Bench"]].map(([count, pos]) => (
                          <span key={pos} style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 10px", borderRadius: 6,
                            background: "var(--card)", border: "1px solid var(--border)",
                          }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>{count}</span>
                            <span style={{ fontSize: 12, color: "var(--text)" }}>{pos}</span>
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--faint)" }}>UTIL takes any skater (F or D).</div>
                    </div>

                    {/* Scoring */}
                    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-soft)" }}>
                      <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 10 }}>Scoring</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", marginBottom: 6 }}>Skaters</div>
                          {[["Goal", "+2.0"], ["Assist", "+1.5"], ["Power-play point", "+0.5"]].map(([stat, val], i) => (
                            <div key={stat} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderTop: i > 0 ? "1px solid var(--border-soft)" : "none" }}>
                              <span style={{ color: "var(--muted)" }}>{stat}</span>
                              <span style={{ color: "var(--green)", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{val}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", marginBottom: 6 }}>Goalies</div>
                          {[["Win", "+5.0"], ["Save", "+0.2"], ["Shutout", "+3.0"], ["Goal against", "−1.0"]].map(([stat, val], i) => (
                            <div key={stat} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderTop: i > 0 ? "1px solid var(--border-soft)" : "none" }}>
                              <span style={{ color: "var(--muted)" }}>{stat}</span>
                              <span style={{ color: val.startsWith("−") ? "var(--red)" : "var(--green)", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Standings */}
                    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "var(--dim)" }}>Standings</span>
                      <span style={{ fontSize: 13, color: "var(--text)", display: "flex", alignItems: "center" }}>
                        Ranked by <strong style={{ marginLeft: 4 }}>Victory Points (VP)</strong><VpExplainer />
                      </span>
                    </div>

                    {/* Playoffs */}
                    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "var(--dim)" }}>Playoffs</span>
                      <span style={{ fontSize: 13, color: "var(--text)", textAlign: "right" }}>Top 4 teams · single elimination · no byes</span>
                    </div>

                    {/* Season */}
                    <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "var(--dim)" }}>Season</span>
                      <span style={{ fontSize: 13, color: "var(--text)", textAlign: "right" }}>
                        {isReplay ? `2025-26 replay · ${maxTeams} teams` : `2026-27 live PWHL · ${maxTeams} teams`}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: "rgba(143,193,232,0.06)",
                    border: "1px solid rgba(143,193,232,0.15)",
                    fontSize: 13, color: "var(--dim)",
                  }}>
                    💡 Scoring, roster slots, and playoff format can all be changed from the admin panel before the draft.
                  </div>

                  <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
                    <button className="button-secondary" onClick={goBack} style={{ flex: 1 }}>← Back</button>
                    <button className="button-primary" onClick={handleCreateOrAdvance} disabled={loading} style={{ flex: 1 }}>
                      {loading ? (createdLeagueId ? "Continuing…" : "Creating league…") : (createdLeagueId ? "Continue →" : "Create league →")}
                    </button>
                  </div>
                </>
              )}
              {error && <WizardError message={error} />}
            </div>
          )}

          {/* ── Step 5: Commissioner creates their team ── */}
          {step === 5 && createdLeagueId && !createdTeamId && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Create your team</h1>
                <p style={{ margin: 0, color: "var(--faint)", fontSize: 14 }}>
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
                <span style={{ fontSize: 11, color: teamName.length > 45 ? "var(--amber)" : "var(--faint)", marginTop: 4, display: "block" }}>
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
              {error && <WizardError message={error} />}
            </div>
          )}

          {/* ── Step 6: Invite managers ── */}
          {step === 6 && createdLeagueId && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{
                padding: "14px 16px", borderRadius: 12,
                background: "rgba(81,216,138,0.07)",
                border: "1px solid rgba(81,216,138,0.2)",
              }}>
                <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--green)" }}>
                  ✓ League created!
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--faint)" }}>
                  {name} is ready. Invite your managers below.
                </p>
              </div>

              <div>
                <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Invite managers</h2>
                <p style={{ margin: "0 0 14px", color: "var(--faint)", fontSize: 14 }}>
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
                <p style={{ margin: 0, color: "var(--faint)", fontSize: 14 }}>
                  {name} is created. Here&apos;s how to get ready for draft day.
                </p>
              </div>

              {/* Your league at a glance (RD-012) */}
              <div style={{
                background: "var(--bg-raised)", border: "1px solid var(--border)",
                borderRadius: 14, padding: "16px",
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 12px" }}>
                  Your league at a glance
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "League", value: name },
                    { label: "Size", value: `${maxTeams} teams` },
                    { label: "Mode", value: isReplay ? "⏪ Replay" : "Live season" },
                    { label: "Scoring", value: "VP standings" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{value}</span>
                    </div>
                  ))}
                </div>
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

function WizardError({ message }: { message: string }) {
  const isAuthError = /unauthorized|session|sign in|not logged/i.test(message);
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "12px 14px", borderRadius: 10,
      background: "rgba(246,131,127,0.08)",
      border: "1px solid rgba(246,131,127,0.25)",
    }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1, color: "var(--red)" }}>!</span>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.4 }}>
        {message}
        {isAuthError && (
          <>
            {" "}
            <a
              href="/login"
              style={{ color: "var(--red)", fontWeight: 700, textDecoration: "underline" }}
            >
              Sign in again
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function RuleRow({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "12px 14px", borderRadius: 12,
      background: "var(--bg-raised)",
      border: "1px solid var(--border)",
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: "var(--text)" }}>{value}</div>
      </div>
    </div>
  );
}

function PrepStep({ num, label, desc, done }: { num: number; label: string; desc: string; done?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "12px 14px", borderRadius: 12,
      background: done ? "rgba(81,216,138,0.05)" : "var(--bg-raised)",
      border: `1px solid ${done ? "rgba(81,216,138,0.15)" : "var(--border)"}`,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700,
        background: done ? "rgba(81,216,138,0.15)" : "rgba(143,193,232,0.1)",
        color: done ? "var(--green)" : "var(--accent-strong)",
        border: `1.5px solid ${done ? "var(--green)" : "var(--accent)"}`,
        marginTop: 1,
      }}>
        {done ? "✓" : num}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: done ? "var(--faint)" : "var(--text)", textDecoration: done ? "line-through" : "none" }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}
