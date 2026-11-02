# Mission 2 rebuild — storyboard board checklist

Board numbers = the number in each storyboard phone screen's top bar (`UI/ภารกิจที่ 2/LINE_ALBUM_กราฟิก 2 งงๆ_261101_13…38.jpg`).
Shot list for the Visual clip = `example use flow/…_39/40.jpg` ("การ์ดเว็บปลิวลม", 12 shots, 56 s, 3 stops).
Every row has a 2-up `compare-<board>.png` (storyboard left, build right, 390×844). Verified by playing headless Chrome
(scratchpad scripts sim/visual/text.mjs) with mouse drag, CDP touch drag and tap-to-place, asserting placement state.

Status: MATCH = layout, sizes, colours, positions and interaction match; CLOSE = same layout/interaction, small visual differences noted.

| Board | Screen | Interactions implemented | Status | Evidence |
|---:|---|---|---|---|
| 24 | Visual: วิธีดู | Wood sign, purple pill, cream rules card with 5 numbered purple steps, Dome bottom-right, green CTA | MATCH | compare-24 |
| 25 | Visual: กำลังดูคลิป | 16:10 player, 12 animated storyboard shots (props: paper cards fly, phones, nested boxes, scan arrow), progress bar with 3 gold stop dots, play/pause, skip, subtitles, Dome bubble | CLOSE (no real video/voice; scenes are animated stills) | compare-25 |
| 26 | Visual: หยุดถาม 1 | Clip auto-pauses at gold dot, "หยุดถาม 1" badge + pause icon, Dome "คำถามจากโดม", A/B/C cream cards | MATCH | compare-26 |
| 27 | Visual: ตอบผิด ได้คำใบ้ | Wrong card turns red with ✗, bubble tag "คำใบ้" (server hint); 2nd miss → rewatch range, 3rd → explanation | MATCH | compare-27 |
| 28 | Visual: หยุดถาม 2 ลากเรียง | Drag 3 wooden pieces into "?" slots with nails (mouse + touch + tap), server-graded order | MATCH | compare-28 |
| 29 | Visual: หยุดถาม 3 ประยุกต์ | booking choice, green ✓ on correct | MATCH | compare-29 |
| 30 | Visual: คำถามท้ายคลิป | ข้อ 1/2 kanombanyai.net choice + เฉลย card (server `post` kind); ข้อ 2/2 open answer (AI graded) | MATCH | compare-30 |
| 31 | Text: เปิดเรื่อง + บทอ่าน 1 | Sky band + cream chat, 6 progress dots, Dome bubbles, quick reply chip, purple-header lesson card, hint bulb + input + send | MATCH | compare-31 |
| 32 | Text: พิมพ์ตอบอิสระ | Free-text answer in bottom input, send button | MATCH (native keyboard) | compare-32 |
| 33 | Text: ตอบถูก + บทอ่าน 2 | Correct reply in green-tint bubble, TLD/SLD/Subdomain colour-pill lesson card, dots advance | MATCH | compare-33 |
| 34 | Text: ตอบผิด + คำใบ้ | "เกือบแล้วครับ" + "คำใบ้ n" yellow bubbles, retry; 3rd miss reveals | MATCH | compare-34 |
| 35 | Text: บทอ่าน 3 ลำดับ | Right-to-left lesson card + orange arrow with green/blue/orange dots | MATCH | compare-35 |
| 36 | Text: ถามโดมกลับ | Hint bulb asks Dome anytime; Dome answers in chat | CLOSE (no free-form side question; bulb gives the hint) | compare-36 |
| 37 | Text: การ์ดสรุป | Summary card (booking/forcespeed/com pills), notebook auto-saved, orange "ไปเช็กความเข้าใจ" | MATCH | compare-37 |
| 38 | Sim: ฉากเปิดพายุ | Full-bleed darkened island scene, rain streaks, 6 wooden pieces tumbling/drifting, flying leaves, Dome bubble, tap anywhere | MATCH | compare-38 |
| 39 | Sim: Tutorial | Dim layer except target; Subdomain/SLD/TLD coloured slots, TLD glows; animated hand drags com; skip "ข้ามสอนเล่น"; drop com → done | MATCH | compare-39 |
| 40 | Sim ด่าน 1/4 ประกอบป้าย | "?" slots + nails, com pre-placed, tray "ชิ้นป้ายที่เก็บได้", real drag/snap/spring-back, swap, tap fallback, hint bulb, per-slot ✓/✗ (server `wrong`) | MATCH | compare-40 |
| 41 | Sim ด่าน 2/4 ติดชื่อส่วน | Assembled sign, empty label pills, drag Subdomain/SLD tags (TLD pre-stuck), hand hint on SLD | MATCH | compare-41 |
| 42 | Sim ด่าน 3/4 เลขลำดับ | Drag badges 1-2-3 onto pieces, "สแกนเลย!" runs light right→left, badges turn green | MATCH | compare-42 |
| 43 | Sim ด่าน 4/4 ป้ายไทย + ชิ้นหลอก | 4 slots (.co.th), decoys www/com, per-slot red ✗ / green ✓, Dome "ชิ้นหลอก!" explanation | MATCH | compare-43 |
| 44 | Sim: ตอบถูก ไฟสแกน | Placed signs with coloured part labels + ✓, signs light right→left, animated arrow, big Dome, 3 stars pop | CLOSE (signs smaller than board) | compare-44 |
| 45 | Exit Check | One question per screen (ข้อ n/3), Dome + domain bubble, A/B/C cards, "ตอบได้ครั้งเดียว ไม่มีคำใบ้", server graded | MATCH | compare-45 |
| 46 | ตอนจบ A Perfect | 3 stars, sign, confetti, Domain Architect medal, bubble, progress 50%, "ไปต่อภารกิจหลัก" + "กลับแผนที่" | MATCH | compare-46 |
| 47 | ตอนจบ B ผ่าน | 2 stars, "ผ่านภารกิจที่ 2", progress, CTA | MATCH | compare-47 |
| 48 | ตอนจบ C เกือบแล้ว | Grey stars, "เกือบแล้ว!", red "ไปซ่อมจุดอ่อน", blue "เปลี่ยนวิธีเรียน" (reopens mode drawer) | MATCH | compare-48 |
| 49 | ซ่อมจุดอ่อน 30 วินาที | Timer pill counting down, ★ n/5 pill, purple domain bar with highlighted part, drag/throw into Subdomain/SLD/TLD crates, bounce/shake + feedback, back to Exit Check | MATCH | compare-49 |
| 50 | แผนที่ / mode select | Out of scope (map + `mode-popup.tsx` drawer kept) | N/A | — |

Flow after pass: "ไปต่อภารกิจหลัก" → `/mission/m2` (existing learn-done / mission pass card) — verified (`sim-99-after-pass.png`).
Small phone 360×740: `*-360.png`. Reduced motion: all animations collapse via `prefers-reduced-motion`.
