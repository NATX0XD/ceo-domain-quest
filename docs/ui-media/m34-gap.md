# M3/M4 Padlet flow gap audit

ตรวจเทียบ `mission-3-domain-counter.md` / `mission-4-domain-registration.md`, flow-board และภาพ G01–G09 / R01–R11 กับ runtime ปัจจุบันที่ `CounterGame`, `RegistrarGame` และ `game-ui/*` ก่อนแก้ไข

## แก้แล้วในรอบนี้

- M3/M4 ใช้เส้นทาง `modes:["do"]` และเข้าเกมจาก intro โดยตรง ไม่มี warmup, recommend/choose, watch หรือ read
- M4 เดิมกดจาก R01 ไป R04 route board ก่อน R02/R03 จึงสลับเป็น R01 → ค้นชื่อจริง/นักสืบโดเมน → R04 route board; ขั้น account/menu/search ที่ภาพ R04 ถือว่าเสร็จใน hand-off แล้ว
- M4 ยังคง 10 ช่อง, 4 เหตุการณ์ และเกณฑ์ผ่าน `explain >= 7/10` + `events >= 3/4`
- M3 ยังคงลำดับเคาน์เตอร์ request → interview → tag → stamp และเกณฑ์ `stamp points >= 60%` + `tags >= 80%`

## ช่องว่างที่พบและยังต้องยืนยัน

1. ภาพ G01–G09 และ R01–R11 เป็นภาพ Padlet ที่มีข้อความฝังอยู่ แต่ runtime ใช้ HTML/React วาดข้อความและใช้ภาพฉากเป็นพื้นหลัง จึงไม่ใช้ภาพทั้งจอเป็น background เพื่อไม่ให้ข้อความซ้ำและไม่สามารถเข้าถึงได้ ภาพรวมสี/กรอบ/ลำดับจอถูกจำลองใน component แต่ตำแหน่ง artwork ไม่ pixel-identical กับภาพอ้างอิง
2. M3 runtime มี handbook และโต๊ะโดมเป็น side panels ระหว่างเล่น ซึ่งเป็น gimmick ที่เอกสารอธิบายไว้ แต่ภาพ G01–G09 แสดง bottom dock และจอ tutorial/ผลลัพธ์ที่ต่างกัน รายละเอียดว่า side panel ต้องแสดงทุกจอหรือเฉพาะตอนกดคู่มือ/ถามโดมยังไม่ระบุใน md
3. M3 runtime ใช้รูป `public/learn/m3/customer-*` และ `bg-pixel-office.webp` แทนภาพ G01–G09 โดยตรง ต้องยืนยันว่าทีมต้องการ artwork ต้นฉบับในภาพเป็น asset runtime หรือเพียง visual reference สำหรับ HTML
4. M4 แถวข้อมูลจำลองจากการค้นชื่อยังใช้วันที่ fallback ใน `registrar-screens.tsx` เมื่อระบบบังคับให้เห็นเหตุการณ์ชื่อซ้ำ ภาพ R03 ระบุว่าวันที่ในภาพเป็นตัวอย่างและ runtime ควรใช้วันที่ในเกม แต่ไม่มีวันที่ canonical ใน content จึงยังไม่เดาเปลี่ยนค่า
5. ภาพ R09 แสดงปฏิทินวันที่เฉพาะเจาะจง ขณะที่ runtime ใช้ข้อมูลหมดอายุจาก flow จำลอง/ข้อมูลที่ค้นได้ตามสถานะ ควรยืนยันวันที่เริ่มเกมและ timezone ที่ต้องใช้ในหน้าจอ

## คำถามสำหรับ owner/team

- ต้องการให้ G/R PNG เป็นภาพพื้นหลังจริงทั้งจอ หรือยืนยันแนวทาง HTML accessible ที่ใช้ใน runtime ปัจจุบัน?
- M3 tutorial S01–S05 เป็นส่วนหนึ่งของ Pixel Counter ที่ต้องเปิดก่อน G01 หรือเป็น storyboard ของเส้นทางเดิมที่ถูกตัดออกเมื่อ M3 เป็น single activity?
- วันที่ fallback ของ R03/R09 และ timezone canonical คืออะไร?
