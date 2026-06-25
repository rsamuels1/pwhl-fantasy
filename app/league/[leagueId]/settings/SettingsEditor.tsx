"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import type { ScoringSettings } from "@/lib/scoring/index";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RosterSettings {
  forward: number;
  defense: number;
  goalie: number;
  util: number;
  bench: number;
  ir: number;
}

interface PlayoffSettings {
  teamsInPlayoff: number;
  topSeedsWithBye: number;
  roundDurationPeriods: number;
  higherSeedWinsTies: boolean;
}

export interface SettingsEditorProps {
  leagueId: string;
  leagueName: string;
  season: string;
  status: string;
  draftType: string;
  maxTeams: number;
  teamCount: number;
  isCommissioner: boolean;
  isDraftComplete: boolean;
  isPlayoffStarted: boolean;
  initialScoring: ScoringSettings;
  initialRoster: RosterSettings;
  initialPlayoff: PlayoffSettings;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  if (n === 0) return "0";
  const s = Number.isInteger(n) ? String(Math.abs(n)) : Math.abs(n).toFixed(2).replace(/\.?0+$/, "");
  return (n > 0 ? "+" : "−") + s;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Design primitives
// ---------------------------------------------------------------------------

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: "20px 22px",
  marginBottom: 18,
};

function SectionBar({ title, amber }: { title: string; amber?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <span style={{ width: 3, height: 15, borderRadius: 2, background: amber ? "linear-gradient(var(--amber),rgba(245,201,123,0.5))" : "linear-gradient(var(--accent-strong),var(--accent-deep))", flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: amber ? "var(--gold)" : "var(--muted)" }}>{title}</span>
    </div>
  );
}

function SubNote({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "var(--faint)", marginBottom: 18, marginLeft: 13 }}>{children}</div>;
}

function InfoCard({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 11, padding: "14px 16px" }}>
      <div>
        <div style={{ fontSize: 11, color: "var(--dim)", letterSpacing: "0.04em", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>{value}</div>
      </div>
      {dot && <span style={{ width: 9, height: 9, borderRadius: "50%", background: dot, boxShadow: `0 0 0 4px ${dot}26`, flexShrink: 0 }} />}
    </div>
  );
}

function Btn({ onClick, disabled, children, size = 28 }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; size?: number }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: size, height: size, borderRadius: 8,
        background: disabled ? "rgba(150,160,200,0.06)" : "rgba(143,193,232,0.12)",
        border: disabled ? "1px solid rgba(150,160,200,0.12)" : "1px solid rgba(143,193,232,0.26)",
        color: disabled ? "var(--faint)" : "var(--accent-strong)",
        fontSize: size === 28 ? 17 : 18, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >{children}</button>
  );
}

function ScoringCard({
  label, value, onChange, disabled,
}: {
  label: string; value: number; onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <div style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 12, padding: "13px 14px" }}>
      <div style={{ fontSize: 11, color: "var(--dim)", letterSpacing: "0.03em", marginBottom: 10, minHeight: 26 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Btn disabled={disabled} onClick={() => onChange(round2(value - 0.25))}>−</Btn>
        <input
          type="text" inputMode="decimal"
          value={fmt(value)}
          disabled={disabled}
          onChange={(e) => { const v = parseFloat(e.target.value.replace("−", "-").replace("+", "")); if (!isNaN(v)) onChange(v); }}
          style={{ flex: 1, minWidth: 0, textAlign: "center", background: "transparent", border: "none", color: disabled ? "var(--faint)" : "var(--text)", fontFamily: "'Saira Condensed',sans-serif", fontWeight: 700, fontSize: 22, outline: "none", cursor: disabled ? "not-allowed" : "text" }}
        />
        <Btn disabled={disabled} onClick={() => onChange(round2(value + 0.25))}>+</Btn>
      </div>
    </div>
  );
}

function RosterRow({
  label, note, value, onChange, disabled,
}: {
  label: string; note: string; value: number; onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: disabled ? "#5b6480" : "var(--text)" }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 1 }}>{note}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <Btn size={30} disabled={disabled || value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>−</Btn>
        <span style={{ fontFamily: "'Saira Condensed',sans-serif", fontWeight: 700, fontSize: 22, color: disabled ? "var(--faint)" : "var(--text)", minWidth: 24, textAlign: "center" as const }}>{value}</span>
        <Btn size={30} disabled={disabled} onClick={() => onChange(value + 1)}>+</Btn>
      </div>
    </div>
  );
}

