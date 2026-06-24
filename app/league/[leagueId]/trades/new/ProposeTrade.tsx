"use client";
// ProposeTrade.tsx — 4-step wizard: Pick partner → Send → Receive → Review & Send

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
  /** When provided, success navigation uses /team/[teamId]/trades routes */
  teamId?: string;
}

const POS_ORDER: Record<string, number> = { FORWARD: 0, DEFENSE: 1, GOALIE: 2 };
const STEPS = ["Partner", "Send", "Receive", "Review"];

// ── Progress bar ────────────────────────────────────────────────────────────────
function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} style={{ flex: 1 }}>
            <div style={{
              height: 4, borderRadius: 3,
              background: done
                ? "var(--accent)"
                : active
                ? "rgba(143,193,232,0.5)"
                : "var(--surface)",
              transition: "background 0.2s",
            }} />
            <div style={{
              marginTop: 5, fontSize: 11, fontWeight: active || done ? 600 : 400,
              color: active ? "var(--accent-strong)" : done ? "var(--dim)" : "var(--faint)",
            }}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Player row ────────────────────────────────────────────────────────────────
function PlayerRow({
  player,
  selected,
  onToggle,
}: {
  player: PlayerOption;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "10px 12px", borderRadius: 8, marginBottom: 3,
        background: selected ? "rgba(143,193,232,0.15)" : "var(--bg-raised)",
        border: selected ? "1px solid rgba(143,193,232,0.45)" : "1px solid var(--surface)",
        cursor: "pointer", color: selected ? "var(--accent-strong)" : "var(--text)", textAlign: "left",
        transition: "all 0.1s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {selected && (
          <span style={{
            width: 18, height: 18, borderRadius: 4, display: "flex", alignItems: "center",
            justifyContent: "center", background: "var(--accent)", fontSize: 11, color: "var(--accent-ink)", flexShrink: 0,
          }}>✓</span>
        )}
        {!selected && (
          <span style={{
            width: 18, height: 18, borderRadius: 4, border: "1px solid var(--border)", flexShrink: 0,
          }} />
        )}
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{player.name}</div>
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 1 }}>{player.position}</div>
        </div>
      </div>
      {player.fp > 0 && (
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--faint)", flexShrink: 0 }}>
          {player.fp} FP
        </span>
      )}
    </button>
  );
}

