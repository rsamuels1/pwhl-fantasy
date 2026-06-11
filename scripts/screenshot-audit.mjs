// screenshot-audit.mjs — Playwright screenshot script for ChatGPT UX audit
// Usage: node scripts/screenshot-audit.mjs
// Requires dev server running on :3000

import { chromium } from "/Users/ryansamuelson/.npm/_npx/5e2e484947874241/node_modules/playwright/index.mjs";
import { execSync } from "child_process";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const OUT_DIR = join(REPO_ROOT, "audit-screenshots");
const ZIP_PATH = join(REPO_ROOT, "pwhl-audit-screenshots.zip");

const BASE = "http://localhost:3000";
const AUTH_EMAIL = "commish@dev.local";
const LEAGUE_ID = "cmq8mmity0002qpiaed7atip4";
const TEAM_ID   = "cmq8mmiwl0004qpiavbk104cb";

// ── Logged-out pages ──────────────────────────────────────────────────────────
const LOGGED_OUT = [
  { name: "01-homepage",      url: "/" },
  { name: "02-login",         url: "/login" },
  { name: "03-register",      url: "/create-league" },
];

// ── Logged-in (commissioner) pages ───────────────────────────────────────────
const LOGGED_IN = [
  { name: "04-dashboard",          url: "/dashboard" },
  { name: "05-team-matchup",       url: `/team/${TEAM_ID}/matchup` },
  { name: "06-team-roster",        url: `/team/${TEAM_ID}/roster` },
  { name: "07-team-lineup",        url: `/team/${TEAM_ID}/lineup` },
  { name: "08-league-overview",    url: `/league/${LEAGUE_ID}` },
  { name: "09-league-standings",   url: `/league/${LEAGUE_ID}/standings` },
  { name: "10-league-matchups",    url: `/league/${LEAGUE_ID}/matchups` },
  { name: "11-draft-room",         url: `/draft/${LEAGUE_ID}?team=${TEAM_ID}` },
  { name: "12-league-settings",    url: `/league/${LEAGUE_ID}/settings` },
  { name: "13-commissioner-admin", url: `/league/${LEAGUE_ID}/admin` },
];

const VIEWPORTS = [
  { label: "desktop", width: 1280, height: 900 },
  { label: "mobile",  width: 390,  height: 844, isMobile: true, deviceScaleFactor: 2 },
];

// Clean output dir
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const viewport of VIEWPORTS) {
  console.log(`\n── ${viewport.label.toUpperCase()} (${viewport.width}×${viewport.height}) ──`);
  const vpDir = join(OUT_DIR, viewport.label);
  mkdirSync(vpDir, { recursive: true });

  // ── Logged-out context ────────────────────────────────────────────────────
  const loggedOutCtx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
    isMobile: viewport.isMobile ?? false,
  });

  console.log("  [logged-out]");
  for (const page of LOGGED_OUT) {
    const destFile = join(vpDir, `${page.name}.png`);
    const pg = await loggedOutCtx.newPage();
    try {
      await pg.goto(`${BASE}${page.url}`, { waitUntil: "networkidle", timeout: 15000 });
      await pg.waitForTimeout(600);
      await pg.screenshot({ path: destFile, fullPage: true });
      console.log(`    ✓ ${page.name}`);
    } catch (err) {
      console.error(`    ✗ ${page.name} — ${err.message}`);
    } finally {
      await pg.close();
    }
  }
  await loggedOutCtx.close();

  // ── Logged-in context ─────────────────────────────────────────────────────
  const loggedInCtx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
    isMobile: viewport.isMobile ?? false,
  });

  // Authenticate once
  const loginPage = await loggedInCtx.newPage();
  const loginRes = await loginPage.request.post(`${BASE}/api/auth/login`, {
    data: { email: AUTH_EMAIL, displayName: "Commish" },
    headers: { "Content-Type": "application/json" },
  });
  const loginData = await loginRes.json();
  console.log(`  [logged-in] auth → ${loginData.redirectTo ?? "(no redirect)"}`);
  await loginPage.close();

  console.log("  [logged-in]");
  for (const page of LOGGED_IN) {
    const destFile = join(vpDir, `${page.name}.png`);
    const pg = await loggedInCtx.newPage();
    try {
      await pg.goto(`${BASE}${page.url}`, { waitUntil: "networkidle", timeout: 20000 });
      await pg.waitForTimeout(800);
      await pg.screenshot({ path: destFile, fullPage: true });
      console.log(`    ✓ ${page.name}`);
    } catch (err) {
      console.error(`    ✗ ${page.name} — ${err.message}`);
    } finally {
      await pg.close();
    }
  }
  await loggedInCtx.close();
}

await browser.close();

// Zip it up
if (existsSync(ZIP_PATH)) rmSync(ZIP_PATH);
execSync(`cd "${REPO_ROOT}" && zip -r "${ZIP_PATH}" audit-screenshots/`, { stdio: "inherit" });
console.log(`\n✅ Done — ${ZIP_PATH}`);
