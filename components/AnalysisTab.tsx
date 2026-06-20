"use client";

import { useParams } from "next/navigation";
import type { TeamAnalysis, PlayerTrend, PositionGroupRow, FaUpgradeCard } from "@/lib/services/analysis-service";

// ── Trend pill ────────────────────────────────────────────────────────────────

const TREND_STYLES: Record<PlayerTrend["trend"], { bg: string; color: string; label: string }> = {
  hot: { bg: "rgba(52,211,153,0.12)", color: "#34d399", label: "Hot" },
  cold: { bg: "rgba(248,113,113,0.12)", color: "#f87171", label: "Cold" },
  "on-track": { bg: "rgba(148,163,184,0.1)", color: "#94a3b8", label: "On Track" },
  new: { bg: "rgba(99,102,241,0.12)", color: "#818cf8", label: "New" },
};

function TrendPill({ trend }: { trend: PlayerTrend["trend"] }) {
  const s = TREND_STYLES[trend];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
      background: s.bg, color: s.color, whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
}

// ── Player Trends section ─────────────────────────────────────────────────────

function PlayerTrendsSection({
  trends,
  labels,
}: {
  trends: PlayerTrend[];
  labels: string[];
}) {
  if (trends.length === 0) {
    return (
      <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>No active roster players found.</p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#475569" }}>
            <th style={{ textAlign: "left", padding: "0 0 8px", minWidth: 130 }}>Player</th>
            <th style={{ textAlign: "center", padding: "0 6px 8px", minWidth: 50 }}>Pos</th>
            <th style={{ textAlign: "center", padding: "0 6px 8px", minWidth: 70 }}>Trend</th>
            {labels.map((lbl) => (
              <th key={lbl} style={{ textAlign: "right", padding: "0 6px 8px", minWidth: 48 }}>{lbl}</th>
            ))}
            <th style={{ textAlign: "right", padding: "0 0 8px", minWidth: 56 }}>Avg</th>
            <th style={{ textAlign: "right", padding: "0 0 8px", minWidth: 56 }}>Season</th>
          </tr>
        </thead>
        <tbody>
          {trends.map((t, i) => (
            <tr key={t.playerId} style={{
              borderTop: i === 0 ? "1px solid rgba(148,163,184,0.08)" : "1px solid rgba(148,163,184,0.05)",
            }}>
              <td style={{ padding: "9px 0 9px", color: "#e2e8f0", fontWeight: 600 }}>
                {t.playerName}
              </td>
              <td style={{ textAlign: "center", padding: "9px 6px" }}>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: t.position === "FORWARD" ? "#60a5fa" : t.position === "DEFENSE" ? "#34d399" : "#f59e0b",
                }}>
                  {t.position[0]}
                </span>
              </td>
              <td style={{ textAlign: "center", padding: "9px 6px" }}>
                <TrendPill trend={t.trend} />
              </td>
              {t.weeklyFp.map((fp, wi) => (
                <td key={wi} style={{ textAlign: "right", padding: "9px 6px", fontVariantNumeric: "tabular-nums" }}>
                  {fp !== null ? (
                    <span style={{ color: fp > 0 ? "#e2e8f0" : "#475569" }}>{fp.toFixed(1)}</span>
                  ) : (
                    <span style={{ color: "#334155" }}>—</span>
                  )}
                </td>
              ))}
              <td style={{ textAlign: "right", padding: "9px 0", fontWeight: 700, color: "#a5b4fc", fontVariantNumeric: "tabular-nums" }}>
                {t.recentFpPerGame.toFixed(1)}
              </td>
              <td style={{ textAlign: "right", padding: "9px 0", color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                {t.seasonFpPerGame.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Position Groups section ───────────────────────────────────────────────────

function PositionGroupsSection({
  groups,
  labels,
}: {
  groups: PositionGroupRow[];
  labels: string[];
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#475569" }}>
            <th style={{ textAlign: "left", padding: "0 0 8px", minWidth: 90 }}>Group</th>
            {labels.map((lbl) => (
              <th key={lbl} style={{ textAlign: "right", padding: "0 6px 8px", minWidth: 52 }}>{lbl}</th>
            ))}
            <th style={{ textAlign: "right", padding: "0 0 8px", minWidth: 48 }}>Avg</th>
            <th style={{ textAlign: "right", padding: "0 0 8px", minWidth: 80 }}>vs Median</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => {
            const myVals = g.myWeeklyFp.filter((v): v is number => v !== null);
            const myAvg = myVals.length > 0 ? myVals.reduce((s, v) => s + v, 0) / myVals.length : 0;
            const medVals = g.leagueMedianWeeklyFp.filter((v): v is number => v !== null);
            const medAvg = medVals.length > 0 ? medVals.reduce((s, v) => s + v, 0) / medVals.length : 0;
            const diff = myAvg - medAvg;
            const diffColor = diff >= 0 ? "#34d399" : "#f87171";

            return (
              <tr key={g.group} style={{
                borderTop: i === 0 ? "1px solid rgba(148,163,184,0.08)" : "1px solid rgba(148,163,184,0.05)",
                borderLeft: g.isWeakest ? "3px solid rgba(245,158,11,0.5)" : "3px solid transparent",
              }}>
                <td style={{ padding: "9px 0 9px 6px", color: "#e2e8f0", fontWeight: 600 }}>
                  {g.group}
                  {g.isWeakest && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>WEAK</span>
                  )}
                </td>
                {g.myWeeklyFp.map((fp, wi) => (
                  <td key={wi} style={{ textAlign: "right", padding: "9px 6px", fontVariantNumeric: "tabular-nums" }}>
                    {fp !== null ? (
                      <span style={{ color: "#e2e8f0" }}>{fp.toFixed(1)}</span>
                    ) : (
                      <span style={{ color: "#334155" }}>—</span>
                    )}
                  </td>
                ))}
                <td style={{ textAlign: "right", padding: "9px 0", fontWeight: 700, color: "#a5b4fc", fontVariantNumeric: "tabular-nums" }}>
                  {myAvg.toFixed(1)}
                </td>
                <td style={{ textAlign: "right", padding: "9px 0", fontWeight: 700, color: diffColor, fontVariantNumeric: "tabular-nums" }}>
                  {diff >= 0 ? "+" : ""}{diff.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ fontSize: 11, color: "#475569", margin: "8px 0 0", lineHeight: 1.5 }}>
        Amber border = weakest group. "vs Median" compares your group average to the league median.
      </p>
    </div>
  );
}

// ── FA Upgrade cards ──────────────────────────────────────────────────────────

function FaUpgradeSection({
  upgrades,
  teamId,
  weakestGroup,
}: {
  upgrades: FaUpgradeCard[];
  teamId: string;
  weakestGroup: string | undefined;
}) {
  if (upgrades.length === 0) {
    return (
      <div style={{
        background: "rgba(99,102,241,0.06)",
        border: "1px solid rgba(99,102,241,0.15)",
        borderRadius: 12, padding: "14px 16px",
      }}>
        <p style={{ fontWeight: 600, color: "#a5b4fc", fontSize: 14, margin: "0 0 4px" }}>
          Your {weakestGroup} group looks solid.
        </p>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          The top available {weakestGroup?.toLowerCase()} aren&apos;t a clear upgrade over your
          current starters. Check back after the next scored week or{" "}
          <a href={`/team/${teamId}/roster`} style={{ color: "#818cf8" }}>
            browse the free agent pool
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {upgrades.map((u, i) => (
        <div key={i} style={{
          background: "rgba(99,102,241,0.06)",
          border: "1px solid rgba(99,102,241,0.15)",
          borderRadius: 12, padding: "14px 16px",
          display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, color: "#a5b4fc", fontSize: 14 }}>
                {u.candidate.playerName}
              </span>
              <span style={{ fontSize: 11, color: "#64748b" }}>{u.candidate.position[0]}</span>
              <span style={{ fontSize: 12, color: "#34d399", fontWeight: 600 }}>
                {u.candidate.projectedFpPerGame.toFixed(1)} FP/gm
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Drop{" "}
              <span style={{ color: "#f87171", fontWeight: 600 }}>{u.suggestedDrop.playerName}</span>
              {" "}({u.suggestedDrop.recentFpPerGame.toFixed(1)} FP/gm recent)
            </div>
          </div>
          <a
            href={`/team/${teamId}/roster`}
            style={{
              fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
              background: "rgba(99,102,241,0.15)", color: "#818cf8",
              border: "1px solid rgba(99,102,241,0.3)", textDecoration: "none", flexShrink: 0,
            }}
          >
            View →
          </a>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnalysisTab({ analysis }: { analysis: TeamAnalysis | null }) {
  const params = useParams();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";

  if (!analysis) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted, #64748b)" }}>
        <p style={{ margin: 0 }}>Analysis data unavailable. Try refreshing the page.</p>
      </div>
    );
  }

  if (!analysis.hasEnoughHistory) {
    return (
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(148,163,184,0.14)",
        borderRadius: 20, padding: 24,
        textAlign: "center",
      }}>
        <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
          Not enough scored weeks yet — check back after week 2.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 0 }}>
      {/* Section 1 — Player Trends */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(148,163,184,0.14)",
        borderRadius: 20, padding: 20,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "#e2e8f0" }}>
          Player Trends
        </h2>
        <PlayerTrendsSection
          trends={analysis.playerTrends}
          labels={analysis.scoredWeekLabels}
        />
      </div>

      <hr style={{ margin: "1.5rem 0", opacity: 0.15 }} />

      {/* Section 2 — Position Groups */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(148,163,184,0.14)",
        borderRadius: 20, padding: 20,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "#e2e8f0" }}>
          Position Groups
        </h2>
        <PositionGroupsSection
          groups={analysis.positionGroups}
          labels={analysis.scoredWeekLabels}
        />
      </div>

      {/* Section 3 — FA Upgrades (always shown when there's a weakest group) */}
      {(() => {
        const weakestGroup = analysis.positionGroups.find((g) => g.isWeakest)?.group;
        if (!weakestGroup) return null;
        return (
          <>
            <hr style={{ margin: "1.5rem 0", opacity: 0.15 }} />
            <div style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(148,163,184,0.14)",
              borderRadius: 20, padding: 20,
            }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "#e2e8f0" }}>
                FA Upgrade Suggestions
              </h2>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px" }}>
                Top free agents for your weakest group ({weakestGroup}).
              </p>
              <FaUpgradeSection
                upgrades={analysis.faUpgrades}
                teamId={teamId}
                weakestGroup={weakestGroup}
              />
            </div>
          </>
        );
      })()}
    </div>
  );
}
