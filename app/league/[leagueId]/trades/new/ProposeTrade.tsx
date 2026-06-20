"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface PlayerOption {
  playerId: string;
  name: string;
  position: string;
  active: boolean;
}

interface Props {
  leagueId: string;
  myTeamId: string;
  myTeamName: string;
  otherTeams: Array<{ id: string; name: string }>;
  myRoster: PlayerOption[];
  rostersByTeam: Record<string, PlayerOption[]>;
  preselectedTeamId: string | null;
  counterOfId: string | null;
}

function PlayerPicker({
  players,
  selected,
  onToggle,
  label,
}: {
  players: PlayerOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  label: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <input
        type="text"
        placeholder="Search players..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "8px 12px", borderRadius: 8,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          color: "#e2e8f0", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
        }}
      />
      <div style={{ maxHeight: 240, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 13, padding: 8 }}>No players found.</div>
        ) : (
          filtered.map((p) => {
            const isSelected = selected.has(p.playerId);
            return (
              <button
                key={p.playerId}
                type="button"
                onClick={() => onToggle(p.playerId)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "8px 12px", borderRadius: 8,
                  background: isSelected ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.03)",
                  border: isSelected ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.06)",
                  cursor: "pointer", marginBottom: 4, color: isSelected ? "#a5b4fc" : "#e2e8f0",
                  textAlign: "left",
                }}
              >
                <span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                  {" "}
                  <span style={{ fontSize: 11, color: "#64748b" }}>{p.position}</span>
                </span>
                {isSelected && <span style={{ fontSize: 12, color: "#a5b4fc" }}>✓ Selected</span>}
              </button>
            );
          })
        )}
      </div>
      {selected.size > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#a5b4fc" }}>
          {selected.size} player{selected.size !== 1 ? "s" : ""} selected
        </div>
      )}
    </div>
  );
}

export default function ProposeTrade({
  leagueId,
  myTeamId,
  myTeamName,
  otherTeams,
  myRoster,
  rostersByTeam,
  preselectedTeamId,
  counterOfId,
}: Props) {
  const router = useRouter();
  const [selectedTeamId, setSelectedTeamId] = useState(preselectedTeamId ?? "");
  const [mySelected, setMySelected] = useState<Set<string>>(new Set());
  const [theirSelected, setTheirSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const theirRoster = selectedTeamId ? (rostersByTeam[selectedTeamId] ?? []) : [];
  const selectedTeamName = otherTeams.find((t) => t.id === selectedTeamId)?.name ?? "Their team";

  const canSubmit = selectedTeamId && mySelected.size > 0 && theirSelected.size > 0;

  function toggleMyPlayer(id: string) {
    setMySelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleTheirPlayer(id: string) {
    setTheirSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);

    const items = [
      ...[...mySelected].map((playerId) => ({
        fromTeamId: myTeamId,
        toTeamId: selectedTeamId,
        playerId,
      })),
      ...[...theirSelected].map((playerId) => ({
        fromTeamId: selectedTeamId,
        toTeamId: myTeamId,
        playerId,
      })),
    ];

    // If this is a counter, POST to the counter endpoint, else to the main trades endpoint
    const url = counterOfId
      ? `/api/leagues/${leagueId}/trades/${counterOfId}/counter`
      : `/api/leagues/${leagueId}/trades`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receivingTeamId: selectedTeamId,
          items,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to propose trade.");
        return;
      }
      const tradeId = (data as { trade?: { id: string } }).trade?.id;
      startTransition(() => {
        router.push(tradeId ? `/league/${leagueId}/trades/${tradeId}` : `/league/${leagueId}/trades`);
      });
    } catch {
      setError("Network error. Please try again.");
    }
  }

  return (
    <div style={{ maxWidth: 740 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, marginBottom: 24 }}>
        {counterOfId ? "Counter Offer" : "Propose Trade"}
      </h1>

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#f87171", fontSize: 14,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Step 1: Pick team */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", display: "block", marginBottom: 10 }}>
            Trade with
          </label>
          <select
            value={selectedTeamId}
            onChange={(e) => { setSelectedTeamId(e.target.value); setTheirSelected(new Set()); }}
            style={{
              padding: "10px 14px", borderRadius: 8,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              color: "#e2e8f0", fontSize: 14, width: "100%",
            }}
          >
            <option value="">Select a team...</option>
            {otherTeams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Step 2: Select players */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, alignItems: "start" }}>
            <PlayerPicker
              players={myRoster}
              selected={mySelected}
              onToggle={toggleMyPlayer}
              label={`${myTeamName} gives`}
            />
            <div style={{ paddingTop: 24, color: "#64748b", fontSize: 24, textAlign: "center" }}>⇄</div>
            <PlayerPicker
              players={theirRoster}
              selected={theirSelected}
              onToggle={toggleTheirPlayer}
              label={`${selectedTeamId ? selectedTeamName : "Other team"} gives`}
            />
          </div>
          {!selectedTeamId && (
            <div style={{ marginTop: 12, color: "#64748b", fontSize: 13 }}>
              Select a team above to see their roster.
            </div>
          )}
        </div>

        {/* Step 3: Message */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", display: "block", marginBottom: 8 }}>
            Message (optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Add a note to your proposal..."
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              color: "#e2e8f0", fontSize: 13, resize: "vertical", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Summary + submit */}
        {(mySelected.size > 0 || theirSelected.size > 0) && (
          <div style={{
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#a5b4fc",
          }}>
            {mySelected.size > 0 && (
              <div>You give: {[...mySelected].map((id) => myRoster.find((p) => p.playerId === id)?.name ?? id).join(", ")}</div>
            )}
            {theirSelected.size > 0 && (
              <div>You receive: {[...theirSelected].map((id) => theirRoster.find((p) => p.playerId === id)?.name ?? id).join(", ")}</div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="submit"
            disabled={!canSubmit || isPending}
            style={{
              padding: "12px 24px", borderRadius: 8, border: "none",
              background: canSubmit ? "rgba(99,102,241,0.85)" : "rgba(99,102,241,0.3)",
              color: "#fff", fontSize: 14, fontWeight: 600,
              cursor: canSubmit && !isPending ? "pointer" : "not-allowed",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Sending..." : counterOfId ? "Send Counter Offer" : "Send Trade Proposal"}
          </button>
          <a
            href={`/league/${leagueId}/trades`}
            style={{
              padding: "12px 24px", borderRadius: 8,
              border: "1px solid rgba(148,163,184,0.3)",
              background: "transparent", color: "#94a3b8",
              fontSize: 14, textDecoration: "none", lineHeight: "normal",
              display: "inline-flex", alignItems: "center",
            }}
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
