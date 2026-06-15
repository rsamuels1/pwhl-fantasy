import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { User, FantasyTeam, FantasyLeague } from "@prisma/client";

const USER_SESSION_COOKIE = "pwhl_user_email";

export function getAuthCookie() {
  return cookies().get(USER_SESSION_COOKIE)?.value ?? null;
}

export function setAuthCookie(response: NextResponse, email: string) {
  response.cookies.set({
    name: USER_SESSION_COOKIE,
    value: email,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: USER_SESSION_COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const email = getAuthCookie();
  if (!email) return null;
  return prisma.user.findUnique({ where: { email } });
}

// ── Page-level guards (throw/redirect) ───────────────────────────────────────

// Returns the current user or redirects to /login with returnTo preserved.
export async function requireAuth(returnTo?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const destination = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
    redirect(destination);
  }
  return user;
}

// Returns the user's FantasyTeam in the given league, or calls notFound().
// Use in league pages to enforce membership.
export async function requireLeagueMember(
  leagueId: string,
  userId: string
): Promise<FantasyTeam> {
  const team = await prisma.fantasyTeam.findFirst({
    where: { leagueId, ownerId: userId },
  });
  if (!team) notFound();
  return team;
}

// Returns the user's FantasyTeam with its league, or calls notFound() if the user doesn't own it.
export async function requireTeamOwner(
  teamId: string,
  userId: string
): Promise<FantasyTeam & { league: Pick<FantasyLeague, "id" | "name" | "playoffStatus"> }> {
  const team = await prisma.fantasyTeam.findUnique({
    where: { id: teamId },
    include: { league: { select: { id: true, name: true, playoffStatus: true } } },
  });
  if (!team || team.ownerId !== userId) notFound();
  return team as FantasyTeam & { league: Pick<FantasyLeague, "id" | "name" | "playoffStatus"> };
}

// Returns the league if the user is commissioner, otherwise calls notFound().
export async function requireCommissioner(
  leagueId: string,
  userId: string
): Promise<FantasyLeague> {
  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
  });
  if (!league || league.commissionerId !== userId) notFound();
  return league;
}

// Returns the user's FantasyTeam (may be null) and isCommissioner flag for the league.
// Calls notFound() if the user is neither a team owner nor commissioner in the league.
export async function requireLeagueAccess(
  leagueId: string,
  userId: string
): Promise<{ myTeam: FantasyTeam | null; isCommissioner: boolean }> {
  const [team, league] = await Promise.all([
    prisma.fantasyTeam.findFirst({
      where: { leagueId, ownerId: userId },
    }),
    prisma.fantasyLeague.findFirst({
      where: { id: leagueId },
      select: { commissionerId: true },
    }),
  ]);
  const isCommissioner = league?.commissionerId === userId;
  if (!team && !isCommissioner) notFound();
  return { myTeam: team, isCommissioner };
}

// ── API-level guards (return NextResponse on failure) ────────────────────────

// Reads the auth cookie from the request and looks up the user.
// Returns the User, or a 401 NextResponse.
export async function apiRequireAuth(
  req: NextRequest
): Promise<User | NextResponse> {
  const email = req.cookies.get(USER_SESSION_COOKIE)?.value;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return user;
}

// Returns the user's FantasyTeam in the league, or a 403 NextResponse.
export async function apiRequireLeagueMember(
  leagueId: string,
  userId: string
): Promise<FantasyTeam | NextResponse> {
  const team = await prisma.fantasyTeam.findFirst({
    where: { leagueId, ownerId: userId },
  });
  if (!team) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return team;
}

// Returns the league if the user is commissioner, or a 403 NextResponse.
export async function apiRequireCommissioner(
  leagueId: string,
  userId: string
): Promise<FantasyLeague | NextResponse> {
  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
  });
  if (!league || league.commissionerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return league;
}

// ── Founder guards ────────────────────────────────────────────────────────────

function isFounderEmail(email: string): boolean {
  const list = process.env.FOUNDER_EMAILS ?? "";
  return list.split(",").map((e) => e.trim()).includes(email);
}

// Synchronous helper: checks if a user (by email) is a founder.
// Use this in client components where you already have the user object.
export function isFounder(userEmail: string): boolean {
  return isFounderEmail(userEmail);
}

// Page-level: returns the authenticated user if they are a founder, else notFound().
export async function requireFounder(): Promise<User> {
  const user = await requireAuth("/founder");
  if (!isFounderEmail(user.email)) notFound();
  return user;
}

// API-level: returns the User or a 403 NextResponse.
export async function apiRequireFounder(
  req: NextRequest
): Promise<User | NextResponse> {
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!isFounderEmail(auth.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return auth;
}
