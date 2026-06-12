"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TeamRow {
  id: string;
  name: string;
  ownerEmail: string;
  roster: Array<{ playerId: string; playerName: string; slot: string }>;
}

interface Props {
  leagueId: string;
  teams: TeamRow[];
  isDraftPaused: boolean;
}

export function CommissionerRecoveryTools({ leagueId, teams, isDraftPaused }: Props) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <ReplaceOwnerSection leagueId={leagueId} teams={teams} />
      <UndoTransactionSection leagueId={leagueId} teams={teams} isDraftPaused={isDraftPaused} />
      <ForceRosterMoveSection leagueId={leagueId} teams={teams} />
    </div>
  );
}

// ── Replace Owner ─────────────────────────────────────────────────────────

function ReplaceOwnerSection({ leagueId, teams }: { leagueId: string; teams: TeamRow[] }) {
  const router = useRouter();
  const [selectedTeam, setSelectedTeam] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleReplace() {
    if (!selectedTeam || !email.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/teams/${selectedTeam}/owner`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerEmail: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error}`);
      } else {
        setResult("Owner replaced. Roster and standings are preserved.");
        setEmail("");
        setSelectedTeam("");
        router.refresh();
      }
    } catch {
      setResult("Network error");
    }
    setBusy(false);
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: "0 0 10px", color: "#e2e8f0" }}>Replace inactive manager</h3>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
        Transfer a team to a new owner. Their roster, standings, and matchups are preserved.
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} style={inputStyle}>
          <option value="">Select team…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name} ({t.ownerEmail})</option>
          ))}
        </select>
        <input
          type="email"
          placeholder="New owner's email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <button
          onClick={handleReplace}
          disabled={busy || !selectedTeam || !email}
          style={btnStyle(busy || !selectedTeam || !email)}
        >
          {busy ? "Replacing…" : "Replace owner"}
        </button>
      </div>
      {result && <p style={{ margin: "8px 0 0", fontSize: 13, color: result.startsWith("Error") ? "#f87171" : "#34d399" }}>{result}</p>}
    </div>
  );
}

// ── Undo Transaction ──────────────────────────────────────────────────────

function UndoTransactionSection({ leagueId, teams, isDraftPaused }: { leagueId: string; teams: TeamRow[]; isDraftPaused: boolean }) {
  const router = useRouter();
  const [selectedTeam, setSelectedTeam] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleUndo(type: "waiver" | "draft-pick") {
    setBusy(true);
    setResult(null);
    const body: Record<string, string> = { type };
    if (type === "waiver") body.teamId = selectedTeam;
    try {
      const res = await fetch(`/api/leagues/${leagueId}/commissioner/undo-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error}`);
      } else {
        setResult(`Undone: ${data.undone}`);
        setSelectedTeam("");
        router.refresh();
      }
    } catch {
      setResult("Network error");
    }
    setBusy(false);
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: "0 0 10px", color: "#e2e8f0" }}>Undo last transaction</h3>
      <div style={{ display: "grid", gap: 8 }}>
        <div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 8px" }}>Waiver move — reverses the most recent add or drop for a team:</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 160 }}>
              <option value="">Select team…</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={() => handleUndo("waiver")} disabled={busy || !selectedTeam} style={btnStyle(busy || !selectedTeam)}>
              {busy ? "Undoing…" : "Undo waiver"}
            </button>
          </div>
        </div>
        {isDraftPaused && (
          <div>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 8px" }}>Draft pick — reverts the most recent pick (draft is paused):</p>
            <button onClick={() => handleUndo("draft-pick")} disabled={busy} style={btnStyle(busy)}>
              {busy ? "Undoing…" : "Undo last draft pick"}
            </button>
          </div>
        )}
      </div>
      {result && <p style={{ margin: "8px 0 0", fontSize: 13, color: result.startsWith("Error") ? "#f87171" : "#34d399" }}>{result}</p>}
    </div>
  );
}

// ── Force Roster Move ─────────────────────────────────────────────────────

const SLOTS = ["FORWARD", "DEFENSE", "GOALIE", "UTIL", "BENCH", "IR"] as const;
type Slot = (typeof SLOTS)[number];

function ForceRosterMoveSection({ leagueId, teams }: { leagueId: string; teams: TeamRow[] }) {
  const router = useRouter();
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [targetSlot, setTargetSlot] = useState<Slot>("BENCH");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const currentTeam = teams.find((t) => t.id === selectedTeam);

  async function handleMove() {
    if (!selectedTeam || !selectedPlayer) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/commissioner/force-move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: selectedTeam, playerId: selectedPlayer, slot: targetSlot, reason: reason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error}`);
      } else {
        setResult("Player moved successfully.");
        setSelectedPlayer("");
        setReason("");
        router.refresh();
      }
    } catch {
      setResult("Network error");
    }
    setBusy(false);
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: "0 0 10px", color: "#e2e8f0" }}>Force roster move</h3>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
        Move a player on behalf of any team. Respects eligibility rules. Cannot move locked players.
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        <select value={selectedTeam} onChange={(e) => { setSelectedTeam(e.target.value); setSelectedPlayer(""); }} style={inputStyle}>
          <option value="">Select team…</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {currentTeam && (
          <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)} style={inputStyle}>
            <option value="">Select player…</option>
            {currentTeam.roster.map((p) => (
              <option key={p.playerId} value={p.playerId}>{p.playerName} ({p.slot})</option>
            ))}
          </select>
        )}
        <select value={targetSlot} onChange={(e) => setTargetSlot(e.target.value as Slot)} style={inputStyle}>
          {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder="Reason (optional, logged in audit trail)" value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle} />
        <button onClick={handleMove} disabled={busy || !selectedTeam || !selectedPlayer} style={btnStyle(busy || !selectedTeam || !selectedPlayer)}>
          {busy ? "Moving…" : "Move player"}
        </button>
      </div>
      {result && <p style={{ margin: "8px 0 0", fontSize: 13, color: result.startsWith("Error") ? "#f87171" : "#34d399" }}>{result}</p>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.2)",
  background: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontSize: 14, width: "100%", boxSizing: "border-box",
};

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "9px 16px", borderRadius: 10, border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? "rgba(99,102,241,0.3)" : "#6366f1",
    color: "#fff", fontWeight: 700, fontSize: 14,
  };
}
