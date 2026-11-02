# Student back-navigation audit

Back buttons use explicit links or an explicit confirm flow. No student back control uses `history.back()` or `router.back()`.

## Navigation model

- **Main tabs** — `/home`, `/map`, `/knowledge`, `/rewards`, `/profile`: no back button. They show the bottom menu bar (`components/bottom-nav.tsx`) and a floating Dome button (`components/dome-fab.tsx`) that opens `/dome?from=<tab>`; the chat's back button returns to that tab (whitelisted, anything else falls back to `/home`). On `/map` the Dome button sits in the map art's top-left corner (over the painted back arrow) so it never covers islands, the pointer hand, or the boss card.
- **Sub-pages** — everything else keeps the round wooden back button (`StudentBackButton`) and no menu bar, except `/result` and `/showcase`, which keep the menu bar by design.

| Student page | Back target | Behavior |
| --- | --- | --- |
| `/home` | — | Main tab; menu bar, no back button. |
| `/map` | — | Main tab; menu bar, no back button (Dome button covers the painted arrow). |
| `/mission/[id]` | `/map` | Opens the exit confirmation while the mission is active; completed missions use the existing map CTA. |
| `/ceo` | `/map` | Opens the exit confirmation while the boss form is active; submitted status is a direct link. |
| `/posttest` | `/map` | Waiting/result screens use an explicit link; the active quiz asks before leaving. |
| `/pretest` | `/home` | Explicit game-frame link. |
| `/reflect` | `/posttest` | Active reflection returns to the posttest step; completed reflection returns to `/result`. |
| `/result` | `/home` | Shared header link. |
| `/knowledge` | — | Main tab; menu bar, no back button. |
| `/rewards` | — | Main tab; menu bar, no back button. |
| `/profile` | — | Main tab; menu bar, no back button. `/check` returns here. |
| `/setup` | `/home` | Shared student-shell link; locked state keeps its existing home CTA. |
| `/dome` | `?from=` tab or `/home` | Shared header link; returns to the main tab whose Dome button opened it. |
| `/check` | `/profile` | Shared student-shell link. |
| `/my-site` | `/home` | Shared header link. |
| `/showcase` | `/home` | Shared header link. |
| `/survey` | `/result` | Shared student-shell link. |

## Exit confirmation truth

The active mission/level flows say exactly what persists:

- Learn paths: server-submitted progress remains; unsent answers are only a local draft.
- Mission main question: submitted hints/help requests remain; an answer not sent for checking is discarded on exit.
- CEO boss form: uploaded audio and submitted work remain; unsent form text is discarded on exit.
- Posttest: answers are saved only when the quiz is submitted.

The dialog traps focus, restores focus after closing, and closes with `Esc`.
