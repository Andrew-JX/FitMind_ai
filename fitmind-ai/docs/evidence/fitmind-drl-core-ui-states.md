# fitmind-drl — core UI state walkthrough evidence

- Frozen contract commit: `1e1f291`
- Baseline: `f833ab0`
- Implementation candidate: `a64e3f3`
- Closeout candidate: the commit containing this evidence and the matching progress entry
- Scope: local React/Vite client in Chromium with Playwright HTTP route interception

## Matrix result

| Area | Empty | Loading / slow | Error / network | Boundary / keyboard |
| --- | --- | --- | --- | --- |
| Registration | Pass: login remains usable | Pass: delayed policy keeps registration disabled | Pass: policy 500 fails closed and login succeeds | Pass: 320×800 and 390×844 overflow metric; recorded Tab order; Enter submits |
| Consent catch-up | N/A | Pass: pending accept is disabled and request count remains one | Pass: first 500 states that nothing was recorded; keyboard Retry succeeds | Pass: checkbox uses Space and primary action uses Enter; existing release suite covers logout and destructive alternatives |
| Training history | Pass: successful empty says `暂无训练记录` | Pass: held request shows loading before release | Pass: 503 suppresses empty; keyboard Refresh makes a new request and recovers | Pass: both narrow viewports with long note/muscle string; accessible `查看详情` affordance remains; pagination path fixed without weakening cursor assertion |
| Analysis | Pass: overview and muscle zero-data notices are visible after successful response | Pass: existing card loading assertions remain in the complete suite | Pass: failed summary and muscle cards suppress their zero-data copy; changing range retries and recovers | Pass: History/Analysis and range tabs are activated with recorded keyboard focus and Enter |
| Assistant + plan | Pass: no-plan and empty-conversation states remain distinct | Pass: held current-plan read shows loading and stays at one request | Pass: current-plan 503 exposes in-place keyboard Retry; composer remains enabled; existing stream error Retry remains in full suite | Pass: both narrow viewports render an 80+ character plan exercise and streamed answer without page overflow; composer submits normally |
| Profile tools | Pass: body, menstrual and memo successful-empty copy is asserted separately | Pass: each held first read exposes explicit loading | Fixed: all three failures suppress empty success, expose in-place Retry, and recover on a later successful response | Pass: tool rows, Retry and Back are reached by Tab and activated with Enter; long display name and memo title fit both viewports |

## Fixed findings

1. `BodyMeasurementsView`, `MenstrualTrackerView`, and `TrainingMemosView` previously rendered a failed read together with successful-empty copy. Explicit read state now makes loading, error and ready mutually exclusive.
2. Those three personal tools and `AssistantCurrentPlanCard` lacked an in-place read retry. Each now calls the existing load/refresh action and clears the error only after a successful response.
3. The cursor-pagination E2E waited for list-only UI while History was still on its default calendar. It now enters History and List view first and still asserts cursor calls `[null, "cursor-page-2"]`.
4. `UI_SPEC.md` still described an obsolete in-memory-only token session. It now matches the implemented HttpOnly-cookie session and `/api/auth/me` refresh restoration.

No P0/P1 finding remains. The long history preview intentionally truncates its visible summary, but the same keyboard-focusable row exposes `查看详情`; this is an accessible full-value affordance, not an unreported truncation.

## Verification

Run from `fitmind-ai` on the closeout candidate:

- `pnpm verify` — exit 0; 119 Vitest files / 939 assertions and 5 monitor assertions passed.
- `pnpm test:e2e` — exit 0; 44 Chromium tests passed, including the six state-matrix cases and the two-viewport boundary case.
- `pnpm --filter @fitmind/client build` — exit 0; Vite production build completed with 147 transformed modules.
- `pnpm test:e2e:release` — exit 0; 21 Chromium compliance tests passed.
- `pnpm eval` — exit 0; offline intent, refusal, faithfulness and safety suites passed.
- `netstat -ano | Select-String ':5173.*LISTENING'` — no result after each runner-owned suite.

The isolated boundary test was also run directly before the complete suite and passed at both 320×800 and 390×844.

## Evidence boundary

These tests exercise the real client bundle, DOM, keyboard behavior and HTTP client against deterministic route handlers. They do **not** prove a live API, database, model provider, GitHub Actions run, deployed environment or production browser path. No real credentials or personal data were used; no push or deployment occurred.
