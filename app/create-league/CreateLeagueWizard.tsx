"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import InviteLinkButton from "@/components/InviteLinkButton";
import BetaWelcomeStep from "@/components/BetaWelcomeStep";
import Link from "next/link";
import { VpExplainer } from "@/components/VpExplainer";
import { useAnalytics } from "@/components/PostHogProvider";

// UX-072/073: Mode is chosen on step 1 so the step count is honest from the first screen.
//
// Internal step numbers match the live-mode path:
//   0  Beta welcome (beta only, hidden from progress bar)
//   1  Mode choice  (Live vs Replay)
//   2  League name
//   3  League size  (live only)
//   4  Draft date   (live only)
//   5  Rules confirmation + league creation
//   6  Team creation
//   7  Invite link
//   8  Done
//
// Replay / beta mode skips steps 3 and 4; after step 2 we jump directly to step 5.
// The progress bar therefore shows 5 steps for replay/beta and 7 steps for live.
// No remap functions needed — the displayed step is just the position in the visible list.

const TOTAL_STEPS = 9; // 0..8
const isBetaMode = typeof process !== "undefined" && process.env.NEXT_PUBLIC_BETA_MODE === "true";

// Returns the array of internal step numbers that are visible (i.e. shown in the progress bar)
// for the current mode. Step 0 (beta welcome) is never in the visible list.
function visibleSteps(isReplay: boolean): number[] {
  if (isReplay) {
    // Mode, Name, Rules, Team, Invite, Done → but Done (8) is terminal, not a progress step
    return [1, 2, 5, 6, 7];
  }
  // Mode, Name, Size, Date, Rules, Team, Invite → Done (8) is terminal
  return [1, 2, 3, 4, 5, 6, 7];
}

// Maps an internal step to its 1-based display position within the visible list.
function getDisplayStep(step: number, isReplay: boolean): number {
  if (step === 0) return 0;
  const visible = visibleSteps(isReplay);
  const idx = visible.indexOf(step);
  // If not in the visible list (shouldn't happen in practice), use last visible position
  return idx >= 0 ? idx + 1 : visible.length;
}

function getDisplayTotal(isReplay: boolean): number {
  return visibleSteps(isReplay).length;
}

function getStepLabels(isReplay: boolean): string[] {
  if (isReplay) return ["Mode", "Name", "Rules", "Team", "Invite"];
  return ["Mode", "Name", "Size", "Date", "Rules", "Team", "Invite"];
}

// The next internal step to go to after step N (respects replay skip logic).
function nextStep(current: number, isReplay: boolean): number {
  if (current === 2 && isReplay) return 5; // skip Size (3) and Date (4)
  return current + 1;
}

// The previous internal step to go back to after step N (respects replay skip logic).
function prevStep(current: number, isReplay: boolean): number {
  if (current === 5 && isReplay) return 2; // skip back over Size (3) and Date (4)
  return current - 1;
}

