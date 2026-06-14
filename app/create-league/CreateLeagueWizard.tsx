"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import InviteLinkButton from "@/components/InviteLinkButton";
import Link from "next/link";

const TOTAL_STEPS = 7;

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
  const [step, setStep] = useState(1);
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

  // Mark onboarding seen on mount (idempotent)
  useEffect(() => {
    fetch("/api/user/onboarding", { method: "POST" }).catch(() => {});
  }, []);

  const goNext = () => {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  // In replay mode, skip steps 4–5 (rules + invite) but still go through team creation
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
      setStep(5);
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
        body: JSON.stringify({ leagueName: name, maxTeams, draftStartsAt }),
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

        {/* Progress indicator */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>
              Step {Math.min(step, TOTAL_STEPS - 1)} of {TOTAL_STEPS - 1}
            </p>
            {step < TOTAL_STEPS && (
              <Link href="/dashboard" style={{ fontSize: 12, color: "#475569", textDecoration: "none" }}>
                Cancel
              </Link>
            )}
          </div>
          <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.07)" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${Math.min(((step - 1) / (TOTAL_STEPS - 1)) * 100, 100)}%`,
              background: "linear-gradient(90deg, #6366f1, #818cf8)",
              transition: "width 0.3s ease",
            }} />
          </div>
        </div>

        <div className="dashboard-panel">

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
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="button-primary"
                  onClick={goNext}
                  disabled={!nameValid}
                >
                  Next →
                </button>
              </div>
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
                              background: "rgba(52,211,153,0.15)", color: "#34d399",
                              border: "1px solid rgba(52,211,153,0.25)",
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
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button className="button-secondary" onClick={goBack}>← Back</button>
                <button className="button-primary" onClick={goNext}>Next →</button>
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

              {/* Replay explanation */}
              {isReplay && (
                <div style={{
                  padding: "14px 16px", borderRadius: 12,
                  background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  fontSize: 13, color: "#94a3b8", lineHeight: 1.5,
                }}>
                  <strong style={{ color: "#fbbf24" }}>⏪ Replay mode</strong> — your league is a sandbox.
                  You control the pace (advance by day or week). Great for trying the app or playing with a friend.
                  Live leagues are the real competition.
                </div>
              )}

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
                      Most leagues draft the week before the season opener. You can set this later from the admin panel.
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

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button className="button-secondary" onClick={goBack}>← Back</button>
                {isReplay ? (
                  <button className="button-primary" onClick={handleReplayCreate} disabled={loading}>
                    {loading ? "Creating…" : "Create replay league →"}
                  </button>
                ) : (
                  <button className="button-primary" onClick={goNext}>Next →</button>
                )}
              </div>
              {error && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>}
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
                <RuleRow icon="👥" label="Roster" value="3 F · 2 D · 1 UTIL · 1 G · 6 Bench = 13 slots, all drafted" />
                <RuleRow icon="📊" label="Standings" value="Victory Points — win your matchup AND be a top scorer each week" />
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

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button className="button-secondary" onClick={goBack}>← Back</button>
                <button className="button-primary" onClick={handleCreate} disabled={loading}>
                  {loading ? "Creating league…" : "Create league →"}
                </button>
              </div>
              {error && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>}
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

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button className="button-secondary" onClick={goBack}>← Back</button>
                <button
                  className="button-primary"
                  onClick={handleCreateTeam}
                  disabled={loading || !teamNameValid}
                >
                  {loading ? "Creating team…" : "Create my team →"}
                </button>
              </div>
              {error && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>}
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
