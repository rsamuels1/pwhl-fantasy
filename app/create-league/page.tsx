import { requireAuth } from "@/lib/auth";
import CreateLeagueWizard from "./CreateLeagueWizard";

interface Props {
  searchParams?: Promise<{ replay?: string }>;
}

export default async function CreateLeaguePage({ searchParams }: Props) {
  const user = await requireAuth("/create-league");
  const sp = searchParams ? await searchParams : {};
  const startAsReplay = sp.replay === "1";

  return <CreateLeagueWizard userDisplayName={user.displayName} startAsReplay={startAsReplay} />;
}
