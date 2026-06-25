// Public invite landing page — no auth required.
// URL: /invite/<leagueId>  (commissioner shares this link)
// Shows league context and a join form so invitees know exactly what they're joining.

import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import InviteJoinForm from "./InviteJoinForm";

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ email?: string }>;
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default async function InvitePage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const { email: prefillEmail } = await searchParams;

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
      minHeight: "100vh", background: "var(--bg)", color: "var(--text)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "32px 16px",
    }}>
      <div style={{ maxWidth: 520, width: "100%" }}>

        {/* League context card */}
        <div style={{
          background: "rgba(143,193,232,0.07)",
          border: "1px solid rgba(143,193,232,0.2)",
          borderRadius: 20, padding: "24px 28px", marginBottom: 20,
          textAlign: "center",
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 10px" }}>
            You&apos;ve been invited
          </p>
          <h1 style={{ margin: "0 0 8px", fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: 800 }}>
            {league.name}
          </h1>
          <p style={{ color: "var(--dim)", margin: "0 0 16px", fontSize: 14 }}>
            PWHL GM · Season {league.season}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{league._count.teams}</div>
              <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Joined</div>
            </div>
            <div style={{ width: 1, background: "var(--border)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: spotsLeft > 0 ? "var(--green)" : "var(--red)" }}>
                {spotsLeft > 0 ? spotsLeft : "Full"}
              </div>
              <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {spotsLeft > 0 ? "Spots left" : "League full"}
              </div>
            </div>
          </div>

          {/* Draft date chip */}
          {league.draftStartsAt && !isDraftDone && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16,
              background: "rgba(143,193,232,0.12)", border: "1px solid rgba(143,193,232,0.25)",
              borderRadius: 99, padding: "5px 14px", fontSize: 12, color: "var(--accent-strong)",
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

        {/* Fantasy primer for cold users */}
        {!isDraftDone && spotsLeft > 0 && (
          <div style={{
            background: "var(--bg-raised)", border: "1px solid var(--border)",
            borderRadius: 16, padding: "20px 22px", marginBottom: 16,
          }}>
            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              New to fantasy sports?
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--faint)", lineHeight: 1.5 }}>
              You pick real PWHL players for your virtual team. Every goal, assist, and save they score in actual games earns you fantasy points. The team with the most points each week wins the matchup.
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                { step: "1", head: "Join & name your team", text: "Pick a name — you're the GM." },
                { step: "2", head: "Draft real PWHL players", text: "Live snake draft. You'll take turns picking from 200+ active players." },
                { step: "3", head: "Set your lineup each week", text: "Choose who plays, who sits. Your starters' real-game stats become your score." },
                { step: "4", head: "Compete for the playoffs", text: "Win your weekly matchup to earn Victory Points. Top 4 teams after the regular season make the playoffs." },
              ].map(({ step, head, text }) => (
                <div key={step} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(143,193,232,0.15)", color: "var(--accent-strong)",
                    fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                    marginTop: 1,
                  }}>
                    {step}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 1 }}>{head}</div>
                    <div style={{ fontSize: 12, color: "var(--faint)", lineHeight: 1.4 }}>{text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isDraftDone ? (
          <div style={{
            background: "var(--surface)", border: "1px solid rgba(148,163,184,0.12)",
            borderRadius: 20, padding: "24px 28px", textAlign: "center",
          }}>
            <p style={{ color: "var(--amber)", fontWeight: 700, marginBottom: 8 }}>Draft already completed</p>
            <p style={{ color: "var(--dim)", fontSize: 14, margin: 0 }}>
              This league is already in-season. Contact the commissioner if you think this is an error.
            </p>
          </div>
        ) : spotsLeft <= 0 ? (
          <div style={{
            background: "var(--surface)", border: "1px solid rgba(148,163,184,0.12)",
            borderRadius: 20, padding: "24px 28px", textAlign: "center",
          }}>
            <p style={{ color: "var(--red)", fontWeight: 700, marginBottom: 8 }}>League is full</p>
            <p style={{ color: "var(--dim)", fontSize: 14, margin: 0 }}>
              All {league.maxTeams} spots have been taken. Ask the commissioner to increase the team limit.
            </p>
          </div>
        ) : (
          <div style={{
            background: "var(--surface)", border: "1px solid rgba(148,163,184,0.12)",
            borderRadius: 20, padding: "24px 28px",
          }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700 }}>Claim your spot</h2>
            <InviteJoinForm leagueId={leagueId} prefillEmail={prefillEmail} />
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--faint)" }}>
          Starting your own league?{" "}
          <a href="/create-league" style={{ color: "var(--accent-strong)" }}>Create one here</a>
        </p>
      </div>
    </div>
  );
}
