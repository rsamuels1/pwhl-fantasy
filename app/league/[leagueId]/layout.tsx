import Link from "next/link";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import NotificationBell from "@/components/NotificationBell";
import FeedbackWidget from "@/components/FeedbackWidget";

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
        status: true, playoffStatus: true,
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
    { label: "Schedule", href: `${basePath}/matchups` },
    { label: "Playoffs", href: `${basePath}/bracket` },
    { label: "Rosters", href: `${basePath}/roster` },
    { label: "Trades", href: `${basePath}/trades` },
    { label: "Transactions", href: `${basePath}/transactions` },
    ...(league?.isReplay && isCommissioner ? [{ label: "Sim →", href: `${basePath}/sim` }] : []),
  ];
  const adminItem = isCommissioner
    ? { label: "⚙ Settings", href: `${basePath}/admin` }
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        <header style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: 22, fontWeight: 700 }}>
                PWHL Fantasy
              </Link>
              <span style={{ color: "#94a3b8", fontSize: 14 }}>{league?.name ?? "League"}</span>
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
                    color: "#a5b4fc",
                    textDecoration: "none",
                    padding: "6px 14px",
                    borderRadius: 999,
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.3)",
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
            gap: 10,
            marginBottom: 24,
            alignItems: "center",
          }}
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 14px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                color: "#e2e8f0",
                textDecoration: "none",
                fontSize: 13,
              }}
            >
              {item.label}
            </Link>
          ))}
          {adminItem && (
            <Link
              href={adminItem.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.15)",
                color: "#64748b",
                textDecoration: "none",
                fontSize: 12,
                marginLeft: "auto",
              }}
            >
              {adminItem.label}
            </Link>
          )}
        </nav>

        <main className="bottom-nav-pad">{children}</main>
        {myTeam && <BottomNav teamId={myTeam.id} leagueId={leagueId} />}
        <FeedbackWidget leagueId={leagueId} />
      </div>
    </div>
  );
}
