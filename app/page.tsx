import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import QuickDraftJoinForm from "@/components/QuickDraftJoinForm";

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 80, paddingBottom: 80 }}>

      {/* ── 1. Hero ──────────────────────────────────────────────────────────── */}
      <section style={{ textAlign: "center", padding: "64px 16px 0" }}>
        {/* Eyebrow pill */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(124,58,237,0.14)", border: "1px solid rgba(124,58,237,0.30)", marginBottom: 24 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#c9b6ff", letterSpacing: "0.06em" }}>Fantasy hockey for the PWHL</span>
        </div>

        <h1 className="hero-title" style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", fontWeight: 900, letterSpacing: "-0.03em" }}>
          Think Like a GM.
        </h1>
        <p className="hero-text" style={{ maxWidth: 560, margin: "24px auto 0", textAlign: "center" }}>
          Don&apos;t just draft a team — run a front office. Build rosters, set lineups, work the wire, and make the calls that win championships in the Professional Women&apos;s Hockey League.
        </p>
        {/* Trust strip */}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 20 }}>
          <span style={{ fontSize: 13, color: "#6f788e" }}><span style={{ color: "#22c55e", marginRight: 4 }}>✓</span>Free to play</span>
          <span style={{ fontSize: 13, color: "#6f788e" }}><span style={{ color: "#22c55e", marginRight: 4 }}>✓</span>No gambling, pure strategy</span>
        </div>
        <div className="hero-actions" style={{ justifyContent: "center", marginTop: 36 }}>
          <Link href="/create-league" className="button-primary">Start your franchise →</Link>
          <Link href="/join-league" className="button-secondary">Join a league</Link>
        </div>
      </section>

      {/* ── 2. Featured Players ──────────────────────────────────────────────── */}
      <section className="page-width">
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={sectionHeading}>Draft PWHL Stars</h2>
          <p style={sectionSub}>Build your team around the biggest names in women&apos;s hockey.</p>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
        }}>
          {PLAYERS.map((p) => (
            <div key={p.name} style={playerCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 7px", borderRadius: 5,
                  background: `${POS_COLORS[p.pos]}20`, color: POS_COLORS[p.pos],
                }}>{p.pos}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>{p.team}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0", lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>Last season</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#7c3aed", marginTop: 2 }}>{p.fpts}</div>
              <div style={{ fontSize: 11, color: "#475569" }}>pts</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. How It Works ──────────────────────────────────────────────────── */}
      <section className="page-width">
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h2 style={sectionHeading}>How it works</h2>
        </div>
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 0,
          justifyContent: "center", alignItems: "flex-start",
        }}>
          {STEPS.map((step, i) => (
            <div key={step.label} style={{ display: "flex", alignItems: "flex-start", flexShrink: 0 }}>
              <div style={{ textAlign: "center", maxWidth: 180, padding: "0 16px" }}>
                <div style={{
                  fontSize: 40, fontWeight: 900, lineHeight: 1,
                  color: "rgba(124,58,237,0.25)", marginBottom: 12,
                }}>{i + 1}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>{step.label}</div>
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{step.desc}</div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  fontSize: 22, color: "rgba(124,58,237,0.3)",
                  paddingTop: 8, flexShrink: 0, alignSelf: "flex-start",
                }}>→</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Matchup Demo ──────────────────────────────────────────────────── */}
      <section className="page-width">
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={sectionHeading}>Follow every game with something on the line</h2>
          <p style={sectionSub}>
            Win by one point. Steal a waiver pickup. Build a championship roster.
          </p>
        </div>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={demoCard}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: 20 }}>
              Week 7 · Head to Head
            </div>

            {/* Scores */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Your Team</div>
                <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color: "#e2e8f0" }}>112.4</div>
              </div>
              <div style={{ fontSize: 16, color: "#475569", fontWeight: 700 }}>vs</div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Opponents</div>
                <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color: "#64748b" }}>108.7</div>
              </div>
            </div>

            {/* Win probability bar */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: "#a78bfa" }}>Your Team 67%</span>
                <span style={{ color: "#64748b" }}>33% Opponents</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: "67%", borderRadius: 4, background: "linear-gradient(90deg, #7c3aed, #a78bfa)" }} />
              </div>
            </div>

            {/* Top performers */}
            <div style={{ marginTop: 20, borderTop: "1px solid rgba(148,163,184,0.1)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: 4 }}>Top performers</div>
              {[{ name: "Taylor Heise", pts: "+18.5" }, { name: "Sarah Fillier", pts: "+15.2" }].map((p) => (
                <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, color: "#cbd5e1" }}>{p.name}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#34d399" }}>{p.pts} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Feature Highlights ────────────────────────────────────────────── */}
      <section className="page-width">
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={sectionHeading}>Everything you need to compete</h2>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <strong>Live snake draft</strong>
            <span className="panel-text">Real draft room with a clock, queue, and board. Build your roster pick by pick.</span>
          </div>
          <div className="stat-card">
            <strong>Build your roster</strong>
            <span className="panel-text">Forwards, defense, goalies, bench and utility. Real PWHL depth, real decisions.</span>
          </div>
          <div className="stat-card">
            <strong>Set your weekly lineup</strong>
            <span className="panel-text">Start the right skaters, ride the hot goalie, and lock in before puck drop.</span>
          </div>
          <div className="stat-card">
            <strong>Trades &amp; the waiver wire</strong>
            <span className="panel-text">Negotiate deals, claim breakouts off waivers, and out-maneuver your league.</span>
          </div>
          <div className="stat-card">
            <strong>Standings &amp; playoffs</strong>
            <span className="panel-text">Climb the table on Victory Points, clinch a seed, and chase a championship banner.</span>
          </div>
          <div className="stat-card">
            <strong>Commissioner tools</strong>
            <span className="panel-text">Run your league your way — scoring, schedule, rules and approvals.</span>
          </div>
        </div>
      </section>

      {/* ── 6. Commissioner Section ──────────────────────────────────────────── */}
      <section className="page-width">
        <div style={{
          border: "1px dashed rgba(148,163,184,0.2)",
          borderRadius: 20, padding: "32px 28px",
          display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "start",
        }}
        className="commissioner-grid"
        >
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 10px", color: "#e2e8f0" }}>Running a league?</h2>
            <p style={{ color: "#64748b", margin: 0, lineHeight: 1.7 }}>
              Set up your draft, invite teams, and manage settings from the admin panel.
              Already have a league and team ID? Jump straight into the draft room.
            </p>
          </div>
          <div style={{ minWidth: 260 }}>
            <QuickDraftJoinForm />
          </div>
        </div>
      </section>

      {/* ── 7. Final CTA ─────────────────────────────────────────────────────── */}
      <section style={{ textAlign: "center", padding: "0 16px" }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "#e2e8f0" }}>
          Your franchise is waiting.
        </h2>
        <p style={{ color: "#64748b", marginBottom: 32 }}>
          Start a league with friends or join a public one. Draft tonight, compete all season.
        </p>
        <div className="hero-actions" style={{ justifyContent: "center" }}>
          <Link href="/create-league" className="button-primary">Start your franchise →</Link>
          <Link href="/join-league" className="button-secondary">Join a league</Link>
        </div>
        <p style={{ marginTop: 20, fontSize: 14 }}>
          <Link href="/login" style={{ color: "#64748b" }}>Already have an account? Log in →</Link>
        </p>
      </section>

    </main>
  );
}

