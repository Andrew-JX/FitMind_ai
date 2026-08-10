# History Navigation Design QA

- Source visual truth 1: `G:\ChatData\WeChat\xwechat_files\wxid_qnfcchsh76d812_915f\temp\RWTemp\2026-08\56aa2560edb70871bfe5c5390469104c\0ae4dd18e6d52e30f7ff4bdc59c1d701.jpg`
- Source visual truth 2: `G:\ChatData\WeChat\xwechat_files\wxid_qnfcchsh76d812_915f\temp\RWTemp\2026-08\56aa2560edb70871bfe5c5390469104c\1d14cc86f7e4fe08e8a74a4fd4ad8847.jpg`
- History implementation: `C:\Users\15942\.codex\visualizations\2026\08\09\019fe52c-ce02-7d43-bd8c-c8400d0628ee\fitmind-history-calendar.png`
- Analysis implementation: `C:\Users\15942\.codex\visualizations\2026\08\09\019fe52c-ce02-7d43-bd8c-c8400d0628ee\fitmind-history-analysis.png`
- State: authenticated FitMind mobile view at 711 × 1270, dark theme, real August 2026 workout data.

## Comparison evidence

Both references and both implementation screenshots were opened together in one comparison input. The requested information architecture is preserved: the bottom destination is named「历史」with a clock icon, and the page exposes a centered two-option switch above the content. Per the user's explicit instruction, FitMind labels the second option「分析」rather than copying the reference's「统计」.

The source app's unrelated light palette, five-item navigation, training category filters, report/settings actions, and body illustration were intentionally excluded. The implementation keeps FitMind's existing dark card system, neon emphasis, three-item bottom bar, separate AI assistant button, existing calendar, and existing analysis modules.

## Findings

- No remaining P0/P1/P2 mismatch in the requested navigation scope.
- Bottom navigation:「历史」is visible, selected state aligns with the sliding pill, and the clock icon matches the reference meaning.
- Top switch: centered, visually subordinate to the app header, and uses the shared `SegmentedControl` instead of introducing a one-off control.
- History state: training list, calendar, workout detail, delete, and edit remain functional after migration.
- Analysis state: the original range control, overview, muscle-load distribution, exercise progress, and weekly volume remain intact.
- Training state: no duplicate training-record panel remains on the training page.
- Runtime: browser console contains only Vite connection and React DevTools informational messages; there are no errors or warnings.

## Primary interactions tested

1. Open bottom「历史」and confirm「历史」is the default top selection.
2. Switch to「分析」and confirm the complete former analysis page renders.
3. Return to「历史」and toggle list/calendar views.
4. Expand a workout, open「编辑训练」, verify the existing workout draft, and cancel without mutation.

## Personal Tools Design QA

- Personal-menu reference: `G:\ChatData\WeChat\xwechat_files\wxid_qnfcchsh76d812_915f\temp\RWTemp\2026-08\9e20f478899dc29eb19741386f9343c8\f441da896ca3d1fd10273e549bc0dbef.jpg`
- Menstrual reference: `G:\ChatData\WeChat\xwechat_files\wxid_qnfcchsh76d812_915f\temp\RWTemp\2026-08\9e20f478899dc29eb19741386f9343c8\065de8cd11d989ae774752da739778ba.jpg`
- Body-data reference: `G:\ChatData\WeChat\xwechat_files\wxid_qnfcchsh76d812_915f\temp\RWTemp\2026-08\9e20f478899dc29eb19741386f9343c8\00748d14267a6f01cc8d7c7a7980ad6d.jpg`
- RM reference: `G:\ChatData\WeChat\xwechat_files\wxid_qnfcchsh76d812_915f\temp\RWTemp\2026-08\9e20f478899dc29eb19741386f9343c8\f341f30d713a8948fbd45f34a53e67e5.jpg`
- Memo reference: `G:\ChatData\WeChat\xwechat_files\wxid_qnfcchsh76d812_915f\temp\RWTemp\2026-08\9e20f478899dc29eb19741386f9343c8\d5e56b5f4f13e350474d2ac2c048150c.jpg`
- Implementation captures: `C:\Users\15942\.codex\visualizations\2026\08\09\019fe52c-ce02-7d43-bd8c-c8400d0628ee\fitmind-personal-tools-menu.png`, `fitmind-menstrual.png`, `fitmind-body-form.png`, `fitmind-rm-calculator.png`, `fitmind-memos.png`, and `fitmind-personal-tools-light.png` in the same evidence directory.
- State: authenticated FitMind mobile view at 711 × 1270, checked in dark and light themes.

### Comparison evidence

Each reference was opened in the same comparison input as the corresponding FitMind implementation capture. The screenshots are treated as interaction and information-architecture references rather than a request to copy the source product's brand. FitMind therefore keeps its existing typography, neon accent, cards, three-item navigation, AI-assistant action, responsive width, and shared icon set.

### Findings

