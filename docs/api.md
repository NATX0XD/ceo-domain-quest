# เอกสาร API — Digital Biz Quest

สื่อการสอนวิชา 21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล

> **สถานะ:** ตรงกับโค้ดใน `app/api/` ณ 30 ก.ย. 2569 — ตาราง endpoint ครอบคลุม **ทุกคู่ method+path ที่มีอยู่จริง
> (57 ไฟล์ route · 79 คู่)** ไล่เทียบด้วยสคริปต์แล้ว ไม่มีเส้นที่ยังไม่ได้เขียนถึง และไม่มีเส้นในเอกสารที่ไม่มีในโค้ด
> ยืนยันด้วยการยิงจริงผ่าน newman: **973 assertion ผ่านหมด ตก 0 · 398 คำขอ** (30 ก.ย. 2569 · ตั้ง `teacherPassword2` ด้วย
> เทสต์ชุดครู B จึงได้รันครบ — ไม่ตั้งจะเหลือ 924 assertion เพราะชุดนั้น**ถูกข้าม ไม่ใช่ตก**)
>
> `app/api/` ยังถูกแก้อยู่โดยหลาย session ถ้าไม่ตรงกับที่เห็น ให้ทำตามหัวข้อ 7 "วิธีอัปเดตไฟล์นี้เมื่อ route เปลี่ยน"
>
> **ของใหม่ในรอบ API-4 (15 route):** ครูคุมช่วงของคาบ (`/api/teacher/session` + `GET /api/session` ฝั่งนักเรียน) ·
> จอหน้าห้อง (`/api/teacher/screen`) · ประกาศถึงทั้งห้อง (`/api/teacher/broadcast`) · ธงคำไม่เหมาะสม (`/api/teacher/flags`) ·
> แบบสอบถาม (`/api/survey`) · แบบทดสอบหลังเรียน (`/api/posttest`) · เช็กความเข้าใจ 4 ข้อ (`/api/check`) ·
> ลูปครูส่งงานกลับให้แก้ (`/api/teacher/request-revision`) · รายงาน (`/api/teacher/report` · `/report/class` · `/efficiency`) ·
> ครูปรับแผนรายคน (`/api/teacher/student`) · ผนังผลงานฝั่งครู (`/api/teacher/showcase`) · ส่งออก CSV (`/api/teacher/export`)
>
> **ของใหม่ในรอบ API-5:** `GET /api/grade/status` — สถานะการตรวจงานสำหรับหน้าจอ poll (หัวข้อ 3.8)
>
> **ของใหม่ในรอบ API-6:** เกราะ 3 ชั้นของ `POST /api/join` (หัวข้อ 2.1)
>
> **ของใหม่ในรอบ API-7 (16 คู่ method+path):** คู่หูครบวง (`/api/buddy` · `/buddy/respond` · `/buddy/close` — หัวข้อ 3.9) ·
> คำขอเปลี่ยนแผน 2 ฝั่ง (`/api/plan-request` · `/plan-request/respond` — หัวข้อ 3.10) ·
> ประเมินตนเอง 3 แหล่ง + เป้าคาบหน้า (`/api/self-assess` · `/self-assess/next-goal` — หัวข้อ 3.11) ·
> เรื่องราวเฉพาะคน (`/api/story` · `/api/mission/:id/story` — หัวข้อ 3.12) ·
> จุดเต้นของหัวใจ (`/api/presence`) กับตรวจชื่อโดเมนว่าง (`/api/domain/check`) — หัวข้อ 3.13 ·
> สถิติรายข้อ (`/api/teacher/report/items`) · ปุ่มล้างห้องสาธิต (`/api/teacher/demo-reset`) — หัวข้อ 3.14

> **ของใหม่ในรอบ API-8:** หน้าเปิดดู API แบบ Swagger UI ที่ **`/api-docs`** (เครื่องพัฒนาเท่านั้น) + ไฟล์ OpenAPI 3.1
> ที่ครอบทุกคู่ พร้อมเทสต์/สคริปต์ที่จับได้ถ้ามีใครเพิ่ม route แล้วลืมเขียนเอกสาร — **หัวข้อ 9**
>
> **ของใหม่ในรอบ API-9:** `POST /api/teacher/logout` (หัวข้อ 2.5) — เส้นแรกที่ **ตัวกันเอกสารเก่าจับได้เองจริง ๆ**
> ตอน session อื่นเพิ่ม route เข้ามาคืนนี้ ไม่ใช่คนมานั่งนึกออกทีหลัง

ยิงทดสอบจริงได้ที่ `postman/digital-biz-quest.postman_collection.json` คู่กับ `postman/local.postman_environment.json`
เปิดดูแบบกดลองยิงได้ที่ `http://localhost:3000/api-docs` (ต้องรัน `next dev`)

---

## 1. ตัวตนของผู้เรียก — มี 2 คุกกี้

API ชุดนี้ **ไม่ใช้ Bearer token** ใช้คุกกี้ `httpOnly` ทั้งหมด JavaScript ฝั่งหน้าเว็บอ่านไม่ได้ จึงขโมย token ไปสวมรอยไม่ได้

| คุกกี้ | ออกให้โดย | ใช้กับ | อายุ |
|---|---|---|---|
| `dbq_student` | `POST /api/join` · `POST /api/join/resume` | ทุก endpoint ของนักเรียน | 6 ชั่วโมง |
| `dbq_teacher` | `POST /api/teacher/login` | `/api/teacher/*` | 12 ชั่วโมง |

ทั้งสองใบเป็น JWT HS256 ลงนามด้วย `SESSION_SECRET` (`lib/session.ts`) และ **ตรวจ `role` แยกกัน**
token ของนักเรียน verify ลายเซ็นผ่าน แต่ใช้แทนคุกกี้ครูไม่ได้ เพราะ `verifyTeacherSession()` เช็ก `role === 'teacher'` ด้วย

> **หมายเหตุสำหรับคนที่อ่านเอกสารหรือ session เก่า**
> คุกกี้ `dbq_demo` และ endpoint `POST /api/session` **ถูกลบทิ้งแล้ว** ระบบเดิมเก็บความก้าวหน้าใน `Map` ในหน่วยความจำ
> ตอนนี้ทุกอย่างอ่าน/เขียนฐานข้อมูลผ่านคุกกี้ `dbq_student` ใบเดียว การขอตัวตนใช้ `POST /api/join`

คอลัมน์ "ใครเรียกได้": **ไม่ต้อง login** = ยิงได้เลย · **นักเรียน** = ต้องมี `dbq_student` · **ครู** = ต้องมี `dbq_teacher`

---

## 2. ตารางสรุปทุก endpoint

รูปแบบ error เหมือนกันทุก route คือ `{ error, message }` และอาจมีฟิลด์เสริม (`resetAt` `remaining` `minLength` `missingFields` `tooShort`) — ดู `app/api/_lib/session-cookie.ts`

### 2.1 นักเรียนเข้าห้องเรียน

| Method | Path | ใครเรียกได้ | body / query ที่รับ | สิ่งที่คืน | status |
|---|---|---|---|---|---|
| `POST` | `/api/join` | ไม่ต้อง login | `roomCode` (6 ตัว `[A-Z0-9]`) · `nickname` (1-40) · `pin` (ตัวเลข 4 หลักเป๊ะ) | `{ ok, nickname, renamed, roomCode, seatsLeft, capacity }` + ตั้งคุกกี้ `dbq_student` | `200` · `400` `bad-request`/`bad-pin` · `404` `room-not-found` · **`409` `nickname-taken`/`room-full`** · `422` `content-flagged` · `429` `too-many-attempts`/`room-too-busy` |
| `POST` | `/api/join/resume` | ไม่ต้อง login | `roomCode` · `nickname` · `pin` | `{ ok, nickname, roomCode }` + คุกกี้ใบใหม่ | `200` · `400` · `401` `invalid-credentials` · `404` · `429` |
| `GET` | `/api/me` | นักเรียน | ไม่รับอะไรเลย | `{ student: { id, nickname, joinedAt }, classroom: { id, roomCode, status } \| null, profile, progress[], missions[], shop: { stage, stagesCleared, stagesTotal, label, percent } }` | `200` · `401` |

`/api/join` สร้างแถวนักเรียนใหม่ทุกครั้ง · `/api/join/resume` ไม่สร้างแถวใหม่ แต่ตรวจ PIN กับ hash เดิมแล้วออกคุกกี้ใบใหม่ — ใช้ตอนย้ายเครื่อง

#### เกราะ 3 ชั้นของ `POST /api/join`

รหัสห้อง 6 ตัวถูกฉายบนจอทั้งคาบ ใครจดไปก็ยิงเส้นนี้ได้ และนี่เป็นเส้นเดียวที่สร้างแถวนักเรียนได้
เดิมยิงชื่อเดิมรัว 9 ครั้งได้นักเรียนจริง 9 แถว (UAT-3 ช่องโหว่ข้อ 1) ตอนนี้มี 3 ชั้นซ้อนกัน **ถอดชั้นใดชั้นหนึ่งออก อีกสองชั้นเอาไม่อยู่**

| ชั้น | กติกา | ได้อะไรเมื่อชน |
|---|---|---|
| 1 ตัวนับต่อ (รหัสห้อง + ชื่อเล่น) | 5 ครั้ง/10 นาที · **ไม่ล้างตัวนับเมื่อเข้าสำเร็จ** | `429` `too-many-attempts` + `resetAt` |
| 2 เพดานคนต่อห้อง | ค่าเริ่มต้น **60 คน** ปรับด้วย env `CLASSROOM_MAX_STUDENTS` (จำนวนเต็มบวก ค่าเพี้ยนตกกลับไปใช้ 60) | `409` `room-full` + `capacity` `count` |
| 3 ชื่อซ้ำในห้อง | **ไม่เติมเลขท้ายให้แล้ว** — ให้เด็กเปลี่ยนชื่อเอง หรือไปโหมด "เคยเข้าห้องแล้ว" | `409` `nickname-taken` |

- ชั้น 1 เดิมเรียก `resetAttempts()` ตอนเข้าสำเร็จ ตัวนับจึงถูกล้างทุกครั้ง = ไม่มีเพดานเลย · การเข้าสำเร็จรัว ๆ จากเครื่องเดียวไม่ใช่การใช้งานปกติ
- ชั้น 2 นับเฉพาะตอนรับ **คนใหม่** เท่านั้น — คนที่อยู่ในห้องแล้วกลับเข้ามาทาง `/api/join/resume` ไม่ผ่านด่านนี้ **ห้องที่คนเต็มแล้วจึงไม่มีทางล็อกคนของตัวเองออก**
- ชั้น 3 ป้องกันสองเรื่องพร้อมกัน: ยิงชื่อเดิมซ้ำแล้วได้แถวใหม่ทุกครั้ง และเด็กที่พิมพ์ชื่อชนเพื่อนแล้วกลายเป็นชื่ออื่นโดยไม่รู้ตัว
  กรณีสองเครื่องกดพร้อมกันเป๊ะ ฐานข้อมูลตัดสินด้วย `unique (classroom_id, nickname)` คนที่สองได้ `409` ไม่ใช่ได้ชื่อเพี้ยน
- `renamed` ในผลลัพธ์**เป็น `false` เสมอ**แล้ว คงช่องไว้ให้หน้าจอเดิมไม่พัง · `seatsLeft` = ที่ว่างหลังรับคนนี้เข้าไป (`null` = ห้องเก่าที่ล้นเพดาน ดูด้านล่าง)

⚠️ **ห้องเก่าที่มีคนเกินเพดานอยู่ก่อนแล้ว** (ห้องเดโม/ห้องที่เคยใช้ทดสอบโหลด เช่น `QUEST9` ที่มี ~300 คน)
ไม่ถูกล็อกออก เพราะคนในห้องยังเรียนอยู่ แต่คุมด้วย **อัตราการรับคนใหม่ 45 คน/10 นาทีต่อห้อง** แทน (`room-too-busy` `429`)
ห้องที่เปิดหลังจากนี้ไม่มีทางเข้ากิ่งนี้ — คนที่ทำให้ครบเพดานพอดีคือคนสุดท้ายที่เข้าได้ จำนวนคนจึงไม่มีทาง**เกิน**เพดาน

**rate limit ของ resume** นับต่อคู่ (รหัสห้อง + ชื่อเล่น) **5 ครั้ง/10 นาที** เหมือนกัน (`lib/rate-limit.ts`)
นับตอน "พยายาม" **ก่อน** ตรวจรหัส ไม่ใช่นับเฉพาะตอนผิด จึงเลี่ยงด้วยการสลับส่งรหัสถูก/ผิดไม่ได้ · เข้าสำเร็จแล้วล้างตัวนับ (ฝั่ง resume เท่านั้น)
ข้อความ `401` ของ resume ต้องเหมือนกันทั้งกรณี "ไม่มีชื่อนี้" และ "รหัสผิด" ไม่งั้นคนเดาจะรู้ว่าเดาชื่อถูกแล้ว

### 2.2 ก่อนเรียน และการเลือกวิธีเรียนของตัวเอง

| Method | Path | ใครเรียกได้ | body / query ที่รับ | สิ่งที่คืน | status |
|---|---|---|---|---|---|
| `GET` | `/api/pretest` | นักเรียน | ไม่รับอะไรเลย | `{ result, open, reason }` — `result` เป็น `null` ถ้ายังไม่เคยทำ | `200` · `401` |
| `POST` | `/api/pretest` | นักเรียน | `answers` object คู่ `pre-1`…`pre-10` : ลำดับตัวเลือก `0-3` | `{ ok, score, total, suggestedLevel, levelReason, weakObjectives }` | `200` · `400` · `401` · **`403` `not-open`** · `409` `already-done` |
| `GET` | `/api/posttest` | นักเรียน | ไม่รับอะไรเลย | `{ open, reason, done, score, total, questions[] }` — ส่งโจทย์เฉพาะตอนเปิดจริงและยังไม่เคยทำ | `200` · `401` |
| `POST` | `/api/posttest` | นักเรียน | `answers` object คู่ `post-1`…`post-10` | `{ ok, score, total, preScore, gain }` | `200` · `400` · `401` · `403` `not-open` · `409` `already-done` |
| `GET` | `/api/check` | นักเรียน | ไม่รับอะไรเลย | `{ setId, questions[], done, score, total }` — โจทย์**ไม่มี** `answerIndex`/`objectiveId` ติดมา | `200` · `401` |
| `POST` | `/api/check` | นักเรียน | `answers` (รหัสข้อ : ตัวเลือก) · `confidence` (รหัสข้อ : 1-3 ไม่บังคับ) · `setId` | `{ ok, score, total, suggestedLevel, levelReason, weakObjectives }` | `200` · `400` · `401` |
| `GET` | `/api/session` | นักเรียน | **ไม่รับอะไรเลย** | `{ active, phase, phaseLabel, remainingSeconds, paused, showClock, warn, restMode, restReason }` | `200` · `401` |
| `POST` | `/api/profile/preferences` | นักเรียน | `prefAnswers` object คู่ `pref-N: pref-N-x` | `{ suggestedRoute, routeScores, routeReason, suggestedLevel, levelReason, weakObjectives, talentId }` | `200` · `400` · `401` |
| `POST` | `/api/profile/choice` | นักเรียน | `route` (`clip`\|`card`\|`game`\|`buddy`) · `level` (1\|2\|3) · `goalId` · `ownGoalText` (≤300) · `finish` — ใส่ช่องไหนก็ได้ | `{ accepted: true, route, routeChosenBy, level, goalId, goalStars, goalRejectedNote }` | `200` · `400` · `401` · `404` `goal-not-found` |

**`/api/pretest` ตรวจที่เซิร์ฟเวอร์เท่านั้น** ผ่าน `core/quiz.ts` เฉลยอยู่ใน `content/quiz-answers.json`
⚠️ **ห้ามคืน `wrongIds` หรือเฉลย** คืนแค่คะแนนรวมกับหัวข้อที่ควรเน้น ไม่งั้นย้อนรู้เฉลยได้
รหัสข้อที่ไม่มีอยู่จริงถูกตัดทิ้ง (route วนเฉพาะข้อในชุด `pre`)

**ผลของ `pretest` และ `preferences` เป็น "ข้อเสนอ" ไม่ใช่ค่าที่ใช้จริง** จนกว่านักเรียนจะกดเลือกที่ `POST /api/profile/choice`

⚠️ **`/api/profile/choice` ห้ามปฏิเสธช่องทางหรือระดับที่นักเรียนเลือก** เลือกได้ครบทั้ง 4 ช่องทางและ 3 ระดับเสมอ
ระบบแค่บันทึก `chosenBy = student` ไว้เป็นหลักฐานให้ครูเห็น
ข้อยกเว้นเดียวคือเป้าหมาย: **ยกขึ้นได้ตลอดคาบ แต่ลดไม่ได้** (`goalPolicy.canLowerDuringLesson = false`)
กดลดเป้าจะได้ `200` พร้อม `goalRejectedNote` อธิบาย **ไม่ใช่ error** — ปฏิเสธการกระทำ แต่ไม่ปฏิเสธตัวผู้เรียน

### 2.3 เล่นภารกิจ

