"use client";

import { styles } from "./draftStyles";
import type { DraftState } from "@/lib/draft/messages";

const SLOT_LABELS: Record<string, string> = {
  forward: "Forward",
  defense: "Defense",
  goalie: "Goalie",
  util: "Flex (any skater)",
  bench: "Bench",
  ir: "IR",
};

function simulateSlotFill(
  picks: Array<{ playerId: string }>,
  positions: Record<string, string>,
  settings: Record<string, number>
): Record<string, number> {
  const caps = { ...settings };
  const filled: Record<string, number> = Object.fromEntries(
    Object.keys(caps).map((k) => [k, 0])
  );
  for (const pick of picks) {
    const pos = positions[pick.playerId]?.toLowerCase() ?? "";
    if (pos === "forward" && (filled.forward ?? 0) < (caps.forward ?? 0)) {
      filled.forward = (filled.forward ?? 0) + 1;
    } else if (pos === "defense" && (filled.defense ?? 0) < (caps.defense ?? 0)) {
      filled.defense = (filled.defense ?? 0) + 1;
    } else if (pos === "goalie" && (filled.goalie ?? 0) < (caps.goalie ?? 0)) {
      filled.goalie = (filled.goalie ?? 0) + 1;
    } else if (pos !== "goalie" && (filled.util ?? 0) < (caps.util ?? 0)) {
      filled.util = (filled.util ?? 0) + 1;
    } else {
      filled.bench = (filled.bench ?? 0) + 1;
    }
  }
  return filled;
}

export function TeamSpreadPanel({
  draft,
  myTeamId,
  playerTeams,
}: {
  draft: DraftState;
  myTeamId: string;
  playerTeams: Record<string, string | null>;
}) {
  const myPicks = draft.completed.filter((p) => p.fantasyTeamId === myTeamId);
  const counts: Record<string, number> = {};
  for (const pick of myPicks) {
    const team = playerTeams[pick.playerId] ?? "—";
    counts[team] = (counts[team] ?? 0) + 1;
  }
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}><span className="section-accent" />Team Spread</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, lineHeight: 1.5 }}>
        High concentration from one team increases injury/absence risk.
        <br />
        <span style={{ color: "var(--green)" }}>Green</span> = 1–2 players (fine) · <span style={{ color: "var(--amber)" }}>Amber</span> = 3 players (some risk) · <span style={{ color: "var(--clock-warn)" }}>Red</span> = 4+ players (high risk)
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>No picks yet</div>
      ) : (
        rows.map(([team, count]) => {
          const isHigh = count >= 4;
          const isMid = count === 3;
          const barColor = isHigh ? "var(--clock-warn)" : isMid ? "var(--amber)" : "var(--green)";
          const barBg = isHigh ? "rgba(249,115,22,0.18)" : isMid ? "rgba(245,201,123,0.14)" : "rgba(81,216,138,0.12)";
          const countColor = isHigh ? "var(--clock-warn)" : isMid ? "var(--amber)" : "var(--text)";
          const maxCount = rows[0][1];
          const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
          return (
            <div key={team} style={{ padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 3 }}>
                <span style={{ flex: 1, color: "var(--text)" }}>{team}</span>
                <span className="font-stats" style={{ fontWeight: 700, color: countColor }}>{count}</span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 2, transition: "width 0.3s", boxShadow: `0 0 4px ${barBg}` }} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export function NeedsPanel({
  draft,
  myTeamId,
  rosterSettings,
  playerPositions,
}: {
  draft: DraftState;
  myTeamId: string;
  rosterSettings: Record<string, number>;
  playerPositions: Record<string, string>;
}) {
  const myPicks = draft.completed.filter((p) => p.fantasyTeamId === myTeamId);

  const filled = simulateSlotFill(myPicks, playerPositions, rosterSettings);

  const draftSlots = Object.entries(rosterSettings)
    .filter(([k]) => k !== "ir")
    .reduce((s, [, n]) => s + n, 0);
  const totalDrafted = myPicks.length;

  const draftableSlots = Object.entries(rosterSettings).filter(([k]) => k !== "ir");

  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}><span className="section-accent" />Roster Needs</div>
      <div style={{ marginBottom: 8, fontSize: 12, color: "var(--muted)" }}>
        {totalDrafted} / {draftSlots} picks made
      </div>
      {draftableSlots.map(([slot, need]) => {
        const have = filled[slot] ?? 0;
        const remaining = Math.max(0, need - have);
        const done = remaining === 0;
        const critical = !done && remaining <= 1;
        const pct = need > 0 ? Math.min(100, Math.round((have / need) * 100)) : 0;
        const barColor = done ? "var(--green)" : have > 0 ? "var(--accent-strong)" : "var(--gold)";
        const rowBg = done
          ? "rgba(81,216,138,0.07)"
          : critical
          ? "rgba(245,201,123,0.06)"
          : "rgba(150,160,200,0.03)";
        const countColor = done ? "var(--green)" : critical ? "var(--gold)" : "var(--muted)";
        return (
          <div key={slot} style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: rowBg, fontSize: 12 }}>
              <span className="font-stats" style={{ flex: 1, fontSize: 14, fontWeight: 600, color: done ? "var(--green)" : critical ? "var(--gold)" : "var(--text)" }}>
                {SLOT_LABELS[slot] ?? slot}
              </span>
              <span style={{ color: countColor, fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
                {have}/{need}
              </span>
              {done && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
              )}
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(150,160,200,0.10)", overflow: "hidden", marginTop: 3, marginLeft: 10, marginRight: 10 }}>
              <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3, transition: "width 0.3s" }} />
            </div>
          </div>
        );
      })}
      {(rosterSettings.ir ?? 0) > 0 && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
          +{rosterSettings.ir} IR slot{rosterSettings.ir > 1 ? "s" : ""} (fill from waivers)
        </div>
      )}
    </div>
  );
}
