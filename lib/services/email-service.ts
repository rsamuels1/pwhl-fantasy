// lib/services/email-service.ts
// Thin Resend wrapper for all transactional emails.
//
// All functions:
//   1. No-op + console.log when EMAIL_RESEND_ENABLED !== "true"
//   2. Fire-and-forget safe — callers should use `void fn().catch(() => {})`
//
// To activate real email delivery:
//   - Set RESEND_API_KEY in environment
//   - Set EMAIL_RESEND_ENABLED=true (Production only — never staging)
//   - Verify noreply@dykedb.org in the Resend dashboard (DNS DKIM + SPF records)

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "PWHL GM <noreply@dykedb.org>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://beta.fantasy.dykedb.org";

function enabled(): boolean {
  return process.env.EMAIL_RESEND_ENABLED === "true";
}

/**
 * Send a magic sign-in link to a user's email address.
 * rawToken: the raw 32-byte hex token (goes in the URL, never stored)
 * returnTo: optional path to redirect to after successful verification
 */
export async function sendMagicLink(
  email: string,
  displayName: string,
  rawToken: string,
  returnTo?: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/api/auth/verify?token=${rawToken}${
    returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""
  }`;

  if (!enabled()) {
    console.log(`[EMAIL] sendMagicLink to ${email}: ${verifyUrl}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Your sign-in link for PWHL GM",
    html: `
<p>Hi ${displayName},</p>
<p><a href="${verifyUrl}">Click here to sign in to PWHL GM</a></p>
<p>This link expires in 15 minutes and can only be used once.</p>
<p>If you didn't request this, you can ignore it.</p>
    `.trim(),
  });
}

/**
 * Send an "you're on the clock" email with an embedded magic link so the
 * recipient can click directly into the draft room without an extra login step.
 * Only sent when the team has no active WebSocket connection.
 */
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
  const verifyUrl = `${APP_URL}/api/auth/verify?token=${rawToken}&returnTo=${encodeURIComponent(
    returnTo
  )}`;

  if (!enabled()) {
    console.log(`[EMAIL] sendOnClock to ${email}: ${verifyUrl}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "You're on the clock — PWHL GM Draft",
    html: `
<p>Hi ${displayName},</p>
<p>It's your turn to draft! Pick ${pickN} of ${totalPicks}.</p>
<p><a href="${verifyUrl}">Join the draft room</a></p>
<p>You have limited time — act fast!</p>
    `.trim(),
  });
}

/**
 * Send a notification to a team owner that they've received a trade offer.
 * actionUrl: path (not full URL) to the trade detail page
 */
export async function sendTradeReceived(
  email: string,
  displayName: string,
  traderName: string,
  leagueName: string,
  actionUrl: string
): Promise<void> {
  const fullUrl = `${APP_URL}${actionUrl}`;

  if (!enabled()) {
    console.log(`[EMAIL] sendTradeReceived to ${email}: ${fullUrl}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `You have a trade offer in ${leagueName}`,
    html: `
<p>Hi ${displayName},</p>
<p>${traderName} sent you a trade offer in ${leagueName}.</p>
<p><a href="${fullUrl}">View the offer</a></p>
    `.trim(),
  });
}

/**
 * Send an email invitation to join a league.
 * Used by the commissioner invite-by-email form.
 */
export async function sendInvite(
  email: string,
  leagueId: string,
  leagueName: string,
  inviterName: string
): Promise<void> {
  const joinUrl = `${APP_URL}/invite/${leagueId}?email=${encodeURIComponent(email)}`;

  if (!enabled()) {
    console.log(`[EMAIL] sendInvite to ${email}: ${joinUrl}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${inviterName} invited you to ${leagueName} on PWHL GM`,
    html: `
<p>${inviterName} has invited you to join <strong>${leagueName}</strong> on PWHL GM — fantasy hockey for the PWHL.</p>
<p><a href="${joinUrl}">Accept your invitation</a></p>
    `.trim(),
  });
}
