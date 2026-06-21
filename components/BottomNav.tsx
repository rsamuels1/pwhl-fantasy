"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  teamId: string;
  leagueId: string;
}

const TABS = [
  {
    key: "matchup",
    label: "Home",
    hrefFn: (teamId: string, _: string) => `/team/${teamId}/matchup`,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    ),
  },
  {
    key: "lineup",
    label: "Lineup",
    hrefFn: (teamId: string, _: string) => `/team/${teamId}/lineup`,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M9 4v16" />
      </svg>
    ),
  },
  {
    key: "roster",
    label: "Roster",
    hrefFn: (teamId: string, _: string) => `/team/${teamId}/roster`,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="4" width="12" height="17" rx="2" />
        <path d="M9 4V2h6v2M9 10h6M9 14h6" />
      </svg>
    ),
  },
  {
    key: "league",
    label: "League",
    hrefFn: (_: string, leagueId: string) => `/league/${leagueId}`,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
        <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
      </svg>
    ),
  },
  {
    key: "more",
    label: "More",
    hrefFn: (_: string, leagueId: string) => `/league/${leagueId}/standings`,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
      </svg>
    ),
  },
] as const;

export default function BottomNav({ teamId, leagueId }: Props) {
  const pathname = usePathname();

  return (
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      padding: `9px 6px env(safe-area-inset-bottom, 20px)`,
      background: "rgba(10,14,26,0.92)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderTop: "1px solid rgba(150,160,200,0.10)",
    }}>
      {TABS.map((tab) => {
        const href = tab.hrefFn(teamId, leagueId);
        const active = pathname === href || (tab.key !== "more" && tab.key !== "league" && pathname.startsWith(href));
        const color = active ? "#a78bfa" : "#6f788e";
        return (
          <Link
            key={tab.key}
            href={href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              color,
              textDecoration: "none",
              minWidth: 44,
              minHeight: 44,
              justifyContent: "center",
              transition: "color 0.15s",
            }}
          >
            {tab.icon}
            <span style={{
              fontSize: 9.5,
              fontWeight: active ? 700 : 600,
              letterSpacing: "0.04em",
              lineHeight: 1,
            }}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
