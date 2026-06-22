// Public invite landing page — no auth required.
// URL: /invite/<leagueId>  (commissioner shares this link)
// Shows league context and a join form so invitees know exactly what they're joining.

import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import InviteJoinForm from "./InviteJoinForm";

interface Props {
  params: Promise<{ leagueId: string }>;
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default async function InvitePage({ params }: Props) {
  const { leagueId } = await params;

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      name: true,
      season: true,
      maxTeams: true,
      status: true,
      draftStartsAt: true,
      _count: { select: { teams: true } },
    },
  });

  if (!league) notFound();

  const spotsLeft = league.maxTeams - league._count.teams;
  const isDraftDone = league.status === "IN_SEASON" || league.status === "COMPLETE";

  return (
    <div style={{
      minHeight: "100vh", background: "#0f1117", color: "#e2e8f0",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "32px 16px",
    }}>
      <div style={{ maxWidth: 520, width: "100%" }}>

        {/* League context card */}
        <div style={{
          background: "rgba(99,102,241,0.07)",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 20, padding: "24px 28px", marginBottom: 20,
          textAlign: "center",
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 10px" }}>
            You&apos;ve been invited
          </p>
          <h1 style={{ margin: "0 0 8px", fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: 800 }}>
            {league.name}
          </h1>
          <p style={{ color: "#94a3b8", margin: "0 0 16px", fontSize: 14 }}>
            PWHL GM · Season {league.season}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0" }}>{league._count.teams}</div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Joined</div>
            </div>
            <div style={{ width: 1, background: "rgba(148,163,184,0.1)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: spotsLeft > 0 ? "#34d399" : "#f87171" }}>
                {spotsLeft > 0 ? spotsLeft : "Full"}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {spotsLeft > 0 ? "Spots left" : "League full"}
              </div>
            </div>
          </div>

          {/* Draft date chip */}
          {league.draftStartsAt && !isDraftDone && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16,
              background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: 99, padding: "5px 14px", fontSize: 12, color: "#a5b4fc",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Draft: {fmt(new Date(league.draftStartsAt))}
            </div>
          )}
        </div>

        {/* Fantasy explainer */}
        {!isDraftDone && spotsLeft > 0 && (
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.08)",
            borderRadius: 16, padding: "18px 22px", marginBottom: 16,
          }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 12px" }}>
              How it works
            </h2>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                { step: "1", text: "Join the league and pick a team name" },
                { step: "2", text: "Draft real PWHL players in a live snake draft" },
                { step: "3", text: "Set your lineup each week — most FP wins the matchup" },
                { step: "4", text: "Rack up Victory Points. Top 4 teams make the playoffs" },
              ].map(({ step, text }) => (
                <div key={step} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(99,102,241,0.2)", color: "#a5b4fc",
                    fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {step}
                  </span>
                  <span style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.4 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isDraftDone ? (
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.12)",
            borderRadius: 20, padding: "24px 28px", textAlign: "center",
          }}>
            <p style={{ color: "#f59e0b", fontWeight: 700, marginBottom: 8 }}>Draft already completed</p>
            <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
              This league is already in-season. Contact the commissioner if you think this is an error.
            </p>
          </div>
        ) : spotsLeft <= 0 ? (
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.12)",
            borderRadius: 20, padding: "24px 28px", textAlign: "center",
          }}>
            <p style={{ color: "#f87171", fontWeight: 700, marginBottom: 8 }}>League is full</p>
            <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
              All {league.maxTeams} spots have been taken. Ask the commissioner to increase the team limit.
            </p>
          </div>
        ) : (
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.12)",
            borderRadius: 20, padding: "24px 28px",
          }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700 }}>Claim your spot</h2>
            <InviteJoinForm leagueId={leagueId} />
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#475569" }}>
          Starting your own league?{" "}
          <a href="/create-league" style={{ color: "#a5b4fc" }}>Create one here</a>
        </p>
      </div>
    </div>
  );
}
