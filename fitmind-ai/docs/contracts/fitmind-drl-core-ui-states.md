# fitmind-drl — core UI state walkthrough contract

Contract SHA: this file's first committed revision. After that commit this file
is frozen and the implementation candidate must not modify it.

Baseline SHA: `f833ab0`.

Candidate SHA: empty before implementation.

Allowed files after this contract is frozen:

- `fitmind-ai/client/e2e/core-ui-states.spec.ts`
- `fitmind-ai/client/e2e/support/core-ui-state-mocks.ts`
- `fitmind-ai/client/e2e/support/mock-api.ts`
- `fitmind-ai/client/e2e/ui-finishers.spec.ts`
- `fitmind-ai/client/src/features/assistant/AssistantCurrentPlanCard.tsx`
- `fitmind-ai/client/src/features/assistant/AssistantWorkspace.tsx`
- `fitmind-ai/client/src/features/profile/BodyMeasurementsView.tsx`
- `fitmind-ai/client/src/features/profile/MenstrualTrackerView.tsx`
- `fitmind-ai/client/src/features/profile/TrainingMemosView.tsx`
- `fitmind-ai/docs/UI_SPEC.md`
- `fitmind-ai/docs/frontend-current-state.md`
- `fitmind-ai/docs/progress.md`
- `fitmind-ai/docs/evidence/fitmind-drl-core-ui-states.md`
- `fitmind-ai/docs/contracts/fitmind-drl-core-ui-states.md`

The candidate must not change server, shared-contract, API, database, auth,
assistant-state-machine, production deployment, or styling-token behavior.

## Frozen baseline facts

1. Baseline `pnpm verify` passes 119 Vitest files / 939 assertions plus five
   monitor assertions.
2. Baseline `pnpm test:e2e` runs 37 Chromium tests: 36 pass and the cursor
   pagination test times out because it waits for list content while the app is
   still on the training tab. The candidate must correct the user path, not
   delete or weaken the pagination assertions.
3. The unauthenticated 320 px browser path has no horizontal overflow and shows
   policy-read failure as `注册暂不可用` while keeping login enabled.
4. Body measurements, menstrual records, and training memos can currently show
   a load error and a successful-empty message at the same time, and none offers
   an in-place read retry. The current-plan load error likewise has no retry
   action. These are acceptance failures, not approved behavior.

## State matrix

The machine walkthrough uses the real React/Vite client in Chromium with route
interception at the HTTP boundary. Mock state must be held by route handlers and
observed through the same UI actions a user takes; directly calling hooks or
setting React state does not satisfy this matrix.

| Area | Empty | Loading / slow | 4xx / 5xx / network | Boundary / keyboard |
| --- | --- | --- | --- | --- |
| Registration | login form remains usable | policy request is delayed and registration stays disabled | policy 500 fails registration closed; login still submits | Tab reaches email, password, remember-email, and submit in order |
| Consent catch-up | not applicable | accept is single-flight and disabled while pending | failed accept explains that no consent was recorded and retry succeeds | checkbox + primary/decline/delete paths are keyboard reachable |
| Training history | successful empty list says no records | delayed list shows loading and then the empty state | list failure is not called empty; Refresh retries and recovers | long note/exercise data does not create page-level overflow |
| Analysis | zero totals, no-action, muscle, and weekly states are truthful | delayed summary/load cards show loading | an error is not also rendered as zero-data; changing the range retries | range and exercise controls are keyboard reachable |
| Assistant + current plan | empty conversation and no-plan states are distinct | delayed plan shows loading | plan read failure has an in-place retry; stream failure leaves composer/retry usable | long answer/plan exercise does not overflow; composer is keyboard reachable |
| Profile tools | body, menstrual, and memo successful-empty states are truthful | first read has an explicit loading state | each read failure suppresses empty success, offers Retry, and a succeeding retry recovers | profile rows/back/retry actions are keyboard reachable |

## Acceptance criteria

1. **Machine / state-matrix coverage.** `core-ui-states.spec.ts` names and
   executes every cell above that is applicable. Each error-to-recovery case
   uses a handler whose first response fails and later response succeeds, and
   asserts both the failure state and the recovered state. A test that merely
   renders error copy without exercising recovery is a false green.
2. **Machine / truthful exclusivity.** On failed reads, history and all three
   profile tools do not simultaneously show successful-empty copy. Analysis
   errors do not show zero-data copy for the same card. On successful empty
   responses, no error copy remains. Assertions are made against visible DOM,
   not source strings.
3. **Machine / slow single-flight.** Delayed policy, consent mutation, workout
   list, and current-plan responses expose their documented loading text; a
   mutation button is disabled while pending and request counters remain one
   until the response settles. A fixed sleep without checking the pending UI
   and call count is insufficient.
4. **Machine / narrow-layout metric.** At both 320×800 and 390×844 viewports,
   `document.documentElement.scrollWidth <= document.documentElement.clientWidth`
   for auth, long authenticated history, assistant, and profile fixtures. The
   fixture includes at least one 80-character unbroken display name, exercise
   name, memo title, and assistant/plan string. Truncation without an accessible
   name or full-value affordance is recorded as a finding rather than silently
   accepted.
5. **Machine / keyboard behavior.** Playwright uses `page.keyboard` from a
   deterministic starting focus and records active roles/names after each Tab.
   Enter or Space activates the login submit, history/analysis segment,
   assistant entry/composer, profile tool, Back, and Retry controls. Native
   element type alone is not evidence.
6. **Machine / existing regression.** The cursor-pagination E2E navigates to
   History and list view before expanding, still proves cursor calls
   `[null, "cursor-page-2"]`, and the isolated test plus the complete E2E suite
   pass. Deleting the cursor assertion, forcing visibility, or increasing the
   timeout without fixing the path fails this criterion.
7. **Machine / repository gates.** On the exact candidate, `pnpm verify`,
   `pnpm test:e2e`, `pnpm --filter @fitmind/client build`, and
   `pnpm test:e2e:release` exit zero. The E2E lifecycle leaves port 5173 without
   a listener after each runner-owned suite.
8. **Document / walkthrough evidence.** The evidence file records every matrix
   cell as pass, fixed finding, deferred non-blocker, or unverified; lists test
   fixtures and exact commands; distinguishes mocked HTTP, local browser, and
   production status; and does not claim real API/database/provider coverage.
   `UI_SPEC.md`, `frontend-current-state.md`, and `progress.md` are synchronized,
   including the actual HttpOnly-cookie session rule.
9. **Scope / frozen candidate.** Candidate diff and untracked files match the
   allowed list, the contract is byte-identical to its contract SHA, no P0/P1
   finding remains open, and no push or deployment occurs.

## False-green and conflict check

- Empty and error are mutually exclusive per card; a page containing one of
  each in unrelated cards is not enough to pass another card.
- Route interception validates client HTTP behavior, not server correctness or
  a live production path; evidence must preserve that boundary.
- Responsive acceptance uses measured page overflow, not screenshot appearance.
- Keyboard acceptance records focus transitions and activation outcomes; source
  tags or mouse clicks cannot substitute.
- The full E2E gate includes the existing suites and the new matrix; an isolated
  green spec cannot close the issue.
- No criterion requires real credentials, personal data, production writes,
  network access, or a deployed release. There is no conflict with the no-push
  boundary.
