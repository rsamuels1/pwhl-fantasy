"use client";

import React from "react";
import type { PlayoffBracket as BracketType, BracketMatchup, SeededTeam } from "@/lib/playoffs/brackets";

interface Props {
  bracket: Pick<BracketType, "seededTeams" | "rounds" | "settings" | "currentRound">;
}

const ROUND_NAMES: Record<number, Record<number, string>> = {
  2: { 1: "Semifinals", 2: "Championship" },
  3: { 1: "First Round", 2: "Semifinals", 3: "Finals" },
};

function getRoundName(totalRounds: number, round: number): string {
  return ROUND_NAMES[totalRounds]?.[round] ?? `Round ${round}`;
}

export default function PlayoffBracket({ bracket }: Props) {
  const { rounds, settings } = bracket;
  const totalRounds = rounds.length;

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{
        display: "flex",
        gap: 16,
        minWidth: `${totalRounds * 260}px`,
        paddingBottom: 4,
      }}>
        {rounds.map((round, rIdx) => (
          <div key={rIdx} style={{ flex: "0 0 240px" }}>
            {/* Round header */}
            <div style={{
              marginBottom: 16, paddingBottom: 10,
              borderBottom: "1px solid rgba(148,163,184,0.15)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
                {getRoundName(totalRounds, rIdx + 1)}
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                {settings.roundDurationPeriods} week{settings.roundDurationPeriods !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Matchups */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {round.map((matchup, mIdx) => (
                <BracketMatchupCard key={mIdx} matchup={matchup} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatchupCard({ matchup }: { matchup: BracketMatchup }) {
  const scored = matchup.homeScore !== undefined && matchup.awayScore !== undefined;
  return (
    <div style={{
      borderRadius: 12,
      border: "1px solid rgba(148,163,184,0.14)",
      overflow: "hidden",
      background: "rgba(255,255,255,0.03)",
    }}>
      <TeamRow team={matchup.homeTeam} score={matchup.homeScore} winner={matchup.winner} scored={scored} />
      <div style={{ height: 1, background: "rgba(148,163,184,0.08)" }} />
      <TeamRow team={matchup.awayTeam} score={matchup.awayScore} winner={matchup.winner} scored={scored} />
    </div>
  );
}

function TeamRow({
  team, score, winner, scored,
}: {
  team: SeededTeam | null | undefined;
  score: number | undefined;
  winner: SeededTeam | undefined;
  scored: boolean;
}) {
  const isWinner = scored && winner && team && winner.fantasyTeamId === team.fantasyTeamId;
  const isLoser = scored && winner && team && winner.fantasyTeamId !== team.fantasyTeamId;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 12px",
      background: isWinner ? "rgba(52,211,153,0.06)" : "transparent",
      borderLeft: isWinner ? "3px solid #34d399" : "3px solid transparent",
    }}>
      {/* Seed badge */}
      <span style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 800,
        background: "rgba(148,163,184,0.1)",
        color: "#64748b",
      }}>
        {team?.seed ?? "?"}
      </span>

      {/* Name */}
      <span style={{
        flex: 1, fontSize: 13, fontWeight: isWinner ? 700 : 500,
        color: isWinner ? "#e2e8f0" : isLoser ? "#475569" : "#94a3b8",
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
        color: isWinner ? "#34d399" : isLoser ? "#475569" : "#334155",
      }}>
        {score !== undefined ? score.toFixed(1) : "—"}
      </span>
    </div>
  );
}
