export default function BracketLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: "100vw" }}>
      {/* Header skeleton */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ height: 32, width: 180, background: "rgba(148,163,184,0.12)", borderRadius: 8, animation: "pulse 2s infinite" }} />
        <div style={{ height: 24, width: 80, background: "rgba(148,163,184,0.08)", borderRadius: 20, animation: "pulse 2s infinite" }} />
      </div>

      {/* Bracket skeleton - 2-3 column layout */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 20, padding: 20, display: "flex", gap: 20, overflowX: "auto" }}>
        {Array.from({ length: 2 }).map((_, roundIdx) => (
          <div key={roundIdx} style={{ flex: "0 0 220px", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Round label */}
            <div style={{ height: 16, width: 120, background: "rgba(148,163,184,0.12)", borderRadius: 4, animation: "pulse 2s infinite" }} />
            {/* Matchup cards */}
            {Array.from({ length: 2 }).map((_, matchupIdx) => (
              <div key={matchupIdx} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.06)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ height: 14, width: "100%", background: "rgba(148,163,184,0.12)", borderRadius: 3, animation: "pulse 2s infinite" }} />
                <div style={{ height: 12, width: "80%", background: "rgba(148,163,184,0.08)", borderRadius: 2, animation: "pulse 2s infinite" }} />
                <div style={{ height: 14, width: "100%", background: "rgba(148,163,184,0.12)", borderRadius: 3, animation: "pulse 2s infinite" }} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
