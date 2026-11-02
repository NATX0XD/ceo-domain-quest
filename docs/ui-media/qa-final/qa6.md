# QA round 6 — UI conformance + real flow

Date: 2026-11-02 · Chrome headless, real UI actions only · viewport baseline 390×844

Product code was not edited. The only student records created in this round were `qa6-1209` and `qa6-1218`; the teacher UI has no per-student delete action, so they remain as a cleanup blocker (see D7). No room reset or direct database write was used.

## Part A — design conformance

I opened all 100 image files under `UI/` and extracted/inspected 3 representative frames from `UI/1015.mp4`. The pair boards are in [`qa6-design/`](qa6-design/). Each row below covers every file in the listed folder/glob; numeric ranges are inclusive and no files in the range were skipped.

| design file(s) | app route/state and pair evidence | result | concrete comparison | exact teammate asset used by app? |
|---|---|---|---|---|
| `UI/Welcome/{Dome.png,bg.png,effect.png,logo.png,option.png}` | `/` welcome, 390×844; [`pair-welcome-bg.jpg`](qa6-design/pair-welcome-bg.jpg), [`pair-welcome-logo.jpg`](qa6-design/pair-welcome-logo.jpg), [`pair-welcome-option.jpg`](qa6-design/pair-welcome-option.jpg) | PARTIAL | Same island/welcome intent and mascot/logo role, but app composition is a compact responsive HTML hero with different crop, spacing, typography, CTA treatment, and Dome pose/placement. | No. App uses `public/ui/welcome/{bg,effect,logo,dome}.webp`; `option.png` is not referenced. |
| `UI/02 — เข้าสู่ห้องเรียน/{bg.png,กรอบ.png,ปุ่ม.png,ป้าย.png}` | `/join?code=UAT777`, filled form; [`pair-join-bg.jpg`](qa6-design/pair-join-bg.jpg), [`pair-join-frame.jpg`](qa6-design/pair-join-frame.jpg) | PARTIAL | App has the same join task and framed mobile form, but fields are HTML cards and bottom CTA, with different background crop, labels, font, and ornament placement. | No. App uses `public/ui/join/{bg,frame}.webp`; exact PNG names are absent from app references. |
| `UI/03 คุยกับโดม/{1.png,2.png,3.png,4.png,bg.png,ปุ่ม.png,แชท.png}` | `/dome` after setup; [`pair-dome-chat.jpg`](qa6-design/pair-dome-chat.jpg) | PARTIAL | Dome conversation exists, but the four supplied storyboard/map screens and chat frame are not rendered as the supplied compositions; app uses a scrollable learning shell, HTML chat bubbles, different mascot poses and navigation. | No. App uses `public/ui/dome/bg.webp` plus separate `public/dome/mascot/*` assets. |
| `UI/ภารกิจที่ 1/{map.png,popup.png}` | `/map`; `/mission/m1` fog → mode chooser; [`pair-mission1-map.jpg`](qa6-design/pair-mission1-map.jpg), [`pair-mission1-popup.jpg`](qa6-design/pair-mission1-popup.jpg) | PARTIAL | Map and three-mode choice are implemented, including the recommended marker and alternate selection, but neither screen matches the supplied full-bleed map/centered popup: app uses modern progress cards, fixed nav, different art, colors, type scale, and popup placement. | No. App uses `public/ui/map/state-*.webp`, `public/ui/mode/*`, and CSS; `UI/ภารกิจที่ 1/popup.png` is not used. |
| `UI/LINE_ALBUM_กราฟิก_261101_{1..18}.jpg` plus `UI/messageImage_1793467941503.jpg`, `UI/messageImage_1793526248996.jpg` | `/`, `/join`, `/map`, `/dome`, m1/m2 learn states; [`pair-root-line-album.jpg`](qa6-design/pair-root-line-album.jpg), [`pair-root-message.jpg`](qa6-design/pair-root-message.jpg) | PARTIAL | These include duplicate/annotated references for welcome, join, map, Dome, and chat. The app has corresponding concepts, but not the supplied screenshot compositions, asset crops, or exact message art. | No. Equivalent files are in `public/landing`, `public/ui`, `public/learn`, and `public/dome`. |
| `UI/ภารกิจที่ 2/LINE_ALBUM_กราฟิก 2 งงๆ_261101_{1..38}.jpg` | `/mission/m2` read path, chat reveal and Dome questions; [`pair-mission2-screen.jpg`](qa6-design/pair-mission2-screen.jpg) | PARTIAL | Read path works to completion, but the supplied 38-screen visual language (frames, toolbar, pixel scenes, title bars, chat art) is not reproduced one-for-one; app is a different responsive card/shell implementation. | No. App uses `public/ui/m2/*`, `public/learn/m2/*`, and CSS/HTML. |
| `UI/ภารกิจที่ 2/example use flow/LINE_ALBUM_กราฟิก 2 งงๆ_261101_{39..61}.jpg` | Intended m2 storyboard/example flow; [`pair-mission2-storyboard.jpg`](qa6-design/pair-mission2-storyboard.jpg) | MISSING | No direct implementation of these storyboard frames as screens. The app has an m2 learning flow, but no exact storyboard scene sequence, layout, or supplied image usage. | No. No exact storyboard JPG is referenced. |
| `UI/mascot/dome-sheet-official.jpg` | Dome/mode/mission mascot states; [`pair-mascot-sheet.jpg`](qa6-design/pair-mascot-sheet.jpg) | MISSING | The supplied sprite sheet is not used/rendered as a sheet or as its exact poses. The app selects separate pose files and SVG/WEBP assets. | No. `public/dome/mascot/*` is a separate asset set. |
| `UI/1015.mp4` | m1 watch video; [`pair-video-frame-00.jpg`](qa6-design/pair-video-frame-00.jpg), [`pair-video-frame-25.jpg`](qa6-design/pair-video-frame-25.jpg) | PARTIAL | m1 does play a 31-second watch video and the learning intent matches, but the served file is `public/videos/m1-watch.mp4` (different hash/size from `UI/1015.mp4`), so supplied video is not the runtime asset. | No. `UI/1015.mp4` is not referenced; runtime asset is a different file. |

