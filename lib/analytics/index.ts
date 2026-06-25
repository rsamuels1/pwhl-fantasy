import { PostHog } from "posthog-node";

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
  userId?: string;
  leagueId?: string;
}

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.POSTHOG_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new PostHog(key, {
      host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
    process.on("exit", () => void _client?.shutdown());
  }
  return _client;
}

export function trackEvent(e: AnalyticsEvent): void {
  const client = getClient();
  if (!client) return;
  const { event, userId, leagueId, properties } = e;
  client.capture({
    distinctId: userId ?? "anonymous",
    event,
    properties: {
      ...(leagueId ? { leagueId } : {}),
      ...properties,
    },
  });
}
