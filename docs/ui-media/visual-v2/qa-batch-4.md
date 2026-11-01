# QA batch 4 — authenticated student polish and full route sweep

## Findings first

| ID | State | Finding | Result |
|---|---|---|---|
| H-03 | `/home` stage 0 | The selected shop was rendered as a generic empty lot, so the student could not see their own business yet. | fixed: the selected business photo is revealed faintly behind the construction overlay at stage 0; later stages still reveal the same shop progressively. |
| S-03 | `/setup` 390/360 | The scenic background competed with the heading and long choice descriptions made tile buttons look like wrapped CTAs. | fixed: opaque world surface, one-line purpose copy, short visible labels, full labels preserved in `aria-label`. |
| P-03 | `/profile` step 1 | Quiz dots duplicated the single progress bar. | fixed: compact profile step keeps the bar and nav pair only. |
| M-05 | `/mission/m1` intro | Goal story and warmup explanation formed a text wall before the first action. | fixed: three-line teaser, expandable full story, one-line warmup note. |
| W-01 | `/mission/m1–m4` learn shell | Learn screens used a separate flat app skin instead of the approved island-world language. | fixed: shared learn shell now uses wood header, cream dock, sea tint, and wood-edged cards. |
| C-01 | `/ceo` speak step | The boss objective occupied too much of the hero and inherited the flat student shell. | fixed: objective is capped to three lines and the boss flow uses the same sea/cream world surface. |

## Automated checks

- `npm run typecheck` passes after the changes.
- Authenticated UAT student sessions were created through `POST /api/join` for the visual sweep, then profiles through `POST /api/profile`.
- 390×844 route sweep captured `/intro`, `/dome`, `/setup`, `/home`, `/map`, `/mission/m1–m4`, `/knowledge`, `/rewards`, `/profile`, `/ceo`, and `/my-site`.
- 360×740 route sweep captured `/setup`, `/home`, `/map`, `/mission/m1–m4`, `/knowledge`, `/rewards`, `/profile`, `/ceo`, and `/my-site`.
- Both sweeps reported document height equal to viewport height and no console errors.
- CTA/choice wrap scan found no wrapped visible setup or primary-action labels after shortening setup choices. Map hotspot controls are intentionally icon-only and have accessible labels.

## Manual review

- `/home` now visibly belongs to the selected bakery world even before the first mission is passed; the shop name remains live HTML outside the art.
- `/setup` at 390 and 360 keeps the heading, one progress bar, preview, name field, and next action legible without an inner scroll container.
- `/profile` step 1 keeps the question and four choices as the hero; the duplicate dots are gone.
- `/mission/m1` warmup uses the same wood/cream/sea language as `/map`; full story remains available behind an explicit disclosure.
- `/ceo` keeps the speaking task as the hero and leaves the recording action in the thumb zone.
- `/knowledge` card titles may wrap inside topic cards by design; primary back/next CTAs remain short and single-line.

## Gate status

Batch 4 passes the current static/visual route gate. Remaining risk is end-to-end answer coverage through every m1–m4 mode, including successful result state, which must be completed in the final play-test gate.