### Asset audit

Grep of `public/`, `app/`, and `components/` found no references to the supplied exact filenames `ปุ่ม.png`, `กรอบ.png`, `ป้าย.png`, `option.png`, `effect.png`, `Dome.png`, or `แชท.png`. There are deliberate-looking equivalents (`public/ui/welcome/*`, `public/ui/join/*`, `public/ui/mode/*`, `public/ui/map/*`, `public/ui/dome/*`), but visual comparison shows they are not the teammate files.

### Designs with no implementation at all

- `UI/ภารกิจที่ 2/example use flow/LINE_ALBUM_กราฟิก 2 งงๆ_261101_39.jpg` through `_61.jpg` — storyboard/example frames have no direct screen implementation.
- `UI/mascot/dome-sheet-official.jpg` — exact sprite sheet/poses are not implemented as supplied.
- Exact supplied image/video files listed above are not runtime assets; only conceptual equivalents exist for the other groups.

## Part B — real UI flow

Resume boundary was exercised with browser `POST /api/join/resume` (not direct DB): `qa6-1218` returned HTTP 200 with `{"ok":true,"nickname":"qa6-1218","roomCode":"UAT777"}` between B1/B2 and later segments. PIN was `1111`.

| segment | result | evidence and observed state |
|---|---|---|
| B0 teacher | PASS | `/teacher/signup` opened and was inspected without submitting. Seeded teacher `kru@uat.local` / `uat1234` logged into UAT777 via UI; [`qa6-teacher-home-1440.png`](../qa6-teacher-home-1440.png). |
| B1 student onboarding | PASS | Landing → `/join` → `/intro` → required `/setup` (shop, category, domain, registration, country) → `/dome` → `/map`; [`qa6-b1-join-filled-390.png`](../qa6-b1-join-filled-390.png), [`qa6-b1-setup-filled.png`](../qa6-b1-setup-filled.png), [`qa6-b1-resume.png`](../qa6-b1-resume.png). |
| B2 pretest/warm-up/mode | PASS | Pretest completed 10 items (3/10), warm-up recommendation was “ดูคลิป”, m1 fog transition appeared, mode popup showed `แนะนำ` on ดู, and another mode was selectable before returning to ดู; [`qa6-b2-fog-immediate-390.png`](../qa6-b2-fog-immediate-390.png), [`qa6-b2-mode-popup-390.png`](../qa6-b2-mode-popup-390.png). |
| B3 m1–m4 | FAIL | m1 completed 3/3, m2 completed 1/3, m3 completed 3/3 through UI; m4 reached real search but the UI returned `ค้นถี่เกินไปแล้ว พักสักครู่แล้วลองใหม่นะ` on repeated human-like attempts, preventing completion. m4 is 0/3; [`qa6-m1-complete-390.png`](../qa6-m1-complete-390.png), [`qa6-m2-complete-390.png`](../qa6-m2-complete-390.png), [`qa6-m3-complete-390.png`](../qa6-m3-complete-390.png), [`qa6-m4-search-390.png`](../qa6-m4-search-390.png). |
| B4 CEO proposal → teacher approval | FAIL | `/ceo` is reachable but `qa6-1218` is not unlocked for a complete CEO submission while m4 remains incomplete; teacher review UI itself was opened and showed an existing seeded queue item, not this student: [`qa6-ceo-before-m4-390.png`](../qa6-ceo-before-m4-390.png), [`qa6-teacher-review-1440.png`](../qa6-teacher-review-1440.png). |
| B5 posttest → reflection → certificate | FAIL | Teacher toggle was opened and then reverted via UI. Student reached posttest question 1 while open, but full posttest/reflection/certificate could not be completed after the m4 block; final teacher state is posttest closed: [`qa6-posttest-open-390.png`](../qa6-posttest-open-390.png), [`qa6-teacher-posttest-final-1440.png`](../qa6-teacher-posttest-final-1440.png). |
| B6 teacher visibility/evaluation | PASS | Teacher UI showed live student progress (`qa6-1218` 7 stars), student detail, review queue, reports, objective stats, learning-route stats, and reflection-summary counts/tabs; [`qa6-teacher-board-1440.png`](../qa6-teacher-board-1440.png), [`qa6-teacher-student-1440.png`](../qa6-teacher-student-1440.png), [`qa6-teacher-report-1440.png`](../qa6-teacher-report-1440.png), [`qa6-teacher-reflection-1440.png`](../qa6-teacher-reflection-1440.png). |

