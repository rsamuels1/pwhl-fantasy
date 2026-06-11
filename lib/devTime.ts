import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const COOKIE = "pwhl_dev_sim_date";

function simEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_SIM_DATE === "true";
}

export async function getDevNow(): Promise<number> {
  if (!simEnabled()) return Date.now();
  const store = await cookies();
  const sim = store.get(COOKIE)?.value;
  if (!sim) return Date.now();
  const ms = new Date(sim).getTime();
  return isNaN(ms) ? Date.now() : ms;
}

export function getDevNowFromRequest(req: NextRequest): number {
  if (!simEnabled()) return Date.now();
  const sim = req.cookies.get(COOKIE)?.value;
  if (!sim) return Date.now();
  const ms = new Date(sim).getTime();
  return isNaN(ms) ? Date.now() : ms;
}
