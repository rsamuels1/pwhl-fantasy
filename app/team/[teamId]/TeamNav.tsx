"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface Props {
  teamId: string;
  leagueId: string;
  leagueName: string;
  playoffStatus: string;
  leagueStatus?: string;
  hasTrophies?: boolean;
}

function TeamNavInner({ teamId, leagueId, leagueName, playoffStatus, leagueStatus, hasTrophies }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rosterPath = `/team/${teamId}/roster`;
  const isRosterActive = pathname.startsWith(rosterPath);

  const tradesPath = `/team/${teamId}/trades`;
  const isTradesActive = pathname.startsWith(tradesPath);

  const tabs = [
    { label: "Matchup",      href: `/team/${teamId}/matchup`,            active: pathname.startsWith(`/team/${teamId}/matchup`) },
    { label: "My Roster",    href: rosterPath,                           active: isRosterActive || pathname.startsWith(`/team/${teamId}/lineup`) },
    { label: "Trades",       href: tradesPath,                           active: isTradesActive },
    { label: "Standings",    href: `/team/${teamId}/standings`,          active: pathname.startsWith(`/team/${teamId}/standings`) },
    { label: "Scoreboard",   href: `/team/${teamId}/scoreboard`,         active: pathname.startsWith(`/team/${teamId}/scoreboard`) },
    { label: "My Season",    href: `/team/${teamId}/schedule`,           active: pathname.startsWith(`/team/${teamId}/schedule`) },
    { label: "Transactions", href: `/team/${teamId}/transactions`,       active: pathname.startsWith(`/team/${teamId}/transactions`) },
    { label: "Analysis",     href: `/team/${teamId}/analysis`,           active: pathname.startsWith(`/team/${teamId}/analysis`) },
    { label: "Settings",     href: `/team/${teamId}/settings`,           active: pathname.startsWith(`/team/${teamId}/settings`) },
    ...(leagueStatus === "PRE_DRAFT"
      ? [{ label: "Draft Queue", href: `/team/${teamId}/draft-prep`,     active: pathname.startsWith(`/team/${teamId}/draft-prep`) }]
      : []),
    ...(playoffStatus !== "NOT_STARTED"
      ? [{ label: "Playoffs", href: `/team/${teamId}/bracket`,           active: pathname.startsWith(`/team/${teamId}/bracket`) }]
      : []),
    ...(hasTrophies
      ? [{ label: "Trophies", href: `/team/${teamId}/trophies`,          active: pathname.startsWith(`/team/${teamId}/trophies`) }]
      : []),
  ];

  return (
    <nav
      className="team-nav"
      style={{
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 28,
        gap: 0,
      }}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          style={{
            padding: "12px 18px",
            fontSize: 14,
            fontWeight: tab.active ? 600 : 400,
            color: tab.active ? "var(--text)" : "var(--faint)",
            textDecoration: "none",
            borderBottom: tab.active ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: -1,
            whiteSpace: "nowrap",
            transition: "color 0.15s",
          }}
        >
          {tab.label}
        </Link>
      ))}

      <Link
        href={`/league/${leagueId}`}
        style={{
          marginLeft: "auto",
          padding: "12px 4px",
          fontSize: 13,
          color: "var(--faint)",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        {leagueName} ↗
      </Link>
    </nav>
  );
}

// useSearchParams requires Suspense on Next.js App Router.
export default function TeamNav(props: Props) {
  return (
    <Suspense fallback={<div style={{ height: 48 }} />}>
      <TeamNavInner {...props} />
    </Suspense>
  );
}
