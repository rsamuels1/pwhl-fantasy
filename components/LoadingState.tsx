interface LoadingStateProps {
  label?: string;
  rows?: number;
}

export default function LoadingState({ label = "Loading…", rows = 4 }: LoadingStateProps) {
  return (
    <div style={{ padding: "32px 24px", maxWidth: 800, margin: "0 auto" }}>
      <style>{`
        @keyframes pwhl-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .loading-pulse { animation: pwhl-pulse 1.6s ease-in-out infinite; }
      `}</style>
      <div
        className="loading-pulse"
        style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}
      >
        {label}
      </div>
      <div className="loading-pulse" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ height: 28, borderRadius: 8, background: "var(--panel)", width: "55%" }} />
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 14,
              borderRadius: 6,
              background: "var(--panel)",
              width: `${85 - i * 8}%`,
              opacity: 1 - i * 0.12,
            }}
          />
        ))}
      </div>
    </div>
  );
}
