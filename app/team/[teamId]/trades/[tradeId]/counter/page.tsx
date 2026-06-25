import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ teamId: string; tradeId: string }>;
}

export default async function TeamCounterRedirectPage({ params }: Props) {
  const { teamId, tradeId } = await params;
  redirect(`/team/${teamId}/trades/new?counterOf=${tradeId}`);
}
