import Link from "next/link";
import type { ActiveMatchup } from "@/lib/services/dashboard";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 16, padding: "18px 20px",
    }}>
      {children}
    </div>
  );
}

export function RosterStatusWidget({
  matchup,
  activeSlotCount,
  teamId,
}: {
  matchup: ActiveMatchup;
  activeSlotCount: number;
  teamId: string;
}) {
  const starters = matchup.myPlayers.filter((p) => p.slot !== "BENCH" && p.slot !== "IR");
  const lockedCount = starters.filter((p) => p.gameCount > 0).length;
  const filledCount = starters.length;
  const hasIssues = filledCount < activeSlotCount;
  const isUpcoming = matchup.status === "upcoming";

  const statusLabel = hasIssues
    ? `⚠ ${filledCount}/${activeSlotCount} starters set`
    : `✓ ${filledCount}/${activeSlotCount} starters`;
  const statusColor = hasIssues ? "var(--gold)" : "var(--green)";
  const projColor = hasIssues ? "var(--gold)" : "var(--accent)";

  return (
    <Card>
      <h2 className="section-title" style={{ marginBottom: 14 }}>Roster status</h2>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>
          Projected FP
        </div>
        <div className="font-stats" style={{ fontSize: 36, fontWeight: 700, color: projColor, lineHeight: 1 }}>
          {matchup.myProjected.toFixed(1)}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--dim)", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, color: statusColor }}>{statusLabel}</span>
        <span>·</span>
        <span>
          {lockedCount > 0 ? `🔒 ${lockedCount} locked` : isUpcoming ? "Not yet locked" : "0 locked"}
        </span>
        {matchup.opponentTeam && matchup.opponentProjected > 0 && (
          <>
            <span>·</span>
            <span>Opp. {matchup.opponentProjected.toFixed(1)} FP</span>
          </>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        <Link href={`/team/${teamId}/lineup`} style={{
          display: "block", textAlign: "center",
          fontSize: 13, fontWeight: 700, padding: "9px 0", borderRadius: 10,
          background: "rgba(143,193,232,0.12)", color: "var(--accent-strong)",
          border: "1px solid rgba(143,193,232,0.25)", textDecoration: "none",
        }}>
          Adjust lineup →
        </Link>
      </div>
    </Card>
  );
}
