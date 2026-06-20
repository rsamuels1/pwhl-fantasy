// Counter-offer page — redirects to /trades/new?counterOf=<tradeId>
// This exists so the "Counter" link in TradeDetailView has a canonical URL.

import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ leagueId: string; tradeId: string }>;
}

export default async function CounterRedirectPage({ params }: Props) {
  const { leagueId, tradeId } = await params;
  redirect(`/league/${leagueId}/trades/new?counterOf=${tradeId}`);
}
