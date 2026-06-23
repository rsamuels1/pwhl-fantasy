import Link from "next/link";

export const metadata = { title: "League Rules — PWHL GM" };

export default function LeagueRulesPage() {
  return (
    <main style={{
      maxWidth: 720,
      margin: "0 auto",
      padding: "48px 24px 80px",
      color: "var(--text)",
    }}>
      <Link href="/" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>
        ← Back
      </Link>

      <h1 style={{ fontSize: 32, fontWeight: 800, margin: "24px 0 8px", color: "var(--text)" }}>
        League Rules
      </h1>
      <p style={{ fontSize: 15, color: "var(--muted)", margin: "0 0 40px", lineHeight: 1.6 }}>
        Everything you need to know about how PWHL GM works.
      </p>

      {/* VP Scoring */}
      <section style={section}>
        <h2 style={h2}>Victory Points (VP)</h2>
        <p style={body}>
          Standings are decided by <strong>Victory Points</strong>, not wins alone. Each week you can earn up to <strong>4 VP</strong>:
        </p>
        <div style={ruleGrid}>
          <RuleRow label="Win your matchup" value="+2 VP" />
          <RuleRow label="Tie your matchup" value="+1 VP" />
          <RuleRow label="Highest fantasy score in the league" value="+2 VP bonus" />
          <RuleRow label="Second-highest fantasy score" value="+1 VP bonus" />
        </div>
        <p style={{ ...body, marginTop: 16 }}>
          Your weekly <strong>fantasy points (FP)</strong> total determines whether you win your matchup. Winning earns VP for the season standings. A team that loses every matchup but dominates FP totals can still finish near the top.
        </p>
      </section>

      {/* Scoring */}
      <section style={section}>
        <h2 style={h2}>Fantasy Point Scoring</h2>
        <p style={body}>Standard scoring for skaters and goalies:</p>
        <div style={ruleGrid}>
          <RuleRow label="Goal" value="3 FP" />
          <RuleRow label="Assist" value="2 FP" />
          <RuleRow label="Power play point" value="+1 FP" />
          <RuleRow label="Shot on goal" value="0.3 FP" />
          <RuleRow label="Hit" value="0.5 FP" />
          <RuleRow label="Blocked shot" value="0.5 FP" />
          <RuleRow label="Goalie win" value="5 FP" />
          <RuleRow label="Save" value="0.2 FP" />
          <RuleRow label="Goal against" value="-1 FP" />
          <RuleRow label="Shutout" value="+3 FP" />
        </div>
      </section>

      {/* Roster */}
      <section style={section}>
        <h2 style={h2}>Roster Format</h2>
        <p style={body}>Each team has <strong>13 roster slots</strong>, all filled during the draft:</p>
        <div style={ruleGrid}>
          <RuleRow label="Forwards (F)" value="3 slots" />
          <RuleRow label="Defense (D)" value="2 slots" />
          <RuleRow label="Goalie (G)" value="1 slot" />
          <RuleRow label="Utility — any skater (UTIL)" value="1 slot" />
          <RuleRow label="Bench" value="6 slots" />
        </div>
        <p style={{ ...body, marginTop: 16 }}>
          Only players in active slots (F, D, G, UTIL) score fantasy points each week. Bench players don't score but can be swapped in before games start.
        </p>
        <p style={{ ...body, marginTop: 8 }}>
          <strong>Lineup lock:</strong> once a player's real PWHL team plays any game in the current scoring week, that player is locked for the rest of the week. You can't bench someone after they've already contributed.
        </p>
      </section>

      {/* Format */}
      <section style={section}>
        <h2 style={h2}>Season Format</h2>
        <div style={ruleGrid}>
          <RuleRow label="Draft type" value="Snake draft" />
          <RuleRow label="Matchup format" value="Weekly head-to-head" />
          <RuleRow label="Scoring period" value="Monday – Sunday" />
          <RuleRow label="Playoffs" value="Top 4 teams, single elimination" />
          <RuleRow label="Playoff format" value="1 vs 4 · 2 vs 3 in round 1" />
          <RuleRow label="Tiebreaker" value="Higher seed wins" />
        </div>
      </section>

      {/* Replay */}
      <section style={{ ...section, borderBottom: "none" }}>
        <h2 style={h2}>What's a Replay League?</h2>
        <p style={body}>
          A <strong>replay league</strong> uses real PWHL stats from a completed season (2025-26) instead of waiting for the live 2026-27 season. All player stats, game results, and matchup outcomes are pre-determined — you're drafting and managing lineups, but the underlying scores come from real games that already happened.
        </p>
        <p style={{ ...body, marginTop: 12 }}>
          Replay leagues are perfect for:
        </p>
        <ul style={{ ...body, margin: "8px 0 0 20px", padding: 0, lineHeight: 2 }}>
          <li>Learning fantasy sports before the live season starts</li>
          <li>Testing strategies with historical data</li>
          <li>Playing with friends during the offseason</li>
        </ul>
        <p style={{ ...body, marginTop: 12 }}>
          The rules, roster format, and VP scoring are identical to a live league — only the data source differs.
        </p>
      </section>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
        <Link href="/create-league" style={{
          display: "inline-block",
          background: "var(--accent)",
          color: "var(--accent-ink)",
          fontWeight: 700,
          fontSize: 14,
          padding: "10px 22px",
          borderRadius: 8,
          textDecoration: "none",
        }}>
          Start a league →
        </Link>
      </div>
    </main>
  );
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 14px",
      background: "var(--bg-raised)",
      borderRadius: 8,
      gap: 16,
    }}>
      <span style={{ fontSize: 14, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

const section: React.CSSProperties = {
  marginBottom: 40,
  paddingBottom: 40,
  borderBottom: "1px solid var(--border)",
};

const h2: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "var(--text)",
  margin: "0 0 16px",
};

const body: React.CSSProperties = {
  fontSize: 14,
  color: "var(--dim)",
  lineHeight: 1.65,
  margin: 0,
};

const ruleGrid: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};
