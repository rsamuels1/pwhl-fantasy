// Runs automatically before `npm run build` (npm's implicit "prebuild" hook).
//
// `npm run build` runs `prisma migrate deploy`, which mutates whatever database
// DATABASE_URL/DIRECT_URL points at. On a developer machine that's almost never
// what you want — see the incident where a local build silently applied
// migrations to production because .env had DATABASE_URL pointed at prod.
//
// Vercel's own production build is the one place this SHOULD run against prod,
// so we no-op whenever we're clearly running on a CI/platform build rather than
// a developer's machine.
import fs from "node:fs";
import path from "node:path";

if (process.env.VERCEL || process.env.CI) {
  process.exit(0);
}

function hostOf(url: string | undefined | null): string | null {
  if (!url) return null;
  const match = url.match(/@([^/]+)/);
  if (!match) return null;
  return match[1].replace(/-pooler$/, "").replace(/:\d+$/, "");
}

// Read known-production hosts out of .env.local (gitignored, local-only) rather
// than hardcoding credentials or hostnames into a committed file.
function prodHostsFromEnvLocal(): Set<string> {
  const hosts = new Set<string>();
  const envLocalPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envLocalPath)) return hosts;
  const contents = fs.readFileSync(envLocalPath, "utf8");
  for (const line of contents.split("\n")) {
    const match = line.match(/^DATABASE_URL_PROD=(.*)$/);
    if (match) {
      const host = hostOf(match[1].trim());
      if (host) hosts.add(host);
    }
  }
  return hosts;
}

const prodHosts = prodHostsFromEnvLocal();
if (prodHosts.size === 0) {
  // No DATABASE_URL_PROD recorded locally — nothing to compare against, so
  // there's nothing safe to assert. Don't block the build on missing config.
  process.exit(0);
}

const currentHosts = [hostOf(process.env.DATABASE_URL), hostOf(process.env.DIRECT_URL)].filter(
  (h): h is string => h !== null
);

const hit = currentHosts.find((h) => prodHosts.has(h));
if (hit) {
  console.error(
    `\n✖ Refusing to run "npm run build" locally: DATABASE_URL/DIRECT_URL resolves to ${hit},\n` +
      `  which matches DATABASE_URL_PROD in .env.local. This build runs "prisma migrate deploy",\n` +
      `  which would apply migrations directly to production.\n\n` +
      `  Point .env at the staging (preview) branch instead. If this really is an intentional\n` +
      `  platform build, it should be running with VERCEL=1 or CI=true set.\n`
  );
  process.exit(1);
}

process.exit(0);