| Method | Path | ใครเรียกได้ | body / query ที่รับ | สิ่งที่คืน | status |
|---|---|---|---|---|---|
| `POST` | `/api/profile` | นักเรียน | `shopName` (1-60) · `businessTypeId` · `domainName` (1-60) · `isRegisteredCompany` (bool) · `audience` (`thai`\|`international`) — บังคับครบ | `{ ok, locked: false, storyQueued }` | `200` · `400` · `401` · `409` `profile-locked`/**`domain-taken`** · `422` `content-flagged` |
| `GET` | `/api/profile` | นักเรียน | ไม่รับอะไรเลย | `{ profile, locked }` | `200` · `401` |
| `POST` | `/api/hint` | นักเรียน | `missionId` (`m1`-`m4` หรือ `station-b`) | ภารกิจ: `{ scope: "mission", hint, hintsUsed, total, exhausted, source, provider }` · สถานี B: `{ scope: "station-b", hintsUsed, exhausted, source, provider, fallbackReason }` | `200` · `400` · `401` · `404` `mission-not-found` |
| `POST` | `/api/mission/:id/check` | นักเรียน | `checkId` · `choiceIndex` (0-3) **หรือ** `placements` (แบบประกอบชิ้นส่วน) · `channel` · `confidence` (1-3) | `{ correct, attempts, wrong, hintsUsed, stars, passed }` + `explanation`/`starCriteria` **เฉพาะตอบถูก** | `200` · `400` · `401` · `404` · `503` `answers-file-missing`/`answers-file-invalid`/`answer-not-found`/**`assemble-key-unavailable`** |
| `POST` | `/api/mission/:id/game` | นักเรียน | `placements` (คู่ช่อง:ชิ้นส่วน ใช้กับ `match`/`build`/`sort`) · `order` (array ใช้กับ `order`) | `{ allCorrect, correctCount, total, kind }` | `200` · `400` · `401` · `404` · `503` `game-key-unavailable` |
| `POST` | `/api/mission/:id/skip` | นักเรียน | ไม่รับอะไรเลย | `{ ok, skipped, nextHref }` | `200` · `401` · **`403` `skip-not-allowed`** · `404` |
| `POST` | `/api/mission/:id/switch-route` | นักเรียน | `toRoute` (`clip`\|`card`\|`game`\|`buddy`) | `{ accepted: true, missionId, fromRoute, toRoute, switchCount }` | `200` · `400` · `401` · `404` |
| `POST` | `/api/station-b/submit` | นักเรียน | `tldId` · **`reasonText` (บังคับ ≥10 ตัวอักษร)** | `{ accepted, reason, tldId, suffix, domain, attempts, hintsUsed, submissionId, reasonScore, reasonMaxScore, reasonFeedback, needsTeacherConfirm, source, provider }` | `200` · `400` `bad-request`/**`reason-required`** · `401` · `404` `tld-not-found` · `409` `no-profile` |
| `POST` | `/api/dome` | นักเรียน | `message` (≤500) · `quickReplyId` (nullable) | คำตอบของโดม + `source` + `quickReplies` | `200` · `400` · `401` · `422` `content-flagged` |
| `POST` | `/api/help` | นักเรียน | `missionId` (ไม่ส่งก็ได้) · `cancel` (bool) | `{ ok, askedForHelp, missionId, message }` | `200` · `400` · `401` |
| `POST` | `/api/presence` | นักเรียน | `screen` (≤64 ตัวอักษร ไม่ส่งก็ได้) | **`{ ok: true }` เท่านั้น** ไม่คืนข้อมูลของใครเลย | `200` · `400` · `401` |
| `POST` | `/api/domain/check` | นักเรียน | `name` (≤200 — ใส่ URL ทั้งก้อนมาก็ได้) | `{ ok, input, name, removed[], rules: { results[], score, allPassed }, takenByNickname, suggestions[], available, status, message }` | `200` · `400` · `401` · `422` `content-flagged` |
| `POST` | `/api/story` | นักเรียน | **ไม่รับอะไรเลย** | `{ ok, enqueued, reused, jobId }` หรือ `{ ok, enqueued: false, reason, message }` | `200` · `401` |
| `GET` | `/api/story` | นักเรียน | ไม่รับอะไรเลย | `{ ok, queue: { pending, running, done, failed } }` — ไม่มีเนื้อเรื่องของใคร | `200` · `401` · `503` `queue-unavailable` |
| `GET` | `/api/mission/:id/story` | นักเรียน | ไม่รับอะไรเลย | `{ ok, missionId, storyId, text, source, fallbackReason, personalized }` — **มีข้อความให้อ่านเสมอ** | `200` · `401` · `404` (รูป `{ ok: false, code }`) |

**โปรไฟล์ถูกล็อกทันทีที่เริ่มเล่น** (`isShopProfileLocked` = มี attempt ของภารกิจใด หรือยื่นสถานี B แล้ว)
จึงต้องยิง `POST /api/profile` **ก่อน** `/api/mission/:id/check` และ `/api/station-b/submit` ไม่งั้นได้ `409 profile-locked`
เหตุผล: สถานี B ตัดสินจาก `isRegisteredCompany` และ `audience` ถ้าแก้ได้เรื่อย ๆ นักเรียนจะยื่นไม่ผ่านแล้วย้อนมาแก้ให้ผ่าน (รีวิว R5 หัวข้อ H4)

**คำใบ้ส่งทีละใบ** ไม่ส่งทั้งชุดตั้งแต่แรก ไม่งั้นเปิด DevTools อ่านครบโดยไม่เสียการนับ · ภารกิจละ 3 ใบ · `station-b` ตันที่ `hintsUsed = 2`

**`/api/mission/:id/check` และ `/api/mission/:id/game` ตรวจที่เซิร์ฟเวอร์เท่านั้น**
เฉลย (ทั้งข้อ check และ `gameKey`) อยู่ใน `content/missions-answers.json` อ่านด้วย dynamic import ตอนเรียกใช้จริง ไม่ import บนหัวไฟล์
(เคยเจอบั๊กจริงว่าเฉลยหลุดเข้า `.next/static`)
`stars` คิดจาก `starsFor()` ใน `core/personalize` ด้วยค่าจากฐานข้อมูล ไม่รับจากเบราว์เซอร์
⚠️ **เกมตอบผิดไม่บอกว่าช่องไหนผิด** บอกแค่จำนวนที่ถูก เพื่อไม่ให้สลับทีละคู่แล้วยิงซ้ำจนครบ

**`/api/station-b/submit` บังคับเขียนเหตุผล** (มติ master รีวิว R7 ข้อ 8) อย่างน้อย 10 ตัวอักษร เพราะการอธิบายเหตุผลคือจุดสอนที่แรงที่สุดของเกม
เช็ก `reasonText` **ก่อน** ค้นหา `tldId` ดังนั้นส่ง tldId มั่วพร้อมเหตุผลว่างจะได้ `reason-required` ไม่ใช่ `tld-not-found`
ยื่นผ่านแล้วบันทึกแถว `submissions` (ครั้งเดียวต่อคน) พร้อมคะแนนเหตุผลจากชั้น AI ซึ่งเป็น **ข้อเสนอ ครูยืนยันเสมอ** (`needsReview: true`)

ลำดับการตัดสินใน `core/tld-rules.ts`: หมวดสงวน → ต้องเป็นนิติบุคคล → ต้องใช้อักษรไทย → ลูกค้าต้องอยู่ไทย
หมวดสงวน (`.ac.th` `.go.th` `.or.th` `.net.th` `.mi.th`) ตัดจบก่อนทุกเงื่อนไข

**`/api/mission/:id/skip` ทำงานจริง ไม่ใช่ปุ่มหลอก** ระบบไม่ห้าม แต่บันทึกเป็น event ให้ครูเห็น
**`/api/mission/:id/switch-route` ห้ามปฏิเสธ** สลับกี่ครั้งก็ได้ ไม่หักดาว
กดช่องทางเดิมซ้ำจะได้ `unchanged: true` และไม่เขียนแถวใหม่ลง `route_changes`

**`POST /api/help` = ปุ่ม "ขอให้ครูมาช่วย"** ผู้เรียนกดเองเมื่อรู้สึกติด ไม่ต้องรอให้เกณฑ์เวลา 60/90/150 วินาทีจับได้ก่อน
ชื่อขึ้นธงแดงบนแผงครูทันที (`askedForHelp: true` ใน `GET /api/teacher/board`) · ส่ง `cancel: true` เพื่อลดธงลง
⚠️ **การขอครูไม่ใช่ช่องทางการเรียนที่ 5** ค่า canonical ของ `channel` ยังเป็น `clip|card|game|buddy` เท่านั้น
route จึงไม่แตะคอลัมน์ `channel`/`learning_route` เลย แต่บันทึกเป็นสถานะ `needs_help` ของแถว station `C` (ใช้เป็น "ช่องธง" อย่างเดียว) พร้อม event
`missionId` ไม่ส่งก็ได้ เซิร์ฟเวอร์เดาจากภารกิจที่ขยับล่าสุดและยังไม่ผ่านให้เอง

### 2.4 ท้ายคาบ — ภารกิจใหญ่ เพื่อน ทบทวน ใบประกาศ

| Method | Path | ใครเรียกได้ | body / query ที่รับ | สิ่งที่คืน | status |
|---|---|---|---|---|---|
| `GET` | `/api/ceo` | นักเรียน | ไม่รับอะไรเลย | `{ submitted, submission: { domainName, tld, format, emphasisCriterion, createdAt } \| null }` | `200` · `401` |
| `POST` | `/api/ceo` | นักเรียน | `modeId` · `focusRubricId` · `fields` (`bm-f1`-`bm-f5`) · `selfAssessment` (`bm-self1`-`bm-self3`) | `{ ok, submitted, submissionId, emphasisCriterion, format, proposedScore, proposedMaxScore, proposedStars, dimensions[4], emphasisDimensionId, feedback, needsTeacherConfirm, totalStars, gradeJobQueued, nextHref, source, provider, fallbackReason }` | `200` · `400` `bad-request`/`bad-mode`/`bad-rubric` · `401` · `409` `already-submitted` · `422` `incomplete` |
| `POST` | `/api/ceo/voice` | นักเรียน | **`multipart/form-data`** — `audio` (ไฟล์ ≤2 MiB) · `durationSec` | `{ ok, durationSec, submissionId, message }` | `200` · `400` `bad-request`/`no-file` · `401` · `413` `too-large` · `415` `bad-type` |
| `GET` | `/api/me/showcase` | นักเรียน | **ไม่รับอะไรเลย** | `{ count, showcase: [{ nickname, domainName, tld, reasonText }], ownHidden }` — **ตัดงานของตัวเองออก** | `200` · `401` |
| `POST` | `/api/showcase/feedback` | นักเรียน | `toNickname` · `praiseText` · `suggestText` — ต้องมีอย่างน้อย 1 ช่องไม่ว่าง | `{ ok, toNickname }` | `200` · `400` `bad-request`/`empty-feedback`/`self-feedback` · `401` · `404` `friend-not-found` · `409` `save-failed` · `422` `content-flagged` |
| `GET` | `/api/reflect` | นักเรียน | ไม่รับอะไรเลย | `{ answers }` | `200` · `401` |
| `POST` | `/api/reflect` | นักเรียน | `answers` object คู่ `reflect-N: ข้อความ` · `submit` (bool) | `{ ok, submitted, earnedStars, goalStars, outcome }` | `200` · `400` · `401` · `422` `too-short` |
| `GET` | `/api/grade/status` | นักเรียน | **ไม่รับอะไรเลย** | `{ ok, submissionId, versionCount, state, stateLabel, aiCheck, message, nextHref, nextLabel, revision, certificate, pollAfterSeconds }` | `200` · `401` |
| `GET` | `/api/survey` | นักเรียน | ไม่รับอะไรเลย | `{ open, done, meta, scale, items[10], reason }` | `200` · `401` |
| `POST` | `/api/survey` | นักเรียน | `scores` (`q1`…`q8` ข้อละ 1-5 **บังคับครบ**) · `likeText` · `improveText` | `{ ok: true }` — **ไม่มี id ของใครเลย** | `200` · `400` · `401` · `403` `not-open` · `409` `already-done` · `422` `incomplete` |
| `GET` | `/api/self-assess` | นักเรียน **หรือ** ครู | นักเรียน: ไม่รับอะไรเลย · ครู: query `studentId` (uuid บังคับ) | นักเรียน: `{ ok, role: "student", submissionId, form, table }` · ครู: `+ nickname, selfAwareness, nextGoal, nextGoalSummary` | `200` · `400` · `401` · `404` `not-found` |
| `POST` | `/api/self-assess` | นักเรียน | `scores` (รหัสด้าน : 1-3 **ครบ 4 ด้าน**) · `submissionId` (ไม่ส่ง = งานชิ้นล่าสุด) | `{ ok, role, submissionId, form, table, message }` | `200` · `400` `bad-request`/`bad-scores` · `401` · `404` · `409` `no-submission` |
| `GET` | `/api/self-assess/next-goal` | นักเรียน | ไม่รับอะไรเลย | `{ ok, prompt, options[], ownTextMaxLength, current, summary }` | `200` · `401` |
| `POST` | `/api/self-assess/next-goal` | นักเรียน | `goalId` (บังคับ) · `ownText` (เฉพาะตัวเลือกที่เปิดให้พิมพ์เอง) | `{ ok, current, summary, message }` | `200` · `400` `bad-request`/`bad-goal`/`goal-blocked` · `401` |
| `GET` | `/api/certificate` | นักเรียน | **ไม่รับอะไรเลย — query ถูกเมินทั้งหมด** | ไฟล์ **PDF** (ไม่ใช่ JSON) | `200` · `401` · **`403` `not-yet`** (+ `status` `passedCount` `missing[]` `nextHref`) |

**`POST /api/ceo` ส่งได้ครั้งเดียว** เช็กด้วยการกรองเฉพาะใบที่มี `emphasis_criterion` (ใบของสถานี B มีค่าเป็น `null` จึงไม่นับ)
⚠️ แต่ **`GET /api/ceo` คืนใบล่าสุดทุกชนิด รวมใบของสถานี B** จึงรายงาน `submitted: true` ได้ทั้งที่ยังไม่ส่งภารกิจใหญ่ — แยกกันที่ `emphasisCriterion`

**นักเรียนเลือกเองได้ 2 อย่างในภารกิจใหญ่:** `modeId` รูปแบบการส่งงาน (`bm-mode-write`/`voice`/`design`) และ `focusRubricId` ด้านที่อยากให้ประเมินหนักเป็นพิเศษ ถ่วง 2 เท่า (`bm-r1`-`bm-r4`)
เปลี่ยนได้จนกว่าจะกดส่ง หลังส่งแล้วล็อก เพื่อไม่ให้เปลี่ยนเกณฑ์หลังเห็นผล
**ตรวจความครบถ้วนที่เซิร์ฟเวอร์** กรอกไม่ครบได้ `422` พร้อมรายชื่อช่องที่ขาด

**`POST /api/ceo` ให้คะแนนด้วยกฎทันที แล้วฝากงานเข้าคิวให้ AI ตรวจทีหลัง** (มติ master)
ไม่แตะเน็ตเลยในคำขอนี้ จบในหลักมิลลิวินาที · ดูรายละเอียดทั้งหมดที่หัวข้อ **3.4 คิวตรวจงานเบื้องหลัง**
`gradeJobQueued: false` แปลว่าเข้าคิวไม่สำเร็จ — **ไม่กระทบคะแนนของนักเรียน** เพราะบันทึกไปก่อนแล้ว

**`POST /api/ceo/voice`** ใช้เมื่อผู้เรียนเลือกโหมด `bm-mode-voice` · เก็บลง bucket **ส่วนตัว** `voice-submissions`
- path ในสตอเรจเป็น `<studentId>/<uuid>.<ext>` เสมอ (policy ของ storage อ่าน `student_id` จากโฟลเดอร์ชั้นแรก — ห้ามเปลี่ยนรูปแบบโดยไม่แก้ migration)
- รับเฉพาะ `audio/webm` `audio/ogg` `audio/mp4` `audio/mpeg` `audio/wav` · เกิน 2 MiB ได้ `413`
- **ฝั่งนักเรียนได้แค่ `submissionId`** ไม่มี URL ไฟล์และไม่มี path หลุดออกมา — คนที่ได้ URL อายุสั้นคือครูเจ้าของห้องเท่านั้น
- ⚠️ **อัปโหลดพังต้องไม่ทำให้ผู้เรียนตัน** ทุกข้อความ error ของ route นี้ลงท้ายด้วย "พิมพ์คำตอบแทนได้เลย"
- **เก็บ 90 วันแล้วลบอัตโนมัติ** (`voice_submissions.expires_at`) ครูสั่งลบก่อนได้ — เสียงเด็กเป็นข้อมูลส่วนบุคคล

**`GET /api/me/showcase` = กระดานผลงาน **ของเพื่อน** ในห้อง** ไม่รับพารามิเตอร์ใด ๆ `classroomId`/`studentId` มาจากคุกกี้เท่านั้น
⚠️ **ห้ามมีดาว คะแนน หรือสถานะผ่าน/ไม่ผ่านของใครในนี้เด็ดขาด** SQL function `classroom_showcase` เลือกมาแค่ 4 คอลัมน์
กระดานนี้ให้เห็นไอเดียเพื่อน **ไม่ใช่ตารางอันดับ** — เด็กที่ได้ 1 ดาวกับ 3 ดาวเปิดแล้วเห็นเหมือนกันทุกประการ
`p_student_id` ใน SQL ใช้ยืนยันแค่ว่า "อยู่ห้องนี้จริง" (คนนอกห้องได้ `[]` เสมอ) **ไม่ได้กรองงานตัวเองออก**
route จึงตัดออกอีกชั้นด้วย**ชื่อเล่น** แล้วบอกจำนวนที่ตัดไปใน `ownHidden` (`{ count, showcase, ownHidden }`)
กรองด้วยชื่อเล่นได้แม่นยำเพราะตาราง `students` มี `unique (classroom_id, nickname)` — ในห้องหนึ่งชื่อเล่นชี้คนได้คนเดียวเสมอ
(`POST /api/join` ปฏิเสธชื่อที่ซ้ำตั้งแต่ต้น ดูหัวข้อ 2.1) · `ownHidden` ให้หน้าจอบอกได้ว่า "งานของเราอยู่ที่หน้าผลของฉัน" 

**`/api/showcase/feedback`** ผู้ส่งอ่านจากคุกกี้เท่านั้น · ผู้รับต้องอยู่ห้องเดียวกัน (ค้นด้วย `classroomId` ของ session) ส่งข้ามห้องไม่ได้
⚠️ **ที่นี่ไม่มีคะแนนหรือดาวของใครทั้งสิ้น** ตำราห้ามเอาผู้เรียนมาเปรียบเทียบกัน

**`/api/reflect`** ความยาวขั้นต่ำมาจากไฟล์เนื้อหา (`reflect-1`/`reflect-3` ≥10 ตัวอักษร · `reflect-2` ≥5) ตรวจที่เซิร์ฟเวอร์
ข้อไหนยังไม่ตอบข้ามได้ถ้าไม่ส่ง `submit: true` · ตอบซ้ำ = ทับของเดิม · response คือ "ผลลัพธ์" ที่หน้าเว็บเอาไปโชว์

**`GET /api/certificate`** ⚠️ **`studentId` อ่านจากคุกกี้เท่านั้น route ไม่อ่าน `searchParams` เลย**
ถ้ารับจาก query เด็กจะโหลดใบประกาศของเพื่อนได้ทั้งห้อง (`docs/auth-and-roles.md` หัวข้อ 6)
- `content-type: application/pdf`
- `content-disposition` ชื่อไฟล์ `เกียรติบัตร-<ชื่อเล่น>.pdf` ส่งแบบ RFC 5987 เพื่อให้ชื่อไทยไม่เพี้ยน
- `cache-control: private, no-store` เพราะเป็นข้อมูลรายบุคคล ห้ามให้ proxy หรือ CDN เก็บไว้แจกซ้ำ

**ใบประกาศไม่ได้ออกให้ทุกคนอัตโนมัติ** (มติ T40 · เปลี่ยนจากร่างแรกที่ให้ทุกคนที่เข้าร่วม)
ออกให้เมื่อ **ครูยืนยันคะแนนแล้ว และได้ระดับ 3 ขึ้นไปครบทั้ง 4 ด้าน** · **ไม่ผูกกับจำนวนดาว**
ตัดสินฝั่งเซิร์ฟเวอร์ที่ `components/server/certificate-eligibility.ts` คืน 4 สถานะ `not-submitted` · `pending-teacher` · `keep-going` · `passed`
สถานะ `keep-going` **ไม่ใช่สถานะปลายทาง** — หน้าเดียวกันบอกว่าทำได้แล้วกี่ด้าน เหลือด้านไหน และต้องเพิ่มอะไรถึงจะได้ระดับ 3 แล้วแก้ส่งใหม่ได้ (`POST /api/teacher/request-revision`)
⚠️ **กติกาถ้อยคำ** ข้อความทุกสถานะห้ามใช้คำว่า ไม่ผ่าน · ตก · ล้มเหลว · ยังไม่ได้มาตรฐาน (`content/rubric.json` → `certificate.wordingRule` · `content/reflection.json` → `_certificateToneRule`)

### 2.5 ครู

| Method | Path | ใครเรียกได้ | body / query ที่รับ | สิ่งที่คืน | status |
|---|---|---|---|---|---|
| `POST` | `/api/teacher/login` | ไม่ต้อง login | `email` · `password` (Supabase Auth) | `{ ok, teacher: { email, name } }` + ตั้งคุกกี้ `dbq_teacher` | `200` · `400` · `401` `invalid-credentials` |
| `POST` | `/api/teacher/logout` | ครู | **ไม่รับอะไรเลย** | `{ ok: true }` + ลบคุกกี้ `dbq_teacher` ใน `set-cookie` | `200` · **`401`** |
| `GET` | `/api/teacher/classroom` | ครู | ไม่รับอะไรเลย | `{ classrooms: [{ id, room_code, status, teacher_id, opens_at, closes_at, created_at }] }` | `200` · `401` |
| `POST` | `/api/teacher/classroom` | ครู | ไม่รับอะไรเลย | `{ ok, classroom }` — รหัส 6 ตัวสุ่มฝั่งเซิร์ฟเวอร์ | `201` · `401` |
| `PATCH` | `/api/teacher/classroom` | ครู | `classroomId` (uuid) · `status` (`open`\|`locked`\|`closed`) | `{ ok, classroom }` — `closed` จะ stamp `closes_at` | `200` · `400` · `401` · `404` `not-found` |
| `GET` | `/api/teacher/board` | ครู | query `classroomId` (บังคับ) · `now` (timestamp ไว้ทดสอบ) | `{ classroomId, now, students, flagged, needsHelp, shouldTalk, shouldPraise, pendingReview, coachRules, board[] }` | `200` · `400` · `401` · `404` `not-found` |
| `POST` | `/api/teacher/confirm-score` | ครู | `submissionId` (uuid) · **`dimensions` ครบ 4 ด้าน ด้านละ 1-3** · `emphasisDimensionId` · `stars` (0-3) · **`note` บังคับ ≥1 ตัวอักษร ≤500** · (รูปแบบเดิม `score`/`maxScore` ยังรับได้) | `{ ok, submission: { id, needsReview, aiScores, teacherScores, teacherChanged, changedDimensions[], changedFrom, previousTeacherScores, confirmedAt } }` | `200` · `400` · `401` · `404` `not-found` |
| `GET` | `/api/teacher/voice` | ครู | query `classroomId` (บังคับ) | `{ classroomId, count, voices: [{ id, nickname, durationSec, transcriptText, createdAt, expiresAt, url }] }` | `200` · `400` · `401` · `404` `not-found` |
| `DELETE` | `/api/teacher/voice` | ครู | `voiceSubmissionId` (uuid) | `{ ok, deleted }` | `200` · `400` · `401` · `404` `not-found` |
| `DELETE` | `/api/teacher/classroom` | ครู | `classroomId` (uuid) | `{ ok, deletedVoiceFiles }` — **ลบจริง** พร้อมไฟล์เสียงทั้งห้อง | `200` · `400` · `401` · `404` |
| `GET` | `/api/teacher/session` | ครู | query `classroomId` (บังคับ) | `{ session, phases[8], changes[] }` — **เปิดคาบให้เองถ้ายังไม่มี** | `200` · `400` · `401` · `404` |
| `POST` | `/api/teacher/session` | ครู | `action` + ฟิลด์ตาม action (ดูหัวข้อ 3.6) | `{ ok, session }` หรือ `{ ok, unlock }` | `200` · `400` · `401` · `404` · `409` `too-late` |
| `GET` | `/api/teacher/screen` | ครู | query `classroomId` (บังคับ) | `{ ok, phase, phaseLabel, remainingSeconds, paused, focusScreen, joined, missionsPassed, submitted, showcase[] }` | `200` · `400` · `401` · `404` |
| `GET` | `/api/teacher/broadcast` | ครู | query `classroomId` (บังคับ) | `{ broadcasts[], presets[], maxChars: 80 }` | `200` · `400` · `401` · `404` |
| `POST` | `/api/teacher/broadcast` | ครู | `classroomId` · `text` (≤80) · `target` (`all`\|`mission`) · `targetValue` | `{ ok, broadcast }` | `200` · `400` · `401` · `404` · **`429` `too-fast`** (1 ข้อความ/30 วินาที) |
| `GET` | `/api/teacher/flags` | ครู | query `classroomId` (บังคับ) · `since` · `minLevel` | `{ ok, minLevel, flags[], checkedAt }` — ครูเห็นข้อความเต็มเฉพาะระดับ 3 | `200` · `400` · `401` · `404` |
| `POST` | `/api/teacher/flags` | ครู | `flagId` (uuid) · `note` | `{ ok, flagId }` — "ดูแลแล้ว" = ปิดธง **ไม่ลบข้อความ** | `200` · `400` · `401` · `404` |
| `POST` | `/api/teacher/request-revision` | ครู | `submissionId` · `dimensionIds[]` (≥1) · `dimensions` · **`note` บังคับ** · `allowExtraRound` | `{ ok, submission: { id, needsReview, revision } }` | `200` · `400` · `401` · `404` |
| `GET` | `/api/teacher/report/items` | ครู | query `classroomId` (บังคับ) | `{ itemAnalysis: { classroomId, criteria, sets: [pre, post] } }` — ค่าความยาก p + อำนาจจำแนก r รายข้อ | `200` · `400` · `401` · `404` `not-found` |
| `POST` | `/api/teacher/demo-reset` | ครู | `classroomId` (uuid) · **`roomCode` เพื่อยืนยัน** | `{ ok, roomCode, cleared, seeded, elapsedMs, message }` — **ลบข้อมูลทั้งห้องแล้วเติมหุ่นกลับ** | `200` · `400` `bad-request`/`confirm-mismatch` · `401` · **`403` `not-demo`** · `404` |
| `GET` | `/api/teacher/report` | ครู | query `studentId` **หรือ** `classroomId` | `{ report }` (รายคน) หรือ `{ report, buddyLog }` (รายห้อง) | `200` · `400` · `401` · `404` |
| `GET` | `/api/teacher/report/class` | ครู | query `classroomId` (บังคับ) | `{ report }` — E1/E2 · t-test · effect size · normalized gain · objectiveGaps | `200` · `400` · `401` · `404` |
| `GET` | `/api/teacher/efficiency` | ครู | query `classroomId` (บังคับ) | `{ ok, studentCount, postTestDone, preTestDone, e1{}, e2{}, label, standardLabel, meetsStandard, summary }` | `200` · `400` · `401` · `404` |
| `GET` | `/api/teacher/student` | ครู | query `studentId` (บังคับ) | `{ report, overrides[], notes[], unlocks[], reasonOptions[] }` | `200` · `400` · `401` · `404` |
| `POST` | `/api/teacher/student` | ครู | `action` + `studentId` + **`reason`** (ดูหัวข้อ 3.7) | ต่างกันตาม action | `200` · `400` · `401` · `404` |
| `GET` | `/api/teacher/showcase` | ครู | query `classroomId` (บังคับ) | `{ ok, pinned[], feedback[], withoutFeedback[] }` | `200` · `400` · `401` · `404` |
| `POST` | `/api/teacher/showcase` | ครู | `action` `pin` (`submissionId` · `pinned` · `hideName`) หรือ `hide-feedback` (`feedbackId` · `hidden` · `reason`) | `{ ok, submissionId, pinnedAt }` / `{ ok, feedbackId, hiddenAt }` | `200` · `400` · `401` · `404` |
| `GET` | `/api/teacher/export` | ครู | query `classroomId` (บังคับ) · `type` (`students`\|`scores`\|`events`\|`reflections`\|`survey`) · `pseudonymize=1` | ไฟล์ **CSV** (`text/csv; charset=utf-8` + BOM) | `200` · `400` · `401` · `404` |
| `GET` | `/api/jobs/drain` | ครู **หรือ** header `x-worker-secret` | ไม่รับอะไรเลย | `{ ok, pending, running, done, failed }` — อ่านอย่างเดียว ไม่แตะคิว | `200` · `401` |
| `POST` | `/api/jobs/drain` | ครู **หรือ** header `x-worker-secret` | `max` (ไม่บังคับ ≤20) | `{ ok, reclaimed, processed, queue }` | `200` · `401` `unauthorized` |

**`POST /api/teacher/login` ตรวจรหัสผ่านด้วย anon key ไม่ใช่ `service_role`** แล้วแลกเป็นคุกกี้ของแอปเอง
access token ของ Supabase ไม่ถูกส่งกลับไปเบราว์เซอร์เลย

**`POST /api/teacher/logout`** ก่อนหน้านี้ทั้งระบบ **ไม่มีทางออกจากระบบให้ครูกดเลย** ครูที่ยืมเครื่องคนอื่น
หรือใช้เครื่องกลางของโรงเรียนจึงค้าง session ไว้จนหมดอายุเอง (12 ชั่วโมง)
- ลบคุกกี้ด้วย**ออปชันชุดเดียวกับตอนตั้ง** (`path`/`secure`/`sameSite`) ไม่งั้นเบราว์เซอร์ถือว่าคนละใบ แล้วคุกกี้เดิมจะยังอยู่
- ⚠️ **ไม่มีคุกกี้มาด้วยได้ `401` ไม่ใช่ `200`** — เหมือนเส้นอื่นใต้ `/api/teacher/*` ทั้งหมด ไม่มีข้อยกเว้นให้จำ
  (จุดนี้เคยเขียนผิดในร่างแรกของ OpenAPI ว่า "ตอบ 200 เสมอ" แก้ตามซอร์สแล้ว)

**ครูเลือกรหัสห้องเองไม่ได้** `POST /api/teacher/classroom` ไม่รับ body รหัสมาจาก `genRoomCode()` ที่ตัด `0 O 1 I L` ออกเพราะอ่านสับสนบนโปรเจกเตอร์

**`GET /api/teacher/board` เป็นแผงโค้ช ไม่ใช่ตารางสถานะเฉย ๆ** แต่ละแถวมี:
`studentId` `nickname` `businessName` `learningRoute` `scaffoldLevel` `goalStars` `goalStatus` `earnedStars` `currentMission` `idleSeconds`
`confidenceByObjective` `correctByObjective` `calibration` `skippedMissions` `pendingReview` `pendingSubmissions` `askedForHelp` `helpMissionId` `flag` `coachCard`

- `flag` = `{ flagged, level (สีธง), cause, label, reasonId, reasonName, teacherNote }` บอกว่าควรเข้าไปหาใครก่อนและเพราะอะไร (เช่น `idle-too-long`)
- `currentMission` = `{ missionId, title, attempts, hintsUsed, maxHints, solved }`
- `coachCard` = คำแนะนำที่ครูอ่านแล้วเดินไปคุยได้ทันที
- `coachRules` = เกณฑ์ของธง ให้ครูเข้าใจว่าระบบยกธงจากอะไร
- `goalStatus` แยก **"ยังไม่ตั้งเป้า"** ออกจาก **"ตั้งเป้า 0"** ให้ครูเห็นชัด (สองอย่างนี้ไม่เหมือนกัน)
- `pendingSubmissions[]` = การ์ดงานที่รอครูยืนยัน มี `source` (`ai`/`fallback`/`unknown`) และ `sourceLabel` ภาษาไทยติดมา
  **ครูต้องเห็นป้ายนี้ก่อนกดยืนยัน** — AI เป็นข้อเสนอเสมอ ครูเป็นคนตัดสิน

**ธง calibration (ของใหม่):** `calibration[]` เทียบ "ความมั่นใจที่ผู้เรียนกรอก" กับ "ผลถูกผิดจริง" รายวัตถุประสงค์
ได้ธง **"ควรคุย"** (มั่นใจสูงแต่ผิด) และ **"ควรชม"** (มั่นใจต่ำแต่ถูก) พร้อมการ์ดคำถามโค้ช
ระดับบนสุดสรุปให้เป็น `shouldTalk` / `shouldPraise` · **ไม่มีผลกับคะแนน และไม่แสดงเป็นคำตัดสินให้ผู้เรียนเห็น** ใช้ตั้งวงคุยเท่านั้น

ไม่มี `pin_hash` หรือคีย์ลับหลุดออกมา · หน้าเว็บครู poll ทุก 3 วินาที
⚠️ **ห้ามส่งเฉลยมาที่ฝั่งครูในหน้าเดียวกับคำถามโค้ช** `content/missions.json` มีทั้ง `check.choices` และ `hints`
แต่ route อ่านเฉพาะ `title` กับ **"จำนวน"** ของ hints (เอาไปคิด `hintsExhausted`) ไม่เคยส่งตัวข้อความออกไป — ตำราให้ครูถาม ไม่ใช่ให้ครูบอกคำตอบ
⚠️ **ไม่มีช่อง `stations` แล้ว** (รูปแบบเดิม) โค้ดฝั่งหน้าเว็บที่ยังอ่าน `row.stations` ต้องแก้

**`POST /api/teacher/confirm-score` — ครูเป็นคนตัดสินเสมอ AI เป็นแค่ข้อเสนอ**
`submissionId` รับจาก body ได้ แต่ SQL function ตรวจ `EXISTS(งานชิ้นนี้อยู่ในห้องของครูคนนี้)` ภายใน `UPDATE` เดียวกัน ไม่ใช่เจ้าของ = 0 แถว = `404`
ฝั่ง DB บันทึกร่องรอยให้เอง: `confirmed_by` · `confirmed_at` · `ai_scores_snapshot` · `teacher_changed` — เอาไปโชว์ได้ว่าครูเป็นคนตัดสินจริง

**รูปแบบใหม่: คะแนนรายด้าน 4 ด้าน** (เดิมเก็บแค่ `score` ก้อนเดียว การแก้รายด้านบนจอจึงไม่ถูกบันทึกจริง)

| id ของด้าน | ชื่อ |
|---|---|
| `dim-naming` | ชื่อจำง่ายและสะกดถูกกฎ |
| `dim-tld-fit` | นามสกุลเหมาะกับประเภทธุรกิจ |
| `dim-customer-reason` | เหตุผลอ้างอิงลูกค้าเป้าหมาย |
| `dim-business-link` | เชื่อมโยงกับธุรกิจตัวเอง |

- **เซิร์ฟเวอร์คำนวณคะแนนรวมถ่วงน้ำหนักเอง ไม่รับตัวเลขรวมจากหน้าจอ** สูตร = (ด้านที่เน้น × 2) + อีก 3 ด้าน · เต็ม 15
- `emphasisDimensionId` รับได้ทั้ง `dim-*` และ `emphasis-*` · ขาดด้านไหนได้ `400` พร้อม**บอกชื่อด้านที่ขาดมาตรง ๆ**
- **`note` บังคับกรอก** อย่างน้อย 1 บรรทัด — คะแนนที่ไม่มีคำอธิบายไม่ช่วยให้ผู้เรียนรู้ว่าต้องแก้อะไร
- ส่ง `stars` มาด้วยจะใช้ค่านั้น ไม่ส่งจะคิดจาก `starBands` ใน `content/rubric.json` ให้เอง แล้วเรียก `recalcStudentStars()` ให้ทุกจอตรงกัน

**ตัวแปลงรหัสด้านของรูบริก — มีที่เดียวในโปรเจกต์**

ในระบบมีรหัสของด้านเดียวกันอยู่ 3 ชุด เพราะไฟล์เนื้อหาคนละไฟล์เกิดคนละเวลา

| ชุด | ตัวอย่าง | มาจาก | ใครใช้ |
|---|---|---|---|
| `dim-*` | `dim-tld-fit` | `content/rubric.json` `dimensions[].id` | **รหัสมาตรฐาน** ที่ทุกที่ควรเก็บ |
| `bm-r*` | `bm-r2` | `sourceId` ของด้านนั้น (ของเดิมใน `big-mission.json`) | `focusRubricId` ที่หน้าด่านบอสส่งมา |
| `emphasis-*` | `emphasis-tld-fit` | `content/rubric.json` `emphasis.options[].id` | ตัวเลือกบนหน้าจอครู |

`toRubricDimensionId()` ใน `components/server/lesson-content.ts` **รับได้ครบทั้ง 3 ชุด คืน `dim-*` เสมอ**
และมีคู่แฝด `toEmphasisOptionId()` สำหรับแปลงกลับเป็นตัวเลือกบนหน้าจอครู
จับคู่จากไฟล์เนื้อหาโดยตรง ไม่ผูกคู่ไอดีไว้ในโค้ด — เพิ่มด้านใหม่ใน `content/rubric.json` แล้วตัวแปลงรู้เอง
ล็อกไว้ด้วยเทสต์ `components/server/rubric-id.test.ts`

⚠️ **ห้ามสร้างตารางแม็ปของตัวเองขึ้นมาใหม่ที่อื่น** ให้ import ตัวนี้ไปใช้
`app/api/teacher/confirm-score` เลิกใช้ตารางแม็ป `EMPHASIS_TO_DIMENSION` ของตัวเองแล้ว เรียกตัวแปลงกลางตัวเดียว
จึงรับ `dim-*` · `bm-r*` · `emphasis-*` ได้หมด (บันทึกลงฐานข้อมูลเป็น `dim-*` เสมอ) · รหัสที่ไม่รู้จักยังได้ `400`

**`changedDimensions` = ด้านที่ครูแก้ "รอบนี้"** ไม่ใช่ "ต่างจากที่ AI เสนอ" (เปลี่ยนความหมายแล้ว)
เทียบกับคำตัดสินครั้งก่อนของครูเอง (`submissions.teacher_scores_before`) ถ้าเป็นการยืนยันครั้งแรกจึงเทียบกับข้อเสนอของกฎ/AI
ช่อง `changedFrom` บอกว่าเทียบกับอะไร — `'teacher'` = รอบก่อนของครู · `'ai'` = ยืนยันครั้งแรก · `null` = ไม่มีอะไรให้เทียบ
และ `previousTeacherScores` คือคะแนนที่ครูยืนยันไว้ครั้งก่อน (`null` = ครั้งนี้ครั้งแรก)
กดยืนยันซ้ำโดยไม่แก้อะไรได้ `changedDimensions: []` · แก้ด้านเดียวได้ 1 ด้าน (เดิมขึ้นครบ 4 ด้านทุกกรณี)

**`GET` / `DELETE /api/teacher/voice` — ไฟล์เสียงของทั้งห้อง**
`teacherId` มาจากคุกกี้เท่านั้น · ทั้ง `listClassroomVoiceSubmissions` และ `delete_voice_submission` ตรวจสายโซ่เจ้าของ
(ไฟล์เสียง → นักเรียน → ห้อง → ครู) ใน query/SQL เดียวกัน ไม่ใช่เจ้าของ = `404` และ**ไม่แตะไฟล์ใน bucket เลย**
`url` ที่คืนมาเป็น signed URL อายุสั้นของ bucket ส่วนตัว ไม่ใช่ลิงก์สาธารณะ · `DELETE` ลบทั้งไฟล์และแถว

**`POST /api/jobs/drain` = worker ของคิวตรวจงาน** ดูหัวข้อ **3.4**
ผ่านได้ 2 ทาง: (1) header `x-worker-secret` ตรงกับ `GRADE_WORKER_SECRET` หรือ (2) มีคุกกี้ `dbq_teacher`
ไม่ได้ตั้ง `GRADE_WORKER_SECRET` = ทางที่ (1) ไม่ผ่านตั้งแต่ต้น (ไม่ใช่ "ไม่ตั้ง = ผ่านหมด")
⚠️ **ช้าได้เป็นสิบวินาที** เพราะฝั่งเบื้องหลังให้งบเวลา 60 วินาทีต่องาน ตรวจได้สูงสุด 20 งานต่อครั้ง เหลือให้ยิงซ้ำ

---

## 3. ที่มาของคำตอบจาก AI — ทุกที่ต้องมี `source`

endpoint ที่เรียกชั้น AI (`/api/hint` · `/api/station-b/submit` · `/api/ceo` · `/api/dome`) คืนช่องบอกที่มาติดมาด้วยเสมอ:

| ช่อง | ความหมาย |
|---|---|
| `source` | `ai` = มาจากโมเดล · `fallback` = มาจากกฎล้วน |
| `provider` | ชื่อผู้ให้บริการ หรือ `rules` ถ้าเป็นกฎ |
| `fallbackReason` | เหตุผลที่ตกไปทางกฎ (เช่น `not-requested` = ไม่ได้เรียกโมเดลตั้งแต่แรก) |
| `needsTeacherConfirm` | คะแนนนี้ต้องให้ครูยืนยัน |

### 3.1 สถานะปัจจุบัน: ใส่คีย์จริงแล้ว

**ใส่ API key จริงของ Gemini และ Typhoon ไว้ใน `.env.local` แล้ว** (`GEMINI_API_KEY` / `TYPHOON_API_KEY`)
เส้นทาง AI จึงทำงานจริง ปกติจะได้ `source: "ai"` ไม่ใช่ `"fallback"` อีกแล้ว

`providerChain()` ใน `lib/ai/index.ts` สร้าง **ลูกโซ่ผู้ให้บริการ** จากคีย์ที่มีจริง แล้วลองทีละชั้น:

```
Gemini  →  Typhoon  →  กฎล้วน (rules)
```

ไม่ใช่ "เลือกเจ้าเดียวแล้วจบ" — **ชั้นแรกพังจะลองชั้นถัดไปให้เอง** แล้วค่อยตกกฎเป็นด่านสุดท้าย
มีคีย์เจ้าเดียวก็ได้ลูกโซ่ยาว 1 ตัว · ไม่มีคีย์เลยได้อาร์เรย์ว่าง = ใช้กฎทันทีโดยไม่แตะเน็ต

**งบเวลารวมทั้งลูกโซ่คือ 5 วินาที** แบ่งให้แต่ละชั้น (ชั้นที่ไม่ใช่ชั้นสุดท้ายได้อย่างน้อย 1.2 วินาที ชั้นสุดท้ายได้เวลาที่เหลือทั้งหมด)
`attempts[]` บันทึกว่าแต่ละชั้นใช้เวลาเท่าไรและพังเพราะอะไร ใช้ตอบครูและตอน debug

เหตุผลที่เรียง Gemini ก่อน: บังคับรูปแบบ JSON ด้วย `responseSchema` ได้จริง ส่วน Typhoon ตอบไทยเป็นธรรมชาติและเร็วกว่าในงานสั้น

> 🔒 **ห้ามพิมพ์ค่าคีย์ออกมาที่ไหนทั้งสิ้น** — ไม่ว่าในเทอร์มินัล log ไฟล์ผล เอกสาร collection หรือ `.env.example`
> ต่อให้บางส่วนของคีย์ก็ห้าม · และห้ามตั้งชื่อ env ขึ้นต้น `NEXT_PUBLIC_` ให้คีย์เด็ดขาด (ดูหัวข้อ 4.4)

### 3.2 ระบบต้องเดินได้แม้ AI ล่ม — นี่คือจุดขาย ไม่ใช่ข้อแก้ตัว

เน็ตโรงเรียนไม่แน่นอนจริง เส้นทางกฎล้วนจึงเป็น **เส้นทางหลักที่ต้องเดินได้เสมอ** ไม่ใช่ทางหนีทีไล่

`lib/ai/index.ts` ตกไปทางกฎล้วนโดยอัตโนมัติเมื่อ:

| `fallbackReason` | เกิดตอนไหน |
|---|---|
| `no-api-key` | ไม่มีคีย์ → **ไม่แตะเน็ตเลยแม้แต่ครั้งเดียว** |
| `timeout` | โมเดลตอบช้าเกิน **5 วินาที** (`DEFAULT_TIMEOUT_MS`) |
| `bad-response` | โมเดลตอบผิดรูปแบบ parse ไม่ได้ |
| `request-failed` | เรียกไม่สำเร็จ เน็ตหลุด โมเดลล่ม |
| `quota-exceeded` | ใช้ครบโควตา **12 ครั้ง/คน/คาบ** (`DEFAULT_MAX_CALLS_PER_STUDENT`, ปรับด้วย `AI_MAX_CALLS_PER_STUDENT`) |
| `not-requested` | ไม่ได้เรียกโมเดลตั้งแต่แรก (เช่น ตัวช่วยสถานี B) |

**ทุกกรณีคือผลที่ถูกต้อง ไม่ใช่ error** — ห้าม throw ห้ามขึ้นหน้าจอ error ให้นักเรียนเห็นกลางคาบ
ตัวช่วยของสถานี B เป็น `fallback`/`rules` เสมอ เพราะเป็นการเปิดป้ายเงื่อนไขจากไฟล์เนื้อหา ไม่ได้เรียกโมเดล

collection จึง assert ว่า `source` เป็น `ai` **หรือ** `fallback` โดยเจตนา — ทั้งสองค่าถือว่าระบบทำงานถูก
ถ้าเทสต์บังคับให้เป็น `ai` เท่านั้น ชุดทดสอบจะแดงทุกครั้งที่เน็ตสะดุด ซึ่งผิดเจตนาของการออกแบบ

### 3.3 หลักฐานจากการยิงจริง (29 ก.ย. 2569)

ยิงทั้ง collection ด้วยคีย์จริง แล้วนับค่า `source` ที่ได้กลับมา — **2 รอบติดกัน ได้สัดส่วนต่างกัน** เพราะขึ้นกับสภาพผู้ให้บริการตอนนั้น:

```
รอบที่ 1                                 รอบที่ 2
ai       / gemini                   4    ai       / gemini               5
ai       / typhoon                  4    ai       / typhoon              4
fallback / rules / not-requested    7    fallback / rules / not-requested 7
fallback / rules / timeout          5    fallback / rules / timeout       4
```

**สัดส่วนไม่คงที่เป็นเรื่องปกติ ไม่ใช่บั๊ก** — จึงห้ามเขียนเทสต์ที่บังคับว่าต้องเป็น `ai` เท่านั้น
collection assert เป็น `oneOf ['ai', 'fallback']` ไว้ทุกจุด

**ลูกโซ่ทำงานถูกต้องตามออกแบบ:**
- Gemini ตอบทันในงบ → `ai / gemini`
- Gemini ล่มหรือช้า → **Typhoon รับช่วง** → `ai / typhoon` (เคยยิงตอน Gemini ตอบ `503 UNAVAILABLE` "high demand" ทุกรุ่น แล้ว Typhoon รับช่วงได้จริง)
- ทั้งคู่ไม่ทันงบ 5 วินาที → `fallback / rules / timeout`
- ตัวช่วยสถานี B และการให้คะแนนภารกิจใหญ่ → `not-requested` เพราะ**ไม่ได้เรียกโมเดลตั้งแต่แรก**โดยเจตนา (ดู 3.4)

**ทั้งหมดนี้คือพฤติกรรมที่ถูกต้อง** ผู้ใช้ไม่เห็น error สักครั้ง เกมเดินจบคาบได้ตามปกติ
**ชุดทดสอบผ่าน 431/431 ในทั้งสองรอบ** ทั้งที่สัดส่วน AI ต่างกัน — เป็นหลักฐานตรงว่า "ระบบทำงานได้แม้ AI ล่ม" ไม่ใช่คำโฆษณา

ที่มาถูกบันทึกเป็น event ให้ครูตรวจย้อนหลังได้ว่าอันไหน AI อันไหนกฎ
`sourceLabel()` ใน `components/server/ai.ts` แปลงเป็นป้ายไทยสั้น ๆ ให้หน้าจอครู เช่น `AI เสนอ (gemini)` หรือ `กฎในโค้ดเสนอ (AI ตอบช้าเกิน 5 วินาที)`

**คะแนนจาก AI เป็นข้อเสนอเท่านั้น** ระบบไม่ตัดสินคะแนนแทนครู ทุกใบบันทึก `needs_review = true` จนครูกดยืนยันที่ `POST /api/teacher/confirm-score`

### 3.4 คิวตรวจงานเบื้องหลัง — ผู้เรียนไม่เคยรอ AI

**ปัญหา:** นาทีที่ 40-50 ของคาบ นักเรียน 30 คนกดส่งใบเสนอพร้อมกัน
ถ้ารอให้ AI ตรวจสด ๆ ต่อให้ยืดงบเป็น 10 วินาทีก็ยังเป็นคอขวด และโควตาผู้ให้บริการไม่พอ
**เด็กนั่งมองจอค้าง = บทเรียนพัง** ไม่ใช่แค่ UX ไม่ดี

**ทางออก: แยกคะแนนที่เห็นทันที ออกจากข้อเสนอของ AI ออกจากคะแนนจริง**

| | ใครคิด | เมื่อไร | เก็บที่ไหน | ผู้เรียนเห็นไหม |
|---|---|---|---|---|
| คะแนนที่เห็นทันที | กฎล้วนในโค้ด (ไม่แตะเน็ต) | ตอนกดส่ง หลักมิลลิวินาที | `ai_scores.ruleScores` + ฟิลด์ระดับบนสุด | เห็น พร้อมดาว |
| ข้อเสนอของ AI | โมเดล ผ่านคิว `grade_jobs` | ทีหลัง ไม่มีเส้นตาย | **`ai_scores.aiProposed`** | ไม่เห็น ครูเห็นคู่กับของกฎ |
| คะแนนจริง | **ครู** | ตอนครูกดยืนยัน | `teacher_confirmed_scores` | เห็นเป็นดาวสุดท้าย |

**กติกา 3 ข้อที่ห้ามผิด** (`lib/ai/grade-queue.ts` · `components/server/grade-queue.ts`)

1. **ผู้เรียนได้ผลจากกฎทันที** `POST /api/ceo` ไม่แตะเน็ตเลย · ยิงจริงวัดได้ **~115 ms**
2. **AI ตรวจทีหลังโดยไม่มีเส้นตาย 5 วินาที** ฝั่งเบื้องหลังใช้ `BACKGROUND_TIMEOUT_MS = 60_000` ไม่ใช่ `DEFAULT_TIMEOUT_MS = 5000`
   (ถ้าสร้าง `AiClient` ด้วยงบ 5 วินาที งานเบื้องหลังจะ timeout ทุกงานแล้วไม่ได้ผลจาก AI เลย)
3. **ผลของ AI เป็นข้อเสนอคู่ขนาน** เก็บใต้ `aiProposed` เท่านั้น
   **ห้ามแตะดาวที่ผู้เรียนเห็นไปแล้ว และห้ามแตะคะแนนที่ครูยืนยัน**
   (บั๊กจริงที่เคยเจอ: เขียนทับฟิลด์ระดับบนสุด → ดาวที่ครูให้ถูกกลบตอนคำนวณใหม่ · จอเด็กขึ้น 8/15 แต่แผงครูขึ้น 0)

**คิวอยู่ในตาราง `grade_jobs` ไม่ใช่ในหน่วยความจำ** เซิร์ฟเวอร์ดับกลางคันแล้วงานไม่หาย
- หยิบงานด้วย `claim_next_grade_job()` ที่ใช้ `FOR UPDATE SKIP LOCKED` — worker หลายตัวยิงพร้อมกันได้ ไม่แย่งงานกัน
- worker ที่ตายคางานไว้ถูก `reclaim_stale_grade_jobs()` ดึงกลับเข้าคิว (`claimed` ค้างเกิน 5 นาที → `pending`)
- ⚠️ `claimNext` คืน `null` ได้ทั้งตอน "คิวว่างจริง" และตอน "แถวถูกล็อกโดย worker อื่น" — `drainQueue()` จึงลองซ้ำอีกรอบก่อนสรุปว่าคิวหมด

**`gradingStatus` เดินได้ 3 สถานะ**

| ค่า | แปลว่า |
|---|---|
| `pending-ai` | คะแนนที่เห็นมาจากกฎ งานเข้าคิวรอ AI ตรวจอยู่ |
| `done` | AI ตรวจสำเร็จ `aiProposed` ถูกเติมย้อนหลังเข้าใบงานเดิมแล้ว |
| `ai-failed` | AI ตรวจไม่สำเร็จครบ 3 ครั้ง · `aiProposed: null` และ `aiError` บอกสาเหตุ |

**งานไม่มีทางค้างเป็น `pending-ai` ตลอดไป** ตรวจไม่สำเร็จจะถูกโยนกลับเข้าคิวลองใหม่จนครบ `DEFAULT_MAX_ATTEMPTS = 3` แล้วปักเป็น `failed`
ทั้งสองทางลงเอยที่ `done` หรือ `ai-failed` — **นี่คือสิ่งที่รับประกัน ไม่ใช่ "AI ต้องสำเร็จทุกครั้ง"**

**วิธีดูสถานะผ่าน HTTP:** ตอนนี้ยังไม่มี endpoint อ่าน `ai_scores` ตรง ๆ
อ่านได้ทางเดียวคือ `ai_scores_snapshot` ที่ `POST /api/teacher/confirm-score` คืนกลับมา (SQL ถ่ายค่า `ai_scores` ณ วินาทีที่ครูกดยืนยัน)
โฟลเดอร์ **7-คิวตรวจเบื้องหลัง** ใน Postman ใช้ช่องนี้พิสูจน์ทั้งวง: ยืนยันนักเรียน A **ก่อน** worker (ได้ `pending-ai`) และนักเรียน B **หลัง** worker (ได้ `done` + `aiProposed`)

⚠️ **`GRADE_WORKER_SECRET` ต้องอยู่ใน `.env.local` เท่านั้น** ห้ามขึ้นต้น `NEXT_PUBLIC_` และห้ามใส่ค่าจริงลง `.env.example`
ถ้าไม่มี worker จะยิงได้เฉพาะครูที่ล็อกอินอยู่ — ไม่ใช่ "ไม่ตั้ง = ใครก็ยิงได้"

### 3.5 ลูปแก้งาน — "ไม่มีการตก ทำต่อได้" ทำงานอย่างไร

มติ T40 ทำให้ใบประกาศต้องได้ระดับ 3 ครบ 4 ด้าน **ถ้าแก้งานไม่ได้ คนที่ได้ 2 ด้านจะไม่มีทางได้ใบเลย**
ซึ่งขัดกับข้อความที่ขึ้นบนหน้าจอเอง ลูปนี้จึงเป็นของที่ขาดไม่ได้ (สเปกข้อ 3.3)

```
เด็กส่ง -> ครูสั่งแก้ -> เด็กแก้แล้วส่งใหม่ (แถวใหม่) -> ครูยืนยัน -> ใบประกาศออก
```

**เก็บยังไงโดยไม่แตะ schema** (`components/server/revision.ts`)

- คำสั่ง "ให้แก้" เก็บใน `submissions.teacher_confirmed_scores` เป็น `{ status: 'revise', reviseDimensionIds, note, round, overrideLimit }`
- เด็กแก้แล้วส่งใหม่ = **แถวใหม่ใน `submissions`** ฉบับเดิมไม่ถูกทับ ครูเทียบได้ว่านักเรียนพัฒนาตรงไหน
- รอบที่เท่าไร = นับจำนวนแถวใบเสนอของภารกิจใหญ่ของคนนั้น

| ค่าใน `GET /api/ceo` | ความหมาย |
|---|---|
| `canResubmit` | ส่งใหม่ได้ไหมตอนนี้ (หน้าจอใช้ตัดสินว่าจะเปิดฟอร์ม แต่คนตัดสินจริงคือ `POST`) |
| `versionCount` | ส่งมาแล้วกี่ฉบับ |
| `revision.dimensions[].whatGetsYouThere` | descriptor ระดับ 3 จาก `content/rubric.json` **ตรง ๆ ไม่ได้แต่งเอง** |
| `revision.roundsLeft` | เหลือโควตาแก้อีกกี่รอบ |
| `blockedReason` | ข้อความบอกผู้เรียนว่าทำไมส่งใหม่ไม่ได้ — **ห้ามสื่อว่าตก** |

**แก้ได้ 3 รอบ** (`MAX_REVISION_ROUNDS`) กันวนไม่จบ แต่**ไม่ตัน** — ครบแล้วครูติ๊ก `allowExtraRound: true` ให้แก้ต่อได้
`POST /api/ceo` ตอนยังไม่ถูกสั่งแก้ = `409` `already-submitted` · ครบโควตาแล้ว = `409` `revision-limit`

⚠️ **สถานะนำหน้าคะแนนเสมอ** ครูกด "ส่งกลับให้แก้" = ยังไม่ใช่คะแนนสุดท้าย
ต่อให้ครูเผลอให้ 3 ครบทุกด้านตอนสั่งแก้ ใบประกาศก็ยังเป็น `keep-going` อยู่ดี

**ยืนยันครบวงใน Postman โฟลเดอร์ 9-ลูปแก้งาน**

### 3.6 ครูคุมช่วงของคาบและเวลา (T-03)

**"ช่วงของห้อง" คือเพดานสูงสุดที่ครูเปิดให้ทำ ไม่ใช่โซ่ที่ลากทุกคนไปพร้อมกัน**

| ช่วง | ป้ายบนจอครู |
|---|---|
| `wait` | รอเริ่ม (ครูสอนสไลด์) |
| `onboard` | รู้จักตัวเอง |
| `mission` | ภารกิจย่อย |
| `boss` | ด่านบอส |
| `summary` | ครูสรุป (ดูจอหน้าห้อง) |
| `reflect` | สะท้อนคิด |
| `end` | จบคาบ |
| `home` | ทำต่อที่บ้าน |

`POST /api/teacher/session` รับ `action` ต่อไปนี้

| action | ฟิลด์ | ทำอะไร |
|---|---|---|
| `open` | `classroomId` | เปิดคาบ (มีอยู่แล้วคืนของเดิม ไม่สร้างซ้อน) |
| `phase` | `sessionId` · `phase` · `timerSeconds` | ย้ายทั้งห้อง + ตั้งนาฬิกาในคำสั่งเดียว |
| `revert` | `sessionId` | ย้อนการย้ายช่วงล่าสุด **ภายใน 30 วินาที** เกินนั้น `409` `too-late` |
| `timer` / `extend` | `sessionId` · `seconds` / `addSeconds` | ตั้งเวลา / ปุ่ม +1 +3 +5 นาที (นับสะสมใน `timer_extended_seconds`) |
| `pause` | `sessionId` · `paused` | หยุด/เดินนาฬิกาต่อ **จากวินาทีที่ค้างไว้** ไม่ใช่เริ่มนับใหม่ |
| `focus` | `sessionId` · `on` | เรียกความสนใจ — จอเด็กขึ้นหน้าพัก "ดูจอหน้าห้องนะ" |
| `settings` | `sessionId` · `aiEnabled` · `allowEarlyBoss` · `surveyEnabled` · `homeDeadline` | ตั้งค่าของคาบ |
| `test-window` | `sessionId` · `which` (`pre`\|`post`) · `enabled` | **เปิด/ปิดแบบทดสอบ 10 ข้อ** |
| `test` | `sessionId` · `kind` (`pretest`\|`posttest`) · `enabled` | ชื่อเดิมของ `test-window` — ยังรับอยู่ให้หน้าจอเก่าไม่พัง |
| `close` | `sessionId` | ปิดคาบ (ห้องยังเปิด เด็กยังเข้าได้) |
| `unlock-student` / `lock-student` | `studentId` · `phase` · `note` | ปลดล็อก/เก็บคืนช่วงให้รายคนก่อนทั้งห้อง |

**ปลดล็อกได้เฉพาะ** `onboard` `mission` `boss` `summary` `reflect` `home` (`wait`/`end` ไม่ใช่กิจกรรมที่ทำคนเดียวได้)

⚠️ **แบบทดสอบก่อน/หลังเรียนไม่ผูกกับช่วงของคาบ** (T-12) ใช้สวิตช์ `class_sessions.pretest_enabled` / `posttest_enabled` โดยตรง
ผลที่ตั้งใจ: ครูกดเปิดแบบทดสอบแล้ว**ทั้งห้องไม่เด้งไปช่วงอื่น** และย้ายช่วงได้โดยแบบทดสอบไม่เปิดเอง
(รอบก่อนหน้าเคยผูกกับ `phase >= reflect` ชั่วคราวเพราะยังไม่มีคอลัมน์ — เลิกแล้ว)

⚠️ **ปิดคาบแล้วสั่งอะไรกับ `sessionId` ใบนั้นไม่ได้อีก** ได้ `404` `not-found`
ถ้าครูปิดคาบแล้วนึกได้ว่าลืมเปิดแบบทดสอบ **ต้องกด `open` เปิดคาบใหม่ก่อน** (ยืนยันไว้ที่โฟลเดอร์ 8 ขั้น 24)

**`GET /api/session` ฝั่งนักเรียนอ่านอย่างเดียว** · **เซิร์ฟเวอร์ส่ง "วินาทีที่เหลือ" ไปให้ ไม่ให้เบราว์เซอร์คิดเองจากนาฬิกาเครื่องตัวเอง**
· **ห้ามจับเวลารายข้อ** (สเปกข้อ 2.7) นาฬิกามีเฉพาะระดับ "ช่วงกิจกรรม"
· `restMode` เป็นหน้าพัก **ไม่ได้ล็อกเครื่อง** เด็กกด "กลับไปทำต่อ" เองได้

### 3.7 ครูปรับแผนรายคน และร่องรอยที่เก็บไว้ (T-06 · T-07)

`POST /api/teacher/student` — **ทุกการแก้ต้องเลือกเหตุผล** จาก `coached` · `device` · `level-fit` · `other`
ระบบเก็บค่าเดิม ค่าใหม่ ใครแก้ เมื่อไร ลง `teacher_overrides` เอาไปตอบกรรมการได้ว่า **"ครูแก้การตัดสินใจของระบบได้จริง ไม่ใช่ระบบสั่งครู"**

| action | ทำอะไร |
|---|---|
| `mission-level` | ปรับระดับตัวช่วยของภารกิจหนึ่งให้คนหนึ่ง |
| `allow-skip` | เปิด/ปิดสิทธิ์ข้ามภารกิจนั้น (ส่ง `allow`) |
| `skip-mission` | สั่งข้ามภารกิจนั้นให้เลย |
| `force-pass` | ให้ผ่านภารกิจนั้น |
| `scaffold` | เปลี่ยนช่องทางเรียน/ระดับตัวช่วย (ต้องส่ง `channel` หรือ `level` อย่างน้อยหนึ่งอย่าง ไม่งั้น `400`) |
| `unlock-business` | ปลดล็อกโปรไฟล์ร้านให้แก้ได้อีกครั้ง |
| `boss-template` | เปลี่ยนแม่แบบงานด่านบอส |
| `open-boss` | เปิดด่านบอสให้คนนี้ก่อน |
| `reset-pin` | ออกรหัส 4 หลักชั่วคราว — **คืนค่ากลับมาครั้งเดียวให้ครูบอกต่อ ฐานข้อมูลเก็บแต่ hash** |
| `note` | บันทึกการโค้ช (ป้าย + ข้อความ) — ไม่ใช่การแก้ค่า จึงไม่บังคับเหตุผล |

**การข้ามภารกิจมี 3 ผลที่คนละเรื่องกัน** (`POST /api/mission/:id/skip` · `core/personalize.evaluateSkip`)

| ผล | ดาว | นับว่าผ่านจุดประสงค์ |
|---|---|---|
| ข้ามเองโดยเข้าเงื่อนไข (ตอบข้อที่วัดเรื่องนี้ถูกตอนเช็กความเข้าใจ) | **3 ดาว** เท่าทำผ่านเอง | ผ่าน |
| ครูสั่งให้ข้าม (`allow-skip`) | **0 ดาว** | ผ่าน |
| ยังไม่เข้าเงื่อนไข | — | **`403` `skip-not-allowed`** |

⚠️ route นี้**ไม่อ่าน body เลยแม้แต่ฟิลด์เดียว** ยิง `{"allowed":true,"by":"teacher"}` มาก็ไม่มีผล
ที่ต้องปฏิเสธแทนที่จะปล่อยให้ข้ามแล้วให้ 0 ดาว เพราะถ้าใครก็ข้ามได้ **ตัวเลข "ผ่านจุดประสงค์" ของทั้งห้องจะเชื่อไม่ได้**
แล้วรายงาน T-10/T-11 ก็ไม่มีความหมาย

### 3.8 `GET /api/grade/status` — สถานะการตรวจงานสำหรับหน้าจอ poll

**ปัญหาที่แก้:** เด็กกดส่งใบเสนอแล้วหน้าจอเงียบ ไม่รู้ว่า "ครูอ่านหรือยัง" หรือ "ต้องแก้อะไรไหม"
ต้องรีเฟรชเองไปเรื่อย ๆ ซึ่งในคาบจริงแปลว่าเด็กนั่งจ้องจอแทนที่จะไปทำอย่างอื่นต่อ

| `state` | ความหมาย | `pollAfterSeconds` |
|---|---|---|
| `not-submitted` | ยังไม่ได้ส่งใบเสนอของภารกิจใหญ่ | `0` |
| `waiting-teacher` | ส่งแล้ว รอครูอ่าน | `10` |
| `revise` | ครูส่งกลับมาให้แก้ (ดู `revision`) | `10` |
| `confirmed` | ครูยืนยันคะแนนแล้ว | `0` |

| `aiCheck` | ความหมาย |
|---|---|
| `not-submitted` | ยังไม่มีใบเสนอ |
| `not-requested` | ใบนี้ไม่ได้ฝากเข้าคิว (ใบเก่าก่อนมีคิว) |
| `in-progress` | อยู่ในคิว หรือ worker กำลังตรวจ |
| `done` | worker เติมข้อเสนอของ AI เข้าใบงานแล้ว |
| `unavailable` | ตรวจไม่สำเร็จครบ 3 รอบ — **ไม่กระทบผู้เรียน** คะแนนจากกฎบันทึกไปตั้งแต่ตอนกดส่ง |

**เบาพอให้ poll ได้**
- อ่านฐานข้อมูล **ครั้งเดียว** (`listSubmissions`) แล้วใช้แถวชุดเดิมคิดทั้งสถานะการตรวจและสถานะใบประกาศ
  ผ่าน `certificateStandingOf(rows)` ที่เป็นตัวคิดล้วน ๆ (แยกออกมาจาก `certificateEligibility(studentId)` เพื่อการนี้)
- ไม่แตะ AI ไม่แตะคิว ไม่เขียนอะไรลงฐานข้อมูล
- **`pollAfterSeconds: 0` = จบแล้ว หน้าจอหยุดถามได้** ไม่ต้องเดาจังหวะเอง

⚠️ **ห้ามส่งคะแนนที่ AI เสนอออกมาทางนี้เด็ดขาด** คะแนนของ AI เป็นข้อเสนอ**สำหรับครู** ไม่ใช่ผลของผู้เรียน
route นี้บอกแค่ว่า "ตรวจถึงไหนแล้ว" ไม่บอกว่า AI ให้เท่าไร (เทสต์ในโฟลเดอร์ 2 และ 9 ไล่ตรวจคีย์ `aiProposed` `ruleScores` `weightedTotal` `proposedScore` ว่าต้องไม่หลุด)

⚠️ **ข้อความทั้งหมดมาจากตัวเดียวกับที่หน้าใบประกาศใช้** (`certificateStandingOf`) จึงไม่มีทางที่สองหน้าจะพูดคนละเรื่องกัน
และผ่านกติกาถ้อยคำเดียวกัน — ห้ามมีคำว่าตก/ไม่ผ่าน

---

### 3.9 คู่หูและคู่คิด — เพื่อนช่วยเพื่อน (E-04 · S-41)

```
เอกดขอเพื่อนช่วย -> ระบบเลือกคนที่เหมาะที่สุด -> ยิงคำขอ "ทีละคน" -> บีเห็นแผ่นคำขอบนเครื่องตัวเอง
   -> บีกดช่วยได้ -> รู้กันทั้งสองฝั่ง -> เอปิดใบ -> บีได้ตราพี่เลี้ยง +1
```

| Method | Path | ใครเรียกได้ | body / query | สิ่งที่คืน | status |
|---|---|---|---|---|---|
| `POST` | `/api/buddy` | นักเรียน | `missionId` (`m1`-`m4`) | `{ ok, kind, headline, request, showCard, teacherHelpAvailable, consideredCount, reason }` | `200` · `400` · `401` · `404` `student-not-found` · `503` |
| `GET` | `/api/buddy` | นักเรียน | query `screen` (ไม่บังคับ) | `{ ok, myRequest, incoming[], helping, helpedCount }` | `200` · `401` |
| `POST` | `/api/buddy/respond` | นักเรียน | `offerId` (uuid) · `accept` (bool) | รับ: `{ ok, accepted: true, missionId, requesterNickname, message }` · ปฏิเสธ: `{ ok, accepted: false, passedOn, message }` | `200` · `400` · `401` · `409` `offer-not-open` |
| `POST` | `/api/buddy/close` | นักเรียน | `requestId` (uuid) · `action` (`cancel`\|`done`) · `feedback` (`helpful`\|`ok`) · `passedAfter` (bool) | `{ ok, status, message }` | `200` · `400` · `401` · `409` `request-not-open` |

**เกณฑ์การเป็นผู้ช่วย ครบทุกข้อเท่านั้น** (`core/buddy.ts` — ตรรกะล้วน ไม่แตะฐานข้อมูล)

| เกณฑ์ | เหตุผล |
|---|---|
| ผ่านภารกิจนั้นแล้ว หรือข้ามเพราะตอบถูกตั้งแต่ตอนเช็ก | คนที่ยังไม่ผ่านช่วยอธิบายไม่ได้ (ถ้าไม่มีใครผ่านเลย จะได้ **คู่คิด** แทน) |
| ใช้งานใน **60 วินาที**ที่ผ่านมา (`students.last_seen_at`) | คนที่ลุกไปแล้วรับคำขอไม่ได้ — ต่อสัญญาณด้วย `POST /api/presence` |
| ไม่ได้อยู่ในด่านบอส · ไม่ได้กดเรียกครูค้างไว้ · ไม่ได้ปิดรับคำขอ | ห้ามรบกวนคนที่กำลังทำงานสำคัญของตัวเอง |
| กำลังช่วยอยู่ไม่เกิน 2 คน | กันคนเก่งคนเดียวรับภาระทั้งห้อง |
| ไม่ได้เพิ่งปฏิเสธผู้ขอคนนี้ไปไม่ถึง 5 นาที | ไม่ถามคนเดิมซ้ำให้อึดอัด |

**คะแนนจัดลำดับ** ผ่าน 3 ดาว +3 · ข้ามเพราะมั่นใจ +2 · ผ่าน 2 ดาว +1 · ชอบเรียนกับเพื่อน +1 · นั่งโซนเดียวกัน +1 ·
**ช่วยไปแล้วกี่ครั้ง -1 ต่อครั้ง** (กระจายภาระ) · คะแนนเท่ากันตัดสินด้วยลำดับคงที่ **ไม่สุ่ม** จึงตรวจย้อนได้

⚠️ **ยิงคำขอทีละคน ไม่ประกาศทั้งห้อง** คนที่ถูกถามมีเวลาตอบ 60 วินาที ปฏิเสธ/หมดเวลาแล้วระบบยิงต่อคนถัดไปเอง สูงสุด 3 คน
⚠️ **ผู้ขอมีใบค้างได้ครั้งละ 1 ใบ** กดซ้ำได้ `200` พร้อมใบเดิม **ไม่ใช่ `409`** เพราะการกดซ้ำไม่ใช่ความผิดของเด็ก
⚠️ **ไม่มีใครเข้าเกณฑ์ = ไม่เปิดใบ** แต่ต้องได้การ์ดคู่คิด (`showCard: true`) + `teacherHelpAvailable: true` ทันที ห้ามปล่อยจอค้าง
⚠️ **ไม่มี `studentId` ของเพื่อนคนไหนในคำตอบเลย มีแต่ชื่อเล่น**
⚠️ ตอบแทนคนอื่น/ปิดใบของคนอื่นถูกกันที่ **ฐานข้อมูล** (`helper_id` / `requester_id` อยู่ในเงื่อนไข `UPDATE`) ไม่ใช่แค่ที่ชั้น route
⚠️ `helpedCount` = **ตราพี่เลี้ยง** ไม่ใช่ดาว ไม่เอาไปเทียบกับเพื่อน และไม่ขึ้นอันดับ

### 3.10 คำขอเปลี่ยนแผน 2 ฝั่ง (S-08)

| Method | Path | ใครเรียกได้ | body / query | สิ่งที่คืน | status |
|---|---|---|---|---|---|
| `POST` | `/api/plan-request` | นักเรียน | `kind` (`level`\|`channel`\|`skip`\|`time`) · `requestedValue` · `missionId` · **`reason` 1-500 บังคับ** | `{ ok, request: { id, kind, missionId, requestedValue, reason, status, createdAt, summary }, message }` | `200` · `400` `bad-request`/`bad-value`/`reason-blocked` · `401` · `409` `duplicate-request` |
| `GET` | `/api/plan-request` | นักเรียน **หรือ** ครู | ครู: query `classroomId` (uuid บังคับ) · `all=1` เอาใบที่ตอบแล้วมาด้วย | นักเรียน: `{ ok, role: "student", requests[] }` (มี `answer` เป็นภาษาคน) · ครู: `{ ok, role: "teacher", pendingCount, requests[] }` (มี `nickname` + `reason` เต็ม) | `200` · `400` · `401` · `404` `not-found` |
| `POST` | `/api/plan-request/respond` | ครู | `requestId` (uuid) · `status` (`approved`\|`rejected`\|`changed`) · `response` (≤300) · `grantedValue` · `kind` | `{ ok, request, answer }` | `200` · `400` `bad-request`/`bad-value`/**`granted-value-required`** · `401` · `409` `request-not-open` |

**ค่าที่ขอได้** `level` 1-3 · `channel` `clip`/`card`/`game`/`buddy` · `time` **1-15 นาที** · `skip` ไม่ต้องมีค่า
กติกาอยู่ที่ `core/plan-request.ts` ที่เดียว และ**ค่าที่ครูให้ถูกตรวจด้วยกติกาตัวเดียวกัน**

⚠️ **เก็บทั้งสิ่งที่ขอ (`requested_value`) และสิ่งที่ได้จริง (`granted_value`) ห้ามเขียนทับกัน**
เพราะครูตอบว่า "ให้แบบอื่นแทน" ได้ ถ้าเหลือค่าเดียวจะตอบไม่ได้ว่าเด็กขออะไรไว้ตอนต้น
⚠️ **`changed` โดยไม่บอกว่าให้อะไรแทน = `400`** เด็กที่ได้คำตอบว่า "ครูให้แบบอื่น" แล้วไม่รู้ว่าทำอะไรต่อ แย่กว่าถูกปฏิเสธตรง ๆ
⚠️ **ใบซ้ำเป็น `409` ไม่ใช่ `500`** — unique index `plan_requests_one_pending_idx` เด้ง `23505` แล้ว route แปลงให้
⚠️ **เหตุผลที่เด็กพิมพ์ผ่านด่านกรองคำทุกครั้ง** ระดับ 2-3 บันทึกธงถึงครูในคำขอเดียวกัน (ดูหัวข้อ 3.14)
⚠️ ตอบไปแล้วตอบซ้ำไม่ได้ (`409`) — กันครู 2 คนกดพร้อมกันแล้วคำตอบของคนแรกถูกทับ
⚠️ ครูคนอื่นขอดูห้องนี้ได้ `404` (เดิมเป็น `200` + รายการว่าง แก้แล้วในรอบ T67)

### 3.11 ประเมินตนเอง 3 แหล่ง และเป้าหมายคาบหน้า (S-26 · S-32 · S-33)

ตารางเดียวที่มี 3 คอลัมน์ — **ฉันให้ตัวเอง** · **ระบบเสนอ** · **ครูยืนยัน** ครูกับผู้เรียนเห็นตารางเดียวกัน

⚠️ **คะแนนที่ผู้เรียนให้ตัวเองไม่ถูกเอาไปรวมกับคะแนนครู และไม่มีผลต่อดาวเลย**
จุดประสงค์คือฝึกมองงานตัวเองด้วยเกณฑ์เดียวกับครู ไม่ใช่การให้คะแนนตัวเอง
⚠️ **ให้ใหม่ทับของเดิมได้ตลอด** ไม่ใช่ทำได้ครั้งเดียว
⚠️ เก็บใต้คีย์ `dimensions` ของ `submissions.self_scores` **รวมกับของเดิม ไม่เขียนทับทั้งก้อน**
เพราะคอลัมน์นั้นเก็บคำตอบแบบพิมพ์ 3 ข้อของด่านบอสอยู่แล้ว (`bm-self1..3`) — เขียนทับแล้วคำตอบเด็กหาย
⚠️ `selfAwareness` (**ธงการรู้ตัว** — ใครประเมินตัวเองสูง/ต่ำกว่าครูซ้ำ ๆ) **มีแต่ในมุมของครู ไม่เคยส่งไปฝั่งผู้เรียน**
⚠️ ข้อความทุกบรรทัดมาจาก `core/self-assess.ts` ซึ่งมีเทสต์คุมว่า**ไม่มีคำตัดสิน** หน้าจอห้ามแต่งประโยคเปรียบเทียบเอง

**เป้าหมายคาบหน้า** ตัวเลือกมาจาก `content/reflection.json` คีย์ `nextGoals` (ไฟล์เนื้อหาเขียนกติกาไว้เองว่า
**ห้ามมีตัวเลือกที่เทียบกับเพื่อน**) · ตัวเลือกที่มี `allowFreeText` เปิดช่องพิมพ์เป้าของตัวเอง ยาว 4-200 ตัวอักษร
ข้อความที่พิมพ์เอง **ผ่านด่านกรองคำทุกครั้ง** · ตัวเลือกสำเร็จรูป **ใช้ข้อความจากไฟล์เนื้อหา ไม่ใช้ที่หน้าจอส่งมา**
`changeCount` นับจำนวนครั้งที่เปลี่ยนใจ — เป็นข้อมูลการกำกับตนเอง **ไม่ใช่ความผิด** · เป้าคาบหน้าไม่มีผลต่อดาวของคาบนี้

### 3.12 เรื่องราวเฉพาะคน (E-07 · S-16)

**สัญญาข้อเดียวที่ห้ามผิด: ต้องมีข้อความให้อ่านเสมอ ผู้เรียนห้ามนั่งรอ**

| สถานะ | ได้อะไร | `source` | `personalized` |
|---|---|---|---|
| AI แต่งเสร็จแล้ว | เรื่องเฉพาะร้านของตัวเอง | `ai` | `true` |
| ยังไม่เสร็จ / AI ใช้ไม่ได้ | ประโยคสำรองที่เติมชื่อร้านจริงแล้ว | `fallback` | `false` |
| ยังไม่ได้ตั้งค่าร้าน | บทเปิดกลางของภารกิจจากไฟล์เนื้อหา | `lesson-content` | `false` |

`POST /api/profile` ฝากงานแต่งเรื่องให้เองตอนตั้งค่าร้านเสร็จ (`storyQueued` ในคำตอบ) ตามสเปกข้อ 3.1 นาทีที่ 15-20
ระหว่างนั้นเด็กเดินไปทำเช็กความเข้าใจต่อ ราว 1-2 นาที **จึงไม่เคยนั่งรอเรื่องราวเลย**
`GET /api/mission/:id/story` เป็น**ตาข่ายรับ** — ไม่เคยฝากงานเลยก็ฝากให้ตรงนั้นแล้วคืนประโยคสำรองในคำขอเดียวกัน

⚠️ **ฝากซ้ำไม่บวมคิว** (`reused: true`) · ฝากไม่สำเร็จ**ไม่ใช่เรื่องที่ผู้เรียนต้องรับรู้** คืน `200` + `reason` แล้วเล่นต่อได้
⚠️ **ห้ามสลับข้อความระหว่างที่เด็กกำลังอ่าน** หน้าจอจึงควรเรียกครั้งเดียวตอนเปิดภารกิจ แล้วถือข้อความนั้นไว้
⚠️ `GET /api/story` คืนแค่ตัวนับคิว **ไม่มีเนื้อเรื่องและไม่มีรหัสนักเรียนของใคร**

### 3.13 จุดเต้นของหัวใจ และการตรวจชื่อโดเมนว่าง

**`POST /api/presence`** เขียน `students.last_seen_at` ให้เป็นปัจจุบัน — หน้าเว็บยิงทุก 30 วินาทีจากทุกหน้า
(`components/session-clock.tsx`) · `screen` บอกว่าเด็กค้างอยู่หน้าไหน ครูใช้บนแผง (T-05)

⚠️ **ถ้าไม่มีใครเขียนคอลัมน์นี้ จะไม่มีใครเข้าเกณฑ์เป็นคู่หูได้เลยสักคน โดยไม่มี error ให้เห็น** (บั๊กเงียบที่ T57 ฝากไว้)
⚠️ **เบาที่สุดในระบบโดยตั้งใจ** — เด็กทั้งห้องยิงพร้อมกัน จึงมีแค่ `UPDATE` แถวเดียว ไม่อ่านโปรไฟล์ ไม่เขียน event log
⚠️ **คืนแค่ `{ ok: true }`** ไม่คืนข้อมูลของใครเลย กันไม่ให้กลายเป็นช่องส่องเพื่อน
⚠️ ไม่ได้เข้าห้อง = `401` ซึ่งหน้าจอใช้เป็นสัญญาณ **"หยุดเต้นถาวร"** (หน้า `/join` `/teacher` จะได้ไม่ยิงเปล่าทุก 30 วินาที)

**`POST /api/domain/check`** ปุ่ม "ชื่อนี้ว่างไหม" ตรวจ 4 ชั้นตามลำดับ (ลำดับสำคัญ ดู `components/server/domain-registry.ts`)

1. ตัด URL ที่ก๊อปมาวางให้เหลือชื่อจริง แล้วบอกใน `removed` ว่าตัดอะไรไป
2. ชื่อต้องห้าม — แบรนด์คนอื่น · ชื่อในแบบฝึก · คำสงวนทางเทคนิค (`status: "reserved"`)
3. ถูกจดไปแล้วในโลกของเกม (`status: "taken-world"`)
4. เพื่อนในห้องเดียวกันจดไปก่อน — **ใครจดก่อนได้ก่อน** (`status: "taken-classroom"` + `takenByNickname`)

⚠️ **ตรวจอย่างเดียว ไม่จดให้ และไม่แก้ชื่อของเด็ก** การจดจริงเกิดตอนบันทึกโปรไฟล์ที่ `POST /api/profile`
⚠️ **ชนแล้วต้องมี `suggestions` เสมอ** ไม่ปล่อยให้เด็กค้าง · ยังไม่พิมพ์ชื่อได้ `200` + `status: "empty"` **ไม่ใช่ `400`**
⚠️ **คืนแค่ชื่อเล่นของเพื่อนที่จดไปก่อน ไม่คืนดาวหรือคะแนนของใคร**
⚠️ ชื่อเว็บก็เป็นข้อความที่เด็กพิมพ์เอง จึงผ่านด่านกรองคำก่อน — ไม่ผ่าน = `422` `content-flagged` พร้อมข้อความเดิม

### 3.14 สถิติรายข้อ · ธงคำถึงครู · ปุ่มล้างห้องสาธิต

**`GET /api/teacher/report/items`** ค่าความยาก (p) และอำนาจจำแนก (r) รายข้อ — สถิติตัวที่ 5 จาก 6 ของสเปกข้อ 9.4
เกณฑ์: ความยาก **0.20-0.80** · อำนาจจำแนก **ตั้งแต่ 0.20** · ทุกข้อมีคำแปลเป็นภาษาที่ครูใช้ตัดสินใจได้ (`verdict`)

⚠️ **แยกชุดก่อนเรียน (ชุด A) กับหลังเรียน (ชุด B) ก่อนคิดเสมอ** เป็นข้อสอบคู่ขนานคนละฉบับ
รวมกันแล้วค่าความยากทุกข้อจะกลายเป็นค่าเฉลี่ยของ "ข้อที่ครึ่งห้องไม่ได้ทำ"
⚠️ **คิดที่ `core/statistics.itemAnalysis()` ที่เดียว** ฐานข้อมูลคืนแค่ "ใครตอบข้อไหนถูก"
⚠️ **ไม่คืนเฉลยและไม่คืนตัวเลือกที่เด็กกด** เพราะ (รหัสข้อ + ตัวเลือก + ตอบถูก) = เฉลยข้อนั้น
⚠️ `groupSize` = กลุ่มสูง/กลุ่มต่ำกลุ่มละกี่คน (27% ของผู้ทำ) — ห้องเล็กได้กลุ่มละ 1 คน ทำให้ r มีได้แค่ -1/0/1 ครูต้องรู้ก่อนตีความ

**ธงคำถึงครู (E-11)** ตารางการตัดสินของ `reviewStudentText()`

| สิ่งที่เจอ | ระบบทำอะไร | ครูเห็นไหม |
|---|---|---|
| ข้อมูลส่วนตัว (เบอร์โทร ที่อยู่) | ไม่รับ บอกให้เอาออก | **ไม่แจ้งครู** (ตามตารางในสเปก) |
| ระดับ 1 | ไม่รับ ชวนเปลี่ยนคำ | ไม่แจ้งครู (บันทึกสถิติ) |
| ระดับ 2 | ไม่รับ | **แจ้งครู** พร้อมข้อความ**ปิดบางส่วน** |
| ระดับ 3 | ไม่รับ | **แจ้งครู** พร้อมข้อความเต็ม (ต้องถึงแผงครูใน 3 วินาที) |

**ข้อความเดิมของเด็กถูกส่งกลับไปให้เห็นเสมอ (`original`) ห้ามกลืนหาย** และ**ไม่มีการแก้ข้อความของเด็กให้**

**`POST /api/teacher/demo-reset`** ปุ่มล้างห้องสาธิตกลับค่าเริ่มต้น (E-16) — **ด่าน 3 ชั้น ด่านล่างสุดคือตัวจริง**

1. คุกกี้ครู (`teacherId` ไม่เคยรับจาก body)
2. `roomCode` ในคำขอต้องตรงกับรหัสห้องจริง = **การยืนยัน** (ไม่ตรง = `400` `confirm-mismatch` และ**ไม่ลบอะไรเลย**)
3. `reset_demo_classroom` ในฐานข้อมูล**ปฏิเสธห้องที่ไม่ได้ติดป้าย `is_demo`** → ห้องเรียนจริงล้างไม่ได้แม้ยิง API ตรง ๆ

⚠️ **ขั้นนี้ใน Postman ถูกปิดไว้เป็นค่าเริ่มต้น** (`allowDemoReset=0`) เพราะมันลบนักเรียนทั้งห้องเดโมจริง ๆ
ซึ่งจะทำให้ session อื่นที่กำลังทดสอบบนห้องนั้นหลุดกลางทาง · เคสที่ถูกปฏิเสธทั้งหมดเปิดไว้ตามปกติเพราะไม่ลบอะไร

## 4. กฎที่ทุก endpoint ต้องเคารพ

### 4.1 อ่านตัวตนจากคุกกี้เท่านั้น ห้ามเชื่อ id จาก body หรือ query

`studentId` และ `teacherId` ต้องมาจากคุกกี้ที่เซ็นไว้เท่านั้น **ห้ามอ่านจาก body หรือ query string เด็ดขาด**
ถ้ารับจาก body นักเรียนจะสวมรอยเป็นเพื่อนแล้วยิงคะแนนให้ตัวเองหรือคนอื่นได้

- อ่านผ่าน `readStudentSession()` / `readTeacherSession()` ใน `app/api/_lib/session-cookie.ts` เท่านั้น
- ไม่มี schema ของ route ไหนมีช่อง `studentId` หรือ `teacherId` เลย ค่าที่ส่งมาจึงถูก zod ตัดทิ้งเงียบ ๆ
  จึงได้ `200` ไม่ใช่ `400` — **ค่าส่วนเกินไม่มีผล ไม่ใช่ค่าส่วนเกินทำให้ request พัง**
- **ไม่มี route ฝั่งนักเรียนไหนอ่าน `searchParams` เลย** (`/api/certificate` เป็นตัวอย่างที่ชัดที่สุด)
  ต่อ `?company=1` หรือ `?studentId=` ท้าย URL แล้วไม่มีผลใด ๆ

**ข้อยกเว้นที่รับ id จากภายนอกได้ และเงื่อนไขที่ต้องทำคู่กัน**
`classroomId` (ฝั่งครู) และ `submissionId` (ยืนยันคะแนน) รับจาก body/query ได้
แต่ทุกคำสั่งต้องใส่ `teacher_id = <คนที่ถือคุกกี้>` ลงไปใน query เดียวกัน **ไม่ใช่ "ค้นก่อนแล้วเช็กทีหลัง"**
ดู `listClassroomBoard(teacherId, classroomId)` · `setClassroomStatus(teacherId, ...)` · `closeClassroom(teacherId, ...)` · `confirmSubmissionScores(teacherId, ...)`
· `listClassroomVoiceSubmissions(teacherId, classroomId)` · `getSignedVoiceUrl(teacherId, voiceId)` · `deleteVoiceSubmission(teacherId, voiceId)` ใน `lib/db/repo.ts`
ไม่ใช่เจ้าของจะได้ `null` / 0 แถว แล้ว route ตอบ `404`

**ตอบ `404` ไม่ใช่ `403` โดยเจตนา** เพราะ `403` เท่ากับบอกว่า "ห้อง/งาน id นี้มีอยู่จริงแต่ไม่ใช่ของคุณ" ทำให้ไล่เดา id ของคนอื่นได้

**ยืนยันด้วยครูจริงใบที่สอง ไม่ใช่แค่ id ปลอม** โฟลเดอร์ 5 ให้ครู B ที่ล็อกอินจริงยิงไปที่ห้องของครู A ที่มีข้อมูลจริง
ครบทั้ง 5 ทาง — ดูแผงโค้ช · ยืนยันคะแนนรายด้าน · ฟังไฟล์เสียง · สั่งลบไฟล์เสียง · สั่งปิดห้อง — **ได้ `404` ทุกทาง**

### 4.2 ค่าที่ชี้ผลลัพธ์ต้องอ่านและคิดที่ฝั่งเซิร์ฟเวอร์

- `POST /api/profile` เป็น**จุดเดียว**ที่เบราว์เซอร์ส่งข้อมูลร้านเข้ามาได้ และล็อกทันทีที่เริ่มเล่น
- `/api/station-b/submit` รับแค่ `tldId` กับ `reasonText` — ยัด `shopProfile` หรือ `isRegisteredCompany` มาก็ไม่มีผล
- ตัวนับ `attempts` / `hintsUsed` และ `stars` เพิ่มและคิดที่เซิร์ฟเวอร์ ห้ามรับตัวเลขจากเบราว์เซอร์ รีเฟรชแล้วต้องไม่รีเซ็ต
- เฉลยห้ามหลุดไปฝั่งเบราว์เซอร์ ตอบผิดต้องไม่ส่ง `explanation` / `starCriteria` / `wrongIds` / ตำแหน่งช่องที่ผิดในเกม
- คะแนนจาก AI เป็น**ข้อเสนอ** ครูยืนยันเสมอ

### 4.3 `service_role` ห้ามออกจากฝั่งเซิร์ฟเวอร์

- ใช้ได้เฉพาะใน route handler ฝั่งเซิร์ฟเวอร์ ผ่าน `getServiceClient()` ใน `lib/db/client.ts`
- `lib/db/client.ts` มี `assertServer()` ที่เช็ก `typeof window !== 'undefined'` แล้ว throw — เรียกทั้งตอน module โหลดและทุกครั้งที่เรียก `getServiceClient()`
- การตรวจรหัสผ่านครูใช้ anon key ไม่ใช่ `service_role`
- ห้าม import `lib/db/*` หรือ `components/server/*` จาก client component

### 4.4 ห้ามตั้งชื่อ env ขึ้นต้น `NEXT_PUBLIC_` ให้ความลับ

Next.js **ฝังค่าของ env ที่ขึ้นต้น `NEXT_PUBLIC_` ลงไฟล์ฝั่งเบราว์เซอร์** ทุกคนที่เปิดหน้าเว็บอ่านได้
ห้ามใช้คำนำหน้านั้นกับ `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `SUPABASE_DB_URL`, `GEMINI_API_KEY`, `TYPHOON_API_KEY`, **`GRADE_WORKER_SECRET`**, `DEMO_MODE` หรือความลับใด ๆ

⚠️ `GRADE_WORKER_SECRET` **ยังไม่มีชื่อใน `.env.example`** ทั้งที่โค้ดอ่านค่านี้อยู่ (`app/api/jobs/drain/route.ts`)
คนที่ตั้งเครื่องใหม่จะไม่รู้ว่าต้องตั้ง — เจ้าของไฟล์ควรเพิ่ม **ชื่อตัวแปรกับค่าว่าง** ลงไป (ห้ามใส่ค่าจริง)

**คีย์ทุกตัวอยู่ใน `.env.local` เท่านั้น** และ:
- ห้าม `cat` / `echo` / `grep` หรือแสดงค่าคีย์ในเทอร์มินัล log ไฟล์ผล `bus.md` เอกสาร หรือ collection — **ต่อให้บางส่วนก็ห้าม**
- ห้ามเขียนลง `.env.example` (ใส่ได้แค่ชื่อตัวแปรกับค่าว่าง)
- คีย์ AI ถูกอ่านเฉพาะใน `lib/ai/*` ฝั่งเซิร์ฟเวอร์ และไม่เคยถูกส่งกลับไปในคำตอบของ API เลย
  response บอกแค่ `provider` (ชื่อผู้ให้บริการ) ไม่ใช่คีย์

`SESSION_SECRET` ต้องยาวอย่างน้อย 32 ตัวอักษร และอ่าน**ตอนเรียกใช้ ไม่ใช่ตอน import** เพื่อให้ build บนเครื่องที่ไม่มี env ไม่พังทั้ง build

### 4.5 กฎย่อยที่โค้ดยึดอยู่แล้ว

- **รูปแบบ error เดียวกันทุก route** คือ `{ error, message }` ใช้ `errorResponse()` / `unauthorized()` ไม่ throw ดิบ
- **อ่าน body ด้วย `readJsonBody()`** ที่ `.catch(() => null)` เพื่อให้ body ที่ไม่ใช่ JSON กลายเป็น `400` ไม่ใช่ `500`
- **ตรวจ schema ก่อนแตะฐานข้อมูล** ทุก route ใช้ zod `safeParse` ก่อนเสมอ
- **เช็กคุกกี้ก่อนเช็ก body ทุกครั้ง** ไม่มีคุกกี้ต้องได้ `401` ก่อนไปถึงการตรวจรูปแบบและก่อนโหลดเฉลย
- **ข้อความ error ห้ามบอกว่าอะไรมีอยู่จริง** ทั้งรหัสห้อง ชื่อเล่น อีเมลครู id ห้อง และ id งาน
- **ทุก route ตั้ง `runtime = 'nodejs'` และ `dynamic = 'force-dynamic'`** เพราะต้องอ่านคุกกี้และห้ามถูก cache

---

## 5. ข้อควรระวังเรื่องไฟล์เนื้อหา

หลายไฟล์ใน `components/server/` และ `components/missions.ts` เรียก `Schema.parse(...)` **ตอน module โหลด** ไม่ใช่ตอนเรียกฟังก์ชัน
ผลคือถ้าไฟล์ใน `content/` ไม่ตรง schema **ทุก route ที่ import ไฟล์นั้นจะตอบ `500` ทั้งหมด** ก่อนโค้ดใน handler ได้ทำงานเลย

เจอมาแล้ว 2 ครั้ง (ทั้งคู่ถูกแก้แล้ว):
1. `content/missions.json` ภารกิจ `m4` ตั้ง `channels.game.kind` เป็น `"order"` ที่ไม่อยู่ใน `GAME_KINDS` → `/api/hint` กับ `/api/mission/:id/check` พัง
2. `content/reflection.json` `goalCompare[0]` ขาดช่อง `message` และ `goalCompare[2]` ใช้ `id` เป็น `compare-above` แต่ schema ต้องการ `compare-exceeded` → `/api/profile/preferences` `/api/profile/choice` `/api/ceo` `/api/reflect` พัง

รูปแบบความพังนี้จะกลับมาได้ทุกครั้งที่แก้ไฟล์ `content/`
collection จึงใส่ guard ไว้: request ที่พึ่งไฟล์เนื้อหาจะรายงานชัดว่า `500`/`503` มาจาก schema ของไฟล์เนื้อหา ไม่ใช่ collection เขียนผิด

**อาการที่ควรนึกถึงทันที:** endpoint หลายตัวพร้อมกันตอบ `500` ทั้งที่ไม่ได้แก้ route เลย → ไปดู log ของ `next dev` หา `ZodError` แล้วอ่านว่า path ไหนของไฟล์เนื้อหาไม่ตรง

---

## 6. เตรียมเครื่องก่อนยิงทดสอบ

```bash
npm run db:start                      # Supabase local
npx tsx scripts/seed-demo.ts          # ครู 1 คน + ห้อง QUEST9 + นักเรียน 3 คน (idempotent)
npm run dev
```

ข้อมูลเดโมมาจาก `scripts/seed-demo.ts` — รหัสห้อง (`QUEST9`) อีเมลครู รหัสผ่าน และ PIN เป็นค่าคงที่ในไฟล์นั้น
seed เปิดห้องกลับเป็น `open` ทุกครั้งที่รัน จึงใช้กู้สถานะได้เมื่อห้องถูกล็อกหรือปิดไปจากการทดสอบ

**env ที่ไม่ใช่ความลับและปรับได้** `CLASSROOM_MAX_STUDENTS` = เพดานจำนวนนักเรียนต่อห้อง (ไม่ตั้ง = 60 · ดูหัวข้อ 2.1)
ตั้งเป็นจำนวนเต็มบวกเท่านั้น ค่าเพี้ยนจะตกกลับไปใช้ 60 แทนที่จะกลายเป็น 0 แล้วล็อกทั้งห้องไว้ข้างนอก

⚠️ **ชุดทดสอบกินที่นั่งในห้องเดโม** — รัน collection เต็มหนึ่งรอบสร้างนักเรียนใหม่ **~12 คน** ในห้อง `QUEST9`
ห้องเดโมเริ่มที่หุ่น 20 คน จึงรันติดกันได้ราว **3 รอบ** ก่อนชนเพดาน 60 แล้วได้ `409` `room-full`
เจอแล้วให้รัน `npx tsx scripts/seed-demo.ts` ใหม่ — สคริปต์ล้างห้อง `QUEST9` แล้วเรียงหุ่น 20 คนกลับให้เหมือนเดิม
(ถ้ามี session อื่นกำลังทดสอบอยู่บนห้องนี้ ให้ถามก่อน เพราะการล้างจะลบนักเรียนที่เขากำลังใช้ไปด้วย)

> ⚠️ **ห้ามรัน `supabase db reset` หรือคำสั่งที่ล้างฐานข้อมูล** โดยไม่ได้รับอนุญาตจาก master
> ระหว่าง QA เล่นจริง การล้าง DB กลางคันทำให้นักเรียนที่กำลังทดสอบหลุด `401` ทั้งห้อง
> `scripts/seed-demo.ts` ปลอดภัย เพราะเป็น upsert ไม่ลบข้อมูลเดิม

**ถ้าจะให้เทสต์ "ครู B แตะห้องครู A ไม่ได้" ทำงานจริง ต้องสร้างบัญชีครูใบที่สองก่อน (ครั้งเดียว)**

```bash
SEED_TEACHER_EMAIL=teacher.b@digital-biz.local \
  SEED_TEACHER_PASSWORD=<ตั้งเอง> \
  SEED_ROOM_CODE=QUESTB \
  npx tsx scripts/seed-production.ts
```

สคริปต์นี้เขียนอย่างเดียว รันซ้ำได้ ไม่ล้างฐานข้อมูล · ไม่ทำก็ได้ เทสต์ชุดนั้นจะถูก**ข้าม** ไม่ใช่ตก

รันชุดทดสอบ — **ต้องรันจากรากโปรเจกต์** เพราะโฟลเดอร์ 2 แนบไฟล์ `postman/sample-voice.webm`:

```bash
npx newman run postman/digital-biz-quest.postman_collection.json \
  -e postman/local.postman_environment.json \
  --env-var teacherPassword=<รหัสผ่านครูของ seed> \
  --env-var teacherPassword2=<รหัสผ่านครูใบที่สอง ถ้ามี>
```

⚠️ ไฟล์ environment **ไม่เก็บรหัสผ่านหรือคีย์ใด ๆ** `teacherPassword` / `teacherPassword2` เว้นว่างไว้โดยเจตนา ต้องกรอกเองหรือส่งผ่าน `--env-var`

**โฟลเดอร์ใน collection**

| โฟลเดอร์ | ใช้ตอนไหน |
|---|---|
| 1-นักเรียนเข้าห้อง | ขั้นเข้าห้อง + เคสรหัสผิด/ห้องผิด |
| 2-เล่นภารกิจ | ไล่ทุก endpoint ฝั่งนักเรียนทีละอัน เพื่อดูสัญญาของแต่ละตัว |
| 3-ครู | เปิดห้อง ดูแผงโค้ช ยืนยันคะแนนรายด้าน ฟัง/ลบไฟล์เสียง สั่ง worker ล็อก/ปิดห้อง · **ออกจากระบบแล้วล็อกอินกลับ** (4 ขั้นท้ายโฟลเดอร์) |
| 4-ระบบ | health check + เคส validation |
| **5-ทดสอบว่าโกงไม่ได้** | หลักฐานความปลอดภัย — ใช้สาธิตบนเวที **ต้องเขียว 100%** |
| **6-เดินครบคาบ** | เส้นทางที่นักเรียนเจอจริง กด Run ทีเดียวจบทั้งคาบ — ใช้สาธิตบนเวที **ต้องเขียว 100%** |
| **7-คิวตรวจเบื้องหลัง** | หลักฐานว่าผู้เรียนไม่ต้องรอ AI — ใช้สาธิตบนเวที **ต้องเขียว 100%** |
| **8-ครูคุมคาบ** | ครูคุมช่วงและเวลาตลอดคาบ — ใช้สาธิตบนเวที **ต้องเขียว 100%** |
| **9-ลูปแก้งาน** | ครูสั่งแก้ → เด็กแก้ → ครูยืนยัน → ใบประกาศออก — ใช้สาธิตบนเวที **ต้องเขียว 100%** |
| **10-ขอความช่วยเหลือ** | คู่หูครบวง · คำขอเปลี่ยนแผน 2 ฝั่ง · ธงคำถึงครู — ใช้สาธิตบนเวที **ต้องเขียว 100%** |

โฟลเดอร์ 6 7 8 9 10 **รันเดี่ยวได้** เพราะขั้นแรกสร้างนักเรียน (และห้อง) ของตัวเองให้เอง · โฟลเดอร์ 2-5 ต้องรันเรียงจากโฟลเดอร์ 1

**ทุกชื่อเล่นและชื่อโดเมนในชุดทดสอบสุ่มใหม่ทุกครั้งที่กด Run** เพราะ 3 กติกานี้ทำให้ค่าคงที่ใช้ซ้ำไม่ได้:

1. `/api/join` จำกัดการลองผิด **5 ครั้ง/10 นาที ต่อคู่ (รหัสห้อง + ชื่อเล่น)** — ชื่อคงที่ทำให้รันรอบที่ 3 เจอ `429`
2. **ชื่อโดเมนห้ามซ้ำในห้อง** (S-23 · E-06 ใครจดก่อนได้ก่อน) — ชื่อคงที่ทำให้รอบที่ 2 เจอ `409` `domain-taken`
3. **โปรไฟล์ร้านล็อกทันทีที่เริ่มเล่น** — ใช้คนเดิมทำให้เจอ `409` `profile-locked`

สุ่มด้วย `Date.now().toString(36)` **ไม่ใช่ตัวเลขล้วน** เพราะตัวกรองคำ (E-11) มองเลขยาวติดกันว่าเป็นข้อมูลส่วนตัว แล้วตอบ `422` `content-flagged`

⚠️ โฟลเดอร์ 7 มีขั้น `POST /api/jobs/drain` ที่**ช้าได้เป็นสิบวินาที** ไม่ใช่ค้าง (งบเวลาฝั่งเบื้องหลังคือ 60 วินาทีต่องาน)

---

## 7. วิธีอัปเดตไฟล์นี้เมื่อ route เปลี่ยน

`app/api/` ถูกแก้อยู่ตลอดโดยหลาย session เอกสารนี้จะเก่าเร็ว ทำตามลำดับนี้แล้วจะไม่หลุด

1. **ดูว่ามี route อะไรอยู่จริงบ้าง** — ห้ามเดาจากเอกสารเก่า
   ```bash
   find app/api -name route.ts | sort
   ```
2. **ดูว่าแต่ละไฟล์ export method อะไร และอ่านตัวตนจากไหน**
   ```bash
   for f in $(find app/api -name route.ts | sort); do
     echo "--- $f"
     grep -n "export async function [A-Z]*\|readStudentSession\|readTeacherSession" "$f"
   done
   ```
3. **อ่าน `const RequestSchema = z.object({...})` ของ route นั้น** คือ body ที่รับจริง — ช่องที่ไม่อยู่ใน schema ถูกตัดทิ้งเงียบ ๆ
4. **ไล่ `errorResponse(...)` และ `NextResponse.json(..., { status })` ทุกจุดในไฟล์** คือ status code ที่เป็นไปได้จริงทั้งหมด
5. **แก้ตารางในหัวข้อ 2** ให้ตรง แล้วแก้ description ของ request ใน collection ให้ตรงกัน
6. **ยิงจริงแล้วดูของที่คืนมา** อย่าเชื่อ type ใน repo อย่างเดียว เพราะ route อาจ reshape ก่อนส่งออก
   ```bash
   npx newman run postman/digital-biz-quest.postman_collection.json \
     -e postman/local.postman_environment.json \
     --env-var teacherPassword=<รหัส> --reporters cli
   ```
7. **แยกสาเหตุที่ assertion ตกให้ชัดเจน 3 แบบ** แล้วบันทึกไว้:
   - **route ยังไม่มี / ยังพัง** → ติดป้ายชื่อ request ว่า `(ยังไม่พร้อม)` และใส่ guard ไว้
   - **route เปลี่ยนรูปแบบ** → ติดป้ายว่า `(ต้องตรวจซ้ำ)` แล้วแก้ assertion ตามของจริง
   - **collection เขียนผิด** → แก้ collection ทันที ไม่ต้องติดป้าย
8. **โฟลเดอร์ 5 · 6 · 7 · 8 · 9 · 10 ต้องเขียว 100% เสมอ** ใช้สาธิตสดบนเวที
   ถ้าโฟลเดอร์ 5 ตก ให้ถือเป็นงานด่วน เพราะแปลว่าอาจมีช่องโหว่จริง ไม่ใช่แค่เอกสารไม่ตรง
9. **ปิด dev server เมื่อเสร็จทุกครั้ง** ห้ามเปิดทิ้งไว้

**จุดที่เปลี่ยนบ่อยและควรเช็กก่อนเสมอ**
ชื่อคุกกี้ · รูปแบบ row ของ `/api/teacher/board` · ช่องบังคับของ `/api/station-b/submit` · เงื่อนไขล็อกโปรไฟล์ · ช่อง `source` ของ endpoint ที่เรียก AI · ลำดับที่ต้องยิงก่อนหลัง

**กับดักที่เคยเจอตอนเขียน collection**
- **ค่าตัวเลขที่ส่งผ่านตัวแปร Postman** ต้องไม่มีเครื่องหมายคำพูดครอบใน raw JSON (`"level": {{var}}` ไม่ใช่ `"level": "{{var}}"`) ไม่งั้น zod ปัดตกเป็น `400`
- **ตัวแปรใน environment มีลำดับสูงกว่า collection** `pm.collectionVariables.set()` จะถูกค่าใน environment ทับ ถ้าต้องเขียนทับค่าที่มีใน environment ให้ใช้ `pm.environment.set()`
- **เทสต์ที่พึ่ง rate limit ต้องสุ่มชื่อใหม่ทุกรอบ** เพราะ bucket เก็บในหน่วยความจำของเซิร์ฟเวอร์และอยู่ยาว 10 นาที รันรอบสองจะเจอ bucket เดิมที่เต็มแล้ว
- **cookie jar ของ Postman ถือคุกกี้นักเรียนและครูไว้พร้อมกัน** ซึ่ง**เบราว์เซอร์จริงไม่เป็นแบบนั้น**
  เส้นที่ตอบคนละอย่างตามบทบาท (`GET /api/plan-request` · `GET /api/self-assess`) จะเข้าทางของครูเสมอถ้ายิงตรง ๆ
  แล้วขอ `classroomId`/`studentId` → ได้ `400` ทั้งที่ระบบทำถูก
  วิธีที่ collection ใช้: อ่าน token จาก jar แล้วยิงไปที่ `{{baseUrlNoCookie}}` พร้อมแนบ `cookie: dbq_student=<token>` ใบเดียว
  (ดูขั้น 24 · 29 ของโฟลเดอร์ 10 และขั้นประเมินตนเองในโฟลเดอร์ 9)
- **เทสต์เรื่องบทบาทต้องสวม token ข้ามช่อง ไม่ใช่แค่ "ใช้คุกกี้นักเรียนยิงเส้นครู"** ด้วยเหตุผลข้อบน
- **คิวตรวจงานมี worker ได้ครั้งละตัวต่อ process** (`inFlight` ใน `components/server/grade-queue.ts`)
  `POST /api/jobs/drain` ที่ชนกับ worker เบื้องหลังจะได้ `skipped: true` · `processed: 0` ซึ่ง**ไม่ใช่ข้อผิดพลาด**
  โฟลเดอร์ 7 จึงยิงซ้ำเป็นระยะจนกว่าจะตรวจได้หรือคิวว่าง (ขั้น 12) แล้วรอให้งานพ้น `pending-ai` ก่อนให้ครูยืนยัน (ขั้น 13ข)
- **ขั้นที่ลบคุกกี้ต้องอยู่ท้ายโฟลเดอร์ แล้วล็อกอินกลับเสมอ** `POST /api/teacher/logout` ลบคุกกี้ครูออกจาก jar จริง
  ถ้าวางไว้กลางโฟลเดอร์ 3 ทุกขั้นที่เหลือ **และทั้งโฟลเดอร์ 5** จะแดงยกชุดเพราะ `401` ไม่ใช่เพราะมีช่องโหว่
  (4 ขั้นท้ายโฟลเดอร์ 3 = ไม่มีคุกกี้ 401 → มีคุกกี้ 200 → ยิงเส้นครูต่อได้ 401 → ล็อกอินกลับ)
- **`scripts/seed-demo.ts` ตัวใหม่ล้างห้อง `QUEST9` ตอนรันซ้ำ** ถ้ามีใครรันระหว่างที่ newman กำลังเดิน
  นักเรียนของรอบนั้นจะหายกลางทาง แล้วเจอ `401`/`404` ต่อกันเป็นโดมิโนโดยที่ไม่มีอะไรพังจริง
  เจออาการนี้ให้เช็ก `students.created_at` ของหุ่นในห้องก่อนไล่หาบั๊ก

---

## 8. บั๊กที่รู้แล้วแต่ยังไม่แก้ (พบจากการยิงจริง 30 ก.ย. 2569)

### 8.1 ~~`/api/teacher/screen` และ `/api/teacher/showcase` พังเมื่อห้องมีนักเรียนเยอะ~~ — **แก้แล้ว 30 ก.ย. 2569**

**อาการ:** ทั้งสอง route ตอบ `500` เมื่อห้องมีนักเรียนเกินราว 200 คน
ข้อความใน log คือ `[db] listClassroomFeedback ล้มเหลว: URI too long` และ `classroomScreenStats(passed): ` (ข้อความว่าง)

**สาเหตุ:** query ประกอบ `.in('student_id', ids)` จาก uuid ของนักเรียน**ทุกคน**ในห้อง
uuid ยาว 36 ตัวอักษร คูณ 200 คน ทำให้ URL ของ PostgREST ยาวเกินเพดานของเซิร์ฟเวอร์
ดู `components/server/classroom-screen.ts` บรรทัดที่เรียก `.in('student_id', ids)` และ `listClassroomFeedback` ใน `lib/db/repo.ts`

**ผลกระทบจริง:** ห้องเรียนจริง 30-40 คน**ไม่เจอ** แต่ **ฐานข้อมูล QA ที่รันชุดทดสอบซ้ำ ๆ เจอแน่**
(ชุดทดสอบสร้างนักเรียนใหม่ทุกครั้งที่รัน) และถ้าวันหนึ่งเอาไปใช้กับห้องรวมหลายห้องก็จะเจอเหมือนกัน

**ทางแก้ที่เสนอ:** ย้ายไป `join` ใน SQL หรือทำ RPC ที่รับ `classroom_id` ตัวเดียว
แทนการส่ง id ทั้งก้อนผ่าน query string

**แก้แล้ว** — ฝั่งเจ้าของย้ายไปใช้ RPC (`classroom_peer_feedback` ฯลฯ) ที่รับ `classroom_id` ตัวเดียว
แทนการส่ง id ทั้งก้อนผ่าน query string · ยืนยันด้วย newman: โฟลเดอร์ 3 เขียวครบแล้วบนห้องที่มีนักเรียน 300+ คน
เก็บหัวข้อนี้ไว้เป็นบันทึกว่าเคยพังยังไง จะได้ไม่มีใครเผลอเขียน `.in('student_id', ids)` กลับมาอีก

### 8.2 ~~`GRADE_WORKER_SECRET` ยังไม่มีชื่อใน `.env.example`~~ — **แก้แล้ว**

มีชื่อตัวแปรกับค่าว่างใน `.env.example` แล้ว พร้อมคำอธิบายว่าสร้างค่าใหม่อย่างไร
(**ห้ามใส่ค่าจริงลงไฟล์นี้** เพราะถูก commit ขึ้น git)

### 8.3 ~~`focusRubricId` กับ `emphasisDimensionId` ใช้คนละชุด id~~ — **แก้แล้ว**

`toRubricDimensionId()` ใน `components/server/lesson-content.ts` รับได้ครบทั้ง 3 ชุด (`dim-*` · `bm-r*` · `emphasis-*`)
พร้อมคู่แฝด `toEmphasisOptionId()` และเทสต์ล็อกไว้ที่ `components/server/rubric-id.test.ts`
`app/api/teacher/confirm-score` ลบตารางแม็ปของตัวเองทิ้งแล้ว หันมาเรียกตัวแปลงกลาง — **ตัวแปลงมีที่เดียวจริง ๆ**
ส่ง `bm-r2` ตรง ๆ ได้ `200` แล้ว และบันทึกลงฐานข้อมูลเป็น `dim-*` เสมอ

### 8.4 ~~`changedDimensions` รายงานว่าเปลี่ยนครบ 4 ด้านเสมอ~~ — **แก้แล้ว**

ต้นเหตุมีสองชั้น: อ่าน `ai_scores.dimensions` (array) เป็น map จึงได้ `undefined` ทุกตัว
และไม่มีที่เก็บ "คะแนนที่ครูยืนยันไว้ครั้งก่อน" ให้เทียบเลย
แก้ด้วย migration `20261001290000_teacher_scores_before` เพิ่มคอลัมน์ `submissions.teacher_scores_before`
แล้วให้ `confirm_submission_scores` เก็บค่าครูเดิมไว้ก่อน `UPDATE` · route เทียบกับค่านั้นเป็นหลัก ครั้งแรกค่อยเทียบกับกฎ
ความหมายของช่องนี้จึงเปลี่ยนเป็น **"ครูแก้ด้านไหนรอบนี้"** และมี `changedFrom` + `previousTeacherScores` มาด้วย (ดูหัวข้อ 3.7)

### 8.5 `GET /api/grade/status` มีแล้ว — ~~ไม่มี endpoint ให้ครูดู `gradingStatus` แบบสด ๆ~~ **แก้บางส่วน**

ฝั่ง**ผู้เรียน**ดูสถานะการตรวจงานของตัวเองได้แล้วที่ `GET /api/grade/status` (หัวข้อ 3.8)
ฝั่ง**ครู** ยังไม่มีทางดู `gradingStatus` ของทั้งห้องแบบสด ๆ — แผงครูยังเห็นแค่ `source`/`sourceLabel` ของคะแนนจากกฎ
ถ้าอยากให้แผงครูโชว์ "รอ AI อยู่ / AI เสนอมาแล้ว" ต้องเติมช่องนั้นใน `/api/teacher/board` (ของอีก session)

### 8.6 ~~`GET /api/me/showcase` รวมงานของตัวเองมาด้วย~~ — **แก้แล้ว**

SQL function `classroom_showcase` ใช้ `p_student_id` แค่ยืนยันว่าอยู่ห้องนี้จริง (คนนอกห้องได้ `[]`) ไม่ได้กรองเจ้าของออก
route จึงตัดงานของตัวเองออกอีกชั้นด้วยชื่อเล่น แล้วบอกจำนวนที่ตัดไปใน `ownHidden` (ดูหัวข้อ 2.4)
ที่ไม่แก้ที่ SQL เพราะ `supabase/` เป็นของอีก session · ถ้าวันหนึ่งเติม `and st.id <> p_student_id` ที่ SQL
ตัวกรองในrouteจะไม่มีอะไรให้ตัดออกและไม่พังอะไร

### 8.7 ~~`POST /api/join` ยิงรัวได้ไม่จำกัด สร้างนักเรียนใหม่ทุกครั้ง~~ — **แก้แล้ว**

UAT-3 ยิงชื่อเดิม 9 ครั้งติดได้ `200` ทั้ง 9 ครั้ง และเกิดแถวนักเรียนจริง 9 แถว
เพราะ 3 เรื่องรวมกัน: ล้างตัวนับเมื่อเข้าสำเร็จ · ชื่อซ้ำเติมเลขท้ายให้เอง (จึง "สำเร็จ" เสมอ) · ไม่มีเพดานคนต่อห้อง
ปิดครบทั้ง 3 ชั้นแล้ว — กติกาเต็มอยู่ที่หัวข้อ **2.1** · ยิงซ้ำการทดลองเดิม 10 ครั้งตอนนี้ได้
`200` ครั้งเดียว → `409` `nickname-taken` 4 ครั้ง → `429` ตั้งแต่ครั้งที่ 6 และเกิดแถวนักเรียน **1 แถว**

**ยังเหลือ 2 เรื่องที่ต้องให้ session อื่นทำ**

1. **ครูยังไม่มีปุ่มล้างรายชื่อขยะ** ถ้าเกิดเหตุขึ้นจริงกลางคาบ · `repo.removeStudent()` (ตรวจเจ้าของห้องแล้ว) กับ
   `DELETE /api/teacher/classroom` (ลบทั้งห้อง) มีอยู่แล้ว แต่ยังไม่มีเส้น "ลบนักเรียนรายคน" บนแผงครู — ไฟล์ครูเป็นของอีก session
2. **เพดานยังตั้งได้แค่ระดับเซิร์ฟเวอร์** (`CLASSROOM_MAX_STUDENTS`) ยังไม่ใช่รายห้องที่ครูกดตั้งเองได้
   ต้องมีคอลัมน์ `classrooms.max_students` (`supabase/`) + ช่องบนหน้าครู (`app/teacher/**`) ซึ่งอยู่นอกขอบเขตรอบนี้ทั้งคู่
   `classroomCapacity(override)` เปิดพารามิเตอร์รอไว้แล้ว พอมีคอลัมน์ก็ส่งค่าเข้าไปได้เลยโดยไม่ต้องแก้ตัวเรียก

### 8.8 `GET /api/mission/:id/story` ใช้รูปคำตอบ error ไม่เหมือนที่อื่น — **ยังไม่แก้ (เล็ก)**

ทั้งระบบใช้ `{ error, message }` แต่เส้นนี้คืน `{ ok: false, code, message }` ตอน `404`
ไม่ใช่ช่องโหว่และไม่มีข้อมูลรั่ว แต่ทำให้คนเขียนหน้าจอต้องจับสองรูปแบบ
เทสต์ในโฟลเดอร์ 2 จึงยอมรับทั้ง `body.code` และ `body.error` เพื่อไม่ให้แดงตอนเจ้าของไฟล์แก้ให้ตรงกับที่อื่น
**จุดที่ต้องแก้:** `app/api/mission/[id]/story/route.ts:42`

### 8.9 ข้อสำรอง (S-20) มีตรรกะและหน้าจอแล้ว แต่**ยังไม่มี endpoint**

`core/alt-item.ts` (พร้อมเทสต์) และ `components/self-assess/alt-item-offer.tsx` มีครบแล้ว
แต่**ไม่มี route ไหนเรียกใช้เลย** — ไล่ทั้ง `app/api/` แล้วไม่เจอการ import `alt-item` หรือคีย์ `altOffer`
คอมโพเนนต์เองเขียนหมายเหตุไว้ว่า "เจ้าของหน้าภารกิจส่ง prop เข้ามา" และเส้นตรวจคำตอบอยู่ใน `app/api/mission` ของอีก session
**ยังทดสอบด้วย Postman ไม่ได้เพราะไม่มีเส้นให้ยิง** — ต้องให้เจ้าของ `app/api/mission/**` ต่อให้ก่อน

### 8.10 `GET /api/teacher/report/class` ตอบ `500` body ว่าง แบบนาน ๆ ครั้ง — **ยังไม่พบต้นเหตุ**

เจอ 1 ครั้งจาก 5 รอบที่รันทั้ง collection (รอบอื่นเขียว) และ**ยิงซ้ำด้วย curl 5 ครั้งติดได้ `200` ทุกครั้ง**
ขนาด body เท่ากันทุกครั้ง (10,536 ไบต์) จึงไม่น่าใช่ข้อมูลบางชุดที่ทำให้สูตรพัง
ที่น่าจะเป็นที่สุดคือ **`next dev` กำลัง recompile อยู่ตอนนั้น** เพราะมีหลาย session แก้ไฟล์พร้อมกันทั้งคืน
บันทึกไว้เป็นเรื่องที่ต้องดูซ้ำบนเครื่องที่ไม่มีใครแก้ไฟล์ — ถ้าเจอบน production ให้ถือว่าเป็นบั๊กจริงทันที

---

## 9. หน้าเปิดดู API แบบกดลองยิงได้ — `/api-docs`

```bash
npx tsx scripts/seed-demo.ts     # ⚠️ ต้องทำก่อน ไม่งั้นตัวอย่างในหน้านั้นยิงไม่ผ่าน
npm run dev
open http://localhost:3000/api-docs
```

> ⚠️ **ตัวอย่างทุกอันในหน้านั้นผูกกับชุดข้อมูลสาธิตในเครื่อง** (ห้อง `QUEST9` · หุ่น 20 คน PIN `1234` · ครูสาธิต)
> ยังไม่ได้ seed = กด Execute แล้วได้ `404 room-not-found` / `401 invalid-credentials` ทั้งที่ระบบไม่ได้พัง

เห็น **ทุกคู่ method+path ที่มีอยู่จริง (ตอนนี้ 79) แบ่งเป็น 7 กลุ่ม** กดกางดูพารามิเตอร์ ตัวอย่าง body ตัวอย่างคำตอบ และรหัสสถานะทุกกรณี
แล้วกด **Try it out** ยิงจริงไปที่เซิร์ฟเวอร์เดียวกับหน้านั้นได้เลย

**ลำดับที่ต้องทำก่อนกดลองยิง** (ตัวตนเป็นคุกกี้ ไม่ใช่ Bearer token เบราว์เซอร์จึงถือให้เอง)

1. เป็นนักเรียน — ยิง `POST /api/join/resume` (ตัวอย่างเป็นหุ่น `มิ้นท์` + PIN `1234` **กดซ้ำได้ไม่จำกัด**)
   หรือ `POST /api/join` ถ้าอยากเป็นคนใหม่ที่ยังไม่ได้ตั้งค่าร้าน (ชื่อเล่นหนึ่งชื่อใช้ได้ครั้งเดียว)
2. เป็นครู — ยิง `POST /api/teacher/login` หนึ่งครั้ง (ตัวอย่างเป็นบัญชีครูสาธิต)

**ค่าตัวอย่างเป็นของที่ยิงผ่านจริง** ยกเว้น id ที่เกิดใหม่ทุกครั้ง (`classroomId` `sessionId` `submissionId`
`studentId` `flagId` `offerId` `requestId` `voiceSubmissionId`) ซึ่งจงใจใส่ uuid ปลอมไว้
และ**ทุกช่องเขียนกำกับว่าคัดลอกค่าจริงมาจากผลของเส้นไหน**

ปุ่ม **Authorize** ของ Swagger UI **ใช้ไม่ได้และไม่ต้องใช้** เพราะคุกกี้เป็น `httpOnly` จึงกรอกเองไม่ได้ตั้งแต่ต้น

### ของจริงอยู่ที่ไฟล์เดียว

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/openapi/spec.ts` | **ต้นทางของเอกสาร** (info · tags · securitySchemes) ประกอบจาก 3 ไฟล์ path |
| `lib/openapi/paths-student.ts` · `paths-endgame.ts` · `paths-teacher.ts` | สัญญาของแต่ละ endpoint |
| `lib/openapi/builders.ts` | ตัวช่วยที่บังคับกติกา — ทุกเส้นต้องบอกบทบาท · รหัส error ต้องมีคำอธิบาย · ค่าตัวอย่างต้องปลอม |
| `lib/openapi/route-scan.ts` | ไล่ `app/api/**` ว่ามี route อะไรอยู่จริง |
| `app/api-docs/[[...asset]]/route.ts` | หน้าเว็บ + `openapi.json` + ไฟล์ของ Swagger UI |

**ไม่มีไฟล์ `openapi.json` ใน repo โดยเจตนา** — มีของสองใบเมื่อไรก็หลุดกันเมื่อนั้น
อยากได้ไฟล์จริงเอาไปเปิดใน Swagger Editor หรือ import เข้า Postman: `npm run openapi:json > /tmp/openapi.json`

### กันเอกสารเก่าด้วยเครื่อง ไม่ใช่ด้วยความจำ

```bash
npm run check:openapi      # สคริปต์ — ใช้ต่อกับ check:deploy หรือ pre-push
npx vitest run lib/openapi # เทสต์ — ติดใน npm test
```

เทียบ **สองทาง**: มีในซอร์สแต่ไม่มีในเอกสาร = ตก · มีในเอกสารแต่ไม่มีในซอร์ส = ตก
ทดลองเพิ่ม route เปล่า 1 ไฟล์ (2 method) แล้วทั้งสองทางแดงทันทีพร้อมชื่อเส้นที่ขาด

เทสต์ชุดเดียวกันยังล็อกอีก 8 เรื่อง: ทุกเส้นมี `security` ที่อ้าง scheme จริง · เส้นที่ต้องมีคุกกี้ต้องมี `401` ·
**เส้นที่ยิงได้โดยไม่ล็อกอินต้องมีแค่ 3 เส้น** (`/api/join` · `/api/join/resume` · `/api/teacher/login`) ·
ทุกเส้นมี 2xx · `operationId` ไม่ซ้ำ · tag ต้องประกาศไว้ · path ที่มี `{id}` ต้องประกาศ parameter ·
และ**ไล่หาค่าลับทั้งเอกสาร** (JWT `eyJ…` · คีย์ `AIza…` · `sk-…` · hex ยาว · คุกกี้ที่มีค่าติดมา)

### ทำไมปิดสนิทบน production

`NODE_ENV=production` → ทุก URL ใต้ `/api-docs` ตอบ **`404`** (ไม่ใช่ `403` เพื่อไม่ยืนยันแม้แต่ว่าหน้านี้มีอยู่)
เหตุผลเต็มอยู่ในหัวคอมเมนต์ของ `app/api-docs/[[...asset]]/route.ts` · สรุปสั้น:
หน้านี้มีปุ่มยิงคำขอจริงรวม `DELETE /api/teacher/classroom` กับ `POST /api/teacher/demo-reset`
คนที่ต้องอ่านสัญญา API คือคนเขียนโค้ด ไม่ใช่ครู · และ `swagger-ui-dist` เป็น **devDependency**
จึงไม่ถูกติดตั้งบนเซิร์ฟเวอร์จริงตั้งแต่ต้น (`npm ci --omit=dev`) — **ด่านสุดท้ายไม่ได้อยู่ในโค้ด แต่อยู่ที่ของไม่ได้ถูกติดตั้งไป**

⚠️ **ไม่กระทบขนาดไฟล์ที่นักเรียนโหลด** หน้านี้เป็น route handler คืน HTML เป็นข้อความ ไม่มี React component ฝั่งเบราว์เซอร์
`swagger-ui-bundle.js` ไม่ได้อยู่ใน `public/` และไม่มีคำว่า `swagger` ใน `.next/static` แม้แต่ไฟล์เดียว
