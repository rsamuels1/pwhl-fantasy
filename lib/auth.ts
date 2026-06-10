import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

export async function getCurrentUser() {
  const email = getAuthCookie();
  if (!email) return null;
  return prisma.user.findUnique({
    where: { email },
  });
}
