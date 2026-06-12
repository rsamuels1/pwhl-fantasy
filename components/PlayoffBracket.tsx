"use client";

import React from "react";
import type { PlayoffBracket as BracketType, BracketMatchup, SeededTeam } from "@/lib/playoffs/brackets";

interface Props {
  bracket: Pick<BracketType, "seededTeams" | "rounds" | "settings" | "currentRound">;
  myTeamId?: string;
}

const ROUND_NAMES: Record<number, Record<number, string>> = {
  2: { 1: "Semifinals", 2: "Championship" },
  3: { 1: "First Round", 2: "Semifinals", 3: "Championship" },
};

function getRoundName(totalRounds: number, round: number): string {
  return ROUND_NAMES[totalRounds]?.[round] ?? `Round ${round}`;
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
        {rounds.map((round, rIdx) => {
          const isCurrentRound = currentRound !== null && (rIdx + 1) === currentRound;
          const isChampionship = rIdx === totalRounds - 1;

          return (
            <div
              key={rIdx}
              style={{
                flex: "0 0 240px",
                borderRadius: 12,
                padding: "12px 8px",
                background: isCurrentRound ? "rgba(99,102,241,0.05)" : "transparent",
                border: isCurrentRound ? "1px solid rgba(99,102,241,0.15)" : "1px solid transparent",
              }}
            >
              {/* Round header */}
              <div style={{
                marginBottom: 14, paddingBottom: 10,
                borderBottom: "1px solid rgba(148,163,184,0.12)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isChampionship ? "#fbbf24" : "#e2e8f0" }}>
                  {isChampionship ? "🏆 " : ""}{getRoundName(totalRounds, rIdx + 1)}
                </div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                  {settings.roundDurationPeriods} week{settings.roundDurationPeriods !== 1 ? "s" : ""}
                  {isCurrentRound && <span style={{ marginLeft: 6, color: "#818cf8", fontWeight: 700 }}>· Active</span>}
                </div>
              </div>

              {/* Matchups */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {round.map((matchup, mIdx) => (
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
      borderRadius: 10,
      border: "1px solid rgba(148,163,184,0.14)",
      overflow: "hidden",
      background: "rgba(255,255,255,0.03)",
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
      background: isWinner ? winBg : isMe ? "rgba(99,102,241,0.06)" : "transparent",
      borderLeft: isWinner ? `3px solid ${winBorder}` : isMe ? "3px solid #6366f1" : "3px solid transparent",
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
        color: isWinner ? (isChampionship ? "#fbbf24" : "#e2e8f0") : isLoser ? "#475569" : isMe ? "#c7d2fe" : "#94a3b8",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {team ? team.teamName : <em style={{ color: "#334155" }}>TBD</em>}
      </span>

      {/* Bye badge */}
      {team?.hasBye && !scored && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
          background: "rgba(99,102,241,0.15)", color: "#818cf8",
        }}>
          BYE
        </span>
      )}

      {/* Score */}
      <span style={{
        fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums", flexShrink: 0,
        color: isWinner ? winColor : isLoser ? "#475569" : "#334155",
      }}>
        {score !== undefined ? score.toFixed(1) : "—"}
      </span>
    </div>
  );
}