- The personal root now exposes the four requested tools as full-width, accessible rows while preserving the existing training-profile entry.
- The menstrual screen retains the reference's month-calendar model but intentionally records only actual dates. It does not show unsupported ovulation, cycle, or prediction claims. Separate health consent, history-calendar visibility, and destructive deletion are visually distinct.
- The body-data screen exposes dated measurements, kg/jin display, data/trend/calendar tabs, a compact current summary, and a complete measurement form without copying the reference's decorative body illustration.
- The RM calculator improves the source flow by updating immediately and showing the Epley 1RM plus 50–100% working-load references; 80 kg × 8 reps correctly renders 101.5 kg.
- The memo flow has a clear empty state and a focused title/content editor. Opening the editor removes the empty-state card, avoiding duplicate competing messages.
- History list and calendar views still render when the optional menstrual-history request is unavailable; the period overlay fails silently instead of breaking workout history.
- Dark and light themes remain legible at the target mobile viewport. No clipped controls, horizontal overflow, or obstructed primary actions were observed.
- The current browser proxy targets the deployed API, which does not yet contain these unshipped endpoints, so the menstrual, body, and memo browser checks cover loading/error/empty/editor states. Persistence and authorization behavior are covered by repository/service tests and require the migration plus API deployment before production interaction testing.

### Primary interactions tested

1. Open each personal-tool row and return to the personal root.
2. Navigate the menstrual month calendar and inspect consent, visibility, and deletion states.
3. Open the body-measurement form and inspect the full field set and unit controls.
4. Enter 80 kg and 8 reps in the RM calculator and verify the computed result and load table.
5. Open a new training memo, verify title/body inputs, and cancel without mutation.
6. Open History list and calendar views while the optional menstrual endpoint returns unavailable.
7. Switch the app to light theme and back to dark theme.

## History Calendar Month Picker Follow-up QA

- Source visual truth: Browser Comment 1 and Comment 2 marker screenshots supplied with the task at 829 × 1270; the pre-change local baseline is `C:\Users\15942\.codex\visualizations\2026\08\09\019fe52c-ce02-7d43-bd8c-c8400d0628ee\fitmind-history-calendar.png` at 711 × 1270.
- Closed implementation: `C:\Users\15942\.codex\visualizations\2026\08\09\019fe52c-ce02-7d43-bd8c-c8400d0628ee\fitmind-history-default-calendar-829x1270.png` at 829 × 1270.
- Picker implementation: `C:\Users\15942\.codex\visualizations\2026\08\09\019fe52c-ce02-7d43-bd8c-c8400d0628ee\fitmind-history-month-picker-829x1270.png` at 829 × 1270.
- CSS viewport: 829 × 1270 with device scale factor 1; no density normalization was required for the two task screenshots and final implementation captures.
- State: authenticated FitMind history page, dark theme, August 2026 workout data; closed calendar and open picker states.

### Comparison evidence

The task's 829 × 1270 calendar screenshot and the final 829 × 1270 implementation were compared at the same route, theme, month, data, and viewport. A combined comparison input also placed the pre-change calendar baseline beside the final closed implementation. The calendar card, grid density, workout-volume badges, note truncation, top history/analysis switch, and bottom navigation remain unchanged. The only visible closed-state additions are the requested clickable affordance: a small existing-system chevron and the subordinate「选择月份」label.

The open picker has no direct source-state screenshot, so it was evaluated as a focused state against FitMind's existing `ActionSheet`, button, border, radius, typography, and neon selection tokens. A separate implementation comparison input included the closed and open states. No decorative or external assets were introduced.

### Findings

- No actionable P0/P1/P2 differences remain in the annotated scope.
- Fonts and typography: existing FitMind font stack, title hierarchy, numeric alignment, and small-label weights are preserved; picker labels remain legible without competing with the month title.
- Spacing and layout rhythm: calendar dimensions and navigation alignment match the source; the 3 × 4 month grid fits the mobile sheet without clipping or horizontal overflow.
- Colors and visual tokens: the picker reuses the existing surface, border, text, overlay, and accent tokens; the selected month uses the same neon treatment as other selected controls.
- Image quality and asset fidelity: the screen contains no new raster imagery; the disclosure affordance reuses FitMind's existing icon component rather than adding a one-off asset.
- Copy and content: the title is now an explicit「选择时间范围」control, its helper text states year/month scope, and「回到本月」provides a fast recovery action.
- Interaction: History opens in calendar mode; list mode remains available. The picker opens from the month title, supports native year selection, closes after choosing a month, updates the calendar title, clears stale cross-month date selection, and returns to the current month.
- Runtime: the browser reported no console warnings or errors during the verified flow.

### Primary interactions tested

1. Enter History after a hot reload and confirm the calendar is the initial mode.
2. Open the month title and confirm the year selector, 12 month buttons, close action, and「回到本月」action.
3. Choose July 2026 and verify the picker closes and the title updates.
4. Choose year 2025 plus August and verify the combined year/month jump.
5. Return to August 2026, switch to list mode, then switch back to calendar mode.
6. Verify the final closed and open states at 829 × 1270 and inspect browser warnings/errors.

final result: passed
