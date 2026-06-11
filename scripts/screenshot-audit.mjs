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

// Pages to capture
const PAGES = [
  { name: "01-homepage",  url: "/",                                          auth: false },
  { name: "02-dashboard", url: "/dashboard",                                 auth: true  },
  { name: "03-matchup",   url: `/team/${TEAM_ID}/matchup`,                   auth: true  },
  { name: "04-lineup",    url: `/team/${TEAM_ID}/lineup`,                    auth: true  },
  { name: "05-roster",    url: `/team/${TEAM_ID}/roster`,                    auth: true  },
  { name: "06-league",    url: `/league/${LEAGUE_ID}`,                       auth: true  },
  { name: "07-standings", url: `/league/${LEAGUE_ID}/standings`,             auth: true  },
  { name: "08-draft",     url: `/draft/${LEAGUE_ID}?team=${TEAM_ID}`,        auth: true  },
  { name: "09-settings",  url: `/league/${LEAGUE_ID}/settings`,              auth: true  },
  { name: "10-admin",     url: `/league/${LEAGUE_ID}/admin`,                 auth: true  },
  { name: "11-invite",    url: `/invite/${LEAGUE_ID}`,                       auth: false },
  { name: "12-login",     url: "/login",                                     auth: false },
  { name: "13-create-league", url: "/create-league",                         auth: false },
  { name: "14-join-league",   url: "/join-league",                           auth: false },
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

  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
    isMobile: viewport.isMobile ?? false,
  });

  // Log in once — set auth cookie
  const loginPage = await context.newPage();
  const loginRes = await loginPage.request.post(`${BASE}/api/auth/login`, {
    data: { email: AUTH_EMAIL, displayName: "Commish" },
    headers: { "Content-Type": "application/json" },
  });
  const loginData = await loginRes.json();
  console.log("  Auth cookie set for", AUTH_EMAIL, "→ redirectTo:", loginData.redirectTo ?? "(no redirect)");
  await loginPage.close();

  for (const page of PAGES) {
    const destFile = join(vpDir, `${page.name}.png`);
    const pg = await context.newPage();

    try {
      await pg.goto(`${BASE}${page.url}`, { waitUntil: "networkidle", timeout: 15000 });

      // Wait for main content to appear
      await pg.waitForTimeout(600);

      // Full-page screenshot
      await pg.screenshot({ path: destFile, fullPage: true });
      console.log(`  ✓ ${page.name}`);
    } catch (err) {
      console.error(`  ✗ ${page.name} — ${err.message}`);
    } finally {
      await pg.close();
    }
  }

  await context.close();
}

await browser.close();

// Zip it up
if (existsSync(ZIP_PATH)) rmSync(ZIP_PATH);
execSync(`cd "${REPO_ROOT}" && zip -r "${ZIP_PATH}" audit-screenshots/`, { stdio: "inherit" });
console.log(`\n✅ Done — ${ZIP_PATH}`);
