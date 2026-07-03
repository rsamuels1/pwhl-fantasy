// lib/services/email-service.ts
// Real email delivery via Resend. Active when EMAIL_RESEND_ENABLED=true + RESEND_API_KEY set.
// Falls back to logger.info (stub) when either is absent so dev/staging stay noise-free.

import { logger } from "@/lib/logger";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://beta.fantasy.dykedb.org";
const FROM = "PWHL GM <noreply@dykedb.org>";
const enabled = process.env.EMAIL_RESEND_ENABLED === "true";

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!enabled) {
    logger.info(`[EMAIL stub] to=${to} subject="${subject}"`);
    return;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("[EMAIL] RESEND_API_KEY not set — skipping send");
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ── Shared template shell ──────────────────────────────────────────────────

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

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:14px 28px;background:#4f46e5;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;border-radius:8px;">${label}</a>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff;">${text}</h1>`;
}

function para(text: string): string {
  return `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#94a3b8;">${text}</p>`;
}

// ── Exported send functions ────────────────────────────────────────────────

export async function sendMagicLink(
  email: string,
  displayName: string,
  rawToken: string,
  returnTo?: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/api/auth/verify?token=${rawToken}${
    returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""
  }`;

  await send(
    email,
    "Your PWHL GM login link",
    shell(`
      ${heading(`Hey ${displayName} 👋`)}
      ${para("Here's your one-click login link. It expires in 15 minutes and can only be used once.")}
      ${ctaButton(verifyUrl, "Log in to PWHL GM →")}
      ${para(`<span style="font-size:13px;color:#6b7280;display:block;margin-top:16px;">If you didn't request this, you can safely ignore it.</span>`)}
    `)
  );
}

export async function sendOnClock(
  email: string,
  displayName: string,
  rawToken: string,
  leagueId: string,
  teamId: string,
  pickN: number,
  totalPicks: number
): Promise<void> {
  const returnTo = `/draft/${leagueId}?team=${teamId}`;
  const verifyUrl = `${APP_URL}/api/auth/verify?token=${rawToken}&returnTo=${encodeURIComponent(returnTo)}`;

  await send(
    email,
    `You're on the clock! Pick ${pickN} of ${totalPicks}`,
    shell(`
      ${heading("⏱ You're on the clock")}
      ${para(`${displayName}, it's your turn to pick. You have a limited time before the draft auto-picks for you.`)}
      ${para(`<strong style="color:#ffffff;">Pick ${pickN} of ${totalPicks}</strong>`)}
      ${ctaButton(verifyUrl, "Make your pick →")}
    `)
  );
}

export async function sendTradeReceived(
  email: string,
  displayName: string,
  traderName: string,
  leagueName: string,
  actionUrl: string
): Promise<void> {
  await send(
    email,
    `${traderName} sent you a trade offer`,
    shell(`
      ${heading("📬 New trade offer")}
      ${para(`${displayName}, <strong style="color:#ffffff;">${traderName}</strong> has sent you a trade proposal in <strong style="color:#ffffff;">${leagueName}</strong>.`)}
      ${para("Review it before it expires.")}
      ${ctaButton(`${APP_URL}${actionUrl}`, "Review trade →")}
    `)
  );
}

export async function sendBetaWelcome(
  email: string,
  displayName: string,
  role: "commissioner" | "manager",
  magicLinkUrl: string
): Promise<void> {
  const roleLabel = role === "commissioner" ? "commissioner" : "manager";
  const actionLabel = role === "commissioner" ? "Open your league admin →" : "Enter the league →";

  await send(
    email,
    "You're in — PWHL GM beta access",
    shell(`
      ${heading(`Welcome to PWHL GM, ${displayName}`)}
      ${para(`You've been added as a <strong style="color:#ffffff;">${roleLabel}</strong> in a PWHL GM beta league. Click below to log in and get started — this link is valid for 7 days.`)}
      ${para("You'll draft real PWHL players, set weekly lineups, and compete in scored matchups based on the 2025-26 season.")}
      ${ctaButton(magicLinkUrl, actionLabel)}
      ${para(`<span style="font-size:13px;color:#6b7280;display:block;margin-top:16px;">Link expires in 7 days. After that, log in at <a href="${APP_URL}" style="color:#6b7280;">${APP_URL.replace("https://", "")}</a> with this email address.</span>`)}
    `)
  );
}

export async function sendBetaSignupConfirmation(email: string): Promise<void> {
  await send(
    email,
    "You're on the PWHL GM waitlist",
    shell(`
      ${heading("You're on the list 🏒")}
      ${para("Thanks for signing up for PWHL GM beta access. We'll email you when your spot opens up — usually within a few days.")}
      ${para("PWHL GM is a fantasy hockey app for the Professional Women's Hockey League. Draft real players, set your lineup, and compete in weekly head-to-head matchups.")}
      ${para(`<span style="font-size:13px;color:#6b7280;display:block;margin-top:16px;">Can't wait? Forward this to friends who'd want to play — leagues need 6–12 managers.</span>`)}
    `)
  );
}

export async function sendBetaInvite(
  email: string,
  displayName: string,
  leagueId: string
): Promise<void> {
  const loginUrl = `${APP_URL}/login?returnTo=${encodeURIComponent(`/league/${leagueId}`)}`;

  await send(
    email,
    "You're in — PWHL GM Beta",
    shell(`
      ${heading(`${displayName}, you're in! 🎉`)}
      ${para("Your beta access to PWHL GM is approved. Log in to finish setting up your league and invite your friends before the draft.")}
      ${ctaButton(loginUrl, "Enter PWHL GM →")}
      ${para(`<span style="font-size:13px;color:#6b7280;display:block;margin-top:16px;">Reply to this email with any questions — we read everything.</span>`)}
    `)
  );
}

export async function sendInvite(
  email: string,
  leagueId: string,
  leagueName: string,
  inviterName: string
): Promise<void> {
  const joinUrl = `${APP_URL}/invite/${leagueId}?email=${encodeURIComponent(email)}`;

  await send(
    email,
    `${inviterName} invited you to join ${leagueName}`,
    shell(`
      ${heading("You're invited to play PWHL GM")}
      ${para(`<strong style="color:#ffffff;">${inviterName}</strong> has invited you to join their league: <strong style="color:#ffffff;">${leagueName}</strong>.`)}
      ${para("Draft real PWHL players, set your lineup, and compete in weekly head-to-head matchups.")}
      ${ctaButton(joinUrl, "Join the league →")}
    `)
  );
}
