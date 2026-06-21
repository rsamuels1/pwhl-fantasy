import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreateLeagueWizard from "./CreateLeagueWizard";

interface Props {
  searchParams?: Promise<{ replay?: string }>;
}

export default async function CreateLeaguePage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/register?returnTo=/create-league");
  }

  const sp = searchParams ? await searchParams : {};
  const startAsReplay = sp.replay === "1";

  return <CreateLeagueWizard userDisplayName={user.displayName} startAsReplay={startAsReplay} />;
}
