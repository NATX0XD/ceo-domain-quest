# QA batch 7 — remaining student shell blockers and state cleanup

## Findings first

| ID | State | Finding | Result |
|---|---|---|---|
| I1 | `/intro` 390×844 | Visible `1/3` plus three navigation dots duplicated the same progress signal; the card icon was a platform emoji instead of the supplied visual language. | fixed: one screen-reader progress announcement; navigation dots remain the only visible indicator; card icons use 3D assets. |
| P7 | `/profile` step 3, 390×844 | The recommendation paragraph repeated the full weak-objective explanation and pushed the choice cards down, contrary to R4. | fixed: recommendation is one short line; the selectable cards remain the hero. |
| P8 | `/profile` step 4, 390×844 | Successful-save status repeated the CTA's meaning and consumed footer chrome. | fixed: completed status is omitted; sending/error states remain visible. |
| C1 | `/ceo` field/focus steps | Choice list items still used `min-h-0 flex-1`, retaining the same shrink/overlap failure mode as RC1. | fixed: list items use natural height and keep the list itself scrollable. |
| H6 | `/map` bottom state, 360×740 | Boss entry ended underneath the shell navigation when the map was scrolled to its end. | fixed: map reserves nav-height runway; the boss card is fully visible above the nav. |
| H7 | `/map` locked island | Lock toast used the global top position and could cover the map title. | fixed: map toast is positioned above the bottom navigation. |

## Visual evidence

| State | Viewport | Artifact | Result |
|---|---:|---|---|
| `/intro` first card | 390×844 | `output/playwright/intro-390-after.png` | pass: layered island scene, HTML copy on cream panel, one visible dot indicator, no emoji. |
| `/profile` goal step | 390×844 | `output/playwright/profile-step4-390-after.png` | pass: all three goal cards are separate/tappable; custom goal form follows them and is not covering them. |
| `/map` scrolled end | 360×740 | `output/playwright/map-360-bottom-after.png` | pass: boss entry is fully visible with room below it. |
| `/pretest` first question | 360×740 | `output/playwright/pretest-360-current.png` | pass: question card and four choices do not intersect; one progress bar and one nav pair. |

## Automated checks

- `npm run typecheck` passes.
- `npm test` passes: 53 files, 1,020 tests.
- Browser checks used the owner dev server at `http://localhost:3000` without restarting it.
- `/join`, `/intro`, `/dome`, `/setup`, `/profile` steps 1–4, `/pretest`, and `/map` were walked at 390×844 and/or 360×740.
- Visible student buttons remained single-line; no new body text below 14px was introduced.

## Gate status

No blocker/major findings remain in the states covered by this batch. Remaining work is the owner-requested exhaustive answer-by-answer mission walk and final authenticated cleanup, recorded in the next batch.
