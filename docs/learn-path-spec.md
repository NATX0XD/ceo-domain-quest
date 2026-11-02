# Learn Path (ดู / อ่าน / ลงมือทำ) — สเปกร่วมสำหรับคนเขียนโค้ด

เป้าปัจจุบัน: ก่อน m1/m2 ผู้เรียนตอบคำถามรู้จักตัวเองที่ `/profile` แล้วระบบเสนอวิธีเรียนจากผล self-profile ผู้เรียนเลือกวิธีได้ใน bottom drawer บนแผนที่และเข้าเรียนทันที ส่วน m3/m4 เป็น single-mode `do` เข้าเกมจากแผนที่โดยตรง ไม่มี warmup, recommendation, choose, watch หรือ read จากนั้นจึงไปจอภารกิจเดิม ครูเห็นผลทั้งหมดในแผงครู

หมายเหตุย้ายระบบ: ฟิลด์/อีเวนต์ `warmup` คงไว้เพื่ออ่านข้อมูลเก่าและความเข้ากันได้ของ API เท่านั้น client ใหม่ไม่แสดงและไม่บังคับเช็กพื้นฐานรายภารกิจ

ห้ามแก้โครงสร้างฐานข้อมูล ห้าม db reset ใช้ตาราง `events` (ผ่าน `logEvent`) และ `switchLearningRoute` ที่มีอยู่

## การจับคู่กับช่องทางเดิม
| วิธีเรียน | ค่า channel/route เดิม |
|---|---|
| ดู (watch) | `clip` |
| อ่าน (read) | `card` |
| ลงมือทำ (do) | `game` |

## ไฟล์เนื้อหา
- `content/learn-paths.json` — ส่งให้เบราว์เซอร์ได้ **ห้ามมีเฉลย**
- `content/learn-paths-answers.json` — อ่านเฉพาะฝั่งเซิร์ฟเวอร์

```jsonc
// content/learn-paths.json
{
  "paths": [
    {
      "missionId": "m1",
      "modes": ["watch", "read", "do"],
      "story": "ฉากและตัวละครของด่าน (1-2 ประโยค)",
      "warmup": [ { "id": "m1-w1", "question": "...", "choices": ["ก","ข","ค","ง"] } ],   // legacy data; ไม่ใช้เป็นขั้นตอน runtime ใหม่
      "watch": {
        "title": "...",
        "scenes": [ { "id": "s1", "speaker": "โดม|ชื่อตัวละคร", "line": "บทพูดหรือคำบรรยาย", "caption": "ป้ายสั้นบนภาพ", "visual": "shop|dome|diagram|computer|counter|office" } ],  // 4-6 ฉาก
        "questions": [ { "id": "m1-wq1", "prompt": "คำถามปลายเปิดของโดม", "placeholder": "..." } ]  // 2 ข้อ
      },
      "read": {
        "title": "...",
        "chat": [ { "who": "a|b|dome", "name": "มีน", "text": "..." } ],   // 8-16 ข้อความ
        "questions": [ { "id": "m1-rq1", "prompt": "...", "placeholder": "..." } ]  // 2 ข้อ
      },
      "do": { "kind": "game|counter|registrar", "title": "...", "instruction": "..." }
    }
    // m3/m4 ใช้ modes:["do"] และมี story + do เท่านั้นใน runtime
  ]
}
```

```jsonc
// content/learn-paths-answers.json
{
  "paths": [
    {
      "missionId": "m1",
      "warmup": { "m1-w1": 2 },                       // adaptive paths เท่านั้น
      "rubrics": {
        "m1-wq1": {
          "modelAnswer": "คำตอบตัวอย่าง",
          "concepts": [ { "label": "บอกว่าเป็นชื่อเว็บ", "points": 50, "any": ["ชื่อเว็บ","ชื่อที่อยู่"] } ],   // points รวม = 100
          "feedbackPass": "...", "feedbackRetry": "..."
        }
      },
      "counter": { ... },     // เฉพาะ m3 ดูหัวข้อ counter
      "registrar": { ... }    // เฉพาะ m4 ดูหัวข้อ registrar
    }
  ]
}
```

การให้คะแนนคำตอบปลายเปิด: ตัดช่องว่าง ตัวเล็ก แล้วเช็ก `any` แบบ substring ได้ concept ไหนบวก points ข้อละ 100 คะแนนเฉลี่ย 2 ข้อ ผ่านเมื่อ **> 60**

## API เดียว: `POST /api/mission/[id]/learn`
ต้องมี session นักเรียน (`readStudentSession`) body แยกตาม `action`:

