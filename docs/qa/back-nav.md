# Student back-navigation audit

Back buttons use explicit links or an explicit confirm flow. No student back control uses `history.back()` or `router.back()`.

| Student page | Back target | Behavior |
| --- | --- | --- |
| `/home` | — | Root student lobby; no back button. |
| `/map` | `/home` | Round wooden map hotspot. |
| `/mission/[id]` | `/map` | Opens the exit confirmation while the mission is active; completed missions use the existing map CTA. |
| `/ceo` | `/map` | Opens the exit confirmation while the boss form is active; submitted status is a direct link. |
| `/posttest` | `/map` | Waiting/result screens use an explicit link; the active quiz asks before leaving. |
| `/pretest` | `/home` | Explicit game-frame link. |
| `/reflect` | `/posttest` | Active reflection returns to the posttest step; completed reflection returns to `/result`. |
| `/result` | `/home` | Shared header link. |
| `/knowledge` | `/home` | Shared header link. |
| `/rewards` | `/home` | Shared header link. |
| `/profile` | `/home` | Shared student-shell link. `/check` returns here. |
| `/setup` | `/home` | Shared student-shell link; locked state keeps its existing home CTA. |
| `/dome` | `/home` | Shared header link. |
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
