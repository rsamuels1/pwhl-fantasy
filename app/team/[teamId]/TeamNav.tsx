"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef } from "react";

interface Props {
  teamId: string;
  leagueId: string;
  leagueName: string;
  playoffStatus: string;
  leagueStatus?: string;
  hasTrophies?: boolean;
}

function TeamNavInner({ teamId, leagueId, playoffStatus, leagueStatus, hasTrophies }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const rosterPath = `/team/${teamId}/roster`;
  const isRosterActive = pathname.startsWith(rosterPath);
  const tradesPath = `/team/${teamId}/trades`;
  const isTradesActive = pathname.startsWith(tradesPath);

  // Kept for FA active-state detection on roster page (used by More menu isFaTab guard)
  const isFaTab = isRosterActive && searchParams.get("tab") === "freeAgents";

  useEffect(() => {
    if (!moreOpen) return;
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreOpen]);

  // 6 core tabs; Standings swaps for Playoffs; My Season swaps for Draft Queue
  const tabs = [
    {
      label: "Matchup",
      href: `/team/${teamId}/matchup`,
      active: pathname.startsWith(`/team/${teamId}/matchup`),
    },
    {
      label: "Morning Skate",
      href: `/team/${teamId}/morning-skate`,
      active: pathname.startsWith(`/team/${teamId}/morning-skate`),
    },
    {
      label: "My Roster",
      href: rosterPath,
      active: (isRosterActive && !isFaTab) || pathname.startsWith(`/team/${teamId}/lineup`),
    },
    {
      label: "Trades",
      href: tradesPath,
      active: isTradesActive,
    },
    // Standings OR Playoffs — never both
    playoffStatus !== "NOT_STARTED"
      ? { label: "Playoffs", href: `/team/${teamId}/bracket`, active: pathname.startsWith(`/team/${teamId}/bracket`) }
      : { label: "Standings", href: `/team/${teamId}/standings`, active: pathname.startsWith(`/team/${teamId}/standings`) },
    // My Season OR Draft Queue — never both
    leagueStatus === "PRE_DRAFT"
      ? { label: "Draft Queue", href: `/team/${teamId}/draft-prep`, active: pathname.startsWith(`/team/${teamId}/draft-prep`) }
      : { label: "My Season", href: `/team/${teamId}/schedule`, active: pathname.startsWith(`/team/${teamId}/schedule`) },
  ];

  const moreTabs = [
    { label: "Scoreboard",   href: `/team/${teamId}/scoreboard`,   active: pathname.startsWith(`/team/${teamId}/scoreboard`) },
    { label: "Transactions", href: `/team/${teamId}/transactions`,  active: pathname.startsWith(`/team/${teamId}/transactions`) },
    { label: "Analysis",     href: `/team/${teamId}/analysis`,      active: pathname.startsWith(`/team/${teamId}/analysis`) },
    { label: "Settings",     href: `/team/${teamId}/settings`,      active: pathname.startsWith(`/team/${teamId}/settings`) },
    ...(hasTrophies
      ? [{ label: "Trophies", href: `/team/${teamId}/trophies`, active: pathname.startsWith(`/team/${teamId}/trophies`) }]
      : []),
  ];

  const isMoreActive = moreTabs.some((t) => t.active);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    color: active ? "var(--text)" : "var(--faint)",
    textDecoration: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    marginBottom: -1,
    whiteSpace: "nowrap",
    flexShrink: 0,
    transition: "color 0.15s",
  });

  return (
    <nav
      aria-label="Franchise navigation"
      style={{
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 28,
        gap: 0,
        minWidth: 0,
      }}
    >
      {/* Scrollable tab strip — inner div carries overflow-x:auto so the More
          dropdown (a sibling, not a child) is never clipped */}
      <div
        className="team-nav"
        style={{ display: "flex", flex: "1 1 auto", minWidth: 0, alignItems: "center" }}
      >
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            style={tabStyle(tab.active)}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* More ··· overflow menu — outside the scroll container so dropdown isn't clipped */}
      <div ref={moreRef} style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          aria-label="More navigation options"
          style={{
            ...tabStyle(isMoreActive),
            background: "none",
            border: "none",
            borderBottom: isMoreActive ? "2px solid var(--accent)" : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          More
          {isMoreActive
            ? <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", display: "inline-block", marginLeft: 2, flexShrink: 0 }} aria-hidden="true" />
            : <span style={{ color: "var(--faint)", letterSpacing: 1 }} aria-hidden="true">···</span>
          }
        </button>

        {moreOpen && (
          <div
            role="menu"
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              background: "var(--card)",
              border: "1px solid rgba(148,163,184,0.15)",
              borderRadius: 10,
              padding: "6px 0",
              minWidth: 160,
              zIndex: 100,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            {moreTabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                role="menuitem"
                onClick={() => setMoreOpen(false)}
                aria-current={tab.active ? "page" : undefined}
                style={{
                  display: "block",
                  padding: "10px 16px",
                  fontSize: 14,
                  color: tab.active ? "var(--text)" : "var(--faint)",
                  fontWeight: tab.active ? 600 : 400,
                  textDecoration: "none",
                  background: tab.active ? "rgba(143,193,232,0.06)" : undefined,
                }}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* League escape hatch — visually distinct breadcrumb, not a peer tab */}
      <Link
        href={`/league/${leagueId}`}
        aria-label="Back to league dashboard"
        style={{
          marginLeft: "auto",
          padding: "14px 4px 14px 16px",
          fontSize: 12,
          color: "var(--faint)",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
          borderLeft: "1px solid rgba(148,163,184,0.1)",
        }}
      >
        <span aria-hidden="true">← </span>League
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
