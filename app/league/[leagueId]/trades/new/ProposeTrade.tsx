"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface PlayerOption {
  playerId: string;
  name: string;
  position: string;
  active: boolean;
  fp: number;
}

interface LeaguePlayer extends PlayerOption {
  teamId: string;
  teamName: string;
}

interface Props {
  leagueId: string;
  myTeamId: string;
  myTeamName: string;
  myRoster: PlayerOption[];
  leaguePlayers: LeaguePlayer[];
  preselectedTeamId: string | null;
  counterOfId: string | null;
}

const POS_ORDER: Record<string, number> = { FORWARD: 0, DEFENSE: 1, GOALIE: 2 };

function MyRosterPicker({
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
  const [sortBy, setSortBy] = useState<"fp" | "pos">("fp");

  const filtered = players
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sortBy === "fp"
        ? b.fp - a.fp
        : (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9)
    );

  return (
    <div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "7px 10px", borderRadius: 6,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#e2e8f0", fontSize: 13,
          }}
        />
        <button
          type="button"
          onClick={() => setSortBy((s) => s === "fp" ? "pos" : "fp")}
          style={{
            padding: "7px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#94a3b8", whiteSpace: "nowrap",
          }}
        >
          {sortBy === "fp" ? "↓ FP" : "↓ Pos"}
        </button>
      </div>
      <div style={{ maxHeight: 280, overflowY: "auto" }}>
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
                  width: "100%", padding: "8px 10px", borderRadius: 6, marginBottom: 3,
                  background: isSelected ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.03)",
                  border: isSelected ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.06)",
                  cursor: "pointer", color: isSelected ? "#a5b4fc" : "#e2e8f0", textAlign: "left",
                }}
              >
                <span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                  {" "}
                  <span style={{ fontSize: 11, color: "#64748b" }}>{p.position}</span>
                </span>
                <span style={{ fontSize: 12, color: isSelected ? "#a5b4fc" : "#475569" }}>
                  {isSelected ? "✓" : ""} {p.fp > 0 ? `${p.fp} FP` : ""}
                </span>
              </button>
            );
          })
        )}
      </div>
      {selected.size > 0 && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#a5b4fc" }}>
          {selected.size} selected
        </div>
      )}
    </div>
  );
}

function LeaguePlayerPicker({
  players,
  selected,
  lockedTeamId,
  onToggle,
  label,
}: {
  players: LeaguePlayer[];
  selected: Set<string>;
  lockedTeamId: string | null;
  onToggle: (player: LeaguePlayer) => void;
  label: string;
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"fp" | "pos">("fp");

  const filtered = players
    .filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.teamName.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) =>
      sortBy === "fp"
        ? b.fp - a.fp
        : (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9)
    );

  return (
    <div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input
          type="text"
          placeholder="Search players or teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "7px 10px", borderRadius: 6,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#e2e8f0", fontSize: 13,
          }}
        />
        <button
          type="button"
          onClick={() => setSortBy((s) => s === "fp" ? "pos" : "fp")}
          style={{
            padding: "7px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#94a3b8", whiteSpace: "nowrap",
          }}
        >
          {sortBy === "fp" ? "↓ FP" : "↓ Pos"}
        </button>
      </div>
      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 13, padding: 8 }}>No players found.</div>
        ) : (
          filtered.map((p) => {
            const isSelected = selected.has(p.playerId);
            const isWrongTeam = lockedTeamId !== null && p.teamId !== lockedTeamId && !isSelected;
            return (
              <button
                key={p.playerId}
                type="button"
                onClick={() => !isWrongTeam && onToggle(p)}
                disabled={isWrongTeam}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "8px 10px", borderRadius: 6, marginBottom: 3,
                  background: isSelected
                    ? "rgba(99,102,241,0.2)"
                    : isWrongTeam
                    ? "rgba(255,255,255,0.01)"
                    : "rgba(255,255,255,0.03)",
                  border: isSelected
                    ? "1px solid rgba(99,102,241,0.5)"
                    : "1px solid rgba(255,255,255,0.06)",
                  cursor: isWrongTeam ? "not-allowed" : "pointer",
                  color: isSelected ? "#a5b4fc" : isWrongTeam ? "#334155" : "#e2e8f0",
                  textAlign: "left",
                  opacity: isWrongTeam ? 0.4 : 1,
                }}
              >
                <span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                  {" "}
                  <span style={{ fontSize: 11, color: isWrongTeam ? "#334155" : "#64748b" }}>
                    {p.position} · {p.teamName}
                  </span>
                </span>
                <span style={{ fontSize: 12, color: isSelected ? "#a5b4fc" : "#475569" }}>
                  {isSelected ? "✓" : ""} {p.fp > 0 ? `${p.fp} FP` : ""}
                </span>
              </button>
            );
          })
        )}
      </div>
      {selected.size > 0 && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#a5b4fc" }}>
          {selected.size} selected
        </div>
      )}
    </div>
  );
}

