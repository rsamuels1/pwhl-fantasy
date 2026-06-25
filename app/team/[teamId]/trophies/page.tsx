import { notFound } from "next/navigation";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import TrophyCard from "@/components/TrophyCard";
import type { TrophyType } from "@prisma/client";

export default async function TrophiesPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/trophies`);
  const team = await requireTeamOwner(teamId, user.id);

  const trophies = await prisma.trophy.findMany({
    where: { teamId },
    orderBy: { awardedAt: "desc" },
  });

  // Group by season
  const bySeason = new Map<string, typeof trophies>();
  for (const t of trophies) {
    if (!bySeason.has(t.season)) bySeason.set(t.season, []);
    bySeason.get(t.season)!.push(t);
  }

  const seasons = [...bySeason.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>
          Trophy Cabinet
        </h1>
        <p style={{ fontSize: 14, color: "var(--dim)", margin: 0 }}>
          {team.name}&apos;s awards across all seasons
        </p>
      </div>

      {trophies.length === 0 ? (
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
            No trophies yet
          </div>
          <div style={{ fontSize: 13, color: "var(--dim)" }}>
            Trophies are awarded at the end of each season when the league renews.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 28 }}>
          {seasons.map((season) => {
            const items = bySeason.get(season) ?? [];
            return (
              <section key={season}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--dim)",
                    marginBottom: 12,
                  }}
                >
                  {season} Season
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {items.map((trophy) => (
                    <TrophyCard
                      key={trophy.id}
                      type={trophy.type as TrophyType}
                      season={trophy.season}
                      data={(trophy.data ?? {}) as Record<string, unknown>}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
