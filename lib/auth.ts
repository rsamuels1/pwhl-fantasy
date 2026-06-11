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