// ── Roster picker panel ───────────────────────────────────────────────────────
function RosterPicker({
  players,
  selected,
  onToggle,
  heading,
}: {
  players: PlayerOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  heading: string;
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
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
          {heading}
        </div>
        {selected.size > 0 && (
          <div style={{ fontSize: 12, color: "var(--accent-strong)", fontWeight: 600 }}>
            {selected.size} selected
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "8px 11px", borderRadius: 8,
            background: "var(--surface)", border: "1px solid var(--border)",
            color: "var(--text)", fontSize: 13,
          }}
        />
        <button
          type="button"
          onClick={() => setSortBy((s) => (s === "fp" ? "pos" : "fp"))}
          style={{
            padding: "8px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer",
            background: "var(--surface)", border: "1px solid var(--border)",
            color: "var(--dim)", whiteSpace: "nowrap",
          }}
        >
          {sortBy === "fp" ? "↓ FP" : "↓ Pos"}
        </button>
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ color: "var(--faint)", fontSize: 13, padding: 8 }}>No players found.</div>
        ) : (
          filtered.map((p) => (
            <PlayerRow
              key={p.playerId}
              player={p}
              selected={selected.has(p.playerId)}
              onToggle={() => onToggle(p.playerId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProposeTrade({
  leagueId,
  myTeamId,
  myRoster,
  myTeamName,
  leaguePlayers,
  preselectedTeamId,
  counterOfId,
  teamId,
}: Props) {
  const router = useRouter();
  const tradeBase = teamId ? `/team/${teamId}/trades` : `/league/${leagueId}/trades`;

  // Derive partner teams list
  const partnerTeams = [...new Set(leaguePlayers.map((p) => p.teamId))].map((tid) => ({
    teamId: tid,
    teamName: leaguePlayers.find((p) => p.teamId === tid)?.teamName ?? tid,
  }));

  const [step, setStep] = useState(preselectedTeamId ? 1 : 0);
  const [partnerTeamId, setPartnerTeamId] = useState<string | null>(preselectedTeamId);
  const [mySelected, setMySelected] = useState<Set<string>>(new Set());
  const [theirSelected, setTheirSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const partnerName = partnerTeamId
    ? leaguePlayers.find((p) => p.teamId === partnerTeamId)?.teamName ?? "Partner"
    : "";
  const partnerPlayers = partnerTeamId ? leaguePlayers.filter((p) => p.teamId === partnerTeamId) : [];

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

  function canProceedToStep(s: number): boolean {
    if (s === 1) return partnerTeamId !== null;
    if (s === 2) return mySelected.size > 0;
    if (s === 3) return theirSelected.size > 0;
    return true;
  }

  async function handleSubmit() {
    if (!partnerTeamId || mySelected.size === 0 || theirSelected.size === 0) return;
    setError(null);

    const items = [
      ...[...mySelected].map((playerId) => ({
        fromTeamId: myTeamId,
        toTeamId: partnerTeamId,
        playerId,
      })),
      ...[...theirSelected].map((playerId) => ({
        fromTeamId: partnerTeamId,
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
          receivingTeamId: partnerTeamId,
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
        router.push(tradeId ? `${tradeBase}/${tradeId}` : tradeBase);
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
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          {counterOfId ? "Counter Offer" : "Propose Trade"}
        </h1>
        {partnerTeamId && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--dim)" }}>
            With <strong style={{ color: "var(--text)" }}>{partnerName}</strong>
          </p>
        )}
      </div>

      <ProgressBar step={step} />

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#f87171", fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {/* ── Step 0: Pick partner ── */}
      {step === 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
            Who do you want to trade with?
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {partnerTeams.map(({ teamId: tid, teamName }) => (
              <button
                key={tid}
                type="button"
                onClick={() => { setPartnerTeamId(tid); setStep(1); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "13px 16px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                  background: partnerTeamId === tid ? "rgba(143,193,232,0.12)" : "var(--bg-raised)",
                  border: partnerTeamId === tid ? "1px solid rgba(143,193,232,0.4)" : "1px solid var(--border)",
                  color: partnerTeamId === tid ? "var(--accent-strong)" : "var(--text)",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14 }}>{teamName}</span>
                <span style={{ fontSize: 12, color: "var(--faint)" }}>
                  {leaguePlayers.filter((p) => p.teamId === tid).length} players →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 1: Select players to give ── */}
      {step === 1 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
          <RosterPicker
            players={myRoster}
            selected={mySelected}
            onToggle={toggleMyPlayer}
            heading={`${myTeamName} gives`}
          />
        </div>
      )}

      {/* ── Step 2: Select players to receive ── */}
      {step === 2 && partnerTeamId && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
          <RosterPicker
            players={partnerPlayers}
            selected={theirSelected}
            onToggle={toggleTheirPlayer}
            heading={`${partnerName} gives`}
          />
        </div>
      )}

      {/* ── Step 3: Review + Send ── */}
      {step === 3 && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Trade summary */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
              Trade Summary
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--faint)", marginBottom: 8 }}>
                  {myTeamName} gives
                </div>
                {mySelectedNames.map((name, i) => (
                  <div key={i} style={{ fontSize: 13, color: "var(--text)", padding: "5px 0", borderBottom: "1px solid var(--surface)" }}>
                    {name}
                  </div>
                ))}
              </div>
              <div style={{ color: "var(--faint)", fontSize: 20, paddingTop: 20 }}>⇄</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--faint)", marginBottom: 8 }}>
                  {partnerName} gives
                </div>
                {theirSelectedNames.map((name, i) => (
                  <div key={i} style={{ fontSize: 13, color: "var(--text)", padding: "5px 0", borderBottom: "1px solid var(--surface)" }}>
                    {name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Optional message */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 8 }}>
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
                background: "var(--surface)", border: "1px solid var(--border)",
                color: "var(--text)", fontSize: 13, resize: "vertical", boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      )}

      {/* ── Navigation buttons ── */}
      <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            style={{
              padding: "11px 20px", borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", color: "var(--dim)", fontSize: 14, cursor: "pointer",
            }}
          >
            ← Back
          </button>
        )}

        {step < 3 && (
          <button
            type="button"
            onClick={() => canProceedToStep(step + 1) && setStep((s) => s + 1)}
            disabled={!canProceedToStep(step + 1)}
            style={{
              padding: "11px 24px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 600,
              background: canProceedToStep(step + 1) ? "rgba(143,193,232,0.85)" : "rgba(143,193,232,0.25)",
              color: canProceedToStep(step + 1) ? "var(--accent-ink)" : "var(--faint)",
              cursor: canProceedToStep(step + 1) ? "pointer" : "not-allowed",
            }}
          >
            Next →
          </button>
        )}

        {step === 3 && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            style={{
              padding: "11px 24px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 600,
              background: "rgba(143,193,232,0.85)", color: "var(--accent-ink)",
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Sending..." : counterOfId ? "Send Counter Offer" : "Send Trade Proposal"}
          </button>
        )}

        <a
          href={tradeBase}
          style={{
            padding: "11px 20px", borderRadius: 8, border: "1px solid var(--border)",
            background: "transparent", color: "var(--faint)", fontSize: 14,
            textDecoration: "none", lineHeight: "normal", display: "inline-flex", alignItems: "center",
          }}
        >
          Cancel
        </a>
      </div>
    </div>
  );
}
