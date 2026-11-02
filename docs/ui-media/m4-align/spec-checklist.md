# Mission 4 teammate-flow alignment (m4c, 2026-11-02)

Flow and UX follow the teammate boards in `docs/mission-4/images/game/R01-R11` and the flowchart. The visual layer uses the same game style as the m2 storyboard (`UI/ภารกิจที่ 2/example use flow/*.jpg`): full-bleed scene background, wood title sign, round back/sound buttons, cream boards, Dome with a white speech bubble, big glossy green CTA. The pixel office from the teammate boards is replaced by a new bright cartoon office (`public/learn/m4/bg-office-bright.webp`, no baked text). All copy is live HTML.

Evidence: `m4c-compare-<screen>.jpg` = teammate reference (left) beside the build at 390x844 (right). Failing path at 360x740 = `m4c-fail-*.jpg`. Rules/intro at 360x740 = `m4c-rules-360.jpg`, `m4c-intro-360.jpg`.

## Screen-by-screen check

| Screen / step | Teammate layout + interaction | Build now | Evidence | Final |
|---|---|---|---|---|
| R00 กติกา (new, from m2 storyboard) | Visual rules board before play | Infographic board: 4 numbered tiles with 3D icons (search, 10 cards, events, boss), coin/timer/star strip, Dome bubble, green CTA | [compare](m4c-compare-R00-rules.jpg) · [360](m4c-rules-360.jpg) | MATCH |
| R01 เปิดด่านบอส | Office + BOSS, Dome presents surname card, caption, CTA `เริ่มเดินเรื่อง` | Registrar building with live sign + BOSS badge, Dome bobbing beside a `.in.th` ticket (spring-in), bubble with real domain, HUD 0/10 · 04:30 · coins | [compare](m4c-compare-R01-boss-intro.jpg) · [360](m4c-intro-360.jpg) | MATCH |
| R02 ค้นชื่อจริง | Clipboard search, compact status rows (red/green/orange), Dome asks why | Clipboard board, rows stagger in with status pills `ถูกจดแล้ว` / `ไม่พบการจด` / `ไม่มีสิทธิ์ตามบัตร`; RDAP + offline fallback untouched | [compare](m4c-compare-R02-real-search.jpg) | MATCH |
| R03 นักสืบโดเมน | Card with status / registered / expiry rows, Dome question, 3 answers | Centered modal: fact rows with 3D icons, Dome bubble asks, 3 answers, server check, wrong → retry once | [compare](m4c-compare-R03-domain-detective.jpg) | MATCH |
| R04 แผงเดินเรื่อง | 10-slot rail, .th/.com tabs, icon card tray, drag to glowing slot | Numbered rail with icons, .th/.com tabs, sticky tray of icon cards; pointer drag (mouse/touch) with lifted ghost card, tap fallback; wrong card shakes back and a sticky Dome hint appears | [compare](m4c-compare-R04-route-board.jpg) · [fail](m4c-fail-01-wrong-card-360.jpg) · [hint](m4c-fail-01b-wrong-card-hint-390.jpg) | MATCH |
| R05 ฟอร์ม + เอกสาร | Registration paper, 1/2/3-year choice, 3 document cards | Form paper with 1/2/3 years; TLD chips + 3 document cards with art and a check badge; review before submit | [compare](m4c-compare-R05-form-docs.jpg) | MATCH |
| R06 กล่องอีเมล | Inbox, request for clearer document, outcome legend | Inbox header, wait spinner, mail result; legend อนุมัติ / ขอเอกสารเพิ่ม / ไม่อนุมัติ highlights the live outcome; event quiz | [compare](m4c-compare-R06-email-inbox.jpg) · [fail](m4c-fail-02-wrong-event-360.jpg) | MATCH |
| R07 ชำระเงิน | Invoice, approved stamp, 856, .com comparison | Invoice board, server "pay after approval" event, coin burst, paid stamp, coin HUD counts down, .com comparison card | [compare](m4c-compare-R07-payment.jpg) | MATCH |
| R08 ตั้ง DNS | Two NS fields, kmutnb.ac.th reference, name → DNS → shop diagram | Same, diagram lifts green when the test passes | [compare](m4c-compare-R08-dns-setup.jpg) | MATCH |
| R09 ข้ามเวลา 1 ปี | Calendar flip, "30 days", renew / let lapse | Calendar flip (reduced-motion safe), big red "30 วัน" warning, renew 856 or lapse → suspended site + restore 1,712 | [compare](m4c-compare-R09-time-skip.jpg) · [fail](m4c-fail-03-lapse-360.jpg) | MATCH |
| R10 อธิบายให้บอสฟัง | Boss, ordered chips, reasons, completeness meter, submit | Chips in order, reason per step, renewal choice, live meter, server rubric + boss follow-up; fail → repair round of missed events | [compare](m4c-compare-R10-boss-explain.jpg) · [fail](m4c-fail-04-explain-3of10-360.jpg) · [repair](m4c-fail-05-repair-360.jpg) | MATCH |
| R11 จบด่าน | Certificate, stars, score rows, CEO badge, Dome celebrating, back CTA | Certificate board, stars, server score rows, CEO badge, celebrating Dome; dock `กลับแผนที่` + `ไปด่านหลัก →`; failed result → `อธิบายให้บอสฟังอีกครั้ง` | [compare](m4c-compare-R11-boss-clear.jpg) · [1 star](m4c-fail-06-clear-1star-360.jpg) | MATCH |

## Cross-cutting acceptance

- [x] 390x844 and 360x740 readable, no horizontal overflow; desktop keeps a centered 560px stage.
- [x] Real pointer drag for route cards (mouse + touch via pointer events); tap still works.
- [x] `prefers-reduced-motion`: loops/transitions off, state feedback kept.
- [x] Timer, Dome lines, server grading, RDAP search and offline fallback unchanged in logic.
- [x] Every row has a paired screenshot beside the teammate reference.
- [x] Failure path played: wrong card, wrong detective answer, wrong document, wrong events, lapse + restore, weak explanation (3/10) → repair → pass with 1 star.

## Scope note / hookup for the learn-path owner

`RegistrarGame` now renders its own full-screen stage (fixed, like `M2Flow`) with a back button (exit confirm → `/map`), its own rules screen and its own end CTA. Suggested change in `learn-path-client.tsx` (not edited here): for `path.do.kind === 'registrar'`, skip the generic "เป้าหมายด่านนี้" intro and open `step = 'do'` directly, because the game's rules infographic now covers that brief.
