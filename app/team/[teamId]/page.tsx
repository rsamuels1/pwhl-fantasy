import { redirect } from "next/navigation";

export default async function TeamRootPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  redirect(`/team/${teamId}/matchup`);
}
