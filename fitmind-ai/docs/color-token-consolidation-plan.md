# Color token consolidation plan

Status: **plan + execution by the same author** (2026-07-27, main at `34d18c6`).
The usual split is reversed for this batch at the user's request: I plan and
implement, Codex reviews.

## Why

`UI_SPEC.md` §1.1 states that all colors go through CSS variables or the theme
object and that **组件内部禁止硬编码色值**. The code does not honor it: there are
**32 raw brand-color literals across 13 files** outside `theme/tokens.ts`. The
document and the code contradict each other, and the contradiction has been
growing — every UI batch added more.

An external review flagged this and put the count at 32. That number is right,
but it undercounts by missing the spaced `rgba(200, 240, 53, …)` spelling, and
its diagnosis — "the developer knew the token existed and got lazy at the accent
color" — is wrong for most of the occurrences. Getting the classification right
is the whole job here, because the review's prescribed fix (replace every
literal with `theme.colors.ac`) would **break the light theme**:
`theme.colors.ac` is `#5c7404` in light mode, while the design handoff lists the
neon button, the logo, the overlay, and the toast as elements that stay
`#c8f035` in *both* themes.

## The 32 occurrences, classified

### A — brand-invariant (21) → `BRAND_NEON` / `brandAlpha()`

The design fixes these to `#c8f035` regardless of theme. Migrating them is a
pure refactor with **no rendered change**. Note the strings are not
byte-identical: the helper emits the conventional `rgba(200, 240, 53, α)`
spacing while several literals were written without spaces. CSS treats the two
as the same color and both resolve to the spaced form in computed styles, which
is the property the verification checks — not string equality.

| File | Lines | What |
| --- | --- | --- |
| `components/AppShell.tsx` | 217, 289, 293 | logo inner square, FAB fill, FAB active ring |
| `components/ToastProvider.tsx` | 93 | toast border |
| `features/assistant/AssistantComposer.tsx` | 116 | 发送追问 primary button |
| `features/assistant/AssistantMessageBubble.tsx` | 222 | user bubble fill |
| `features/auth/AuthScreen.tsx` | 288, 296, 350, 474 | spinner track + arc, submit button, logo inner |
| `features/training/ExerciseProgressChart.tsx` | 230 | latest bar |
| `features/training/WeeklyVolumeCard.tsx` | 231, 233 | current-week bar + glow |
| `features/training/TrainingView.tsx` | 233, 236 | voice CTA + its shadow |
| `features/training/WorkoutIntakePanel.tsx` | 572–574, 796, 799, 863 | mic pulse keyframes, record button + shadow, confirm button |

### B — neon tint applied in both themes (8) → themed `accentAlpha()`

Surface tints derived from the accent, not brand chrome. The design does not
list them as theme-invariant, and in light mode they currently wash a white
surface with neon. Migrating them **changes the light theme** and is therefore
a separate commit.

| File | Lines | What |
| --- | --- | --- |
| `features/training/WorkoutCalendar.tsx` | 227, 228 | day-with-workout tint + border |
| `features/training/TrainingSessionSetRow.tsx` | 163, 164 | completed set row tint + border |
| `features/training/TrainingPlanCard.tsx` | 75 (×2), 76, 78 | card gradient, border, inset highlight |

### C — already theme-aware, just written as literals (3) → themed `accentAlpha()`

These branch on `theme.isDark` and already use a different light value. They are
the most carefully written of the set; the external review counted them as
laziness, which is backwards. Migrating them removes an **undocumented third
green**: two of them use `rgba(74, 140, 0, …)` (`#4a8c00`), which appears
nowhere in `tokens.ts` and is not the design's light accent `#5c7404`.

| File | Lines | Light value today |
| --- | --- | --- |
| `features/auth/AuthScreen.tsx` | 90 | `rgba(92,116,4,0.12)` — matches the accent token |
| `features/profile/AthleteProfileSheet.tsx` | 267 | `rgba(74,140,0,0.12)` — undocumented green |
| `features/training/TrainingSessionExerciseCard.tsx` | 385 | `rgba(74,140,0,0.12)` — undocumented green |

## Token design

Added to `theme/tokens.ts`:

```ts
/** Design's brand neon. Identical in both themes by design. */
export const BRAND_NEON = "#c8f035";
/** Foreground on brand-neon fills. */
export const BRAND_NEON_TEXT = "#0f0f0f";
/** Translucent brand neon for rings, glows, and keyframes. */
export function brandAlpha(alpha: number): string;
/** Translucent *accent*, which differs per theme. */
export function accentAlpha(theme: Theme, alpha: number): string;
```

`accentAlpha` reads a new `accentRgb` field on `ThemeColors` (`"200, 240, 53"`
dark, `"92, 116, 4"` light) so the two families cannot be confused at the call
site. Choosing between `brandAlpha` and `accentAlpha` is exactly the decision
that was previously implicit in a literal.

## Batches

### T-1 — tokens + category A — zero visual change

Introduce the tokens and migrate the 21 brand-invariant occurrences. Every
resulting string is identical to the literal it replaces, so the rendered output
cannot move. Verified by unit tests on the helpers plus the existing e2e.

### T-2 — categories B and C — light theme only

Migrate the 11 remaining occurrences to `accentAlpha`. Dark mode output is
byte-identical (the dark accent *is* the brand neon). Light mode changes: neon
tints become accent tints, and the undocumented `#4a8c00` is unified onto the
design's `#5c7404`. Verified with light-mode screenshots before and after.

Split from T-1 so the visual change is independently reviewable and revertible.

### T-3 — make the rule enforceable

An ESLint `no-restricted-syntax` rule that fails on a raw brand literal in
`client/src/**` outside `theme/tokens.ts`. Without it this regresses on the next
UI batch, which is precisely what happened between the last two reviews. This is
the part that turns `UI_SPEC` §1.1 from an aspiration into a gate.

## Out of scope

Splitting `TrainingSessionComposer.tsx` (1725 lines) and the documentation
cleanup the external review also raised. Both are real; neither belongs in a
color-token batch.

## Review checkpoints for Codex

- T-1 must not change a single rendered color. Any diff in output is a bug.
- No call site may use `theme.colors.ac` for an element the design fixes to neon
  in both themes; that is the failure mode the external review's advice would
  have produced.
- T-2's light-mode change must be shown, not asserted.
- After T-3, `pnpm lint` must fail if a raw literal is reintroduced — demonstrate
  it, do not just claim it.
