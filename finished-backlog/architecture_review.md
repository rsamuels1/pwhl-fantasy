PWHL Fantasy – Architecture Review

Executive Summary

Overall assessment: B+ to A- architecture, assuming implementation matches the documented design.

The architecture demonstrates strong separation of concerns and avoids many common pitfalls found in early fantasy sports projects. The most significant strength is the separation between:

1. Real-world hockey data ingestion
2. Fantasy business logic
3. Real-time draft infrastructure
4. Presentation/UI

This creates a solid foundation for long-term maintainability and future growth.

⸻

Key Architectural Strengths

1. StatsSource Abstraction

The StatsSource abstraction is the strongest architectural decision in the system.

By isolating HockeyTech behind a provider interface, the riskiest dependency in the entire platform is contained behind a single boundary.

Benefits:

* Swap providers without touching fantasy logic
* Merge multiple data sources
* Add manual data corrections
* Implement aggressive caching
* Replay historical data for testing

Recommendation: Keep this abstraction intact.

⸻

2. Computed Scoring Instead of Persisted Fantasy Points

Current flow:

Game Stats
→ StatLine
→ Scoring Engine
→ Fantasy Points

This is superior to storing fantasy points permanently.

Benefits:

* Scoring rules can evolve
* Historical seasons can be recomputed
* Bugs can be corrected retroactively
* Auditing becomes straightforward

Recommendation: Keep scoring computation as the source of truth.

⸻

3. Draft Engine Separation

Current design:

engine.ts

* Pure reducer

server.ts

* WebSockets
* Timers
* Persistence

This separation is excellent.

Benefits:

* Deterministic tests
* Replayability
* Easier debugging
* Easier future scaling

Recommendation: Continue treating draft rules as a pure domain engine.

⸻

4. League Data vs Fantasy Data Separation

Current conceptual separation:

PWHL Universe

* Teams
* Players
* Games
* StatLines

Fantasy Universe

* Leagues
* Rosters
* Drafts
* Matchups

This is a strong bounded-context design and should be preserved.

⸻

5. Pure Domain Engines

Several systems appear to follow a similar pattern:

* Scoring engine
* Draft engine
* Lineup validation
* Season lifecycle

Each keeps business logic isolated from infrastructure concerns.

Benefits:

* High testability
* Easier simulations
* Better reliability
* Easier production debugging

Recommendation: Continue this pattern for all future domain logic.

⸻

Areas to Improve

1. Introduce an Application Service Layer

Current direction appears to be:

API Routes
→ Prisma
→ Domain Logic

Recommended evolution:

API Routes
→ Application Services
→ Domain Logic
→ Repositories
→ Prisma

Suggested structure:

lib/
services/
draft-service.ts
matchup-service.ts
playoff-service.ts

domain/
scoring/
draft/
playoffs/

repositories/
league-repository.ts
matchup-repository.ts
player-repository.ts

This is not required before launch but will become valuable as complexity grows.

⸻

2. Expand Matchup Scoring Caching

Current approach correctly computes scores from StatLines.

As league volume grows, consider:

StatLine
→ Player Fantasy Point Cache
→ Team Score Cache
→ Matchup Cache

Maintain recomputation capability while improving performance.

⸻

3. Introduce Event-Driven Processing

Current model:

Ingest
→ Write Database

Recommended future model:

Ingest
→ Domain Event
→ Consumers

Consumers could include:

* Stat updates
* Matchup recalculation
* Cache invalidation
* Notifications
* Activity feed generation

A simple database-backed event table is sufficient.

No message broker is required initially.

⸻

4. Monitor Playoff Complexity

Current playoff support appears to be embedded in Matchup.

This is acceptable today.

Potential future direction:

Bracket
→ Matchups

or

Competition
→ Season Competition
→ Playoff Competition

Watch for signs that Matchup begins accumulating too many responsibilities.

⸻

5. Prepare Draft Infrastructure for Scale

Current draft architecture is good.

Future scaling path:

Draft Coordinator
→ Redis
→ Multiple WebSocket Nodes

Not required for launch, but likely necessary if many leagues draft simultaneously.

⸻

What Should Not Be Changed

The following decisions appear correct and should remain foundational:

* StatsSource abstraction
* Computed scoring model
* Pure scoring engine
* Pure draft engine
* League/fantasy data separation
* Server-side lineup validation
* Season lifecycle architecture

⸻

Largest Architectural Risk

The largest risk is not technical.

It is external data dependency risk.

Because there is no official fantasy API, the reliability of HockeyTech and future provider availability represent the greatest long-term uncertainty.

Fortunately, the current architecture already isolates that risk effectively.

⸻

Conclusion

The architecture is launch-worthy.

The project should prioritize:

1. Draft system load testing
2. Ingestion reliability
3. Scoring observability
4. Season lifecycle monitoring

A major architectural rewrite is not justified based on the current design.