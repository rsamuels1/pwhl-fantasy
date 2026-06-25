import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import type { EditionData } from "@/lib/services/morning-skate-service";

export default async function MorningSkateArchivePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const user = await requireAuth(`/league/${leagueId}/morning-skate`);
  await requireLeagueMember(leagueId, user.id);

  const editions = await prisma.morningSkateEdition.findMany({
    where: { leagueId },
    orderBy: { createdAt: "desc" },
  });

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0, marginBottom: 4 }}>Morning Skate</h1>
          <p style={{ fontSize: 13, color: "var(--dim)", margin: 0 }}>
            Weekly digest — published after each period scores
          </p>
        </div>
        <Link href={`/league/${leagueId}`} style={{
          fontSize: 12, color: "var(--faint)", textDecoration: "none",
        }}>
          ← Overview
        </Link>
      </div>

      {editions.length === 0 ? (
        <div style={{
          padding: "40px 24px", borderRadius: 14,
          background: "var(--bg-raised)", border: "1px solid var(--border)",
          textAlign: "center",
        }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginTop: 0, marginBottom: 6 }}>
            No editions yet
          </p>
          <p style={{ fontSize: 13, color: "var(--dim)", margin: 0 }}>
            Check back after the first week scores.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {editions.map((edition) => {
            const data = edition.data as unknown as EditionData;
            return (
              <Link
                key={edition.id}
                href={`/league/${leagueId}/morning-skate/${edition.id}`}
                style={{ textDecoration: "none" }}
              >
                <div style={{
                  background: "var(--bg-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "16px 20px",
                  transition: "border-color 0.15s ease",
                  cursor: "pointer",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.10em",
                      textTransform: "uppercase", color: "rgba(99,102,241,0.85)",
                    }}>
                      Morning Skate
                    </span>
                    <span style={{ fontSize: 11, color: "var(--faint)" }}>
                      {fmt(new Date(edition.createdAt))}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6, lineHeight: 1.3 }}>
                    {data.headline}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--dim)", lineHeight: 1.5 }}>
                    {data.lede}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
