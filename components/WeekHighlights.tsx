// components/WeekHighlights.tsx
// Server component — renders auto-generated weekly highlight cards and award cards.
// Award cards include a tappable ⓘ (InfoTooltip) and, for negative awards, a recovery CTA.

import type { Storyline } from "@/lib/services/storyline-service";
import type { WeeklyAward } from "@/lib/services/storyline-service";
import { getAwardCopy, resolveRecoveryLink } from "@/lib/copy/living-league-glossary";
import InfoTooltip from "@/components/InfoTooltip";
import Link from "next/link";

const KIND_COLOR: Record<string, string> = {
  closest_match: "#a78bfa",
  high_score: "#e3c989",
  player_standout: "#5fa98c",
};

const AWARD_COLOR: Record<string, string> = {
  ice_cold_closer: "#e3c989",
  heater: "#fb923c",
  heartbreaker: "#f87171",
  collapse: "#f87171",
  frozen_stick: "#94a3b8",
};

export default function WeekHighlights({
  storylines,
  weekLabel,
  awards = [],
  showNegativeAwards = true,
  teamId,
}: {
  storylines: Storyline[];
  weekLabel: string;
  awards?: WeeklyAward[];
  showNegativeAwards?: boolean;
  teamId?: string;
}) {
  const visibleAwards = showNegativeAwards
    ? awards
    : awards.filter((a) => !getAwardCopy(a.awardType).isNegative);

  if (storylines.length === 0 && visibleAwards.length === 0) return null;

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 10px" }}>
        <span className="section-accent" />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--dim)",
          }}
        >
          {weekLabel} Highlights
        </span>
      </div>

      {/* Existing storyline cards */}
      {storylines.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 10,
            marginBottom: visibleAwards.length > 0 ? 18 : 0,
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
      )}

      {/* Weekly awards */}
      {visibleAwards.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 8px" }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--dim)",
              }}
            >
              Awards
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 10,
            }}
          >
            {visibleAwards.map((award) => {
              const copy = getAwardCopy(award.awardType);
              const accentColor = AWARD_COLOR[award.awardType] ?? "#a78bfa";
              const recoveryLink =
                copy.recoveryLink && teamId
                  ? resolveRecoveryLink(copy, teamId)
                  : undefined;

              return (
                <div
                  key={award.awardType}
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "14px 16px",
                    borderLeft: `3px solid ${accentColor}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 4,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: accentColor,
                          margin: "0 0 2px",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {copy.icon} {copy.label}
                      </p>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--text)",
                          margin: 0,
                          lineHeight: 1.4,
                        }}
                      >
                        {award.teamName}
                      </p>
                      {recoveryLink && (
                        <Link
                          href={recoveryLink}
                          style={{
                            display: "inline-block",
                            marginTop: 6,
                            fontSize: 11,
                            color: "var(--accent)",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          {copy.recoveryLabel ?? "View →"}
                        </Link>
                      )}
                    </div>
                    <InfoTooltip text={copy.explainer} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
