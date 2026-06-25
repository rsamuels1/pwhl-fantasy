import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie, clearSession, USER_SESSION_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(USER_SESSION_COOKIE)?.value;
  if (token) void clearSession(token);
  const home = new URL("/", req.url);
  const response = NextResponse.redirect(home);
  clearAuthCookie(response);
  return response;
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(USER_SESSION_COOKIE)?.value;
  if (token) void clearSession(token);
  const response = NextResponse.json({ message: "Logged out" });
  clearAuthCookie(response);
  return response;
}
