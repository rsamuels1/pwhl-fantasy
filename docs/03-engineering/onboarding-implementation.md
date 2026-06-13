# League Onboarding Implementation Plan

## Phase 1: Welcome Flow

**Objective:** Implement a first-run orientation for brand-new accounts.

**Tasks:**
1. Create a new component `WelcomeFlow` in the `components` directory.
2. Display three lightweight cards with information about the app, how to win, and two ways to start (create a league or join with an invite).
3. Add a dismiss button to skip the welcome flow.
4. Track the completion of the welcome flow using `User.onboardingCompletedAt`.

**Dependencies:**
- None

## Phase 2: League Setup Wizard

**Objective:** Replace the single create-league form with a stepped flow.

**Tasks:**
1. Create a new component `LeagueSetupWizard` in the `components` directory.
2. Implement Step 1: Name your league (required, ≤ 50 chars).
3. Implement Step 2: League size (default to 8 teams, options: 6, 8, 10, 12).
4. Implement Step 3: Schedule (draft date & season).
5. Implement Step 4: Rules (confirm defaults).
6. Implement Step 5: Invite managers.
7. Implement Step 6: Done → Draft prep.

**Dependencies:**
- Phase 1: Welcome Flow

## Phase 3: Draft Preparation Guide

**Objective:** Create a persistent checklist on the league overview/dashboard between league creation and draft completion.

**Tasks:**
1. Create a new component `DraftPrepGuide` in the `components` directory.
2. Implement commissioner checklist with relevant items.
3. Implement manager checklist with relevant items.
4. Provide pre-draft education on how the draft works.

**Dependencies:**
- Phase 2: League Setup Wizard

## Phase 4: Replay Explanation

**Objective:** Implement an explanation of replay mode, including a one-click creation of a pre-filled replay league.

**Tasks:**
1. Create a new component `ReplayExplanation` in the `components` directory.
2. Display content explaining replay mode and provide a CTA to create a replay league.
3. Implement one-click creation of a pre-filled replay league.

**Dependencies:**
- None

## Phase 5: Analytics Instrumentation

**Objective:** Emit analytics events for each step in the onboarding process.

**Tasks:**
1. Create a new service `AnalyticsService` in the `lib/services` directory.
2. Emit events for welcome flow, league setup, draft preparation, and replay explanation.
3. Track KPIs such as % of registrations that reach `league_created` and % of leagues that reach `draft_complete`.

**Dependencies:**
- None

## Phase 6: Testing and Validation

**Objective:** Conduct thorough testing to ensure the onboarding flow works as expected.

**Tasks:**
1. Write unit tests for each component.
2. Write integration tests for the entire onboarding flow.
3. Validate that all defaults are correctly shown and non-v1 configurations are hidden.

**Dependencies:**
- All previous phases

## Summary

This implementation plan ensures a user-friendly onboarding experience, guiding users through creating a league, inviting managers, preparing for the draft, and understanding replay mode. Each phase builds upon the previous one, ensuring a seamless and intuitive process.
