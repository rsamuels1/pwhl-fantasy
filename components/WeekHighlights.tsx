// components/WeekHighlights.tsx
// Server component — renders auto-generated weekly highlight cards on the league overview.
// No client-side JS; receives pre-fetched Storyline objects as props.

import type { Storyline } from "@/lib/services/storyline-service";

const KIND_COLOR: Record<string, string> = {
  closest_match: "#a78bfa",
  high_score: "#e3c989",
  player_standout: "#5fa98c",
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 10px" }}>
        <span className="section-accent" />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" }}>
          {weekLabel} Highlights
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        {storylines.map((s) => {
          const accentColor = KIND_COLOR[s.kind] ?? "#a78bfa";
          return (
            <div
              key={s.kind}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 16px",
                borderLeft: `3px solid ${accentColor}`,
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                  margin: "0 0 4px",
                  lineHeight: 1.4,
                }}
              >
                {s.headline}
              </p>
              {s.detail && (
                <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{s.detail}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
