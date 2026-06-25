import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import type { EditionData } from "@/lib/services/morning-skate-service";

export default async function TeamMorningSkateEditionPage({
  params,
}: {
  params: Promise<{ teamId: string; editionId: string }>;
}) {
  const { teamId, editionId } = await params;
  const user = await requireAuth(`/team/${teamId}/morning-skate/${editionId}`);
  const team = await requireTeamOwner(teamId, user.id);
  const { id: leagueId } = team.league;

  const edition = await prisma.morningSkateEdition.findFirst({
    where: { id: editionId, leagueId },
  });
  if (!edition) notFound();

  const data = edition.data as unknown as EditionData;

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 680 }}>
      <div>
        <Link href={`/team/${teamId}/morning-skate`} style={{
          fontSize: 12, color: "var(--faint)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16,
        }}>
          ← Morning Skate
        </Link>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.10em",
          textTransform: "uppercase", color: "rgba(99,102,241,0.85)", marginBottom: 8,
        }}>
          Morning Skate · {fmt(new Date(edition.createdAt))}
        </div>
        <h1 style={{ fontSize: 22, margin: 0, marginBottom: 12, lineHeight: 1.2 }}>
          {data.headline}
        </h1>
        <p style={{
          fontSize: 14.5, color: "var(--dim)", lineHeight: 1.7, margin: 0,
          paddingBottom: 20, borderBottom: "1px solid var(--border)",
        }}>
          {data.lede}
        </p>
      </div>

      {data.sections.map((section, i) => (
        <div key={i}>
          <h2 style={{
            fontSize: 13, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--muted)",
            margin: 0, marginBottom: 10,
          }}>
            {section.title}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {section.blurbs.map((blurb, j) => (
              <p key={j} style={{
                margin: 0, fontSize: 14, color: "var(--text)", lineHeight: 1.6,
                padding: "12px 16px",
                background: "var(--bg-raised)",
                borderRadius: 10,
                border: "1px solid var(--border)",
                borderLeft: "3px solid rgba(99,102,241,0.4)",
              }}>
                {blurb}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
