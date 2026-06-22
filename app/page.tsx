import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import React from "react";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main style={{ display: "flex", flexDirection: "column" }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1240, margin: "0 auto", width: "100%",
        padding: "62px 36px 24px",
        display: "grid", gridTemplateColumns: "1.05fr 0.95fr",
        gap: 54, alignItems: "center",
      }}>
        {/* Left col */}
        <div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const,
            color: "#c9b6ff", background: "rgba(124,58,237,0.14)",
            border: "1px solid rgba(124,58,237,0.30)", borderRadius: 30, padding: "7px 14px",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", flexShrink: 0 }} />
            Fantasy hockey for the PWHL
          </span>

          <h1 style={{
            fontSize: 64, lineHeight: 0.98, fontWeight: 900,
            letterSpacing: "-0.03em", margin: "22px 0 0", color: "#f6f7fb",
          }}>
            Think Like<br />a GM.
          </h1>

          <p style={{
            fontSize: 17, lineHeight: 1.6, color: "#aab2c8",
            maxWidth: 480, margin: "20px 0 0",
          }}>
            Don&apos;t just draft a team — run a front office. Build rosters, set lineups,
            work the wire, and make the calls that win championships in the Professional
            Women&apos;s Hockey League.
          </p>

          <div style={{ display: "flex", gap: 13, alignItems: "center", marginTop: 30, flexWrap: "wrap" as const }}>
            <Link href="/register" style={{
              background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff",
              padding: "14px 24px", borderRadius: 11, fontSize: 15, fontWeight: 700,
              display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none",
            }}>
              Start your franchise
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
              </svg>
            </Link>
            <Link href="/join-league" style={{
              background: "rgba(150,160,200,0.06)", border: "1px solid rgba(150,160,200,0.18)",
              color: "#e7eaf3", padding: "14px 22px", borderRadius: 11, fontSize: 15,
              fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none",
            }}>
              Join a league
            </Link>
            <Link href="/beta" style={{
              background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.32)",
              color: "#c4b5fd", padding: "14px 22px", borderRadius: 11, fontSize: 15,
              fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none",
            }}>
              Join the Beta →
            </Link>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 26, fontSize: 12.5, color: "#6f788e" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5fa98c" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
              Free to play
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5fa98c" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
              No gambling, pure strategy
            </span>
          </div>
        </div>

        {/* Right col — product preview */}
        <div style={{ position: "relative" }}>
          <div style={{
            position: "absolute", inset: "-30px -30px -30px -10px",
            background: "radial-gradient(420px 360px at 70% 30%,rgba(124,58,237,0.22),transparent 70%)",
            filter: "blur(8px)",
          }} />
          <div style={{
            position: "relative",
            background: "linear-gradient(160deg,#121829,#0e1322)",
            border: "1px solid rgba(150,160,200,0.14)", borderRadius: 18,
            padding: 16, boxShadow: "0 40px 90px -40px rgba(0,0,0,0.8)",
          }}>
            {/* Card header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 13px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#a78bfa" }}>Your Matchup</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#c9b6ff", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa" }} />Live
                </span>
              </div>
              <span style={{ fontSize: 10.5, color: "#6f788e" }}>Week 7</span>
            </div>

            {/* Scores */}
            <div style={{
              background: "linear-gradient(135deg,#1b1346 0%,#121829 70%)",
              border: "1px solid rgba(124,58,237,0.30)", borderRadius: 14, padding: "18px 20px",
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 14, alignItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f3f5fb", marginBottom: 7 }}>Northwind</div>
                  <div className="font-stats" style={{ fontSize: 46, fontWeight: 700, lineHeight: 0.8, color: "#f3f5fb" }}>48.2</div>
                  <div style={{ fontSize: 10.5, color: "#7fc2a6", marginTop: 6, fontWeight: 600 }}>52% win</div>
                </div>
                <div style={{ fontSize: 11, color: "#6f788e", fontWeight: 600, letterSpacing: "0.08em" }}>VS</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e7eaf3", marginBottom: 7 }}>Granite City</div>
                  <div className="font-stats" style={{ fontSize: 46, fontWeight: 700, lineHeight: 0.8, color: "#c7d2e0" }}>44.8</div>
                  <div style={{ fontSize: 10.5, color: "#8b93a7", marginTop: 6, fontWeight: 600 }}>48% win</div>
                </div>
              </div>
            </div>

            {/* Mini standings */}
            <div style={{
              marginTop: 12, background: "rgba(150,160,200,0.04)",
              border: "1px solid rgba(150,160,200,0.10)", borderRadius: 12, padding: "13px 15px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
                <span style={{ width: 3, height: 13, borderRadius: 2, background: "linear-gradient(#a78bfa,#6d28d9)", flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#c7d2e0" }}>Standings</span>
              </div>
              {MINI_STANDINGS.map((r) => (
                <div key={r.name} style={{
                  display: "grid", gridTemplateColumns: "20px 1fr 44px",
                  alignItems: "center", gap: 10, padding: "7px 9px", borderRadius: 8, marginBottom: 3,
                  background: r.you ? "rgba(124,58,237,0.12)" : "transparent",
                  border: r.you ? "1px solid rgba(124,58,237,0.28)" : "1px solid transparent",
                }}>
                  <span className="font-stats" style={{ fontSize: 13, fontWeight: 600, color: r.you ? "#c9b6ff" : "#6f788e" }}>{r.rank}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: r.you ? "#f3f5fb" : "#dfe3ee" }}>{r.name}</span>
                  <span className="font-stats" style={{ textAlign: "right", fontSize: 15, fontWeight: 700, color: r.you ? "#c9b6ff" : "#c7d2e0" }}>{r.vp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1240, margin: "0 auto", width: "100%", padding: "30px 36px 8px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 24, flexWrap: "wrap" as const, padding: "20px 28px",
          background: "rgba(150,160,200,0.04)", border: "1px solid rgba(150,160,200,0.10)", borderRadius: 16,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#6f788e" }}>
            A real front office, not a points game
          </span>
          <div style={{ display: "flex", gap: 40, flexWrap: "wrap" as const }}>
            {PILLARS.map((p) => (
              <div key={p.label}>
                <div className="font-stats" style={{ fontSize: 26, fontWeight: 700, color: "#f3f5fb", lineHeight: 1 }}>{p.stat}</div>
                <div style={{ fontSize: 11.5, color: "#8b93a7", marginTop: 4 }}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1240, margin: "0 auto", width: "100%", padding: "56px 36px 8px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 13, marginBottom: 8 }}>
          <span className="section-accent" />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#c7d2e0" }}>What you run</span>
        </div>
        <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", maxWidth: 620, lineHeight: 1.1, color: "#f3f5fb", margin: 0 }}>
          Every decision a real GM makes — in your hands.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginTop: 34 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: "#121829", border: "1px solid rgba(150,160,200,0.10)", borderRadius: 16, padding: 24 }}>
              <span style={{
                display: "inline-flex", width: 42, height: 42, borderRadius: 11,
                background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.24)",
                alignItems: "center", justifyContent: "center", color: "#a78bfa",
              }}>
                <f.Icon />
              </span>
              <div style={{ fontSize: 16.5, fontWeight: 700, color: "#f3f5fb", marginTop: 16 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "#9aa3bd", lineHeight: 1.6, marginTop: 8 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1240, margin: "0 auto", width: "100%", padding: "56px 36px 8px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 13, marginBottom: 8 }}>
          <span className="section-accent" />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#c7d2e0" }}>How it works</span>
        </div>
        <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", maxWidth: 620, lineHeight: 1.1, color: "#f3f5fb", margin: 0 }}>
          From draft night to a championship banner.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginTop: 34 }}>
          {STEPS.map((s) => (
            <div key={s.num} style={{
              position: "relative",
              background: "linear-gradient(160deg,rgba(124,58,237,0.08),rgba(150,160,200,0.02))",
              border: "1px solid rgba(150,160,200,0.12)", borderRadius: 16, padding: "26px 24px",
            }}>
              <div className="font-stats" style={{ fontSize: 40, fontWeight: 700, color: "rgba(167,139,250,0.45)", lineHeight: 0.8 }}>{s.num}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#f3f5fb", marginTop: 14 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "#9aa3bd", lineHeight: 1.6, marginTop: 8 }}>{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Band ─────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1240, margin: "0 auto", width: "100%", padding: "60px 36px 70px" }}>
        <div style={{
          position: "relative", overflow: "hidden",
          background: "linear-gradient(135deg,#1b1346 0%,#241657 50%,#121829 100%)",
          border: "1px solid rgba(124,58,237,0.34)", borderRadius: 22,
          padding: "54px 48px", textAlign: "center",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(600px 300px at 50% -20%,rgba(124,58,237,0.30),transparent 70%)",
          }} />
          <div style={{ position: "relative" }}>
            <h2 style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, margin: 0 }}>
              Your franchise is waiting.
            </h2>
            <p style={{ fontSize: 16, color: "#c5cadb", maxWidth: 460, margin: "14px auto 0", lineHeight: 1.6 }}>
              Start a league with friends or join a public one. Draft tonight, compete all season.
            </p>
            <Link href="/register" style={{
              display: "inline-flex", alignItems: "center", gap: 9, marginTop: 28,
              background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff",
              padding: "15px 28px", borderRadius: 12, fontSize: 15.5, fontWeight: 700, textDecoration: "none",
            }}>
              Start your franchise
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
              </svg>
            </Link>
            <div style={{ fontSize: 12, color: "#8b93a7", marginTop: 16 }}>Free to play · Think Like a GM.</div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(150,160,200,0.10)" }}>
        <div style={{
          maxWidth: 1240, margin: "0 auto", width: "100%",
          padding: "32px 36px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 24, flexWrap: "wrap" as const,
        }}>
          <div style={{ fontSize: 12, color: "#6f788e", lineHeight: 1.5 }}>
            PWHL General Manager · Think Like a GM.<br />
            Not affiliated with the PWHL. Fan-built fantasy product.
          </div>
          <div style={{ display: "flex", gap: 26, fontSize: 12.5, color: "#8b93a7" }}>
            <Link href="/leagues" style={{ color: "inherit", textDecoration: "none" }}>Leagues</Link>
            <Link href="/login" style={{ color: "inherit", textDecoration: "none" }}>Sign in</Link>
            <Link href="/create-league" style={{ color: "inherit", textDecoration: "none" }}>Start a league</Link>
          </div>
        </div>
      </footer>

    </main>
  );
}

// ── Static data ──────────────────────────────────────────────────────────────

const MINI_STANDINGS = [
  { rank: 1, name: "Northwind",   vp: 16, you: true  },
  { rank: 2, name: "Granite City", vp: 15, you: false },
  { rank: 3, name: "Harbour City", vp: 13, you: false },
  { rank: 4, name: "Steel & Co",   vp: 12, you: false },
];

const PILLARS = [
  { stat: "Draft",   label: "Build from scratch"    },
  { stat: "Manage",  label: "Lineups & trades"      },
  { stat: "Compete", label: "Standings & playoffs"  },
  { stat: "Win",     label: "Championship banners"  },
];

const SVG = ({ children }: { children: React.ReactNode }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const FEATURES = [
  {
    title: "Live draft room with a pick clock",
    body:  "Run a real draft room with a clock, queue, and player board. Build your foundation pick by pick.",
    Icon: () => <SVG><path d="M12 2v6" /><path d="M12 8 8 5" /><path d="M12 8l4-3" /><rect x="4" y="8" width="16" height="13" rx="2" /><path d="M9 13h6" /></SVG>,
  },
  {
    title: "Build & manage rosters",
    body:  "Forwards, defense, goalies, bench and IR. Shape a roster with real PWHL depth and positions.",
    Icon: () => <SVG><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 4a3 3 0 0 1 0 6" /><path d="M18.5 20a5.5 5.5 0 0 0-3-4.9" /></SVG>,
  },
  {
    title: "Set your weekly lineup",
    body:  "Start the right skaters, ride the hot goalie, and lock in before puck drop every game night.",
    Icon: () => <SVG><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M9 4v16" /></SVG>,
  },
  {
    title: "Trades & the waiver wire",
    body:  "Negotiate deals, claim breakouts off waivers, and out-maneuver your league all season long.",
    Icon: () => <SVG><path d="M16 3h5v5" /><path d="M21 3l-7 7" /><path d="M8 21H3v-5" /><path d="M3 21l7-7" /></SVG>,
  },
  {
    title: "Standings & playoffs",
    body:  "Climb the table on Victory Points, clinch a seed, and chase a championship banner.",
    Icon: () => <SVG><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v1a3 3 0 0 0 3 3" /><path d="M17 6h3v1a3 3 0 0 1-3 3" /></SVG>,
  },
  {
    title: "Commissioner tools",
    body:  "Run your league your way — scoring, schedule, rules and approvals from one front office.",
    Icon: () => <SVG><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></SVG>,
  },
];

const STEPS = [
  { num: "01", title: "Create or join a league",  body: "Start a private league with friends or jump into a public one. Invite up to your league size in seconds." },
  { num: "02", title: "Draft your franchise",      body: "Hit the draft room and build a roster of PWHL players from across all teams in the league."              },
  { num: "03", title: "Manage & compete",          body: "Set lineups, work the wire, make trades, and climb the standings toward the playoffs."                   },
];
