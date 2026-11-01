# QA batch 2 — shared student world / setup / home / intro

## Findings first

| ID | State | Finding | Result |
|---|---|---|---|
| H-01 | `/home` | Dome appeared in the header and again in the next-action bubble; the shop card also repeated progress. | fixed: one Dome bubble and one flow progress indicator |
| H-02 | `/home` | “เหลืออีก N ขั้น” was derived from a different counter than the active step. | fixed: derived from `stepTotal - stepNow`, clamped at zero |
| S-01 | `/setup` | Eight full-width business rows made the form tall and forced Hick-style scanning. | fixed: two-column image tile grid |
| S-02 | `/setup` | CTA repeated answered-count progress and the preview caption stayed generic after a name was entered. | fixed: verb-only CTA and live shop-name caption |
| B-02 | `/intro` | Intro art was a single mascot on a flat surface; it did not belong to the island world. | fixed: responsive sky/shop/Dome layers with HTML copy panel |
| M-01 | `/map` | Unlocked island navigation swapped immediately, with no entry affordance. | fixed: prefetch + 720ms fog transition; reduced-motion short fade |

## Screenshots / manual review

| State | Viewport | Artifact | Result |
|---|---:|---|---|
| `/` | 390×844 | `output/playwright/student-landing-390x844.png` | pass: primary/secondary actions share height/radius language; art and copy remain readable |
| `/join` empty | 390×844 | `output/playwright/student-join-390x844.png` | pass: top-left back action, no inner form scroll, CTA remains in footer |
| `/setup` | 390×844 + 360×740 | authenticated recheck pending | code gate pass; tile/grid and caption updated |
| `/home` | 390×844 + 360×740 | authenticated recheck pending | code gate pass; one progress indicator and one Dome |

## Automated checks

- `npm run typecheck` passes after student changes.
- Generated intro layers are WebP and each is under 200KB: `sky.webp` 89KB, `shop.webp` 114KB.
- Student buttons in the new world skin set `white-space: nowrap`; the visible CTA labels are ≤4 words.
- Teacher, landing, API, and existing screenshot artifact changes were not staged.

## Gate status

Batch 2 is **pass for unauthenticated visual states and code checks**. Authenticated `/setup`, `/home`, `/map`, and all flow states remain in the final authenticated gate.
