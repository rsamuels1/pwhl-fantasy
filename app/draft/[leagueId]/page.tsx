import { notFound } from "next/navigation";
import DraftRoom from "./DraftRoom";

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ team?: string }>;
}

export default async function DraftPage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const { team: teamId } = await searchParams;

  if (!teamId) {
    return (
      <main style={{ padding: "2rem" }}>
        <p style={{ color: "var(--red)" }}>
          Missing <code>?team=&lt;teamId&gt;</code> in the URL.
        </p>
      </main>
    );
  }

  if (!leagueId) notFound();

  return <DraftRoom leagueId={leagueId} teamId={teamId} />;
}
