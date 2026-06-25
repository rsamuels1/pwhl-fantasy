// lib/services/email-service.ts
// Email delivery stub — real sending is deferred until EMAIL_RESEND_ENABLED=true
// and the 'resend' package is installed.
//
// To activate:
//   npm install resend
//   Set RESEND_API_KEY + EMAIL_RESEND_ENABLED=true in production env
//   Verify noreply@dykedb.org in Resend dashboard (DKIM + SPF)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://beta.fantasy.dykedb.org";

export async function sendMagicLink(
  email: string,
  _displayName: string,
  rawToken: string,
  returnTo?: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/api/auth/verify?token=${rawToken}${
    returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""
  }`;
  console.log(`[EMAIL] sendMagicLink to ${email}: ${verifyUrl}`);
}

export async function sendOnClock(
  email: string,
  _displayName: string,
  rawToken: string,
  leagueId: string,
  teamId: string,
  _pickN: number,
  _totalPicks: number
): Promise<void> {
  const returnTo = `/draft/${leagueId}?team=${teamId}`;
  const verifyUrl = `${APP_URL}/api/auth/verify?token=${rawToken}&returnTo=${encodeURIComponent(returnTo)}`;
  console.log(`[EMAIL] sendOnClock to ${email}: ${verifyUrl}`);
}

export async function sendTradeReceived(
  email: string,
  _displayName: string,
  _traderName: string,
  _leagueName: string,
  actionUrl: string
): Promise<void> {
  console.log(`[EMAIL] sendTradeReceived to ${email}: ${APP_URL}${actionUrl}`);
}

export async function sendInvite(
  email: string,
  leagueId: string,
  _leagueName: string,
  _inviterName: string
): Promise<void> {
  const joinUrl = `${APP_URL}/invite/${leagueId}?email=${encodeURIComponent(email)}`;
  console.log(`[EMAIL] sendInvite to ${email}: ${joinUrl}`);
}
