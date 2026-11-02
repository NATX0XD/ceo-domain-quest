# Mission 1 alignment checklist

Baseline: [current/00-current-mission-390.png](./current/00-current-mission-390.png). Final pass: 2026-11-02, played headless at 390×844 and 360×740 against the local dev server. Four temporary students were used: m1cW376 (watch), m1cR27389 (read, failing path then pass), m1cD15916 (do, failing path then pass), and m1cX19665 (watch failing path at 360).

Sources: `docs/teammates/OBJ01_Watch_Video_Learning_Flow.md`, `OBJ01_Read_Chat_Learning_Flow.md`, `OBJ01_Do_DragDrop_Learning_Flow.md`, the m2 storyboard (`UI/ภารกิจที่ 2/example use flow`), and `UI/03 คุยกับโดม`.

Visual language, used on every m1 screen (`components/learn/m1/m1-shell.*`): full-bleed scene background (sky or bakery, plus the Dome room for the hand-off), a wood title sign with leaves, round back and sound buttons, a purple step pill, a 3-step strip, cream boards with a brown outline, Dome with a white speech bubble, and a big glossy CTA docked at the bottom.

† Deviation by app structure: the spec's `ไปวัตถุประสงค์ที่ 2` button would skip a step. In this app, island 2 only unlocks after the Mission 1 end-of-mission question. The pass CTA is therefore `ไปต่อ: คำถามท้ายภารกิจ`. It opens the next step immediately, with no forced re-answer.

## Shared

| ID | Step | Status | Evidence |
|---|---|---|---|
| S0 | Entry from map → `/mission/m1`, centred stage, no warm-up gate | MATCH | [s1](./s1-mode-chooser-390.png) |
| S1 | Mode chooser: Dome greeting, 3 art tiles (ดูวิดีโอ, อ่านแชต, ลงมือทำ), `แนะนำสำหรับคุณ` tag, any mode selectable, `เริ่มภารกิจที่ 1` | MATCH | [390](./s1-mode-chooser-390.png) · [360](./s1-mode-chooser-360.png) |
| S2 | Storyboard shell (sign, round back/sound, steps, cream boards, glossy CTA, 44px+ targets, reduced-motion) | MATCH | all screens |

## Watch

| ID | Step | Status | Evidence |
|---|---|---|---|
| W0 | Brief infographic: exact title, cover of Meen + customer, situation, 3-step flow, Dome tip, `เริ่มดูวิดีโอ` + `กลับแผนภารกิจ` | MATCH | [w0](./w0-watch-brief-390.png) |
| W1 | 16:9 player `/videos/m1-watch.mp4` (transcode of `UI/ภารกิจที่ 1/1015.mp4`, committed in 984e461, so the "missing" claim was wrong). Native controls, replay, external progress, optional captions, Dome outside the video. | MATCH | [w1](./w1-video-390.png) |
| W2 | Locked `ดูให้จบก่อน แล้วคุยกับโดม` → unlocks green `คุยกับโดม` on end | MATCH | [w2](./w2-video-complete-390.png) |
| W3 | Q1 "โดเมนเนมคืออะไร", free text, `ส่งคำตอบ`, "โดมได้รับคำตอบแล้วครับ ไปคำถามต่อไปกันเลย" | MATCH | [w3](./w3-watch-q1-390.png) |
| W4 | Q2 "DNS คืออะไร และช่วยอะไรในการเข้าเว็บไซต์" | MATCH | [w4](./w4-watch-q2-390.png) |
| W5 | ≤60: targeted help, review **seeks the video** (Q1 = scene 3, Q2 = scenes 4–6 → 13.6s), one supplement, then stops | MATCH | [notyet](./w5-watch-notyet-360.png) · [help](./w5-watch-help-360.png) · [seek](./w5-watch-review-seek-360.png) |
| W6 | Result: `ผลความเข้าใจ` ring, pass status, Dome band message, one good point plus one improvement, `ทบทวนด้วยตนเอง` | MATCH† | [w6](./w6-watch-result-390.png) · [after](./w7-after-pass-390.png) |

## Read

