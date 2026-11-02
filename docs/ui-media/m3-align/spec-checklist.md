# Mission 3 alignment checklist (m3c)

Source of truth: `docs/mission-3/mission-3-domain-counter.md` (§4–§16), `docs/mission-3/images/ui/S01–S20`, `images/game/G01–G09`.
Visual style: m2 storyboard (`UI/ภารกิจที่ 2/example use flow/*.jpg`) — full-bleed scene, wood title sign, round back/sound, cream board panels, Dome + white bubble, big glossy CTA.
Captured headless at 390×844 (and 360×740 `*-360.png`) against the live dev server, two fresh students (pass path + fail path).
Side-by-side boards: `cmp-<S##|G##>.png` (teammate ref left, build right).

Shared shell: `components/learn/game-ui/counter-shell.tsx` + `counter-flow.css` (M3Stage, Panel, DomeSay, Cta, Building, useDragDrop, WebAudio sfx + mute).
Real drag = pointer events (mouse + touch, pointer capture, `elementsFromPoint` drop detection) with tap-item then tap-target fallback and keyboard Enter.

| Step | Teammate flow | Build (evidence) | Status |
|---|---|---|---|
| S01 | Mission card, objective, time/level, Dome greets, start | Infographic brief: 3-floor building with live Thai sign text, 3-step strip (อ่าน/ถาม/ตัดสิน), meta pills, Dome line, glossy CTA (`c-s01-brief-390`) | MATCH |
| S02 | Tutorial ป้าส้ม, dim + highlight request slip | Dimmed board, gold spotlight + pointing hand on `somtam.co.th`, tap to continue (`c-s02-tutorial-390`) | MATCH |
| S03 | Ask "จดทะเบียนบริษัทหรือยังคะ", read answer | Spotlit chip → reply bubble "ยังจ้า … บัตรประชาชน" (`c-s03-ask-390`) | MATCH |
| S04 | Handbook cue → stamp เสนอนามสกุลใหม่ → `.in.th`, Skip | Handbook open/close, wrong stamp feedback, `.in.th` ink stamp + win sfx, ข้าม always in dock (`c-s04a-book`, `c-s04b-wrong`, `c-s04-stamp`) | MATCH |
| S05 | 3 prep channels, "แนะนำสำหรับคุณ" | 3 glossy cards with 3D icons, chat recommended, CTA names choice (`c-s05-choose-390`) | MATCH |
| S06 | ≤1-min Dome tour clip + 3 questions, wrong = rewatch scene | 5-scene auto-play clip (floor zoom + glow, Dome lines, progress bar, pause), 3 Qs, wrong → "ดูฉากนั้นซ้ำ" jumps to that scene (`c-s06-*`) | MATCH |
| S07 | Scripted Dome chat (§5.2), nudge once on wrong | 4-question chat with typing dots, nudge on wrong, praise + next (`c-s07-nudge`, `c-s07-chat`) | MATCH |
| S08 | Drag 10 suffix tags into 3 floors, bounce + hint on wrong, building lights up | Real drag onto building floors (tap fallback), shake + Dome hint on wrong, placed chips on floor, building glow when done (`c-s08-*`) | MATCH |
| S09 | Queue 1/4, customer card, request, greeting | Counter scene bg, customer slides in with speech bubble, queue dots, points, request paper (`c-pass-s09-arrive`) | MATCH |
| (§16) | Tag type right after the card opens — drag 2 labels onto the card | Drag category labels onto each domain row (tap fallback), wrong rows highlighted on retry (`c-pass-tag`) | MATCH |
| S10 | Chat, 3-question counter, 6 question chips, document tray | Chat log + typing dots, "ถามได้อีก N" dots, chips | PARTIAL — no separate document tray (answers carry the documents) |
| S11 | Typed questions (challenge level) | "พิมพ์เอง" tab, typed text matched to closest stock question, unmatched gets a polite customer reply (`c-pass-s11-typing`) | MATCH |
| S12 | Handbook bottom sheet, 3 floors, timer | Spring bottom sheet, 3 coloured floors from content, 15 s countdown auto-closes, state kept (`c-pass-s12-book`) | MATCH |
| G05 | Dome desk hint, hints left | Dome sheet, step-aware hint, badge count (`c-pass-g05-dome`) | MATCH |
| S13 | 4 stamps | 4 rubber-stamp tiles with icons + hint lines (`c-pass-s13-stamp`) | MATCH |
| S14 | Suffix choice + 3 reason cards, then stamp | Progressive on the same board: suffix chips → 3 reason cards → gold "ประทับตรา", auto-scroll (`c-pass-s14-detail-2`) | PARTIAL — reasons are generic and unscored (server has no reason key) |
| S15 | Green result, points, stamped request, thanks, Dome | Green board, ink stamp lands on request, happy customer bounce, points count-up, Dome praise (`c-pass-s15-*`) | MATCH |
| S16 | Orange retry, tries left, Dome nudge, re-decide / handbook | Orange board, "ลองได้อีก 1 ครั้ง", wrong-tag hint, confused customer, ตัดสินใหม่ + คู่มือ (`c-fail-s16-retry-*`) | MATCH |
| S17 | Learner's own business, pick suffix + reason, Dome guides until eligible | Business card from profile (`/api/me`), `.go.th` rejected with reason, textarea, unscored "บัตรนามสกุลของฉัน" (`c-pass-s17-bad`) | MATCH |
| S18 | Pass report: correct customers, stars, key-question %, missed chips, my-suffix card, next mission | Stars, 4 metrics, group bars, missed chips, my-suffix card, per-customer accordion, "ไปภารกิจที่ 4" (`c-pass-report*`) | MATCH |
| S19 | Not-pass report → start 30 s drill | Orange report, "เริ่มฝึก 30 วินาที" primary, re-shift secondary (`c-fail-report*`) | MATCH |
| S20 | Conveyor of real domains, 3 bins, 30 s, then 1–2 customers, back to report | Real-domain parcels on moving belt, drag or tap bins, flash/shake, hurry timer, expiry → practice customers → new shift → report (`c-fail-s20-*`, `c-fail-practice`) | MATCH |
| G01–G09 | Pixel counter boards | Same steps rendered in the m2 glossy style (cmp-G01…G09) | MATCH (style intentionally m2) |

## Notes
- Content: c4 is now a normal company case (บริษัทสุขใจ) so the self-customer S17 is a separate unscored step (§10 says it is not a pass criterion). Answers stay server-side.
- Host hookups (owned by `learn-path-client.tsx`, not edited): pass `onExit={exit.request}` and `onFinish={() => go('done')}` to `<CounterGame>`; optionally skip the generic intro step for m3 because S01 now is the rules screen. Without them, back asks to confirm → `/map`, finish → `/map?done=m3`.
- Failing path captured with a second student (wrong tags + ปฏิเสธ twice → 38 คะแนน, 1 star).
