# QA batch 9 — authenticated student route sweep

## Findings first

| ID | State | Finding | Result |
|---|---|---|---|
| SWEEP-1 | `/home`, `/map`, `/knowledge`, `/rewards`, `/profile`, `/ceo`, `/my-site`, `/result`, `/showcase`, `/reflect`, `/posttest`, `/survey`, `/mission/m1–m4` | Final authenticated sweep needed to catch button wrapping, undersized body text, and route-level console failures after the visual batches. | fixed state was verified; no new blocker/major found. |

## Automated gate

- Viewport sweep used the authenticated UAT session at 390×844; `/pretest` and `/map` were additionally checked at 360×740.
- Visible `button`/`a` controls with non-zero boxes: no wrapped or clipped labels detected.
- Visible body text below 14px: none detected.
- Console: no runtime error or warning from the student routes; React DevTools/HMR informational logs only.
- `npm run typecheck`: pass.
- `npm test`: 53 files / 1,020 tests pass.
- `npm run build`: pass. Next emitted only the existing `metadataBase` advisory.

## Test-data cleanup

- The local UAT test student created for this run was deleted with direct SQL limited to `nickname = 'kasuki-visual-20261101'`; follow-up query returned zero rows.
- The linked database had no matching row, so no linked data was changed.

## Gate status

No blocker/major findings remain in the student routes covered by the final sweep. Teacher/board/landing and proxy/API changes were intentionally not touched.