// ── Static data ──────────────────────────────────────────────────────────────

const PLAYERS = [
  { name: "Marie-Philip Poulin", pos: "F", team: "MTL", fpts: 312 },
  { name: "Sarah Fillier",       pos: "F", team: "NY",  fpts: 287 },
  { name: "Taylor Heise",        pos: "F", team: "MIN", fpts: 264 },
  { name: "Hilary Knight",       pos: "F", team: "BOS", fpts: 251 },
  { name: "Natalie Spooner",     pos: "F", team: "TOR", fpts: 238 },
] as const;

const POS_COLORS: Record<string, string> = {
  F: "#60a5fa", D: "#34d399", G: "#f59e0b",
};

const STEPS = [
  { label: "Form Your League",    desc: "Invite up to 12 friends and set your draft date." },
  { label: "Scout & Draft",       desc: "Pick real PWHL stars in a live snake draft." },
  { label: "Manage Your Roster",  desc: "Swap players each week to maximize your score." },
  { label: "Lead Your Franchise", desc: "Outscore your opponent using real game stats." },
];

// ── Shared styles ─────────────────────────────────────────────────────────────

const sectionHeading: React.CSSProperties = {
  fontSize: "clamp(1.5rem, 3vw, 2rem)",
  fontWeight: 800,
  margin: 0,
  color: "#e2e8f0",
};

const sectionSub: React.CSSProperties = {
  color: "#64748b",
  marginTop: 10,
  marginBottom: 0,
  fontSize: "1rem",
  lineHeight: 1.7,
};

const playerCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.12)",
  borderRadius: 16,
  padding: "18px 16px",
};

const demoCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 20,
  padding: "28px 24px",
};
