// components/WeekHighlights.tsx
// Server component — renders auto-generated weekly highlight cards on the league overview.
// No client-side JS; receives pre-fetched Storyline objects as props.

import type { Storyline } from "@/lib/services/storyline-service";

const ICONS: Record<string, string> = {
  closest_match: "⚡",
  high_score: "🔥",
  player_standout: "⭐",
};

export default function WeekHighlights({
  storylines,
  weekLabel,
}: {
  storylines: Storyline[];
  weekLabel: string;
}) {
  if (storylines.length === 0) return null;
  return (
    <section>
      <h2
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#475569",
          margin: "0 0 10px",
        }}
      >
        {weekLabel} Highlights
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        {storylines.map((s) => (
          <div
            key={s.kind}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(148,163,184,0.14)",
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>{ICONS[s.kind] ?? "•"}</div>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#e2e8f0",
                margin: "0 0 4px",
                lineHeight: 1.4,
              }}
            >
              {s.headline}
            </p>
            {s.detail && (
              <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{s.detail}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
