"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  teamId: string;
  leagueId: string;
  leagueName: string;
}

export default function TeamNav({ teamId, leagueId, leagueName }: Props) {
  const pathname = usePathname();

  const tabs = [
    { label: "Matchup",       href: `/team/${teamId}/matchup` },
    { label: "Lineup",        href: `/team/${teamId}/lineup` },
    { label: "Roster",        href: `/team/${teamId}/roster` },
    { label: "Standings",     href: `/team/${teamId}/standings` },
    { label: "PWHL Schedule", href: `/team/${teamId}/schedule` },
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
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "12px 18px",
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "#e2e8f0" : "#64748b",
              textDecoration: "none",
              borderBottom: isActive ? "2px solid #6366f1" : "2px solid transparent",
              marginBottom: -1,
              whiteSpace: "nowrap",
              transition: "color 0.15s",
            }}
          >
            {tab.label}
          </Link>
        );
      })}

      <Link
        href={`/league/${leagueId}`}
        style={{
          marginLeft: "auto",
          padding: "12px 4px",
          fontSize: 13,
          color: "#475569",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        {leagueName} ↗
      </Link>
    </nav>
  );
}
