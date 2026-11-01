# QA batch 5 — student overlap fixes and full UAT flow

## Findings first

| ID | State | Finding | Result |
|---|---|---|---|
| P1/P2/RC1 | `/profile` steps 1–4, 360/390 | Choice cards could overlap because flex children were forced to `flex-1`; the goal form could cover goal cards. | fixed: intrinsic-height choice rows; goal cards and custom form share a scroll column |
| RC2 | knowledge/result/rewards sheets | Tailwind v4 `translate` kept target sheets off-screen when only `transform` was reset. | fixed: target rule resets `translate` and `transform` |
| P1 | `/profile` goal, 360 | Goal choices are separated and visible; custom-goal form is below the cards. | visual pass: `output/playwright/profile-goal-360.png` |
| PRE/CHECK | `/pretest`, `/check`, 360 | Confidence controls could cover answer cards; Dome helper consumed the answer hero. | fixed: compact helper, answer region scroll boundary, confidence appears after an answer is selected |
| O5 | `/dome`, 360 | Four quick replies competed with the first Dome conversation and pushed the input down. | fixed: initial state has one `ถามโดม` affordance; quick replies reveal on demand |

## Visual evidence

- `/profile` step 1: `output/playwright/profile-auth-step1-390.png`
- `/profile` goal step: `output/playwright/profile-goal-360.png`
- `/check` after overlap fix: `output/playwright/quiz-fixed-check5-360.png`
- `/dome` after choice reduction: `output/playwright/dome-collapsed-360.png`
- `/knowledge`/`/home`/`/map`/`/rewards`/`/ceo`/`/my-site` 360 sweep: `output/playwright/sweep-*-360.png`

## Automated checks

- `npm run typecheck` passes after the student changes.
- `npm run qa:class`: 143 checks passed, 0 failed. This exercised API-backed student flows through pretest, profile, check, m1–m4, hints, wrong answers, help request, CEO, result, reflect, posttest, certificate gates, and cleanup.
- Test student `kasuki-v2-20261101` was removed with a direct SQL delete constrained to that nickname and classroom `UAT777`.
- Authenticated screenshot checks used 390×844 and 360×740; no student-side runtime errors were seen in the final quiz and Dome captures.

## Remaining visual gate

The UAT script proves flow/API behavior, not every rendered m3/m4 interaction screenshot. Deep visual states for m3 tag/stamp/interview, m4 search-result sheet, and every mission mode still need a manual screenshot walk before claiming zero visual major findings.

## Gate status

**Continue needed:** deep visual mission-state screenshot walk and any remaining m3/m4 overlay fixes.
