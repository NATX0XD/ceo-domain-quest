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
