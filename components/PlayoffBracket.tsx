"use client";

import React from "react";
import type { PlayoffBracket as BracketType, BracketMatchup, SeededTeam } from "@/lib/playoffs/brackets";
import { getRoundLabel } from "@/lib/playoffs/brackets";

interface Props {
  bracket: Pick<BracketType, "seededTeams" | "rounds" | "settings" | "currentRound">;
  myTeamId?: string;
}

function seedStyle(seed: number | null | undefined): React.CSSProperties {
  if (seed === 1) return { background: "rgba(251,191,36,0.2)", color: "#fbbf24" };
  if (seed === 2) return { background: "rgba(148,163,184,0.15)", color: "#94a3b8" };
  return { background: "rgba(100,116,139,0.1)", color: "#64748b" };
}

export default function PlayoffBracket({ bracket, myTeamId }: Props) {
  const { rounds, settings, currentRound } = bracket;
  const totalRounds = rounds.length;

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{
        display: "flex",
        gap: 12,
        minWidth: `${totalRounds * 260}px`,
        padding: "16px 16px 8px",
      }}>
        {rounds.map((round: BracketMatchup[], rIdx: number) => {
          const isCurrentRound = currentRound !== null && (rIdx + 1) === currentRound;
          const isChampionship = rIdx === totalRounds - 1;

          return (
            <div
              key={rIdx}
              style={{
                flex: "0 0 240px",
                borderRadius: 12,
                padding: "12px 8px",
                background: isCurrentRound ? "var(--accent-dim)" : "transparent",
                border: isCurrentRound ? "1px solid var(--accent-border)" : "1px solid transparent",
              }}
            >
              {/* Round header */}
              <div style={{
                marginBottom: 14, paddingBottom: 10,
                borderBottom: "1px solid var(--border)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: isChampionship ? "#fbbf24" : "var(--dim)" }}>
                  {isChampionship ? "🏆 " : ""}{getRoundLabel(rIdx + 1, totalRounds)}
                </div>
                <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>
                  {settings.roundDurationPeriods} week{settings.roundDurationPeriods !== 1 ? "s" : ""}
                  {isCurrentRound && <span style={{ marginLeft: 6, color: "#c9b6ff", fontWeight: 700 }}>· Active</span>}
                </div>
              </div>

              {/* Matchups */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {round.map((matchup: BracketMatchup, mIdx: number) => (
                  <BracketMatchupCard
                    key={mIdx}
                    matchup={matchup}
                    myTeamId={myTeamId}
                    isChampionship={isChampionship}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketMatchupCard({
  matchup,
  myTeamId,
  isChampionship,
}: {
  matchup: BracketMatchup;
  myTeamId?: string;
  isChampionship: boolean;
}) {
  const scored = matchup.homeScore !== undefined && matchup.awayScore !== undefined;
  return (
    <div style={{
      borderRadius: 12,
      border: "1px solid var(--border)",
      overflow: "hidden",
      background: "var(--card)",
    }}>
      <TeamRow team={matchup.homeTeam} score={matchup.homeScore} winner={matchup.winner} scored={scored} myTeamId={myTeamId} isChampionship={isChampionship} />
      <div style={{ height: 1, background: "rgba(148,163,184,0.08)" }} />
      <TeamRow team={matchup.awayTeam} score={matchup.awayScore} winner={matchup.winner} scored={scored} myTeamId={myTeamId} isChampionship={isChampionship} />
    </div>
  );
}

function TeamRow({
  team, score, winner, scored, myTeamId, isChampionship,
}: {
  team: SeededTeam | null | undefined;
  score: number | undefined;
  winner: SeededTeam | undefined;
  scored: boolean;
  myTeamId?: string;
  isChampionship: boolean;
}) {
  const isWinner = scored && winner && team && winner.fantasyTeamId === team.fantasyTeamId;
  const isLoser = scored && winner && team && winner.fantasyTeamId !== team.fantasyTeamId;
  const isMe = !!myTeamId && !!team && team.fantasyTeamId === myTeamId;

  const winColor = isChampionship ? "#fbbf24" : "#34d399";
  const winBg = isChampionship ? "rgba(251,191,36,0.07)" : "rgba(52,211,153,0.06)";
  const winBorder = isChampionship ? "#fbbf24" : "#34d399";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 12px",
      background: isWinner ? winBg : isMe ? "var(--accent-dim)" : "transparent",
      borderLeft: isWinner ? `2px solid ${winBorder}` : isMe ? "2px solid var(--accent)" : "2px solid transparent",
    }}>
      {/* Seed badge */}
      <span style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 800,
        ...seedStyle(team?.seed),
      }}>
        {team?.seed ?? "?"}
      </span>

      {/* Name */}
      <span style={{
        flex: 1, fontSize: 13, fontWeight: isWinner ? 700 : isMe ? 600 : 500,
        color: isWinner ? (isChampionship ? "#fbbf24" : "var(--text)") : isLoser ? "var(--faint)" : isMe ? "#c9b6ff" : "var(--muted)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {team ? team.teamName : <em style={{ color: "var(--dim)" }}>TBD</em>}
      </span>

      {/* Bye badge */}
      {team?.hasBye && !scored && (
        <span className="chip-in" style={{ fontSize: 9 }}>BYE</span>
      )}

      {/* Score */}
      <span className="font-stats" style={{
        fontSize: 14, fontWeight: 800, flexShrink: 0,
        color: isWinner ? winColor : isLoser ? "var(--faint)" : "var(--dim)",
      }}>
        {score !== undefined ? score.toFixed(1) : "—"}
      </span>
    </div>
  );
}
