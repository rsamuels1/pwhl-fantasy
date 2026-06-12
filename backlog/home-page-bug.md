You are working on a Next.js + Prisma fantasy hockey application.

Users report that after logging in, they cannot easily create new leagues. The application currently redirects them to a "My Franchise" dashboard, but that appears to be the wrong landing experience.

I want you to investigate and fix both the navigation problem and any underlying league-creation issues.

Important: Do not assume the problem is simply the redirect. Verify the actual user flow and identify the real root cause(s).

## Investigation Tasks

### 1. Trace the authenticated user flow

Determine:

- What route anonymous users land on.
- What route authenticated users land on.
- Any middleware redirects.
- Any auth callback redirects.
- Any dashboard redirects.
- Any onboarding logic.

Specifically identify:

- Where users are sent immediately after login.
- Whether they can discover existing leagues.
- Whether they can create a league from the UI.
- Whether league creation is actually broken or merely hidden.

### 2. Audit league discovery and creation UX

Find:

- All pages that list leagues a user belongs to.
- All pages that allow league creation.
- All buttons/links that lead to league creation.
- Any role or permission checks that might prevent creation.

Answer:

- Can a newly registered user create a league?
- Can a user with zero leagues create a league?
- Can a user with existing leagues create additional leagues?
- Are there dead-end states?

### 3. Verify backend functionality

Do not stop at the UI.

Confirm:

- League creation API routes work.
- Server actions work.
- Database inserts succeed.
- Permissions are correct.
- No hidden errors occur after submission.

Test the full creation flow from UI → backend → database.

## Desired Product Behavior

After login, users should land somewhere useful for league management.

A better experience would likely be:

### League Hub / My Leagues page

Show:

- Leagues the user belongs to
- Team/franchise associations
- League status
- Recent activity (optional)

Prominent actions:

- Create League
- Join League
- View Existing League

### Empty State

If the user belongs to zero leagues:

Show:

- Create Your First League
- Join Existing League

Do NOT send them to an empty franchise dashboard.

### Existing Users

If the user belongs to leagues:

Show a league selection/dashboard page rather than forcing a single franchise view.

## Implementation Tasks

1. Identify the current redirect logic.
2. Determine whether it should be replaced or modified.
3. Create a dedicated authenticated landing page if one does not already exist.
4. Surface league creation prominently.
5. Surface league joining prominently.
6. Ensure users can always reach league creation in one click.
7. Preserve existing functionality for:
   - league management
   - franchise management
   - commissioner workflows
   - historical leagues
   - active leagues

## Deliverables

After implementation provide:

### Root Cause Analysis

Explain:

- Why users currently end up in the wrong place.
- Whether league creation was actually broken or simply undiscoverable.
- Any additional bugs found.

### Files Changed

List all modified files and why.

### UX Changes

Explain the new user flow for:

- Brand-new users
- Users with no leagues
- Users with one league
- Users with multiple leagues

### Validation

Demonstrate that:

- Users can create a league.
- Users can join a league.
- Users can find existing leagues.
- Login redirects behave correctly.
- No existing workflows were broken.

Before changing code, verify assumptions by tracing the actual execution path through middleware, auth callbacks, page routing, and league creation logic.