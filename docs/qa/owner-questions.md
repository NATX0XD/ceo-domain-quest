# QA6 owner questions and assumptions

อัปเดตโดย Codex ระหว่าง fix6 — รายการนี้เก็บเฉพาะจุดที่หลักฐานจากดีไซน์หรือระบบยังไม่กำหนดชัดเจน

## 2026-11-02

1. **ภาพ popup ทางการมีเฉพาะข้อความ “ภารกิจที่ 1”**
   - ตัวเลือก: ใช้ภาพต้นฉบับเฉพาะ m1 / ยืดภาพไปใช้ทุกภารกิจ / ทำ artwork ใหม่ทุกภารกิจ
   - เลือก: ใช้ภาพต้นฉบับเฉพาะ m1 และคง HTML ที่เข้าถึงได้สำหรับ mission อื่น ๆ เพื่อไม่ให้ชื่อภารกิจผิดจาก asset
   - หลักฐาน: `UI/ภารกิจที่ 1/popup.png`, `public/ui/mode/official-popup.webp`, `components/learn/mode-popup.tsx`

2. **ไฟล์ UI/ภารกิจที่ 2/example use flow เป็น storyboard จำนวนมาก ไม่ใช่สเปก interaction**
   - ตัวเลือก: ฝังภาพทุกหน้าเป็น flow ใหม่ / คงกิจกรรมที่ทำงานอยู่แล้วและใช้ภาพเป็น reference / หยุดแก้ m2
   - เลือก: คงกิจกรรมที่ทำงานอยู่แล้ว พร้อมใช้ asset ที่เป็นฉากหรือไอคอนได้โดยไม่ทำให้ input/การประเมินเสีย
   - หลักฐาน: `UI/ภารกิจที่ 2/`, `components/learn/`, `docs/ui-media/qa-final/qa6.md`

3. **การลบนักเรียนรายคนจากครูยังไม่มีปุ่ม/contract ที่ระบุใน QA6**
   - ตัวเลือก: เพิ่ม endpoint และปุ่มใหม่ / ลบทั้งห้อง / ลบผ่าน repository เฉพาะ student ที่สร้างชั่วคราว
   - เลือก: ไม่เพิ่ม destructive surface ในรอบนี้; ใช้ cleanup helper/repository ที่มีอยู่สำหรับ temp flow และไม่แตะห้องจริง
   - หลักฐาน: `lib/db/repo.ts` (`removeStudent`), `scripts/smoke-uat.ts`, `app/api/teacher/student/route.ts`

4. **การตรวจ AI บน production ต้องใช้ preview cookie และสิทธิ์ที่อยู่นอก checkout**
   - ตัวเลือก: เดา cookie/credential / ใช้ลิงก์และ cookie จริงโดยไม่พิมพ์ค่า / บันทึกเป็น blocked พร้อมทำ local verification
   - เลือก: จะใช้เฉพาะค่าในไฟล์ preview ที่อ่านเข้า process แบบไม่ print; หาก cookie/สิทธิ์หมดอายุให้บันทึก blocked พร้อม evidence แทนการเดาหรือสร้าง secret ใหม่
   - หลักฐาน: `~/Desktop/ceo-domain-quest-preview-link.txt`, `docs/qa/ai-verification.md`

5. **ข้อความบนแผ่นปุ่มของทีมมี baked label แต่ปุ่มในเกมต้องเปลี่ยนข้อความได้**
   - เลือก: ใช้ขอบซ้าย/ขวาจาก art จริงแบบ 9-slice แล้ววางข้อความสดเป็น HTML ตรงกลาง เพื่อคง accessibility และรองรับ label ใหม่
   - หลักฐาน: `public/ui/kit/buttons/*-left.webp`, `public/ui/kit/buttons/*-right.webp`, `app/globals.css`

6. **วิดีโอ 1015.mp4 มีความยาวเท่ากับ stop-point เดิมอยู่แล้ว**
   - เลือก: transcode เป็น H.264 Main/yuv420p + faststart ที่ 960×540 โดยไม่เปลี่ยนความยาว 31.35 วินาที จึงคง review ranges เดิมของ m1
   - หลักฐาน: `content/learn-paths.json`, `public/videos/m1-watch.mp4`, `public/ui/m1/watch-poster.webp`

7. **m2 storyboard เป็น reference ของลำดับ interaction ไม่ใช่ชุด answer ใหม่**
   - เลือก: ทำ flow แยกสามโหมดตาม storyboard แต่คง server contract/AI grading และ content m2 เดิม; ไม่ฝัง storyboard เป็นภาพกดแทน HTML input
   - หลักฐาน: `docs/ui-media/m2-modes/`, `components/learn/m2-flow.tsx`, `components/server/m2-flow.ts`, `app/api/mission/[id]/learn/route.ts`

10. **m2 Visual ยังไม่มีคลิปที่ใช้ได้ใน repo**
   - เลือก: ใช้ timeline placeholder สั้นจากภาพฉาก m2 ที่มีอยู่ใน `public/learn/m2/watch-s*.webp` จนกว่าจะมีคลิปจริง โดยยังคง stop-question และช่วง rewatch ให้ทดสอบได้
   - หลักฐาน: `components/learn/m2-flow.tsx`, `public/learn/m2/`

8. **Landing hero มีโลโก้แนวนอนคนละ composition กับ welcome sign 101**
   - เลือก: เปลี่ยน `/` เป็น welcome logo 101 ตาม owner pick แต่คงโลโก้แนวนอนเดิมของ `/landing` เพื่อไม่บีบ layout desktop ที่จัด art เป็น split hero อยู่แล้ว
   - หลักฐาน: `app/page.tsx`, `components/landing/hero.tsx`

9. **CSV bulk-create ระบุ `room_code` ของแถวครูด้วย แต่ยังไม่ได้กำหนดว่าครูหนึ่งคนจะมีหลายห้องหรือไม่**
   - สมมติฐานที่ใช้ตอนนี้: แถวครูสร้าง/ผูกห้องหนึ่งห้องตาม `room_code`; แถวนักเรียนผูกเข้าห้องนั้น และถ้าห้องมีอยู่แล้วต้องเป็นของครูคนนั้น
   - ถ้าต้องการหลายห้องต่อครู ให้เพิ่มหลายแถวครูไม่ได้ เพราะจะสร้างบัญชีซ้ำ; ควรกำหนดรูปแบบ CSV เพิ่มภายหลัง