| ID | Step | Status | Evidence |
|---|---|---|---|
| R0 | `วัตถุประสงค์ที่ 1`, `เพื่อนช่วยเพื่อน: ชื่อร้านออนไลน์`, Meen/Fah cards, chat preview, `ภารกิจอ่าน • ยังไม่เริ่ม`, `เริ่มอ่านแชต` + `กลับแผนภารกิจ` | MATCH | [r0](./r0-read-brief-390.png) |
| R1 | `แชตเพื่อน: มีน × ฟ้า`, 16 messages, Meen right/light-blue, Fah left/green, avatars, tap batches by story part with no typing delay, no input, `อ่านจบแล้ว` only at the end | MATCH | [r1](./r1-read-chat-390.png) · [end](./r1-read-chat-end-390.png) |
| R2 | Hand-off outside the chat (Dome room scene) with the exact Dome line, `เริ่มตอบคำถาม` | MATCH | [r2](./r2-read-handoff-390.png) |
| R3 | Q1/Q2 exact prompts, `ส่งคำตอบ`, `ย้อนอ่านแชต`, "ได้รับคำตอบแล้วครับ ไปข้อถัดไปกัน", no per-question score | MATCH | [q1](./r3-read-q1-390.png) · [q2](./r3-read-q2-390.png) |
| R4 | ≤60: weakest concept, `ทบทวนช่วงที่เกี่ยวข้อง` highlights chat 4–8 / 9–14, `ขอคำใบ้`, one `ส่งคำตอบเสริม` | MATCH | [help](./r4-read-help-390.png) · [highlight](./r4-read-review-highlight-390.png) · [supp](./r4-read-supplement-390.png) |
| R5 | `ผลความเข้าใจ XX%` (>60 passes), not-yet shows `ทบทวนเฉพาะจุด` / `ลองตอบเสริม`, pass shows `อ่านแชตอีกครั้ง` | MATCH† | [notyet](./r5-read-notyet-390.png) · [pass](./r5-read-result-390.png) |

## Do (Drag & Drop)

| ID | Step | Status | Evidence |
|---|---|---|---|
| D0 | `ด่านที่ 1 · ลงมือทำ`, `ภารกิจจับคู่ความหมาย`, Meen art with floating blank cards, exact instruction, `มี 4 การ์ด • ไม่จับเวลา`, Dome line 6.1, `เริ่มภารกิจ` + `ย้อนกลับ` | MATCH | [d0](./d0-do-brief-390.png) |
| D1 | How-to (combined with D01): an animated blank card moves into a zone, with no answer shown | MATCH | [d0](./d0-do-brief-390.png) |
| D2 | Zones stacked top/bottom, shuffled tray, `จัดแล้ว X/4 ใบ`, no correctness while placing, `ขอคำใบ้` (6.2), `เริ่มใหม่`, check disabled until 4/4 | MATCH | [d2](./d2-do-board-390.png) |
| D3 | Real pointer drag (mouse + touch, pointer capture, zone glow while hovering, 90px snap) plus tap card → tap zone or `วางใน …` buttons, `ย้ายกลับ` | MATCH | [drag](./d3-do-drag-390.png) · [tap](./d1-do-tap-select-390.png) |
| D4 | Server-only check; loading text `โดมกำลังสรุปคำแนะนำ...`; deterministic score | MATCH | [ready](./d4-do-ready-390.png) |
| D5 | Pass: `คะแนนของฉัน`, `ผ่านภารกิจแล้ว`, "ได้คะแนนมากกว่า 60%…", Dome feedback, 2-line recap, `ดูการจับคู่และคำแนะนำ` | MATCH† | [d5](./d5-do-result-390.png) · [review](./d5-do-review-390.png) |
| D6 | Not yet: score, Dome feedback, wrong cards listed and flagged on the retry board, one hint, `แก้การจับคู่` once. Second fail offers `ลองเส้นทางดูหรืออ่าน` / `บันทึกไว้เรียนต่อ` | MATCH | [help](./d6-do-help-390.png) · [retry](./d6-do-retry-board-390.png) |
| D7 | Pass result is stored server-side; CTA leaves the learn path immediately | MATCH† | [d7](./d7-do-end-390.png) |

## Assets and contracts

| Area | Status | Note |
|---|---|---|
| Watch media | MATCH | `public/videos/m1-watch.mp4` (2.3 MB transcode) and `public/captions/m1-watch.th.vtt` (opt-in track). `public/learn/m1/1015.mp4` is an uncommitted 7 MB duplicate and is not used. |
| Chat art | MATCH | `public/learn/m1/avatar-{meen,fah}.webp` are cropped from the team still; Dome uses the official mascots; `dome-room.webp` comes from `UI/03 คุยกับโดม`. |
| Server grading | MATCH | `POST /api/mission/m1/learn` is unchanged; there is no answer key on the client. The m1 watch rubric follows the spec Q1/Q2. |
| Scope safety | MATCH | No edits to globals.css, components/ui, m2, counter or registrar files. m3/m4 still use the old AppScreen path. |

Checks: `npx tsc --noEmit -p .` passes, and `npx vitest run` passes 60 files / 1059 tests.
