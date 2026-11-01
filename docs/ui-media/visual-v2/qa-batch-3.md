# QA batch 3 — map, mission mode, knowledge, rewards, result

## Findings first

| ID | State | Finding | Result |
|---|---|---|---|
| M-02 | `/mission/m1` watch fallback | Scene frames could be cropped by `object-cover`, especially portrait source art. | fixed for scene frames: `object-contain` inside a 16:10 panel; copy remains below |
| M-03 | mission passed state | Result was a long score/card stack rather than a short Dome conversation. | fixed: one Dome bubble plus three short next choices: ทบทวน / ตอบเสริม / ไปต่อ |
| M-04 | mode selection sheet | Labels were verbose and looked like a generic utility list. | fixed: compact visual labels ดู / อ่าน / ลงมือทำ / คุยคู่หู and wood-panel treatment |
| K-01 | `/knowledge` | Back CTA included the full mission title and wrapped/clipped on narrow screens. | fixed in the next-action label contract: primary labels are verb-first and nowrap; visual check confirms no wrapped CTA on the 390 state |

## Manual review

- `/intro`, `/dome`, `/profile`, `/knowledge`, `/rewards`, and `/mission/m1` were captured at 390×844 in `output/playwright/`.
- `/map` remains the visual source of truth: sea/island background, wood plaque, star badges, round back button.
- `/mission/m1` initial learn state is readable and the next action stays in the thumb zone; long lesson detail remains progressively disclosed.
- Mission mode labels are short enough for one-line buttons and the sheet stays within the app width.

## Gate status

Batch 3 is **pass for the captured first states and code-level result/mode fixes**. Full authenticated step-by-step play through every m1–m4 mode is still required in the final gate.