export default function ProposeTrade({
  leagueId,
  myTeamId,
  myRoster,
  myTeamName,
  leaguePlayers,
  preselectedTeamId,
  counterOfId,
}: Props) {
  const router = useRouter();

  // Derive locked team from preselectedTeamId or first selected league player
  const preselectedPlayers = preselectedTeamId
    ? leaguePlayers.filter((p) => p.teamId === preselectedTeamId)
    : [];

  const [mySelected, setMySelected] = useState<Set<string>>(new Set());
  const [theirSelected, setTheirSelected] = useState<Set<string>>(new Set());
  // lockedTeamId is the team we're trading with — derived from the first player selected from the league
  const [lockedTeamId, setLockedTeamId] = useState<string | null>(preselectedTeamId);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const lockedTeamName = lockedTeamId
    ? leaguePlayers.find((p) => p.teamId === lockedTeamId)?.teamName ?? "Their team"
    : null;

  function toggleMyPlayer(id: string) {
    setMySelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleLeaguePlayer(player: LeaguePlayer) {
    setTheirSelected((prev) => {
      const next = new Set(prev);
      if (next.has(player.playerId)) {
        next.delete(player.playerId);
        // If nothing left selected from this team, unlock
        const stillHasFromTeam = [...next].some(
          (id) => leaguePlayers.find((p) => p.playerId === id)?.teamId === player.teamId
        );
        if (!stillHasFromTeam) setLockedTeamId(null);
      } else {
        next.add(player.playerId);
        setLockedTeamId(player.teamId);
      }
      return next;
    });
  }

  const canSubmit = lockedTeamId && mySelected.size > 0 && theirSelected.size > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !lockedTeamId) return;
    setError(null);

    const items = [
      ...[...mySelected].map((playerId) => ({
        fromTeamId: myTeamId,
        toTeamId: lockedTeamId,
        playerId,
      })),
      ...[...theirSelected].map((playerId) => ({
        fromTeamId: lockedTeamId,
        toTeamId: myTeamId,
        playerId,
      })),
    ];

    const url = counterOfId
      ? `/api/leagues/${leagueId}/trades/${counterOfId}/counter`
      : `/api/leagues/${leagueId}/trades`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receivingTeamId: lockedTeamId,
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

  const mySelectedNames = [...mySelected].map(
    (id) => myRoster.find((p) => p.playerId === id)?.name ?? id
  );
  const theirSelectedNames = [...theirSelected].map(
    (id) => leaguePlayers.find((p) => p.playerId === id)?.name ?? id
  );

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
        {counterOfId ? "Counter Offer" : "Propose Trade"}
      </h1>
      {lockedTeamName && (
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#94a3b8" }}>
          Trading with <strong style={{ color: "#e2e8f0" }}>{lockedTeamName}</strong>
          {" "}
          <button
            type="button"
            onClick={() => { setLockedTeamId(null); setTheirSelected(new Set()); }}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
          >
            change
          </button>
        </p>
      )}

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#f87171", fontSize: 14,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Player pickers side by side */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, alignItems: "start" }}>
            <MyRosterPicker
              players={myRoster}
              selected={mySelected}
              onToggle={toggleMyPlayer}
              label={`${myTeamName} gives`}
            />
            <div style={{ paddingTop: 32, color: "#475569", fontSize: 22, textAlign: "center" }}>⇄</div>
            <LeaguePlayerPicker
              players={leaguePlayers}
              selected={theirSelected}
              lockedTeamId={lockedTeamId}
              onToggle={toggleLeaguePlayer}
              label={lockedTeamName ? `${lockedTeamName} gives` : "Want from league"}
            />
          </div>
          {!lockedTeamId && (
            <p style={{ marginTop: 12, color: "#64748b", fontSize: 13 }}>
              Search by player name or team name and click a player to start building your trade.
            </p>
          )}
        </div>

        {/* Trade summary */}
        {(mySelected.size > 0 || theirSelected.size > 0) && (
          <div style={{
            background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#a5b4fc",
          }}>
            {mySelected.size > 0 && <div>You give: {mySelectedNames.join(", ")}</div>}
            {theirSelected.size > 0 && <div>You receive: {theirSelectedNames.join(", ")}</div>}
          </div>
        )}

        {/* Message */}
        <div style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", display: "block", marginBottom: 8 }}>
            Message (optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Add a note to your proposal..."
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              color: "#e2e8f0", fontSize: 13, resize: "vertical", boxSizing: "border-box",
            }}
          />
        </div>

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
              padding: "12px 24px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.3)",
              background: "transparent", color: "#94a3b8", fontSize: 14,
              textDecoration: "none", lineHeight: "normal", display: "inline-flex", alignItems: "center",
            }}
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
