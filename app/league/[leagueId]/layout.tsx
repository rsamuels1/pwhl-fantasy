import Link from "next/link";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import NotificationBell from "@/components/NotificationBell";
import FeedbackWidget from "@/components/FeedbackWidget";
import { LogoShield } from "@/components/LogoShield";

interface LeagueLayoutProps {
  children: ReactNode;
  params: Promise<{ leagueId: string }>;
}

export default async function LeagueLayout({ children, params }: LeagueLayoutProps) {
  const { leagueId } = await params;
  const basePath = `/league/${leagueId}`;

  const [user, leagueAndDraft] = await Promise.all([
    getCurrentUser(),
    prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      select: {
        commissionerId: true, name: true, isReplay: true,
        status: true, playoffStatus: true, betaStatus: true,
        draft: { select: { status: true } },
      },
    }),
  ]);

  const league = leagueAndDraft;
  const isCommissioner = !!user && user.id === league?.commissionerId;

  const [myTeam, unreadCount] = await Promise.all([
    user
      ? prisma.fantasyTeam.findFirst({ where: { leagueId, ownerId: user.id }, select: { id: true } })
      : Promise.resolve(null),
    user
      ? prisma.notification.count({ where: { userId: user.id, leagueId, readAt: null } }).catch(() => 0)
      : Promise.resolve(0),
  ]);

  const navItems = [
    { label: "Overview", href: `${basePath}` },
    { label: "Standings", href: `${basePath}/standings` },
    { label: "Morning Skate", href: `${basePath}/morning-skate` },
    { label: "Scoreboard", href: `${basePath}/matchups` },
    { label: "Playoffs", href: `${basePath}/bracket` },
    { label: "Records", href: `${basePath}/records` },
    { label: "Rosters", href: `${basePath}/roster` },
    { label: "Transactions", href: `${basePath}/transactions` },
    { label: "How it works", href: `${basePath}/how-it-works` },
    ...(league?.isReplay && isCommissioner ? [{ label: "Sim →", href: `${basePath}/sim` }] : []),
  ];
  const adminItem = isCommissioner
    ? { label: "⚙ Admin", href: `${basePath}/admin` }
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        <header style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <Link href="/dashboard" style={{ display: "flex", alignItems: "center", opacity: 0.7, transition: "opacity 0.15s" }}>
                <LogoShield size={22} />
              </Link>
              <span style={{ color: "var(--text)", fontSize: 17, fontWeight: 700 }}>{league?.name ?? "League"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {user && (
                <NotificationBell initialCount={unreadCount} leagueId={leagueId} />
              )}
              {myTeam && (
                <Link
                  href={`/team/${myTeam.id}/matchup`}
                  style={{
                    fontSize: 13,
                    color: "var(--accent-strong)",
                    textDecoration: "none",
                    padding: "6px 14px",
                    borderRadius: 999,
                    background: "rgba(143,193,232,0.12)",
                    border: "1px solid rgba(143,193,232,0.3)",
                  }}
                >
                  My Franchise →
                </Link>
              )}
            </div>
          </div>
        </header>


        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0,
            marginBottom: 24,
            alignItems: "center",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {navItems.map((item) => {
            const isActive = item.href === basePath ||
              (item.href !== basePath && item.href.startsWith(basePath + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 16px",
                  borderRadius: 0,
                  background: "transparent",
                  color: isActive ? "var(--text)" : "var(--faint)",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  transition: "color 0.18s ease, border-color 0.18s ease",
                  marginBottom: "-1px",
                }}
              >
                {item.label}
              </Link>
            );
          })}
          {adminItem && (
            <Link
              href={adminItem.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 16px",
                borderRadius: 0,
                border: "none",
                borderBottom: "2px solid transparent",
                color: "var(--faint)",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 400,
                marginLeft: "auto",
                transition: "color 0.18s ease, border-color 0.18s ease",
                marginBottom: "-1px",
              }}
            >
              {adminItem.label}
            </Link>
          )}
        </nav>

        {league?.betaStatus === "ACTIVE" && (
          <div style={{
            background: "rgba(245,201,123,0.08)",
            border: "1px solid rgba(245,201,123,0.3)",
            borderRadius: 6,
            padding: "8px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "var(--gold)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span>Beta League</span>
            <span style={{ color: "var(--faint)" }}>·</span>
            <span style={{ color: "var(--dim)" }}>Using 2025-26 replay data. Your feedback shapes the real thing.</span>
          </div>
        )}

        <main className="bottom-nav-pad">{children}</main>
        {myTeam && <BottomNav teamId={myTeam.id} leagueId={leagueId} />}
        <FeedbackWidget leagueId={leagueId} />
      </div>
    </div>
  );
}