const STEP_NAMES: Record<number, string> = {
  1: "season_mode",
  2: "league_name",
  3: "league_size",
  4: "draft_date",
  5: "rules_review",
  6: "team_name",
  7: "invite",
  8: "done",
};

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
  const { capture } = useAnalytics();
  const prevStepRef = useRef<number | null>(null);

  // Beta mode starts at the welcome screen (step 0); otherwise start at mode choice (step 1).
  const [step, setStep] = useState(isBetaMode ? 0 : 1);
  const [name, setName] = useState("My PWHL League");
  const [maxTeams, setMaxTeams] = useState(8);
  // Mode is set at step 1; pre-select replay if the URL requested it or beta mode is active.
  const [isReplay, setIsReplay] = useState(startAsReplay || isBetaMode);
  // Scoring mode: H2H (default) or VP. H2H is what ESPN/Yahoo do and needs no explanation.
  const [scoringMode, setScoringMode] = useState<"H2H" | "VP">("H2H");
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

  // Fire wizard_step_viewed on each step transition (skip step 0 beta welcome)
  useEffect(() => {
    if (step === 0 || step === prevStepRef.current) return;
    prevStepRef.current = step;
    const stepName = STEP_NAMES[step];
    if (!stepName) return;
    capture("wizard_step_viewed", {
      step,
      stepName,
      mode: step >= 2 ? (isReplay ? "replay" : "live") : undefined,
    });
    if (step === 8 && createdLeagueId) {
      capture("wizard_completed", {
        mode: isReplay ? "replay" : "live",
        maxTeams: isReplay ? 6 : maxTeams,
        leagueId: createdLeagueId,
      });
    }
  }, [step, isReplay, capture, createdLeagueId, maxTeams]);

  const goNext = () => setStep((s) => nextStep(s, isReplay));
  const goBack = () => {
    const minStep = isBetaMode ? 0 : 1;
    setStep((s) => Math.max(prevStep(s, isReplay), minStep));
  };

  const handleCancel = () => {
    if (createdLeagueId && !createdTeamId) {
      const confirmed = window.confirm(
        "Your league was created. Canceling will leave it in your account without a team or members. You can finish setup later from your dashboard.\n\nContinue anyway?"
      );
      if (!confirmed) return;
    }
    router.push("/dashboard");
  };

  // Create the league (called at step 5 — Rules). Idempotent: no-ops if already created.
  const handleCreate = async (): Promise<boolean> => {
    if (createdLeagueId) return true; // Already created (e.g. back/forward navigation)
    setLoading(true);
    setError(null);
    try {
      if (isBetaMode) {
        const res = await fetch("/api/leagues/create", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leagueName: name || "My Beta League", useBetaReplay: true }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data?.error || "Failed to create league"); setLoading(false); return false; }
        setCreatedLeagueId(data.leagueId);
        return true;
      }
      if (isReplay) {
        const res = await fetch("/api/leagues/create", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leagueName: name || "My Replay League", maxTeams, useLastSeasonSimulation: true }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data?.error || "Failed to create league"); setLoading(false); return false; }
        setCreatedLeagueId(data.leagueId);
        return true;
      }
      // Live league
      let draftStartsAt: string | undefined;
      if (draftDate) {
        draftStartsAt = new Date(`${draftDate}T${draftTime}:00`).toISOString();
      }
      const res = await fetch("/api/leagues/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueName: name, maxTeams, draftStartsAt, isPublic, scoringMode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || "Failed to create league"); setLoading(false); return false; }
      setCreatedLeagueId(data.leagueId);
      return true;
    } catch {
      setError("Unable to create league. Please try again.");
      setLoading(false);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Step 5 → 6: create league (if needed) then advance.
  const handleCreateAndAdvance = async () => {
    const ok = await handleCreate();
    if (ok) setStep(6);
  };

  // Create the commissioner's team (step 6 → 7)
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
          ownerEmail: "",
          ownerName: userDisplayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || "Failed to create team"); setLoading(false); return; }
      setCreatedTeamId(data.teamId);
      setStep(7);
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

        {/* Progress indicator — hidden on step 0 (beta welcome) and step 8 (done) */}
        {step > 0 && step < 8 && (() => {
          const displayTotal = getDisplayTotal(isReplay);
          const displayStep = getDisplayStep(step, isReplay);
          const stepLabels = getStepLabels(isReplay);
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>
                  Step {displayStep} of {displayTotal}
                </p>
                <button
                  onClick={handleCancel}
                  style={{ fontSize: 12, color: "var(--faint)", textDecoration: "none", background: "none", border: "none", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {Array.from({ length: displayTotal }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      background: i < displayStep - 1 ? "var(--accent)" : "var(--border)",
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

          {/* ── Step 1: Mode choice (Live vs Replay) ── */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>How do you want to play?</h1>
                <p style={{ margin: 0, color: "var(--faint)", fontSize: 14 }}>
                  Hi {userDisplayName}! Choose a mode to get started. This sets up how many steps you&apos;ll need.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  {
                    value: false,
                    icon: "🏒",
                    label: "Live season",
                    desc: "Play the real 2026-27 PWHL season as it happens. Draft this fall, compete all year.",
                    steps: "7 steps",
                  },
                  {
                    value: true,
                    icon: "⏪",
                    label: "Replay (2025-26)",
                    desc: "Draft and compete using a completed season — start right now without filling a full league.",
                    steps: "5 steps",
                  },
                ].map(({ value, icon, label, desc, steps }) => {
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
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, alignSelf: "flex-start",
                        background: sel ? "rgba(143,193,232,0.15)" : "var(--bg-raised)",
                        color: sel ? "var(--accent-strong)" : "var(--faint)",
                        border: `1px solid ${sel ? "rgba(143,193,232,0.3)" : "var(--border)"}`,
                      }}>
                        {steps}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Beta mode: mode is locked to replay */}
              {isBetaMode && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(245,201,123,0.06)",
                  border: "1px solid rgba(245,201,123,0.2)",
                  fontSize: 12, color: "var(--dim)",
                }}>
                  Beta leagues use Replay mode (2025-26 season data) — pre-configured for a fast, fun test run.
                </div>
              )}

              {/* Scoring mode — only shown for live leagues (replay uses VP for beta compat) */}
              {!isBetaMode && !isReplay && (
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--dim)" }}>
                    How should weekly standings work?
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      {
                        value: "H2H" as const,
                        label: "Head-to-Head",
                        desc: "Play one opponent per week. Most wins = best record. Like ESPN Fantasy.",
                        recommended: true,
                      },
                      {
                        value: "VP" as const,
                        label: "Vs. the Field (VP)",
                        desc: "Rank against the full league each week. Earn VP based on your standing.",
                        recommended: false,
                        advanced: true,
                      },
                    ].map(({ value, label, desc, recommended, advanced }) => {
                      const sel = scoringMode === value;
                      return (
                        <button
                          key={value}
                          onClick={() => setScoringMode(value)}
                          style={{
                            padding: "14px 12px",
                            borderRadius: 12,
                            border: `1.5px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                            background: sel ? "rgba(143,193,232,0.1)" : "var(--bg-raised)",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.15s",
                            display: "flex",
                            flexDirection: "column",
                            gap: 5,
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: sel ? "var(--accent-strong)" : "var(--text)" }}>{label}</span>
                            {recommended && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                                background: "rgba(81,216,138,0.12)", color: "var(--green)",
                                border: "1px solid rgba(81,216,138,0.25)",
                              }}>Default</span>
                            )}
                            {advanced && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                                background: "var(--bg-raised)", color: "var(--faint)",
                                border: "1px solid var(--border)",
                              }}>Advanced</span>
                            )}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--faint)", lineHeight: 1.4 }}>{desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                className="button-primary"
                onClick={goNext}
                style={{ width: "100%", marginTop: 8 }}
              >
                Next →
              </button>
            </div>
          )}

          {/* ── Step 2: League name ── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Name your league</h1>
                <p style={{ margin: 0, color: "var(--faint)", fontSize: 14 }}>
                  You can change this anytime from the admin panel.
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

              <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
                <button className="button-secondary" onClick={goBack} style={{ flex: 1 }}>← Back</button>
                <button
                  className="button-primary"
                  onClick={goNext}
                  disabled={!nameValid}
                  style={{ flex: 1 }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: League size (live only) ── */}
          {step === 3 && (
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

          {/* ── Step 4: Draft date (live only) ── */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Draft date</h1>
                <p style={{ margin: 0, color: "var(--faint)", fontSize: 14 }}>
                  Set when your league will draft. You can always change this from the admin panel.
                </p>
              </div>

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
                    Try late November 2026 (when the PWHL season opens).
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

              <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
                <button className="button-secondary" onClick={goBack} style={{ flex: 1 }}>← Back</button>
                <button className="button-primary" onClick={goNext} style={{ flex: 1 }}>Next →</button>
              </div>
            </div>
          )}

          {/* ── Step 5: Rules confirmation + league creation ── */}
          {step === 5 && (
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
                    <div style={{ fontWeight: 700, color: "var(--gold)", marginBottom: 6 }}>How it works</div>
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
                    Next, you&apos;ll name your own team before inviting others.
                  </div>

                  <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
                    <button className="button-secondary" onClick={goBack} style={{ flex: 1 }}>← Back</button>
                    <button className="button-primary" onClick={handleCreateAndAdvance} disabled={loading} style={{ flex: 1 }}>
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

                  {/* UX-073: auto-skip signpost for replay mode */}
                  {isReplay && (
                    <div style={{
                      padding: "10px 14px", borderRadius: 10,
                      background: "rgba(245,201,123,0.06)",
                      border: "1px solid rgba(245,201,123,0.2)",
                      fontSize: 12, color: "var(--dim)", lineHeight: 1.5,
                    }}>
                      Replay leagues skip size &amp; draft date setup — they&apos;re pre-configured for the 2025-26 season.
                    </div>
                  )}

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
                        {isReplay || scoringMode === "VP" ? (
                          <>Ranked by <strong style={{ marginLeft: 4 }}>Victory Points (VP)</strong><VpExplainer /></>
                        ) : (
                          <>Weekly <strong style={{ marginLeft: 4 }}>Head-to-Head</strong> record (W-L-T)</>
                        )}
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
                        {isReplay ? `2025-26 replay · up to 6 teams` : `2026-27 live PWHL · ${maxTeams} teams`}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: "rgba(143,193,232,0.06)",
                    border: "1px solid rgba(143,193,232,0.15)",
                    fontSize: 13, color: "var(--dim)",
                  }}>
                    Scoring, roster slots, and playoff format can all be changed from the admin panel before the draft.
                  </div>

                  <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
                    <button className="button-secondary" onClick={goBack} style={{ flex: 1 }}>← Back</button>
                    <button className="button-primary" onClick={handleCreateAndAdvance} disabled={loading} style={{ flex: 1 }}>
                      {loading ? (createdLeagueId ? "Continuing…" : "Creating league…") : (createdLeagueId ? "Continue →" : "Create league →")}
                    </button>
                  </div>
                </>
              )}
              {error && <WizardError message={error} />}
            </div>
          )}

          {/* ── Step 6: Commissioner creates their team ── */}
          {step === 6 && createdLeagueId && !createdTeamId && (
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

          {/* ── Step 7: Invite managers ── */}
          {step === 7 && createdLeagueId && (
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
                <button className="button-primary" onClick={() => setStep(8)}>
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

          {/* ── Step 8: Done → draft prep ── */}
          {step === 8 && createdLeagueId && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <p style={{ fontSize: 28, margin: "0 0 8px" }}>🎉</p>
                <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>You&apos;re all set!</h1>
                <p style={{ margin: 0, color: "var(--faint)", fontSize: 14 }}>
                  {name} is created. Here&apos;s how to get ready for draft day.
                </p>
              </div>

              {/* Your league at a glance */}
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
                    { label: "Size", value: isReplay ? "Up to 6 teams" : `${maxTeams} teams` },
                    { label: "Mode", value: isReplay ? "⏪ Replay" : "Live season" },
                    { label: "Scoring", value: isReplay || scoringMode === "VP" ? "VP standings" : "Head-to-Head" },
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
