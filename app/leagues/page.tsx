import Link from "next/link";
import { prisma } from "@/lib/db";

const STATUS_LABEL: Record<string, string> = {
  PRE_DRAFT: "Drafting soon",
  IN_SEASON: "Season in progress",
  COMPLETE: "Season complete",
};

const PLAYOFF_LABEL: Record<string, string> = {
  IN_PROGRESS: "Playoffs underway",
  COMPLETE: "Champion crowned",
};

export default async function LeaguesPage() {
  // Showcase: public leagues actively in season (most interesting to new visitors)
  const showcaseLeagues = await prisma.fantasyLeague.findMany({
    where: { isPublic: true, status: "IN_SEASON" },
    orderBy: { updatedAt: "desc" },
    take: 6,
    include: { _count: { select: { teams: true } } },
  });

  // Directory: public leagues that aren't finished (joinable or starting soon)
  const directoryLeagues = await prisma.fantasyLeague.findMany({
    where: {
      isPublic: true,
      status: { not: "COMPLETE" },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { _count: { select: { teams: true } } },
  });

  return (
    <main style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", padding: "32px 16px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gap: 40 }}>
        <header>
          <p style={{ color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.2em", fontSize: 12, marginBottom: 12 }}>PWHL GM</p>
          <h1 style={{ fontSize: "clamp(2rem, 3vw, 3rem)", lineHeight: 1.05, margin: "0 0 12px" }}>
            Leagues
          </h1>
          <p style={{ color: "#94a3b8", maxWidth: 640, margin: 0, fontSize: 15 }}>
            Join an open league or start your own franchise. Each league drafts real PWHL players and competes for the full season.
          </p>
        </header>

        {/* ── Showcase: active in-season leagues ── */}
        {showcaseLeagues.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 14px" }}>
              Live right now
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {showcaseLeagues.map((league) => {
                const playoffLabel = PLAYOFF_LABEL[league.playoffStatus];
                return (
                  <div key={league.id} style={{
                    padding: "18px 20px", borderRadius: 16,
                    background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.1)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {league.name}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {league.season} · {league._count.teams} managers
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, flexShrink: 0,
                        background: "rgba(34,197,94,0.12)", color: "#4ade80",
                      }}>
                        {playoffLabel ?? "In season"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Directory: public open / pre-draft leagues ── */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>
              Open leagues
            </h2>
            <span style={{ fontSize: 12, color: "#475569" }}>
              {directoryLeagues.length === 0 ? "None open right now" : `${directoryLeagues.length} listed`}
            </span>
          </div>

          {directoryLeagues.length === 0 ? (
            <div style={{ padding: "28px 24px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.1)", textAlign: "center" }}>
              <p style={{ color: "#94a3b8", margin: "0 0 16px", fontSize: 14 }}>
                No public leagues are open right now. Be the first to create one.
              </p>
              <Link href="/create-league" style={{
                display: "inline-block", fontSize: 13, fontWeight: 700, padding: "10px 20px",
                borderRadius: 10, background: "#6366f1", color: "#fff", textDecoration: "none",
              }}>
                Start a league →
              </Link>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {directoryLeagues.map((league) => {
                const spotsLeft = league.maxTeams - league._count.teams;
                const isOpen = league.status === "PRE_DRAFT" && spotsLeft > 0;
                const statusLabel = STATUS_LABEL[league.status] ?? league.status;
                const playoffLabel = PLAYOFF_LABEL[league.playoffStatus];

                return (
                  <div key={league.id} style={{
                    display: "grid", gap: 10, padding: "18px 20px", borderRadius: 16,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.1)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>{league.name}</div>
                        <div style={{ color: "#64748b", marginTop: 4, fontSize: 12 }}>
                          Season {league.season} · {league._count.teams}/{league.maxTeams} managers
                          {isOpen && ` · ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} open`}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                          background: league.status === "IN_SEASON" ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.08)",
                          color: league.status === "IN_SEASON" ? "#4ade80" : "#94a3b8",
                        }}>
                          {playoffLabel ?? statusLabel}
                        </span>
                        {isOpen && (
                          <Link href={`/invite/${league.id}`} style={{
                            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 10,
                            background: "#6366f1", color: "#fff", textDecoration: "none",
                          }}>
                            Join →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Bottom CTA strip ── */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", paddingTop: 16, borderTop: "1px solid rgba(148,163,184,0.08)" }}>
          <Link href="/create-league" style={{
            fontSize: 14, fontWeight: 700, padding: "12px 22px", borderRadius: 12,
            background: "#6366f1", color: "#fff", textDecoration: "none",
          }}>
            Start your own league →
          </Link>
          <Link href="/create-league?replay=1" style={{
            fontSize: 14, fontWeight: 600, padding: "12px 22px", borderRadius: 12,
            border: "1px solid rgba(148,163,184,0.2)", color: "#94a3b8", textDecoration: "none",
          }}>
            Try a solo replay →
          </Link>
        </div>
      </div>
    </main>
  );
}
