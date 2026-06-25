// scripts/test-posthog.ts
// Smoke-test PostHog connectivity by sending a single test event and flushing.
// Run with: npx tsx scripts/test-posthog.ts
//
// Reads POSTHOG_KEY and POSTHOG_HOST from .env.local (same values the app uses).
// Check PostHog → Activity feed after running — you should see "analytics_smoke_test"
// with distinctId "smoke-test-script" within ~5 seconds.

import { readFileSync } from "fs";
import { resolve } from "path";
import { PostHog } from "posthog-node";

// Load .env.local without dotenv
function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env.local absent — rely on real env vars
  }
}

loadEnvLocal();

const key = process.env.POSTHOG_KEY;
const host = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

if (!key) {
  console.error("❌  POSTHOG_KEY not set — add it to .env.local or export it before running.");
  process.exit(1);
}

console.log(`Connecting to PostHog at ${host}`);
console.log(`Key: ${key.slice(0, 12)}…`);

const client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });

const testId = `smoke-test-script`;
const timestamp = new Date().toISOString();

client.capture({
  distinctId: testId,
  event: "analytics_smoke_test",
  properties: {
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "local",
    timestamp,
    source: "scripts/test-posthog.ts",
  },
});

console.log(`\nEvent fired: analytics_smoke_test`);
console.log(`  distinctId : ${testId}`);
console.log(`  timestamp  : ${timestamp}`);
console.log(`\nFlushing…`);

client.shutdown().then(() => {
  console.log("✅  Flush complete. Check PostHog → Activity for \"analytics_smoke_test\".");
  console.log("    If nothing appears within 30s, verify the key and host are correct.");
});
