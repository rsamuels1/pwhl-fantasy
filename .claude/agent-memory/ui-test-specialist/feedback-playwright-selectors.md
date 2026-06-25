---
name: feedback-playwright-selectors
description: Playwright v1.60 selector quirks and async gotchas for PWHL GM tests
metadata:
  type: feedback
---

Playwright version in this repo: 1.60.0 on Node 25.9.0 (macOS).

**Do NOT use `text=` CSS shorthand.** Playwright v1.60 rejects `page.locator('text=...')` with `Unexpected token "=" while parsing css selector`. Use `p:has-text("...")` or `a:has-text("...")` instead.

**Draft room navigation must use `domcontentloaded`.** The draft room page initiates a WebSocket connection to `ws://localhost:8080` which causes `net::ERR_ABORTED` if the draft server is not running. Using `waitUntil: 'networkidle'` will timeout. Use `{ waitUntil: 'domcontentloaded', timeout: 20000 }` with `.catch(() => {})` to navigate without blocking on the abort.

**Variable scoping.** When writing multi-section test scripts that check for the same condition in different contexts (e.g. `hasTapHint` on desktop vs mobile), declare them as separate named variables to avoid `SyntaxError: Identifier already declared`. Use descriptive suffixes like `hasMobileTapHint`.

**Draft room skeleton state.** When the draft server (`:8080`) is not running, the draft room renders persistent loading skeletons with "CONNECTING" in amber. The skeleton state is NOT a failure — it is the intended loading UI while the WebSocket handshake is pending. Do not treat screenshot of skeletons as a broken page; check for the "CONNECTING" vs "CONNECTED" indicator.