function PlayoffRow({
  label, note, value, onChange, disabled, min, max,
}: {
  label: string; note: string; value: number; onChange: (v: number) => void; disabled?: boolean; min?: number; max?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: disabled ? "#5b6480" : "var(--text)" }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 1 }}>{note}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <Btn size={30} disabled={disabled || (min !== undefined && value <= min)} onClick={() => onChange(value - 1)}>−</Btn>
        <span style={{ fontFamily: "'Saira Condensed',sans-serif", fontWeight: 700, fontSize: 22, color: disabled ? "var(--faint)" : "var(--text)", minWidth: 24, textAlign: "center" as const }}>{value}</span>
        <Btn size={30} disabled={disabled || (max !== undefined && value >= max)} onClick={() => onChange(value + 1)}>+</Btn>
      </div>
    </div>
  );
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!value)} style={{ width: 46, height: 26, borderRadius: 99, border: "none", cursor: disabled ? "not-allowed" : "pointer", position: "relative" as const, transition: "background .2s", background: disabled ? "rgba(150,160,200,0.12)" : value ? "var(--accent-deep)" : "rgba(150,160,200,0.20)", flexShrink: 0, opacity: disabled ? 0.45 : 1 }}>
      <span style={{ position: "absolute" as const, top: 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", left: value ? 23 : 3 }} />
    </button>
  );
}


// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export function SettingsEditor({
  leagueId,
  leagueName,
  season,
  status,
  draftType,
  maxTeams,
  teamCount,
  isCommissioner,
  isDraftComplete,
  isPlayoffStarted,
  initialScoring,
  initialRoster,
  initialPlayoff,
}: SettingsEditorProps) {
  const router = useRouter();

  const [scoring, setScoring] = useState<ScoringSettings>(initialScoring);
  const [roster, setRoster] = useState<RosterSettings>(initialRoster);
  const [playoff, setPlayoff] = useState<PlayoffSettings>(initialPlayoff);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const scoringLocked = isDraftComplete || !isCommissioner;
  const playoffLocked = isPlayoffStarted || !isCommissioner;

  const scoringDirty = JSON.stringify(scoring) !== JSON.stringify(initialScoring);
  const rosterDirty = JSON.stringify(roster) !== JSON.stringify(initialRoster);
  const playoffDirty = JSON.stringify(playoff) !== JSON.stringify(initialPlayoff);
  const dirty = (!scoringLocked && (scoringDirty || rosterDirty)) || (!playoffLocked && playoffDirty);

  const changeCount = [!scoringLocked && scoringDirty, !scoringLocked && rosterDirty, !playoffLocked && playoffDirty].filter(Boolean).length;

  const setSkater = useCallback((key: keyof ScoringSettings["skater"], v: number) => {
    setScoring((s) => ({ ...s, skater: { ...s.skater, [key]: v } }));
  }, []);

  const setGoalie = useCallback((key: keyof ScoringSettings["goalie"], v: number) => {
    setScoring((s) => ({ ...s, goalie: { ...s.goalie, [key]: v } }));
  }, []);

  const setRosterKey = useCallback((key: keyof RosterSettings, v: number) => {
    setRoster((r) => ({ ...r, [key]: Math.max(0, v) }));
  }, []);

  const setPlayoffKey = useCallback(<K extends keyof PlayoffSettings>(key: K, v: PlayoffSettings[K]) => {
    setPlayoff((p) => ({ ...p, [key]: v }));
  }, []);

  const handleDiscard = useCallback(() => {
    setScoring(initialScoring);
    setRoster(initialRoster);
    setPlayoff(initialPlayoff);
    setSaveError(null);
  }, [initialScoring, initialRoster, initialPlayoff]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {};
      if (!scoringLocked) {
        if (scoringDirty) body.scoringSettings = scoring;
        if (rosterDirty) body.rosterSettings = roster;
      }
      if (!playoffLocked && playoffDirty) {
        body.playoffSettings = playoff;
      }
      if (Object.keys(body).length === 0) { setSaving(false); return; }
      const res = await fetch(`/api/leagues/${leagueId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setSaveError(d.error ?? "Save failed");
      } else {
        router.refresh();
      }
    } catch {
      setSaveError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }, [leagueId, scoringLocked, playoffLocked, scoringDirty, rosterDirty, playoffDirty, scoring, roster, playoff, router]);

  const statusLabel = { PRE_DRAFT: "Pre-draft", IN_SEASON: "In season", COMPLETE: "Complete" }[status] ?? status.replace(/_/g, " ");
  const statusDot = { IN_SEASON: "#5fa98c", PRE_DRAFT: "#e3c989", COMPLETE: "#9aa3bd" }[status] ?? "#9aa3bd";
  const rosterTotal = Object.values(roster).reduce((a, b) => a + b, 0);

  const skaterFields: { key: keyof ScoringSettings["skater"]; label: string }[] = [
    { key: "goal", label: "Goal" },
    { key: "assist", label: "Assist" },
    { key: "powerPlayPoint", label: "Power-play point" },
    { key: "shot", label: "Shot on goal" },
    { key: "hit", label: "Hit" },
    { key: "block", label: "Blocked shot" },
    { key: "plusMinus", label: "Plus / minus" },
    { key: "penaltyMinute", label: "Penalty minute" },
  ];

  const goalieFields: { key: keyof ScoringSettings["goalie"]; label: string }[] = [
    { key: "win", label: "Win" },
    { key: "save", label: "Save" },
    { key: "shutout", label: "Shutout" },
    { key: "goalAgainst", label: "Goal against" },
  ];

  return (
    <div style={{ fontFamily: "Archivo,sans-serif" }}>

      {/* Title block */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap" as const, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>League Rules</h1>
          <div style={{ fontSize: 13, color: "var(--dim)", marginTop: 5, lineHeight: 1.5 }}>
            Configure scoring, roster structure, and playoffs for <strong style={{ color: "var(--muted)" }}>{leagueName}</strong>.
          </div>
        </div>
        {isCommissioner && (
          <span style={{ fontSize: 11, fontWeight: 600, color: "#7fc2a6", background: "rgba(95,169,140,0.10)", border: "1px solid rgba(95,169,140,0.30)", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" as const }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5fa98c" strokeWidth="2.4"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
            Commissioner access
          </span>
        )}
      </div>

      {/* Basic Settings */}
      <section style={card}>
        <SectionBar title="Basic settings" />
        <SubNote>Format is locked once the draft is complete.</SubNote>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
          <InfoCard label="Season" value={season} />
          <InfoCard label="Status" value={statusLabel} dot={statusDot} />
          <InfoCard label="Draft type" value={draftType === "SNAKE" ? "Snake" : draftType} />
          <InfoCard label="Max franchises" value={`${maxTeams} (${teamCount} joined)`} />
        </div>
      </section>

      {/* Scoring — two-column table: Skaters | Goalies */}
      <section style={card}>
        <SectionBar title="Scoring" />
        <SubNote>
          Fantasy points per stat, per game.
          {scoringLocked && !isCommissioner && " Read-only — commissioner only."}
          {scoringLocked && isCommissioner && " Locked after draft."}
        </SubNote>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
          {/* Skaters column */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--dim)", marginBottom: 8 }}>
              Skaters
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {skaterFields.map(({ key, label }) => (
                <ScoringCard key={key} label={label} value={scoring.skater[key]} onChange={(v) => setSkater(key, v)} disabled={scoringLocked} />
              ))}
            </div>
          </div>
          {/* Goalies column */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--dim)", marginBottom: 8 }}>
              Goalies
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {goalieFields.map(({ key, label }) => (
                <ScoringCard key={key} label={label} value={scoring.goalie[key]} onChange={(v) => setGoalie(key, v)} disabled={scoringLocked} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Roster + Playoffs — 2-col */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18, alignItems: "start" }}>

        {/* Roster Structure */}
        <section style={{ ...card, marginBottom: 0 }}>
          <SectionBar title="Roster structure" />
          <SubNote>
            Starting slots plus bench and injured reserve.
            {scoringLocked && isCommissioner && " Locked after draft."}
          </SubNote>
          {/* Pill badge summary */}
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 16 }}>
            {[
              { label: `${roster.forward}F`, active: roster.forward > 0 },
              { label: `${roster.defense}D`, active: roster.defense > 0 },
              { label: `${roster.goalie}G`, active: roster.goalie > 0 },
              { label: `${roster.util}UTIL`, active: roster.util > 0 },
              { label: `${roster.bench}B`, active: roster.bench > 0 },
              ...(roster.ir > 0 ? [{ label: `${roster.ir}IR`, active: true }] : []),
            ].map(({ label, active }) => (
              <span key={label} style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: active ? "rgba(143,193,232,0.12)" : "var(--surface)", border: `1px solid ${active ? "rgba(143,193,232,0.28)" : "var(--border)"}`, color: active ? "var(--accent-strong)" : "var(--faint)" }}>
                {label}
              </span>
            ))}
          </div>
          {(
            [
              { key: "forward" as const, label: "Forward", note: "F" },
              { key: "defense" as const, label: "Defense", note: "D" },
              { key: "goalie" as const, label: "Goalie", note: "G" },
              { key: "util" as const, label: "Utility", note: "Any skater" },
              { key: "bench" as const, label: "Bench", note: "Reserves" },
              { key: "ir" as const, label: "Injured reserve", note: "IR-eligible only" },
            ] as const
          ).map(({ key, label, note }) => (
            <RosterRow key={key} label={label} note={note} value={roster[key]} onChange={(v) => setRosterKey(key, v)} disabled={scoringLocked} />
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 15, background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 10, padding: "12px 15px" }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: "var(--accent-strong)", textTransform: "uppercase" as const }}>Total roster size</span>
            <span style={{ fontFamily: "'Saira Condensed',sans-serif", fontWeight: 700, fontSize: 24, color: "var(--text)" }}>{rosterTotal}</span>
          </div>
        </section>

        {/* Playoffs */}
        <section style={{ ...card, marginBottom: 0 }}>
          <SectionBar title="Playoff format" />
          <SubNote>
            How the postseason bracket is built.
            {playoffLocked && isPlayoffStarted && " Locked — playoffs in progress."}
            {playoffLocked && !isPlayoffStarted && !isCommissioner && " Read-only — commissioner only."}
          </SubNote>
          <PlayoffRow label="Teams in playoff" note={`Out of ${maxTeams} franchises`} value={playoff.teamsInPlayoff} onChange={(v) => setPlayoffKey("teamsInPlayoff", Math.max(2, Math.min(maxTeams, v)))} disabled={playoffLocked} min={2} max={maxTeams} />
          <PlayoffRow label="Top seeds with bye" note="Skip the first round" value={playoff.topSeedsWithBye} onChange={(v) => setPlayoffKey("topSeedsWithBye", Math.max(0, Math.min(4, v)))} disabled={playoffLocked} min={0} max={4} />
          <PlayoffRow label="Round length" note="Scoring periods per round" value={playoff.roundDurationPeriods} onChange={(v) => setPlayoffKey("roundDurationPeriods", Math.max(1, Math.min(3, v)))} disabled={playoffLocked} min={1} max={3} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 0 4px" }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: playoffLocked ? "#5b6480" : "var(--text)" }}>Higher seed wins ties</div>
              <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 1 }}>Break tied matchups by seed</div>
            </div>
            <Toggle value={playoff.higherSeedWinsTies} onChange={(v) => setPlayoffKey("higherSeedWinsTies", v)} disabled={playoffLocked} />
          </div>
        </section>
      </div>

      {/* Floating save bar */}
      {dirty && (
        <div style={{ position: "fixed" as const, left: 0, right: 0, bottom: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 14, pointerEvents: "none" as const }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, background: "rgba(18,24,41,0.96)", backdropFilter: "blur(12px)", border: "1px solid rgba(143,193,232,0.40)", borderRadius: 14, padding: "12px 14px 12px 20px", boxShadow: "0 12px 40px rgba(0,0,0,0.5)", pointerEvents: "auto" as const }}>
            {saveError ? (
              <span style={{ fontSize: 13, color: "var(--red)", fontWeight: 500 }}>{saveError}</span>
            ) : (
              <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--amber)", flexShrink: 0 }} />
                {changeCount === 1 ? "1 unsaved change" : `${changeCount} unsaved changes`}
              </span>
            )}
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={handleDiscard} disabled={saving} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", padding: "10px 16px", borderRadius: 9, fontWeight: 600, fontSize: 13, fontFamily: "Archivo,sans-serif", cursor: "pointer" }}>
                Discard
              </button>
              <button onClick={handleSave} disabled={saving} style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-deep))", color: "var(--accent-ink)", border: "none", padding: "10px 20px", borderRadius: 9, fontWeight: 700, fontSize: 13, fontFamily: "Archivo,sans-serif", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
