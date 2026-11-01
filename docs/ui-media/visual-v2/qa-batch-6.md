# QA batch 6 — deep mission states and student overlays

## Findings first

| ID | State | Finding | Result |
|---|---|---|---|
| G1 | `/mission/m3` tag/stamp flow, 390/360 | HUD repeated the session timer with a shift clock and elapsed timer; the tag instruction bubble and stamp request card sat across the customer artwork/face. | fixed: one session timer remains in the shell; game HUD keeps only shift label, queue, and points; tag uses a short upper-right pill; stamp uses a compact right-side request card with the customer moved left. |
| G3 | `/mission/m4` search results, 390/360 | Every registered result used the same long action label, so rows were hard to distinguish and could wrap. | fixed: action now includes the row domain in the short label `ดู <domain>`. |
| S1/RC2 | `/knowledge` sheet open, 390 | The Tailwind v4 target reset cleared `transform` but not `--tw-translate-y`, leaving the panel at `top: 844px`; after that was fixed, the shell footer still covered the lower sheet. | fixed: target resets Tailwind translate variables; student main is raised above the shell footer only while a target sheet is open. |
| SETUP | `/setup` 360 | Setup needed a final runtime-console check after the v2 form changes. | verified: no console errors or warnings; all eight business tiles and the CTA are present. |

## Visual evidence

| State | Viewport | Artifact | Result |
|---|---:|---|---|
| m3 tag flow | 390×844 | `.playwright-cli/page-2026-11-01T13-35-08-677Z.png` | pass: customer face is clear; no duplicate in-game clocks |
| m3 tag flow | 360×740 | `.playwright-cli/page-2026-11-01T13-35-16-118Z.png` | pass: instruction pill stays above the face and controls remain tappable |
| m3 stamp flow | 360×740 | `.playwright-cli/page-2026-11-01T13-38-57-908Z.png` | pass: request card and customer are side-by-side; face is fully visible |
| knowledge sheet | 390×844 | `.playwright-cli/page-2026-11-01T13-37-33-477Z.png` | pass: sheet is above footer/nav and content can scroll inside it |

## Automated checks

- `npm run typecheck` passes after the deep-state fixes.
- Browser route sweep covered `/`, `/intro`, `/dome`, `/setup`, `/home`, `/map`, `/knowledge`, `/rewards`, `/profile`, `/ceo`, `/my-site`, `/result`, `/showcase`, `/reflect`, `/pretest`, `/check`, `/posttest`, `/survey`, and `/mission/m1–m4` at 390×844.
- `/setup` was rechecked at 360×740; console reported 0 errors and 0 warnings.
- Open knowledge sheet computed `top: 151.9px`, `translate: 0px`, and student main `z-index: 30` above footer `z-index: 10`.

## Gate status

This deep-state batch passes the visual findings above. Remaining risk is the owner-requested full answer-by-answer screenshot walk through every m1/m2 mode and the complete m4 route board, which is broader than the targeted fixes in this batch.
