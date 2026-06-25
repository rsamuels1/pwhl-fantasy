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
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", padding: "32px 16px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gap: 40 }}>
        <header>
          <p style={{ color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.2em", fontSize: 12, marginBottom: 12 }}>PWHL GM</p>
          <h1 style={{ fontSize: "clamp(2rem, 3vw, 3rem)", lineHeight: 1.05, margin: "0 0 12px" }}>
            Leagues
          </h1>
          <p style={{ color: "var(--dim)", maxWidth: 640, margin: 0, fontSize: 15 }}>
            Join an open league or start your own franchise. Each league drafts real PWHL players and competes for the full season.
          </p>
        </header>

        {/* ── Showcase: active in-season leagues ── */}
        {showcaseLeagues.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 14px" }}>
              Live right now
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {showcaseLeagues.map((league) => {
                const playoffLabel = PLAYOFF_LABEL[league.playoffStatus];
                return (
                  <div key={league.id} style={{
                    padding: "18px 20px", borderRadius: 16,
                    background: "rgba(81,216,138,0.04)", border: "1px solid rgba(81,216,138,0.1)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {league.name}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--faint)" }}>
                          {league.season} · {league._count.teams} managers
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, flexShrink: 0,
                        background: "rgba(81,216,138,0.12)", color: "var(--green)",
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
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>
              Open leagues
            </h2>
            <span style={{ fontSize: 12, color: "var(--faint)" }}>
              {directoryLeagues.length === 0 ? "None open right now" : `${directoryLeagues.length} listed`}
            </span>
          </div>

          {directoryLeagues.length === 0 ? (
            <div style={{ padding: "28px 24px", borderRadius: 16, background: "var(--bg-raised)", border: "1px solid var(--border)", textAlign: "center" }}>
              <p style={{ color: "var(--dim)", margin: "0 0 16px", fontSize: 14 }}>
                No public leagues are open right now. Be the first to create one.
              </p>
              <Link href="/create-league" style={{
                display: "inline-block", fontSize: 13, fontWeight: 700, padding: "10px 20px",
                borderRadius: 10, background: "var(--accent)", color: "var(--accent-ink)", textDecoration: "none",
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
                    background: "var(--surface)", border: "1px solid var(--border)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{league.name}</div>
                        <div style={{ color: "var(--faint)", marginTop: 4, fontSize: 12 }}>
                          Season {league.season} · {league._count.teams}/{league.maxTeams} managers
                          {isOpen && ` · ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} open`}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                          background: league.status === "IN_SEASON" ? "rgba(34,197,94,0.12)" : "var(--border)",
                          color: league.status === "IN_SEASON" ? "var(--green)" : "var(--dim)",
                        }}>
                          {playoffLabel ?? statusLabel}
                        </span>
                        {isOpen && (
                          <Link href={`/invite/${league.id}`} style={{
                            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 10,
                            background: "var(--accent)", color: "var(--accent-ink)", textDecoration: "none",
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
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <Link href="/create-league" style={{
            fontSize: 14, fontWeight: 700, padding: "12px 22px", borderRadius: 12,
            background: "var(--accent)", color: "var(--accent-ink)", textDecoration: "none",
          }}>
            Start your own league →
          </Link>
          <Link href="/create-league?replay=1" style={{
            fontSize: 14, fontWeight: 600, padding: "12px 22px", borderRadius: 12,
            border: "1px solid var(--border)", color: "var(--dim)", textDecoration: "none",
          }}>
            Try a solo replay →
          </Link>
        </div>
      </div>
    </main>
  );
}
