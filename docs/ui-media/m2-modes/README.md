# M2 mode references

The three owner-selected storyboard boards are kept here as visual references:

- `visual-storyboard.png` — ดูคลิป: clip card → watch → timeline checks → post-clip question → exit check → end
- `text-storyboard.png` — แชต: lessons 1–3 → free-type answer → hints/ask Dome → summary → exit check → end
- `sim-storyboard.png` — ลากวาง: storm intro → domain-part activities → right-to-left read → exit check → A/B/C result

The live implementation keeps mode selection in the map bottom drawer, then reuses the existing server-backed learn path:

- Visual uses `path.watch.scenes`, the m1/m2 media player or scene fallback, review ranges, and open-answer grading.
- Text uses `ChatReader`, quick checks, free-type answers, and the AI/rule fallback in `/api/mission/[id]/learn`.
- Sim uses the existing `MissionGame` build interaction and server validation; the m2 badge explicitly teaches right-to-left reading.

The boards are references only; interactive labels and answers remain HTML/data-driven so keyboard access, AI grading, and the existing learning events are preserved.
