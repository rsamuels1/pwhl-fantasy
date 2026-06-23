# Baseline Schema Migration

This migration captures the complete schema state as of June 22, 2026.

**Context:** The schema had been modified via `npx prisma db push` without corresponding migration files for ~20 models including:
- Notification, NotificationPreference, FeedbackSubmission, FeedbackType, FeedbackStatus
- BetaStatus (FantasyLeague.betaStatus field)
- LeagueEvent, EventType (full enum including COMMISSIONER_* and WAIVER_* types)
- Trade, TradeItem, TradeStatus
- And updates to existing models (FantasyLeague, FantasyTeam, etc.)

**Migration strategy:** This baseline captures the entire current schema so future migrations can be generated correctly.

After deployment:
- Run `npx prisma migrate deploy` to mark this migration as applied in production
- All subsequent schema changes should use `npx prisma migrate dev --name <feature>` to generate proper migration files
- Never use `npx prisma db push` in production — only in development
