/**
 * Bracket view page
 * /app/league/[leagueId]/bracket/page.tsx
 * 
 * Displays playoff bracket for a league.
 * Shows standings pre-playoff, bracket during/after playoffs.
 */

"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PlayoffBracket from "@/components/PlayoffBracket";

interface Standing {
  fantasyTeamId: string;
  teamName: string;
  points: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  rank: number;
  isPlayoffEligible: boolean;
  seed: number | null;
}

interface BracketData {
  leagueId: string;
  leagueName: string;
  playoffStatus: string;
  standings?: Standing[];
  bracket?: any;
}

export default function BracketPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [data, setData] = useState<BracketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"standings" | "bracket">("standings");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log("Fetching standings for league:", leagueId);

        // Fetch standings
        const standingsRes = await fetch(
          `/api/leagues/${leagueId}/standings`
        );
        console.log("Standings response status:", standingsRes.status);
        
        if (!standingsRes.ok) {
          const errorData = await standingsRes.text();
          console.error("Standings error response:", errorData);
          throw new Error(`Failed to fetch standings: ${standingsRes.status}`);
        }
        const standingsData = await standingsRes.json();
        console.log("Standings data:", standingsData);

        // Try to fetch bracket (may fail if playoffs haven't started)
        let bracketData = null;
        try {
          console.log("Fetching bracket for league:", leagueId);
          const bracketRes = await fetch(
            `/api/leagues/${leagueId}/bracket`
          );
          console.log("Bracket response status:", bracketRes.status);
          
          if (bracketRes.ok) {
            bracketData = await bracketRes.json();
            console.log("Bracket data:", bracketData);
            setActiveTab("bracket");
          } else {
            console.log("Bracket not ready or not found");
          }
        } catch (e) {
          console.error("Error fetching bracket:", e);
          // Bracket not available yet
        }

        setData({
          ...standingsData,
          bracket: bracketData?.bracket,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to load bracket data";
        console.error("Fetch error:", errorMsg);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    if (leagueId) {
      fetchData();
      // Refresh every 30 seconds to update scores
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [leagueId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600">Loading bracket...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">{error || "Failed to load bracket"}</div>
      </div>
    );
  }

  const hasPlayoffStarted = data.playoffStatus !== "NOT_STARTED";

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {data.leagueName}
        </h1>
        <div className="flex items-center gap-4">
          <p className="text-slate-600">
            {hasPlayoffStarted ? "🏆 Playoffs" : "📊 Regular Season"}
          </p>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              hasPlayoffStarted
                ? "bg-green-100 text-green-800"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            {data.playoffStatus || "Not Started"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      {hasPlayoffStarted && data.bracket && (
        <div className="mb-6 border-b border-slate-300 flex gap-4">
          <button
            onClick={() => setActiveTab("standings")}
            className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
              activeTab === "standings"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            Standings
          </button>
          <button
            onClick={() => setActiveTab("bracket")}
            className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
              activeTab === "bracket"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            Bracket
          </button>
        </div>
      )}

      {/* Content */}
      {activeTab === "standings" && data.standings ? (
        <StandingsTable standings={data.standings} />
      ) : data.bracket ? (
        <PlayoffBracket bracket={data.bracket} />
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-600 mb-4">Playoffs have not started yet</p>
          <p className="text-slate-500 text-sm">
            Check back when the regular season ends
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Standings table component
 */
const StandingsTable: React.FC<{ standings: Standing[] }> = ({
  standings,
}) => {
  return (
    <div className="overflow-x-auto shadow-lg rounded-lg">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-800 text-white">
          <tr>
            <th className="px-6 py-4 font-semibold">Rank</th>
            <th className="px-6 py-4 font-semibold">Team</th>
            <th className="px-6 py-4 font-semibold text-right">Points</th>
            <th className="px-6 py-4 font-semibold text-right">W-L-T</th>
            <th className="px-6 py-4 font-semibold text-right">PF</th>
            <th className="px-6 py-4 font-semibold text-right">PA</th>
            <th className="px-6 py-4 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {standings.map((standing) => (
            <tr
              key={standing.fantasyTeamId}
              className={`hover:bg-slate-50 transition-colors ${
                standing.isPlayoffEligible ? "bg-white" : "bg-slate-50"
              }`}
            >
              <td className="px-6 py-4 font-bold text-slate-800">
                {standing.rank}
              </td>
              <td className="px-6 py-4 font-semibold text-slate-900">
                {standing.teamName}
              </td>
              <td className="px-6 py-4 text-right font-bold text-slate-800">
                {standing.points.toFixed(2)}
              </td>
              <td className="px-6 py-4 text-right text-slate-700">
                {standing.wins}-{standing.losses}-{standing.ties}
              </td>
              <td className="px-6 py-4 text-right text-slate-700">
                {standing.pointsFor.toFixed(1)}
              </td>
              <td className="px-6 py-4 text-right text-slate-700">
                {standing.pointsAgainst.toFixed(1)}
              </td>
              <td className="px-6 py-4">
                {standing.isPlayoffEligible ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-green-600"></span>
                    Seed {standing.seed}
                  </span>
                ) : (
                  <span className="text-slate-500 text-xs">Out</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
