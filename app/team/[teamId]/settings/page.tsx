import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import TeamColorPicker from "@/components/TeamColorPicker";

export default async function FranchiseSettingsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/settings`);
  const team = await requireTeamOwner(teamId, user.id);

  const teamData = await prisma.fantasyTeam.findUnique({
    where: { id: teamId },
    select: { name: true, accentColor: true },
  });

  const accentColor = (teamData as { accentColor?: string | null } | null)?.accentColor ?? null;

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 24px", color: "var(--text)" }}>
        Franchise Settings
      </h1>

      <section style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "20px 24px",
        marginBottom: 16,
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", margin: "0 0 16px" }}>
          Franchise Identity
        </h2>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 4 }}>Team name</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>{teamData?.name}</div>
        </div>

        <div>
          <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 8 }}>Team color</div>
          <p style={{ fontSize: 12, color: "var(--faint)", margin: "0 0 12px" }}>
            Your color appears on your avatar ring and standings row so your franchise stands out in the league.
          </p>
          <TeamColorPicker leagueId={team.league.id} teamId={teamId} currentColor={accentColor} />
        </div>
      </section>
    </div>
  );
}
