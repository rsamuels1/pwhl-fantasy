"use client";

import type { ActivityEvent } from "@/lib/services/activity";

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
  leagueId: string;
  lastMatchup: Matchup;
  commTeamId?: string;
  commTeamName?: string;
  nextWeek: number;
  activity: ActivityEvent[];
  onAdvanceWeek: () => void;
  isSimulating: boolean;
}

export default function WeekRecap({
  leagueId,
  lastMatchup,
  commTeamId,
  commTeamName,
  nextWeek,
  activity,
  onAdvanceWeek,
  isSimulating,
}: Props) {
  const isHome = lastMatchup.homeTeamId === commTeamId;
  const myScore = isHome ? lastMatchup.homeScore : lastMatchup.awayScore;
  const oppScore = isHome ? lastMatchup.awayScore : lastMatchup.homeScore;
  const result = myScore !== null && oppScore !== null
    ? myScore > oppScore
      ? "WIN"
      : myScore < oppScore
        ? "LOSS"
        : "TIE"
    : "FINAL";

  const resultColor =
    result === "WIN" ? "#10b981" : result === "LOSS" ? "#ef4444" : "#f59e0b";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, marginBottom: 24 }}>
      {/* Left: Results and recap */}
      <div>
        {/* Hero card */}
        <div
          style={{
            background: "rgba(30, 30, 46, 0.5)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 52,
              fontWeight: 900,
              margin: "0 0 16px 0",
              color: resultColor,
            }}
          >
            {result}
          </h2>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 24 }}>
            <div>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, marginBottom: 4 }}>
                {commTeamName}
              </p>
              <p style={{ fontSize: 40, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
                {myScore}
              </p>
            </div>
            <div style={{ fontSize: 20, color: "#64748b", alignSelf: "center" }}>—</div>
            <div>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, marginBottom: 4 }}>
                vs. Field
              </p>
              <p style={{ fontSize: 40, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
                {oppScore}
              </p>
            </div>
          </div>
          <p
            style={{
              fontSize: 13,
              color: resultColor,
              fontWeight: 600,
              margin: 0,
            }}
          >
            {result === "WIN"
              ? "You dominated this week! 🔥"
              : result === "LOSS"
                ? "Better luck next week."
                : "A tie this week."}
          </p>
        </div>

        {/* League activity */}
        <div
          style={{
            background: "rgba(30, 30, 46, 0.5)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 12, color: "#cbd5e1" }}>
            This Week's Highlights
          </h3>
          {activity.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activity.slice(0, 5).map((event, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 13,
                    color: "#94a3b8",
                    padding: "8px 0",
                    borderBottom:
                      i < Math.min(5, activity.length) - 1
                        ? "1px solid rgba(148, 163, 184, 0.1)"
                        : "none",
                  }}
                >
                  📰 Activity event {event.id}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              No major highlights this week.
            </p>
          )}
        </div>
      </div>

      {/* Right: Next week button + info */}
      <div>
        <button
          onClick={onAdvanceWeek}
          disabled={isSimulating}
          style={{
            width: "100%",
            padding: "16px 20px",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 700,
            cursor: isSimulating ? "wait" : "pointer",
            opacity: isSimulating ? 0.7 : 1,
            marginBottom: 16,
          }}
        >
          ▶ Start Week {nextWeek}
        </button>

        <div
          style={{
            background: "rgba(30, 30, 46, 0.5)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 0, marginBottom: 12, color: "#cbd5e1" }}>
            Next Steps
          </h3>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>
            <p style={{ margin: "0 0 8px 0" }}>✅ Week {lastMatchup.week} is complete</p>
            <p style={{ margin: "0 0 8px 0" }}>⏳ Click the button to begin Week {nextWeek}</p>
            <p style={{ margin: 0 }}>📝 You'll be able to adjust your lineup when Week {nextWeek} starts</p>
          </div>
        </div>
      </div>
    </div>
  );
}