| action | body | คืนค่า | บันทึก |
|---|---|---|---|
| `warmup` | `{ answers: number[3] }` (legacy compatibility เท่านั้น) | ผลเดิมสำหรับข้อมูลเก่า | `learn-warmup` |
| `choose` | `{ mode }` (m1/m2 เท่านั้น) | `{ ok:true }` | `switchLearningRoute(clip/card/game, {missionId, chosenBy:'student'})` + `learn-choose` (มี recommended, followed) |
| `answer` | `{ mode:'watch'|'read', answers: Record<questionId,string> }` | `{ score, passed, perQuestion:[{id,score,feedback,missing:string[]}] }` | `learn-answer` และถ้าผ่าน `learn-done` |
| `do` | `{ payload }` | `{ score, passed, detail }` | ให้ scorer ของแต่ละด่านตัดสิน บันทึก `learn-do` และถ้าผ่าน `learn-done` |

กติกาปัจจุบัน: ผล self-profile ใน `content/self-profile.json` แม็ป `clip → ดู`, `card → อ่าน`, `game → ลงมือทำ`; ถ้าไม่มีผลให้แนะนำ `ลงมือทำ` แบบนุ่มนวล ผู้เรียนเปลี่ยนได้เสมอจาก drawer เดิมทั้งบนแผนที่และในภารกิจ; m3/m4 ส่งเกมด้วย `action:'do'` โดยตรง

## Scorer ฝั่งเซิร์ฟเวอร์ของเกมลงมือทำ

## ขอบเขต AI ตามภารกิจและบทบาท

AI ทุกจุดที่ผู้เรียนเห็นต้องได้รับ `missionId` และ `role` ผ่านชั้น `lib/ai` เดียวกัน โดยใช้ลำดับ m1 → m2 → m3 → m4 → m5 (m5 คือด่าน CEO)

- ภารกิจปัจจุบันตอบได้ในหัวข้อนั้น แต่คำใบ้และการตรวจงานต้องชวนคิด ไม่เฉลยข้อ graded
- ภารกิจก่อนหน้าใช้ได้เฉพาะการทบทวนแบบถามกลับหรือเตือนสั้น ๆ ไม่ส่งคำตอบเต็ม
- ภารกิจถัดไปไม่สอนหรือสปอยล์ บอกว่าจะได้เรียนภายหลังแล้วชวนกลับมาภารกิจปัจจุบัน
- เรื่องนอกวิชา/นอกธุรกิจร้านปฏิเสธอย่างสุภาพและพากลับเข้าบทเรียน
- registry ใน `lib/ai/topic-lock.ts` แยกเสียงและสิ่งที่เปิดเผยได้ของโดม เพื่อน ลูกค้า เจ้านาย เพื่อนคู่หู และผู้เล่าเรื่อง ลูกค้าพูดได้เฉพาะความต้องการของตน ไม่ทำตัวเป็นครู
- guard ตรวจคำตอบหลัง provider อีกชั้นหนึ่ง หากพบคำสั่งแทรก เฉลย ระบบ หรือ keyword ของภารกิจถัดไป (เมื่อไม่มี keyword ปัจจุบัน) จะใช้ fallback ตามบทบาททันที
- m1, m2: ใช้ `MissionGame` เดิม (`/api/mission/[id]/game`) เมื่อ `onSolved` ถูกเรียก client ส่ง `action:'do'` payload `{ game:'solved' }` เซิร์ฟเวอร์ยืนยันจาก event `mission-game-checked` ล่าสุดที่ `allCorrect`
- m3: `components/server/learn-counter.ts` export `scoreCounter(payload: unknown): { score:number; passed:boolean; detail: unknown }`
- m4: `components/server/learn-registrar.ts` export `scoreRegistrar(payload: unknown): { score:number; passed:boolean; detail: unknown }`

## คอมโพเนนต์ฝั่ง client (ลงมือทำ)
- `components/learn/counter-game.tsx` export `CounterGame({ data, onSubmit })`
  - `data`: ส่วนสาธารณะของเคสลูกค้า (ไม่มีเฉลย) ได้จาก `content/learn-counter.json`
  - `onSubmit(payload) => Promise<{ score:number; passed:boolean; detail:unknown }>` ตัว framework เป็นคน POST
- `components/learn/registrar-game.tsx` export `RegistrarGame({ data, onSubmit })` เหมือนกัน ข้อมูลจาก `content/learn-registrar.json`
  - ค้นชื่อจริงผ่าน `GET /api/domain/rdap?name=xxx` (สร้างใหม่ ไม่ทับ `/api/domain/check` เดิม)

## ข้อกำหนด UI ทุกจอ (จาก docs/design-system.md)
- มือถือ 390px ก่อน ปุ่มสูงอย่างน้อย 44px ตัวหนังสือไทยไม่ต่ำกว่า `text-label`
- ใช้ primitive ใน `components/ui` (Button, ChoiceCard, DomeSays, DomeAvatar, Card, ProgressBar, Chip, TextField) และโทเคนสี brand/quest/spark/danger
- ห้าม emoji ห้ามคำว่า ตก / ไม่ผ่าน / ล้มเหลว บนจอ ใช้ "ยังไม่ครบ ลองอีกนิด"
- ถูก/ผิดต้องมีไอคอนและข้อความคู่สีเสมอ
- ข้อความ UI ภาษาไทยทั้งหมด
