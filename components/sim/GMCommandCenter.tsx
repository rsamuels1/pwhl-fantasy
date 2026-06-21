"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FantasyLeague } from "@prisma/client";
import type { SeasonState } from "@/lib/season/lifecycle";
import type { ScoringPeriod } from "@/lib/scoring/periods";
import type { ActivityEvent } from "@/lib/services/activity";
import WeekSetup from "./WeekSetup";
import WeekRecap from "./WeekRecap";
import SeasonComplete from "./SeasonComplete";
import PlayoffsPanel from "./PlayoffsPanel";

interface Matchup {
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
}

interface Props {
  phase: "PRE_SEASON" | "SETUP" | "RECAP" | "SEASON_COMPLETE" | "PLAYOFFS" | "PLAYOFFS_COMPLETE";
  leagueId: string;
  league: FantasyLeague & { name: string };
  state: SeasonState;
  commTeamId?: string;
  commTeamName?: string;
  lastMatchup: Matchup | null;
  nextPeriod: ScoringPeriod | null | undefined;
  activity: ActivityEvent[];
  currentPlayoffRound?: number;
  totalPlayoffRounds?: number;
}

export default function GMCommandCenter({
  phase,
  leagueId,
  league,
  state,
  commTeamId,
  commTeamName,
  lastMatchup,
  nextPeriod,
  activity,
  currentPlayoffRound,
  totalPlayoffRounds,
}: Props) {
  const router = useRouter();
  const [isSimulating, setIsSimulating] = useState(false);

  const activePeriod = state.periods.find((p) => p.status === "ACTIVE")?.period;
  const weekNumber = activePeriod?.week || nextPeriod?.week || 1;
  const totalWeeks = state.periods.length;

  const phaseLabel = {
    PRE_SEASON: "Pre-Season",
    SETUP: "Setup",
    RECAP: "Recap",
    SEASON_COMPLETE: "Season Complete",
    PLAYOFFS: "Playoffs",
    PLAYOFFS_COMPLETE: "Playoffs Complete",
  }[phase];

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/sim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate" }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`API Error ${res.status}:`, errorText);
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
    } catch (error) {
      console.error("Simulation failed:", error);
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSimulating(false);
      router.refresh();
    }
  };

  const handleAdvanceWeek = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/sim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance" }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`API Error ${res.status}:`, errorText);
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
    } catch (error) {
      console.error("Advance failed:", error);
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSimulating(false);
      router.refresh();
    }
  };

  const handleStartSeason = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/sim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`API Error ${res.status}:`, errorText);
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
    } catch (error) {
      console.error("Start season failed:", error);
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSimulating(false);
      router.refresh();
    }
  };

  const handleStartPlayoffs = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/start-playoffs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`API Error ${res.status}:`, errorText);
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
    } catch (error) {
      console.error("Start playoffs failed:", error);
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSimulating(false);
      router.refresh();
    }
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Top breadcrumb */}
      <div style={{ marginBottom: 32, display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {league.name} — GM Command Center
        </h1>
        <div
          style={{
            fontSize: 13,
            color: "#94a3b8",
            padding: "4px 12px",
            background: "rgba(148, 163, 184, 0.1)",
            borderRadius: 4,
          }}
        >
          Week {weekNumber} of {totalWeeks} · {phaseLabel}
        </div>
      </div>

      {/* Simulating overlay */}
      {isSimulating && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#1e1e2e",
              padding: "32px 40px",
              borderRadius: 12,
              textAlign: "center",
              border: "1px solid rgba(148, 163, 184, 0.2)",
            }}
          >
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              {phase === "SETUP" ? "Simulating Week..." : "Starting Week..."}
            </p>
            <div
              style={{
                width: 40,
                height: 40,
                border: "3px solid rgba(148, 163, 184, 0.2)",
                borderTopColor: "#a5b4fc",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto",
              }}
            />
          </div>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Phase-specific content */}
      {phase === "PRE_SEASON" && (
        <div
          style={{
            background: "rgba(99, 102, 241, 0.1)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>
            Ready to Start the Season?
          </h2>
          <p style={{ color: "#94a3b8", marginBottom: 24 }}>
            Click below to begin Week 1 of the {state.totalWeeks}-week regular season.
          </p>
          <button
            onClick={handleStartSeason}
            disabled={isSimulating}
            style={{
              padding: "12px 24px",
              background: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              opacity: isSimulating ? 0.6 : 1,
            }}
          >
            ▶ Start Season
          </button>
        </div>
      )}

      {phase === "SETUP" && activePeriod && (
        <WeekSetup
          leagueId={leagueId}
          period={activePeriod}
          weekNumber={weekNumber}
          commTeamId={commTeamId}
          commTeamName={commTeamName}
          onSimulate={handleSimulate}
          isSimulating={isSimulating}
        />
      )}

      {phase === "RECAP" && lastMatchup && nextPeriod && (
        <WeekRecap
          leagueId={leagueId}
          lastMatchup={lastMatchup}
          commTeamId={commTeamId}
          commTeamName={commTeamName}
          nextWeek={nextPeriod.week}
          activity={activity}
          onAdvanceWeek={handleAdvanceWeek}
          isSimulating={isSimulating}
        />
      )}

      {phase === "SEASON_COMPLETE" && (
        <SeasonComplete
          leagueId={leagueId}
          commTeamName={commTeamName}
          onStartPlayoffs={handleStartPlayoffs}
          isSimulating={isSimulating}
        />
      )}

      {phase === "PLAYOFFS" && (
        <PlayoffsPanel
          leagueId={leagueId}
          currentRound={currentPlayoffRound}
          totalRounds={totalPlayoffRounds}
        />
      )}

      {phase === "PLAYOFFS_COMPLETE" && (
        <div
          style={{
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>
            🏆 Season Champions Crowned!
          </h2>
          <p style={{ color: "#94a3b8", marginBottom: 24 }}>
            The playoff tournament is complete. View the final bracket and standings.
          </p>
          <a
            href={`/league/${leagueId}/bracket`}
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "#22c55e",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            View Final Bracket →
          </a>
        </div>
      )}
    </div>
  );
}
