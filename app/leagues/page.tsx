import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function LeaguesPage() {
  const leagues = await prisma.fantasyLeague.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return (
    <main style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", padding: "32px 16px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gap: 24 }}>
        <header>
          <p style={{ color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.2em", fontSize: 12, marginBottom: 12 }}>PWHL Fantasy</p>
          <h1 style={{ fontSize: "clamp(2rem, 3vw, 3rem)", lineHeight: 1.05 }}>Browse active leagues</h1>
          <p style={{ color: "#94a3b8", maxWidth: 780, marginTop: 10 }}>
            Discover leagues created on the platform and jump to their dashboard if you have the ID. League privacy is minimal for this prototype.
          </p>
        </header>

        <div style={{ display: "grid", gap: 18 }}>
          {leagues.length ? (
            leagues.map((league) => (
              <Link
                key={league.id}
                href={`/league/${league.id}`}
                style={{
                  display: "grid",
                  gap: 10,
                  padding: 22,
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(148,163,184,0.14)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>{league.name}</h2>
                    <p style={{ color: "#94a3b8", marginTop: 6 }}>Season {league.season} · {league.maxTeams} max teams</p>
                  </div>
                  <span style={{ color: "#94a3b8", fontSize: 13, whiteSpace: "nowrap" }}>{league.status.replace("_", " ")}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, color: "#94a3b8", fontSize: 14 }}>
                  <span>Playoffs: {league.playoffStatus.replace("_", " ")}</span>
                  <span>Updated: {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(league.updatedAt))}</span>
                </div>
              </Link>
            ))
          ) : (
            <div style={{ padding: 24, background: "rgba(255,255,255,0.03)", borderRadius: 20 }}>
              <p style={{ color: "#94a3b8" }}>No leagues have been created yet.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
