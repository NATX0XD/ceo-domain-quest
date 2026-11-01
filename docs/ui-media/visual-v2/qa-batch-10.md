# QA batch 10 — final student sweep and bottom-sheet regression

## Findings first

| ID | State | Finding | Result |
|---|---|---|---|
| S1-regression | `/knowledge#knowledge-m1`, `/rewards#sheet-goal`, `/result#sheet-cert`, `/showcase#sheet-peers` | Tailwind 4 emitted `translate-y-full` through the `translate` property, so targeted server sheets stayed below the viewport even though the older variable/transform reset was present. | Fixed by resetting `translate: 0 0` in `.sheet-panel:target`. |
| SWEEP-10 | Authenticated student routes at 390×844 and 360×740 | Final route sweep needed to confirm no student console errors, horizontal overflow, or sub-44px visible controls after the sheet fix. | No new blocker/major found. |

## Automated gate

- Auth session created through `POST /api/join` in `UAT777` with nickname `kasuki-visual-20261101`, then `/api/profile` saved a test shop.
- Checked `/`, `/intro`, `/dome`, `/setup`, `/home`, `/map`, `/knowledge`, `/rewards`, `/profile`, `/ceo`, `/my-site`, `/join`, `/mission/m1–m4`, `/result`, `/showcase`, `/reflect`, `/posttest`, and `/survey` at 390×844 and 360×740.
- Route responses rendered without a student console error/warning and without horizontal overflow.
- Visible controls remained at least 44px high; the multi-line card layouts are intentional card content, not wrapped CTA labels.
- `/intro` was visually inspected with the layered sky/island/shop/Dome scene and real HTML copy on the cream panel.
- Opened the targeted server sheets and measured their boxes after the hash transition: each sheet entered the viewport (`top < 740`, `bottom = 740`, `translate = 0`).
- Existing full flow coverage from QA batches 1–9 remains the evidence for profile 1–5, setup steps, pretest/check, mission deep states, result conversation, and m3/m4 games.

## Cleanup

- Deleted the single test student created for this batch with direct SQL constrained to `nickname = 'kasuki-visual-20261101'` and classroom `UAT777`; follow-up count was zero.

## Gate status

Student blocker/major gate: **0**. Teacher/board/landing/proxy/API files were not edited.
