import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const home = new URL("/", req.url);
  const response = NextResponse.redirect(home);
  clearAuthCookie(response);
  return response;
}

export async function POST() {
  const response = NextResponse.json({ message: "Logged out" });
  clearAuthCookie(response);
  return response;
}
