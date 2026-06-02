/**
 * PlayoffBracket component
 * 
 * Renders a single-elimination playoff bracket in a tree layout.
 * Displays seeding, team names, scores, and winner indicators.
 */

"use client";

import React from "react";
import { PlayoffBracket as BracketType } from "@/lib/playoffs/brackets";

interface PlayoffBracketProps {
  bracket: BracketType;
}

export const PlayoffBracket: React.FC<PlayoffBracketProps> = ({ bracket }) => {
  const { seededTeams, rounds, settings } = bracket;
  const totalRounds = rounds.length;

  // Get round name
  const getRoundName = (round: number): string => {
    if (totalRounds === 2) {
      return round === 1 ? "Finals" : "Championship";
    } else if (totalRounds === 3) {
      return round === 1 ? "First Round" : round === 2 ? "Semifinals" : "Finals";
    } else {
      return `Round ${round}`;
    }
  };

  return (
    <div className="w-full overflow-x-auto bg-gradient-to-b from-slate-50 to-slate-100 rounded-lg shadow-lg p-6">
      <div className="min-w-full flex gap-8" style={{ minWidth: `${totalRounds * 350}px` }}>
        {rounds.map((round, roundIndex) => (
          <div key={roundIndex} className="flex-shrink-0 w-80">
            {/* Round header */}
            <div className="mb-6 pb-4 border-b-2 border-slate-300">
              <h3 className="text-lg font-bold text-slate-800">
                {getRoundName(roundIndex + 1)}
              </h3>
              <p className="text-sm text-slate-600">
                {round.length} matchup{round.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Matchups */}
            <div className="space-y-8">
              {round.map((matchup, matchupIndex) => (
                <div
                  key={matchupIndex}
                  className="border-2 border-slate-300 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
                >
                  {/* Home team */}
                  {matchup.homeTeam ? (
                    <MatchupTeam
                      team={matchup.homeTeam}
                      score={matchup.homeScore ?? undefined}
                      isWinner={
                        matchup.winner?.fantasyTeamId ===
                        matchup.homeTeam?.fantasyTeamId
                      }
                      seed={matchup.homeTeam.seed}
                    />
                  ) : (
                    <div className="px-4 py-3 bg-slate-100 text-slate-500 italic">
                      TBD
                    </div>
                  )}

                  {/* Score separator */}
                  <div className="h-1 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200"></div>

                  {/* Away team */}
                  {matchup.awayTeam ? (
                    <MatchupTeam
                      team={matchup.awayTeam}
                      score={matchup.awayScore ?? undefined}
                      isWinner={
                        matchup.winner?.fantasyTeamId ===
                        matchup.awayTeam?.fantasyTeamId
                      }
                      seed={matchup.awayTeam.seed}
                    />
                  ) : (
                    <div className="px-4 py-3 bg-slate-100 text-slate-500 italic">
                      TBD
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-8 pt-6 border-t-2 border-slate-300 flex flex-wrap gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded"></div>
          <span className="text-slate-700">Winner</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 border-2 border-blue-500 rounded"></div>
          <span className="text-slate-700">Bye</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-600">Matches: {settings.roundDurationPeriods} period(s)</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Single team row in a matchup
 */
interface MatchupTeamProps {
  team: {
    fantasyTeamId: string;
    teamName: string;
    seed: number;
    hasBye: boolean;
  };
  score?: number;
  isWinner: boolean;
  seed: number;
}

const MatchupTeam: React.FC<MatchupTeamProps> = ({
  team,
  score,
  isWinner,
  seed,
}) => {
  const bgClass = isWinner ? "bg-green-50" : "bg-white";
  const borderClass = isWinner ? "border-l-4 border-green-500" : "";

  return (
    <div className={`px-4 py-3 ${bgClass} ${borderClass} flex items-center justify-between`}>
      <div className="flex items-center gap-3 flex-grow">
        {/* Seed badge */}
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm">
          {seed}
        </div>

        {/* Team name */}
        <div className="flex-grow">
          <p
            className={`font-semibold truncate ${
              isWinner ? "text-green-700" : "text-slate-800"
            }`}
          >
            {team.teamName}
          </p>
          {team.hasBye && (
            <p className="text-xs text-blue-600 font-medium">First Round Bye</p>
          )}
        </div>
      </div>

      {/* Score */}
      {score !== undefined ? (
        <div
          className={`text-xl font-bold ml-4 px-3 py-1 rounded ${
            isWinner
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {score.toFixed(2)}
        </div>
      ) : (
        <div className="text-slate-400 ml-4">—</div>
      )}
    </div>
  );
};

export default PlayoffBracket;
