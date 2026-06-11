"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  teamId: string;
  leagueId: string;
}

const ICON: Record<string, string> = {
  matchup: "⚡",
  lineup: "✏",
  league: "🏒",
  standings: "📊",
};

export default function BottomNav({ teamId, leagueId }: Props) {
  const pathname = usePathname();

  const tabs = [
    { key: "matchup",   label: "Matchup",   href: `/team/${teamId}/matchup` },
    { key: "lineup",    label: "Lineup",    href: `/team/${teamId}/lineup` },
    { key: "league",    label: "League",    href: `/league/${leagueId}` },
    { key: "standings", label: "Standings", href: `/league/${leagueId}/standings` },
  ];

  return (
    <nav className="bottom-nav" style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "#090d16",
      borderTop: "1px solid rgba(148,163,184,0.12)",
      height: 60,
      justifyContent: "stretch",
      alignItems: "stretch",
    }}>
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              textDecoration: "none",
              color: active ? "#a5b4fc" : "#475569",
              fontSize: 10,
              fontWeight: active ? 700 : 500,
              borderTop: active ? "2px solid #6366f1" : "2px solid transparent",
              transition: "color 0.15s",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{ICON[tab.key]}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
