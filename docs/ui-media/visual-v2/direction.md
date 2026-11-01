# Visual V2 direction

## Read

Student-side learning game for Thai vocational students. The approved world is a
bright island adventure: blue sea, warm wood signs, glossy mission badges, cream
panels, and the official Dome mascot. The bebetter reference is used only for
clarity: short copy, one job per screen, visual status, and generous breathing
room. It does not replace the student game art.

## Design decisions

- **World:** UI/ artwork is the source of truth. Use island/sea scenes, wood
  plaques, round wood back controls, glossy pills, star badges, and Dome bubbles.
- **Hierarchy:** one headline, one primary action, one progress indicator. The
  question, choices, map, or form owns at least 60% of a 390x844 viewport.
- **Copy:** purpose in one short line; helper text is one line; details move to
  an info affordance or a later state. Buttons use 3–4 words and never wrap.
- **Surfaces:** warm cream panels over the game scene. Tint cards only when the
  tint communicates state. Avoid flat app-dashboard blocks and duplicate Dome.
- **Motion:** use Motion for feedback and route transitions only. Reduced motion
  falls back to a short opacity crossfade. Never let an animation delay a link.
- **Accessibility:** body text stays at least 14px, controls are at least 44px,
  focus rings remain visible, and real HTML text is used over artwork.

## Batch order

1. Profile flow, landing, and join: remove duplicate progress/navigation and
   make the first viewport usable at 360px and 390px.
2. Setup and home: connect the shop scene to mission progress and reduce chrome.
3. Map, knowledge, rewards, and mission mode choice: reuse the approved map and
   popup language, then add the island-enter transition.
4. Mission states and result: compact scenes and turn result feedback into a
   Dome conversation.

Each batch records findings first, then screenshots and state-by-state checks in
`docs/ui-media/visual-v2/qa-<batch>.md`.
