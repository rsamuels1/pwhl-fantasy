import React from "react";
import StatChip from "@/components/StatChip";
import type { PlayerMatchupRow } from "@/lib/services/dashboard";

const SLOT_LABELS: Record<string, string> = {
  FORWARD: "F", DEFENSE: "D", GOALIE: "G", UTIL: "UTIL", BENCH: "BN", IR: "IR",
};

export function RosterTable({ players, isMyTeam }: { players: PlayerMatchupRow[]; isMyTeam?: boolean }) {
  if (players.length === 0) {
    return <p style={{ color: "var(--faint)", fontSize: 13, margin: 0 }}>No active players yet.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{
        display: "grid", gridTemplateColumns: "44px 1fr 36px 56px",
        gap: 8, padding: "0 12px 6px",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
        textTransform: "uppercase", color: "var(--faint)",
        borderBottom: "1px solid var(--border)",
        marginBottom: 4,
      }}>
        <span>Slot</span><span>Player</span><span style={{ textAlign: "center" }}>Left</span><span style={{ textAlign: "right" }}>FP</span>
      </div>

      {players.map((p) => {
        const isBench = p.slot === "BENCH" || p.slot === "IR";
        const rowStyle: React.CSSProperties = isBench
          ? { background: "var(--bg-raised)", border: "1px solid var(--surface)", opacity: 0.62, borderRadius: 10, padding: "11px 12px" }
          : isMyTeam
            ? { background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 10, padding: "11px 12px" }
            : { background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 12px" };
        return (
          <div key={p.playerId} style={{ display: "grid", gridTemplateColumns: "44px 1fr 36px 56px", gap: 8, alignItems: "center", ...rowStyle }}>
            <span style={{
              fontSize: 9.5, fontWeight: 700, textAlign: "center",
              padding: "3px 7px", borderRadius: 5,
              background: "rgba(143,193,232,0.6)", color: "var(--accent-ink)",
            }}>
              {SLOT_LABELS[p.slot] ?? p.slot}
            </span>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                </span>
                {p.teamAbbr && <span style={{ fontSize: 10, color: "var(--faint)", flexShrink: 0 }}>{p.teamAbbr}</span>}
                {p.chips?.map((chip) => <StatChip key={chip.type} chip={chip} />)}
              </div>
              {p.statBreakdown.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                  {p.statBreakdown.map((b) => (
                    <span key={b.label} style={{
                      fontSize: 10, padding: "1px 6px", borderRadius: 999,
                      background: b.points >= 0 ? "rgba(95,169,140,0.1)" : "rgba(209,139,127,0.1)",
                      color: b.points >= 0 ? "var(--green)" : "var(--red)",
                    }}>
                      {b.label}{b.stat > 1 ? ` ×${b.stat}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ textAlign: "center" }}>
              {p.gamesThisPeriod !== null ? (
                <span className="font-stats" style={{
                  fontSize: 10, fontWeight: 700,
                  padding: "2px 5px", borderRadius: 4,
                  background: p.gamesThisPeriod === 0 ? "rgba(239,68,68,0.12)" : "var(--accent-dim)",
                  color: p.gamesThisPeriod === 0 ? "var(--red)" : "var(--accent-strong)",
                  border: p.gamesThisPeriod > 0 ? "1px solid var(--accent-border)" : undefined,
                }}>
                  {p.gamesThisPeriod === 0 ? "0" : `${p.gamesThisPeriod}G`}
                </span>
              ) : (
                <span style={{ color: "var(--faint)", fontSize: 10 }}>—</span>
              )}
            </div>

            <div style={{ textAlign: "right" }}>
              <span className="font-stats" style={{ fontSize: 18, fontWeight: 700, color: p.points > 0 ? (isMyTeam ? "var(--muted)" : "var(--text)") : "var(--dim)" }}>
                {p.gameCount === 0 && p.points === 0 ? "—" : p.points.toFixed(1)}
              </span>
            </div>
          </div>
        );
      })}

      <div style={{
        display: "grid", gridTemplateColumns: "44px 1fr 36px 56px",
        gap: 8, padding: "10px 12px 0",
        borderTop: "1px solid var(--border)", marginTop: 2,
      }}>
        <span /><span style={{ fontSize: 12, color: "var(--dim)", fontWeight: 600 }}>Total</span><span />
        <span className="font-stats" style={{ textAlign: "right", fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
          {players.reduce((s, p) => s + p.points, 0).toFixed(1)}
        </span>
      </div>
    </div>
  );
}
