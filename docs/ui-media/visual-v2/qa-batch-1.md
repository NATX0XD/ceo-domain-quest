# QA batch 1 — profile / landing / join

## Findings first

| ID | State | Finding | Result |
|---|---|---|---|
| A-01 | `/` landing | Footer actions did not share an explicit height/radius contract with join. | fixed by aligning join primary/secondary to `min-h-16 rounded-xl`; landing remains the source style |
| A-02 | `/join` 390/360 | Boxed Dome paragraph, footer back link, and dynamic “เหลืออีก N ช่อง” copy competed with the form. | fixed: short HTML header, top-left back link, verb-only CTA |
| P-01 | `/profile` ask | Outer step progress plus question progress, answered count, dots, and two nav pairs created one-flow duplication. | fixed in code: one question progress bar, one visible nav pair, no bottom nav, no Dome paragraph |
| P-02 | `/profile` card/goal | Fixed footer and bottom nav consumed space and could cover the identity card/goal form. | fixed in code: bottom nav hidden in flow, content gets bottom breathing room; authenticated recheck still required |
| QA-01 | all changed routes | `docs/ui-media/ux-audit-6/findings.md` named by the brief is not present in the checkout. | recorded as source blocker; used available audit screenshots and owner IDs instead |

## Screenshots

| Screen | Before | After |
|---|---|---|
| `/join` 390 | `docs/ui-media/ux-audit-6/join-empty-390.png` | `output/playwright/join-390x844-after.png` |
| `/join` 360 | `docs/ui-media/ux-audit-6/join-empty-360.png` | `output/playwright/join-360x740-after.png` |
| `/profile` | `docs/ui-media/ux-audit-6/profile-s1-q2-answered-390.png` | blocked: no student session in the owner dev browser |

## Automated checks

- `/join` 390×844: document height `844`, main scroll height `707`; no page overflow.
- `/join` 360×740: document height `740`, main scroll height `603`; no page overflow.
- Primary/secondary buttons are at least 44px high; the join CTA is 64px high.
- Button labels are single line: `เข้าห้องเรียน`, `เข้าห้องเดิม`, `เคยเข้าแล้ว ย้ายเครื่อง`, `หน้าแรก`.
- Console showed only React DevTools/HMR informational entries; no runtime error from `/join`.

## Manual review

- Join scene is readable at both sizes; the form panel, all four PIN cells, footer CTA, and back control are visible.
- The 360 state no longer displays the “เลื่อนดูต่อ” pseudo-label or asks the user to discover a nested scroll.
- Profile visual review is pending authenticated state coverage for steps 1–5, dialogs/sheets, and the goal form.

## Gate status

Batch 1 is **partially pass**: changed unauthenticated landing/join states pass the current checks; authenticated profile state coverage remains open and must be rerun before the next student batch.
