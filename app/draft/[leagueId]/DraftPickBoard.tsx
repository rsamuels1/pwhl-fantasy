"use client";

import { styles } from "./draftStyles";
import type { DraftState } from "@/lib/draft/messages";
import type { PickSlot } from "@/lib/draft/snake";

export function PickBoard({
  draft,
  myTeamId,
  teamNames,
  playerNames,
}: {
  draft: DraftState;
  myTeamId: string;
  teamNames: Record<string, string>;
  playerNames: Record<string, string>;
}) {
  const rounds = new Map<number, PickSlot[]>();
  for (const slot of draft.order) {
    const r = rounds.get(slot.round) ?? [];
    r.push(slot);
    rounds.set(slot.round, r);
  }

  const pickByOverall = new Map(draft.completed.map((p) => [p.overall, p]));

  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}><span className="section-accent" />Pick Board</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
        Pick order reverses each round (snake draft) — so every team gets an early pick.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={styles.table}>
          <tbody>
            {[...rounds.entries()].map(([round, slots]) => (
              <tr key={round}>
                <td style={styles.roundLabel}>R{round}</td>
                {slots.map((slot) => {
                  const pick = pickByOverall.get(slot.overall);
                  const isOnClock =
                    slot.overall === draft.currentOverall && draft.status === "IN_PROGRESS";
                  const isMe = slot.fantasyTeamId === myTeamId;
                  const shortTeam = teamNames[slot.fantasyTeamId]?.split(" ").map((w) => w[0]).join("") ?? "?";
                  const playerLabel = pick
                    ? playerNames[pick.playerId] ?? `…${pick.playerId.slice(-5)}`
                    : null;

                  return (
                    <td
                      key={slot.overall}
                      style={{
                        ...styles.pickCell,
                        background: isOnClock
                          ? "var(--accent-dim)"
                          : pick
                          ? "var(--card)"
                          : "rgba(150,160,200,0.03)",
                        border: isOnClock
                          ? "2px solid var(--accent)"
                          : pick
                          ? "1px solid var(--border)"
                          : "1px solid rgba(150,160,200,0.07)",
                        boxShadow: isOnClock ? "0 0 10px var(--accent-glow)" : "none",
                        opacity: pick && !isMe ? 0.65 : 1,
                      }}
                      title={
                        pick
                          ? `#${pick.overall} ${teamNames[pick.fantasyTeamId] ?? pick.fantasyTeamId}: ${playerNames[pick.playerId] ?? pick.playerId}${pick.auto ? " (auto)" : ""}`
                          : `#${slot.overall} — ${teamNames[slot.fantasyTeamId] ?? slot.fantasyTeamId}`
                      }
                    >
                      <div className="font-stats" style={{ fontSize: 9, color: isOnClock ? "var(--accent-strong)" : "var(--faint)" }}>
                        #{slot.overall}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: isMe ? 700 : 400, color: isOnClock ? "var(--text)" : pick ? "var(--text)" : "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 46 }}>
                        {playerLabel
                          ? playerLabel.split(" ").slice(-1)[0]
                          : isOnClock
                          ? "⏱"
                          : isMe
                          ? shortTeam
                          : "·"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