### Responsive checks

`/` and `/join` were captured at 1440×900 (`qa6-root-1440.png`, `qa6-join-1440.png`); `/map` backdrop at 1440×900 (`qa6-map-1440.png`); m1 at 360×740 (`qa6-mission-360.png`). No blank screen or horizontal browser overflow blocked interaction at these sizes, though the 360 mission is dense and scroll-dependent.

## Defects

| id | severity | screen | defect | evidence | fix |
|---|---|---|---|---|---|
| D1 | major | All student design surfaces | Teammate supplied assets are not used; app uses recreated/equivalent WEBP/SVG/CSS assets, changing visual conformance. | Asset audit above; all 15 pair boards. | Decide whether supplied assets are normative, then wire the exact files and preserve their intended crops/poses. |
| D2 | major | m1/m2 mode chooser | The learn-mode choice popup is not the supplied standalone popup composition; placement, card geometry, mascot, background, and type scale differ even though `แนะนำ` and alternate selection work. | [`pair-mission1-popup.jpg`](qa6-design/pair-mission1-popup.jpg), [`qa6-b2-mode-popup-390.png`](../qa6-b2-mode-popup-390.png). | Implement the teammate popup layout/assets or obtain an explicit approved replacement spec. |
| D3 | major | `/map` | Map is conceptually present but does not follow `UI/ภารกิจที่ 1/map.png`/the map storyboard: different art, card structure, nav, colors, and mascot placement. | [`pair-mission1-map.jpg`](qa6-design/pair-mission1-map.jpg), [`qa6-map-1440.png`](../qa6-map-1440.png). | Rebuild map against the supplied screen at 390px first, then verify desktop backdrop. |
| D4 | major | m4 real-name search | Repeated UI searches eventually hard-block the mission with `ค้นถี่เกินไปแล้ว` and no usable retry timing/fallback; this prevented a real end-to-end m4 completion. | [`qa6-m4-search-390.png`](../qa6-m4-search-390.png). | Show retry cooldown/countdown or use a deterministic UAT fixture after one real lookup; do not leave the student at a generic blocked state. |
| D5 | major | B4/B5 downstream | m4 block prevents the required CEO proposal/review and posttest → reflection → certificate path for this student. | B3–B5 table; `/ceo` remained 0/4 and `/posttest` waited when the teacher toggle was closed. | Unblock m4 first, then rerun B4/B5 with a clean QA student. |
| D6 | minor | `/teacher` on narrow viewport | Teacher login is covered by a device overlay until the tester explicitly chooses “เข้าใจแล้ว ใช้ต่อบนมือถือ”; headless 390px click is intercepted. | `qa6-teacher-login-fail-390.png`; 1440px works after seeded login. | Keep the overlay but expose a stable accessible close action/automation-safe focus, or document the desktop-only teacher surface. |
| D7 | minor / cleanup blocker | teacher student lists | No UI action exists to delete only `qa6-1209` and `qa6-1218`; the only destructive reset found removes/recreates the whole demo room. | `/teacher`, `/teacher/board`, `/teacher/student` showed both QA students but no delete control; room reset was not used. | Add a per-student delete/anonymize control, or provide a documented reversible QA cleanup path. |

## QUESTIONS FOR OWNER

1. Are the supplied `UI/` files normative runtime assets, or are the current `public/ui/*` equivalents acceptable? If normative, which screen owns each duplicate LINE_ALBUM/message image?
2. Should m1/m2 mode selection match the supplied centered `UI/ภารกิจที่ 1/popup.png` exactly, or is the current integrated mode section approved?
3. Are the 23 m2 “example use flow” storyboard frames intended as implemented screens, or reference-only boards?
4. Is `UI/1015.mp4` the required runtime video, or may `public/videos/m1-watch.mp4` be the approved replacement?
5. What is the intended owner-approved cleanup action for a single temporary QA student in UAT777?
