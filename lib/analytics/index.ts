export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
  userId?: string;
  leagueId?: string;
}

// Thin abstraction layer for analytics events. V1 writes to console only.
// Swap the body to call PostHog, Plausible, or another provider without
// changing any call site.
export function trackEvent(e: AnalyticsEvent): void {
  if (process.env.NODE_ENV === "production") {
    // TODO: forward to analytics provider
  }
  console.log("[ANALYTICS]", JSON.stringify({ event: e.event, ...e.properties, userId: e.userId, leagueId: e.leagueId }));
}
