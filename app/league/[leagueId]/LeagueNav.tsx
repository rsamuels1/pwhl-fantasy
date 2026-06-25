"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

interface Props {
  leagueId: string;
  isCommissioner: boolean;
  playoffStatus: string;
  showSim: boolean;
}

export default function LeagueNav({ leagueId, isCommissioner, playoffStatus, showSim }: Props) {
  const pathname = usePathname();
  const basePath = `/league/${leagueId}`;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

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

  const primaryTabs = [
    { label: "Overview",   href: basePath,                 active: pathname === basePath },
    { label: "Standings",  href: `${basePath}/standings`,  active: pathname.startsWith(`${basePath}/standings`) },
    { label: "Scoreboard", href: `${basePath}/matchups`,   active: pathname.startsWith(`${basePath}/matchups`) },
    ...(playoffStatus !== "NOT_STARTED"
      ? [{ label: "Playoffs", href: `${basePath}/bracket`, active: pathname.startsWith(`${basePath}/bracket`) }]
      : []),
  ];

  const moreTabs = [
    { label: "How it works", href: `${basePath}/how-it-works`, active: pathname.startsWith(`${basePath}/how-it-works`) },
    { label: "Rules",        href: `${basePath}/settings`,     active: pathname.startsWith(`${basePath}/settings`) },
    { label: "Records",      href: `${basePath}/records`,      active: pathname.startsWith(`${basePath}/records`) },
    { label: "Leaders",      href: `${basePath}/roster`,       active: pathname.startsWith(`${basePath}/roster`) },
    { label: "Transactions", href: `${basePath}/transactions`,  active: pathname.startsWith(`${basePath}/transactions`) },
    ...(showSim ? [{ label: "Sim →", href: `${basePath}/sim`, active: pathname.startsWith(`${basePath}/sim`) }] : []),
  ];

  const isMoreActive = moreTabs.some((t) => t.active);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "12px 16px",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? "var(--text)" : "var(--faint)",
    textDecoration: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    marginBottom: -1,
    whiteSpace: "nowrap",
    flexShrink: 0,
    transition: "color 0.18s ease",
    display: "inline-flex",
    alignItems: "center",
  });

  return (
    <nav
      aria-label="League navigation"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        marginBottom: 24,
        borderBottom: "1px solid var(--border)",
        minWidth: 0,
      }}
    >
      {/* Scrollable primary tab strip — inner div carries overflow so More dropdown isn't clipped */}
      <div
        className="team-nav"
        style={{ display: "flex", flex: "1 1 auto", minWidth: 0, alignItems: "center" }}
      >
        {primaryTabs.map((tab) => (
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

      {/* More ··· menu — outside scroll container so dropdown isn't clipped */}
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

      {/* Admin — right-pinned, visually separated from peer tabs */}
      {isCommissioner && (
        <Link
          href={`${basePath}/admin`}
          aria-current={pathname.startsWith(`${basePath}/admin`) ? "page" : undefined}
          style={{
            marginLeft: "auto",
            padding: "12px 4px 12px 16px",
            fontSize: 12,
            color: pathname.startsWith(`${basePath}/admin`) ? "var(--text)" : "var(--faint)",
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
            borderLeft: "1px solid rgba(148,163,184,0.1)",
          }}
        >
          ⚙ Admin
        </Link>
      )}
    </nav>
  );
}
