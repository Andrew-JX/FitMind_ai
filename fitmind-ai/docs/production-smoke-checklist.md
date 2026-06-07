# Production Smoke Checklist

Production URL: https://fitmind-ai-psi.vercel.app/

Use this checklist before sending the app to an interviewer, friend, or recruiter. Mark an item passed only after it has been checked in the live app.

## Browser Setup

- [ ] Open `https://fitmind-ai-psi.vercel.app/` in a normal browser tab.
- [ ] Open the same URL in a mobile viewport or on a phone.
- [ ] Confirm the app loads without a blank screen.
- [ ] Confirm there is no horizontal overflow on the login screen.

## Auth

- [ ] Register a fresh test user, or log in with an intentional test account.
- [ ] Confirm invalid login credentials show a friendly message.
- [ ] Confirm logout returns to the login screen.
- [ ] If a token expires or a `401` is reproduced, confirm the UI says `登录已过期，请重新登录。`.
- [ ] Confirm the login screen can remember the email only, without storing password or token.

## Training

- [ ] Create a workout manually with at least one exercise, weight, and reps.
- [ ] Confirm the workout appears in the history list.
- [ ] Open the workout detail.
- [ ] Edit one set or metadata field and save.
- [ ] Delete the test workout and confirm it disappears.
- [ ] Confirm loading, empty, and error states use the shared `StateNotice` style.

## Intake

- [ ] Open text intake.
- [ ] Parse a simple workout sentence.
- [ ] Save the parsed draft.
- [ ] Confirm the saved intake workout appears in history.
- [ ] Open the saved workout and edit the training time.
- [ ] Voice intake can recover from the mobile microphone permission prompt with visible Done / Cancel controls.

## Analysis

- [ ] Open the Analysis tab after creating or saving a workout.
- [ ] Confirm Training Summary refreshes.
- [ ] Select an exercise and confirm Exercise Progress loads.
- [ ] Confirm Recommendation Context Preview loads.
- [ ] Confirm Muscle Load either shows data or a friendly empty/thin-evidence state.

## AI Assistant

- [ ] Open the AI Assistant tab.
- [ ] Confirm the insight dashboard loads or shows a friendly empty/error state.
- [ ] Send one training-related quick prompt.
- [ ] Confirm the assistant either answers with training context or shows a scoped error state.
- [ ] Confirm unsupported/general prompts do not get presented as medical or unrestricted advice.

## Mobile Readiness

- [ ] Login screen fits a narrow mobile viewport.
- [ ] Training tab has no clipped primary controls.
- [ ] Intake modal fits the viewport and can be dismissed.
- [ ] Workout edit and time edit controls are reachable.
- [ ] Analysis cards wrap without horizontal scrolling.
- [ ] AI Assistant composer and messages remain usable on mobile.

## PWA Install Experience

- [x] Browser devtools detects `/manifest.webmanifest`.
- [x] Manifest shows `FitMind AI`, standalone display mode, and 192 / 512 icons.
- [x] iOS Safari can add the app to the home screen.
- [ ] Android Chrome shows Add to Home screen or Install app. Pending real Android device validation.
- [x] Installed app opens in standalone mode rather than a normal browser tab on iPhone Safari.
- [ ] App refresh still loads the training UI after service worker registration.
- [ ] Offline navigation shows the friendly offline fallback page.
- [x] `/api/health` still returns a live 200 response when online.
- [x] `/api/*` responses are not served stale from the service worker cache by `sw.js` design.
- [ ] Login still works after the PWA changes.
- [ ] Training create/edit still works after the PWA changes.
- [ ] Intake still works after the PWA changes.

## 2026-06-01 iPhone Safari Notes

- Passed: add to home screen works, FitMind opens with an app-like standalone feel, icon appears on the home screen.
- Found: because auth token is intentionally memory-only, reopening after the OS ends the PWA process requires login again.
- Found: the previous press-and-hold voice input could get stuck after the iOS microphone permission prompt interrupted the pointer gesture.
- Action in Batch 7B.1: keep token memory-only, add email-only remember convenience, and add visible voice Done / Cancel controls.
- Android Chrome: pending real-device validation.

## Verification Notes

- `pnpm test` is the unit-test lane only.
- `pnpm --filter @fitmind/client exec vite build` should emit `manifest.webmanifest`, `sw.js`, `offline.html`, and icon assets into `client/dist`.
- DB-backed smoke commands require a valid database environment:
  - `pnpm smoke:auth`
  - `pnpm smoke:training`
  - `pnpm smoke:assistant`
  - `pnpm smoke:workout-intake`
- Phase 4.8C vector RAG smoke additionally requires `VOYAGE_API_KEY`, the pgvector migration, and knowledge embedding backfill:
  - `pnpm --filter @fitmind/server run db:migrate`
  - `pnpm --filter @fitmind/server run embed:knowledge ../.env`
  - `pnpm --filter @fitmind/server run smoke:knowledge-rag ../.env`
  - When `VOYAGE_API_KEY` is set, the smoke asserts `Retrieval mode: vector`.
- This checklist is manual browser smoke. Do not mark it complete unless the live browser flow was actually run.
