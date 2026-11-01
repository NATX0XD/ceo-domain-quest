# Teacher CMS redesign audit

## Scope

Audit of the authenticated teacher workspace: `/teacher`, `/teacher/board`, `/teacher/student`, `/teacher/review`, `/teacher/requests`, `/teacher/report`, `/teacher/showcase`, `/teacher/settings`, and `/teacher/demo`. Student routes are explicitly out of scope.

## Findings

1. The teacher shell is a fixed-height dashboard with several nested flex/grid regions. At narrow desktop widths, the header controls and the live-class bottom actions compete for width; the last action can be clipped instead of wrapping.
2. The live-class cockpit uses a saturated purple gradient, full-width tinted alert surfaces, and several competing status colors. This makes the urgent student state harder to scan and does not match a calm CMS workflow.
3. The main content has no shared twelve-column contract. The live roster and utility rail use ad-hoc widths (`15rem`, `xl:grid-cols-3`) and report/settings pages use independent grids, so the right rail becomes visually cramped around 1024–1280px.
4. Student status text is explicitly truncated in the roster (`truncate` on both name/status). Thai progress strings therefore lose meaning, including the owner-reported “ผ่านแล้ว … ภารกิจ” line.
5. Header, utility-rail, and sticky/fixed action controls rely on single-line labels and shrink-resistant buttons. Long Thai labels wrap at awkward points or run past the viewport.
6. Cards use large radii, heavy soft shadows, and many semantic background tints. This creates visual noise and makes the actual primary action unclear.
7. Mobile behavior is mostly an overlay drawer, but the page action row needs a reserved bottom area. Without a consistent shell inset, the action bar can cover content on 390px screens.
8. The existing shared typography tokens already keep body text above 14px, but teacher-specific labels still inherit truncation and dense one-line layouts. Focus styles exist and should be retained.

## Design direction

- Warm neutral canvas, white surfaces, 1px structural borders, and one dark ink accent for primary actions.
- Semantic status colors remain available only as small bars, dots, badges, and short labels.
- A namespaced `.teacher-cms` shell owns the responsive rules so student pages are unaffected.
- The shell uses a 12-column mental model: full-width page header, primary content spanning 8–9 columns, and utility content spanning 3–4 columns where space allows. At tablet/mobile widths, columns collapse without horizontal scrolling.
- Key student information wraps to two lines; only secondary metadata may be ellipsized. Important labels use `overflow-wrap:anywhere`.
- The action row wraps inside normal document flow and receives bottom padding rather than overlaying content.

## Implementation plan

1. Add a teacher-only namespace to the authenticated shell and shared teacher page body.
2. Normalize the shell/header/sidebar, cards, buttons, alerts, tables, drawers, and live roster with scoped CSS.
3. Remove the live cockpit’s large gradient/tint treatment through scoped overrides while preserving data, event handlers, links, and authorization.
4. Add responsive breakpoints for 1920, 1440, 1280, 1024, 768, and 390px; keep the mobile drawer and make its content fit without page overflow.
5. Verify every teacher route with headless Chromium, capture viewport evidence, assert `scrollWidth === clientWidth`, and run typecheck/tests/build.

## Verification target

The redesign is successful when all listed teacher routes render with no horizontal overflow at every requested viewport, key names/statuses remain readable, primary actions stay inside the viewport, and the fixed/sticky action treatment never covers the final content block.
