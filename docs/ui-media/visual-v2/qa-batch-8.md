# QA batch 8 — map island entry motion

## Findings first

| ID | State | Finding | Result |
|---|---|---|---|
| M-TRANSITION | `/map` unlocked island tap | The previous implementation prefetched and showed a fog layer, but the map itself did not zoom toward the tapped island. | fixed: the tapped island supplies a CSS transform origin; the artboard scales into that island for 720ms while the fog layer announces the route change. |

## Visual evidence

| State | Viewport | Artifact | Result |
|---|---:|---|---|
| `/map` → mission 1 | 360×740 | `output/playwright/map-transition-mid-after.png` | pass: route navigation completes to `/mission/m1`; transition is non-blocking and prefetches before push. |
| reduced motion | CSS media rule | source check in `app/globals.css` | pass: transform transition is removed and fog duration is shortened. |

## Automated checks

- `npm run typecheck` passes.
- `npm test` passes: 53 files, 1,020 tests.
- Unlocked island tap still navigates after the transition; route prefetch remains before the delay.
- Locked island behavior remains unchanged: no navigation, info toast only.

## Gate status

No blocker/major findings remain in the map transition state. The remaining owner work is the exhaustive authenticated m1–m4 mode-by-mode play-through and cleanup of the temporary student record.
