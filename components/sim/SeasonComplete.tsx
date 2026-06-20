"use client";

interface Props {
  leagueId: string;
  commTeamName?: string;
  onStartPlayoffs: () => void;
  isSimulating: boolean;
}

export default function SeasonComplete({
  leagueId,
  commTeamName,
  onStartPlayoffs,
  isSimulating,
}: Props) {
  return (
    <div
      style={{
        background: "rgba(30, 30, 46, 0.5)",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        borderRadius: 12,
        padding: 40,
        textAlign: "center",
      }}
    >
      <h2 style={{ fontSize: 32, fontWeight: 700, marginTop: 0, marginBottom: 16, color: "#e2e8f0" }}>
        🏁 Regular Season Complete
      </h2>

      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 16, color: "#94a3b8", marginBottom: 8 }}>
          The regular season has concluded. You finished your final matchup!
        </p>
        <p style={{ fontSize: 14, color: "#64748b" }}>
          Check the standings to see final rankings and playoff seeding.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        <div
          style={{
            background: "rgba(99, 102, 241, 0.1)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <p style={{ fontSize: 12, color: "#a5b4fc", fontWeight: 600, marginTop: 0, marginBottom: 8 }}>
            FINAL STANDINGS
          </p>
          <p style={{ fontSize: 14, color: "#cbd5e1", margin: 0 }}>
            View the final regular season standings and playoff bracket setup.
          </p>
        </div>

        <div
          style={{
            background: "rgba(52, 211, 153, 0.1)",
            border: "1px solid rgba(52, 211, 153, 0.2)",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <p style={{ fontSize: 12, color: "#34d399", fontWeight: 600, marginTop: 0, marginBottom: 8 }}>
            PLAYOFFS READY
          </p>
          <p style={{ fontSize: 14, color: "#cbd5e1", margin: 0 }}>
            The top 4 teams are seeded and ready. Begin the playoff tournament now.
          </p>
        </div>
      </div>

      <button
        onClick={onStartPlayoffs}
        disabled={isSimulating}
        style={{
          padding: "16px 32px",
          background: isSimulating ? "#6366f1" : "#6366f1",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 700,
          cursor: isSimulating ? "wait" : "pointer",
          opacity: isSimulating ? 0.7 : 1,
          marginBottom: 16,
        }}
      >
        ▶ Start Playoffs
      </button>

      <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
        After playoffs begin, navigate to{" "}
        <span style={{ color: "#a5b4fc", fontWeight: 600 }}>Bracket</span> to advance through the rounds.
      </p>
    </div>
  );
}
