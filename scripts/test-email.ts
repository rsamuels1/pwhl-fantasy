// scripts/test-email.ts
// Sends a test email via Resend so you can verify templates in the dashboard.
// Run with: npx tsx scripts/test-email.ts --to you@example.com [--template signup|invite|magic]
//
// Reads RESEND_API_KEY from .env.local. Does NOT require EMAIL_RESEND_ENABLED.
// Check Resend dashboard → Emails after running.

import { readFileSync } from "fs";
import { resolve } from "path";
import { Resend } from "resend";

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

const args = process.argv.slice(2);
const toIdx = args.indexOf("--to");
const templateIdx = args.indexOf("--template");

const to = toIdx !== -1 ? args[toIdx + 1] : null;
const template = templateIdx !== -1 ? args[templateIdx + 1] : "signup";

if (!to) {
  console.error("❌  --to <email> is required");
  console.error("    npx tsx scripts/test-email.ts --to you@example.com [--template signup|invite|magic]");
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error("❌  RESEND_API_KEY not set — add it to .env.local or export it before running.");
  process.exit(1);
}

const APP_URL = "https://beta.fantasy.dykedb.org";
const FROM = "PWHL GM <noreply@dykedb.org>";

function shell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="padding-bottom:24px;">
            <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">PWHL GM</span>
          </td>
        </tr>
        <tr>
          <td style="background:#1a1f2e;border-radius:12px;padding:32px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding-top:20px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#6b7280;">
              You're receiving this because you have an account at
              <a href="${APP_URL}" style="color:#6b7280;">${APP_URL.replace("https://", "")}</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const cta = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;margin-top:24px;padding:14px 28px;background:#4f46e5;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;border-radius:8px;">${label}</a>`;
const h1 = (text: string) =>
  `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff;">${text}</h1>`;
const p = (text: string) =>
  `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#94a3b8;">${text}</p>`;

const templates: Record<string, { subject: string; html: string }> = {
  signup: {
    subject: "You're on the PWHL GM waitlist",
    html: shell(`
      ${h1("You're on the list 🏒")}
      ${p("Thanks for signing up for PWHL GM beta access. We'll email you when your spot opens up — usually within a few days.")}
      ${p("PWHL GM is a fantasy hockey app for the Professional Women's Hockey League. Draft real players, set your lineup, and compete in weekly head-to-head matchups.")}
      ${p(`<span style="font-size:13px;color:#6b7280;display:block;margin-top:16px;">Can't wait? Forward this to friends who'd want to play — leagues need 6–12 managers.</span>`)}
    `),
  },
  invite: {
    subject: "You're in — PWHL GM Beta",
    html: shell(`
      ${h1("Test User, you're in! 🎉")}
      ${p("Your beta access to PWHL GM is approved. Log in to finish setting up your league and invite your friends before the draft.")}
      ${cta(`${APP_URL}/login?returnTo=%2Fleague%2Ftest-league-id`, "Enter PWHL GM →")}
      ${p(`<span style="font-size:13px;color:#6b7280;display:block;margin-top:16px;">Reply to this email with any questions — we read everything.</span>`)}
    `),
  },
  magic: {
    subject: "Your PWHL GM login link",
    html: shell(`
      ${h1("Hey Test User 👋")}
      ${p("Here's your one-click login link. It expires in 15 minutes and can only be used once.")}
      ${cta(`${APP_URL}/api/auth/verify?token=test-token-abc123`, "Log in to PWHL GM →")}
      ${p(`<span style="font-size:13px;color:#6b7280;display:block;margin-top:16px;">If you didn't request this, you can safely ignore it.</span>`)}
    `),
  },
};

const chosen = templates[template];
if (!chosen) {
  console.error(`❌  Unknown template "${template}". Choose: signup, invite, magic`);
  process.exit(1);
}

async function main() {
  console.log(`Sending "${template}" template to ${to} via Resend…`);

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: to as string,
    subject: chosen.subject,
    html: chosen.html,
  });

  if (error) {
    console.error("❌  Resend error:", error);
    process.exit(1);
  }

  console.log(`✅  Sent. Email ID: ${data?.id}`);
  console.log(`    Check Resend dashboard → Emails to see delivery status and preview.`);
}

main().catch((err) => {
  console.error("❌  Unexpected error:", err);
  process.exit(1);
});
