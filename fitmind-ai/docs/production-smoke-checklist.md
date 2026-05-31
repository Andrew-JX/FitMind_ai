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

- [ ] Browser devtools detects `/manifest.webmanifest`.
- [ ] Manifest shows `FitMind AI`, standalone display mode, and 192 / 512 icons.
- [ ] iOS Safari can add the app to the home screen.
- [ ] Android Chrome shows Add to Home screen or Install app.
- [ ] Installed app opens in standalone mode rather than a normal browser tab.
- [ ] App refresh still loads the training UI after service worker registration.
- [ ] Offline navigation shows the friendly offline fallback page.
- [ ] `/api/health` still returns a live 200 response when online.
- [ ] `/api/*` responses are not served stale from the service worker cache.
- [ ] Login still works after the PWA changes.
- [ ] Training create/edit still works after the PWA changes.
- [ ] Intake still works after the PWA changes.

## Verification Notes

- `pnpm test` is the unit-test lane only.
- `pnpm --filter @fitmind/client exec vite build` should emit `manifest.webmanifest`, `sw.js`, `offline.html`, and icon assets into `client/dist`.
- DB-backed smoke commands require a valid database environment:
  - `pnpm smoke:auth`
  - `pnpm smoke:training`
  - `pnpm smoke:assistant`
  - `pnpm smoke:workout-intake`
- This checklist is manual browser smoke. Do not mark it complete unless the live browser flow was actually run.
