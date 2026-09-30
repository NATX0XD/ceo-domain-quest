# Interland (Be Internet Awesome) — ใช้เทคโนโลยีอะไร

ตรวจสอบเมื่อ 29 กันยายน 2569 จาก 2 ทาง
1. ดาวน์โหลดไฟล์ JavaScript จริงจากเว็บมาแกะ (`https://beinternetawesome.withgoogle.com/en_us/interland/landing/mindful-mountain`)
2. อ่านกรณีศึกษาของบริษัทที่สร้าง — **14islands** (เทคโนโลยี) ร่วมกับ **North Kingdom** (ออกแบบและคอนเซปต์)

ทั้งสองทางให้ผลตรงกัน

## สรุป

Interland **ไม่ได้ใช้ game engine สำเร็จรูป** ไม่มี Unity, ไม่มี WebGL build, ไม่มี Phaser
เป็นเว็บธรรมดาที่เขียน **Three.js เอง** แล้ววาดลง canvas โมเดล 3D ปั้นใน **Blender** แล้ว export เข้ามา

## ใครสร้าง

| บทบาท | ผู้รับผิดชอบ |
|---|---|
| เจ้าของโครงการ | Google (โครงการ Be Internet Awesome) |
| ออกแบบและคอนเซปต์ | **North Kingdom** |
| พัฒนาเทคโนโลยี (technology partner หลัก) | **14islands** |
| โฮสต์ | Google App Engine |

จุดที่ 14islands ภูมิใจที่สุดตามที่เขียนไว้ในกรณีศึกษา คือ *"ทั้งประสบการณ์ลื่นแม้บนมือถือรุ่นเก่า"* — เป้าหมายด้านประสิทธิภาพ ไม่ใช่ความอลังการของกราฟิก
ปัจจุบันแปลแล้ว 12 ภาษา

## หลักฐานที่ตรวจพบ

| รายการ | ผลตรวจ |
|---|---|
| 3D engine | **Three.js r84** (`REVISION="84"` ในไฟล์ `third-party-interland.min.js` ขนาด 673 KB) |
| Animation | **GSAP / TweenMax** (พบ `TweenMax` 311 ครั้งใน bundle หลัก) |
| เสียง | **Howler.js** (พบ `Howl` 224 ครั้ง) |
| โมเดล 3D | ฝังเป็น JSON ใน bundle โหลดด้วย `THREE.ObjectLoader` — **ไม่มีไฟล์ `.glb` / `.gltf` / `.fbx` แยก** |
| ตัวละคร | `SkinnedMesh` + `AnimationMixer` (ตัวละครมีกระดูกและอนิเมชัน) |
| กล้อง | `PerspectiveCamera` และ `OrthographicCamera` |
| bundle หลัก | `main-bundled.js` ขนาด **25 MB** (โค้ดเกม + ข้อมูลฉากทั้งหมดรวมกัน) |
| เปลือกเว็บ | HTML/CSS ธรรมดา + `jquery-3.1.1.slim.min.js` + `modernizr.js` |
| อื่น ๆ | `lottie.min.js` (แอนิเมชัน 2D), `jspdf.min.js` (ออกใบประกาศนียบัตรเป็น PDF) |
| ไม่พบ | React, Vue, Backbone, physics engine (cannon/ammo), Draco compression |

จุดที่ยืนยันชัดใน HTML:

```html
<!-- THREE canvas container--><div class="js-three-container">
```

## Stack เต็มตามที่ 14islands ประกาศไว้

รายการนี้มาจากกรณีศึกษาของ 14islands เอง รวมสิ่งที่แกะจากไฟล์ไม่เห็น (เครื่องมือตอน build และตอนทำ asset)

| หมวด | เครื่องมือ | หมายเหตุ |
|---|---|---|
| 3D | **Three.js** บน **WebGL** | ตรงกับ `REVISION="84"` ที่แกะเจอ |
| ปั้นโมเดล 3D | **Blender** | **นี่คือคำตอบว่าทำไมโมเดลสวย — ไม่ได้เขียนด้วยโค้ด** |
| แอนิเมชัน 2D | **Lottie** | ตรงกับ `lottie.min.js` ที่แกะเจอ |
| แอนิเมชันโค้ด | **GreenSock (GSAP)** | ตรงกับ `TweenMax` ที่แกะเจอ |
| ตรวจความสามารถเบราว์เซอร์ | **Modernizr** | ตรงกับ `modernizr.js` ที่แกะเจอ |
| แปลง JavaScript | **Babel** | เครื่องมือตอน build มองไม่เห็นจากไฟล์ที่ deploy |
| เขียน HTML | **Pug** | template engine มองไม่เห็นจากไฟล์ที่ deploy |
| โฮสต์ | **Google App Engine** | |

**ประเด็นสำคัญที่สุดสำหรับเรา:** ไม่มี library ใดทำให้ 3D สวยขึ้น — ความสวยมาจาก **Blender** ซึ่งเป็นโปรแกรมปั้นโมเดล ไม่ใช่ไลบรารี JavaScript
Three.js มีแค่กล่อง ทรงกลม ทรงกระบอก ให้ใช้ ซึ่งเอามาต่อกันยังไงก็ได้รูปทรงพื้นฐาน — ต้องปั้นข้างนอกแล้ว import เข้ามาเท่านั้น

## วิธีตรวจซ้ำ

```bash
curl -sL -A "Mozilla/5.0" \
  "https://beinternetawesome.withgoogle.com/en_us/interland/landing/mindful-mountain" -o interland.html
grep -oE '[^"'\'' ]*\.js[^"'\'' ]*' interland.html | sort -u

curl -sL "https://beinternetawesome.withgoogle.com/interland/third-party-interland.min.js" -o tp.js
grep -oE 'REVISION[^,;]{0,20}' tp.js
```

## ข้อสังเกตก่อนเอาไปเลียนแบบ

- Three.js **r84 ออกปี 2017** เก่ามาก ปัจจุบันเลขรุ่นไปไกลแล้ว API เปลี่ยนหลายจุด **อย่าเริ่มโปรเจกต์ใหม่ที่รุ่นนี้**
- bundle 25 MB คือปัญหาจริง เปิดครั้งแรกบนเน็ตโรงเรียนจะช้ามาก ปัจจุบันควรแยกโมเดลเป็น `.glb` + Draco แล้วโหลดตามด่าน
- จุดที่ **ควรลอก** คือแนวคิด ไม่ใช่เทคโนโลยี ได้แก่
  - 1 เกาะ = 1 หัวข้อ เล่นแยกกันได้ ไม่ต้องเรียงจากต้น
  - รอบเล่นสั้น จบใน 5–10 นาที เหมาะกับคาบเรียน
  - ให้ feedback อธิบายเหตุผลทันทีที่ตอบ ไม่ใช่แค่บอกถูก/ผิด
  - จบแล้วออกใบประกาศนียบัตร (Interland ใช้ jsPDF สร้างในเบราว์เซอร์ ไม่ต้องมี server)
  - มีคู่มือครูและแผนการสอนแจกคู่กับเกม

## ถ้าจะสร้างเกมลักษณะนี้ในปี 2569

| ทาง | Stack | เหมาะเมื่อ |
|---|---|---|
| A | Vite + React + `@react-three/fiber` + `@react-three/drei` + zustand + GSAP + Howler | ต้องการ 3D จริงและมี UI ซ้อนบนฉากเยอะ |
| B | Vite + Phaser 3 + TypeScript | เป็น 2D/isometric อยากเสร็จเร็ว งานน้อยกว่า A ราว 3 เท่า |
| C | Vite + Three.js ตรง ๆ | ทำแบบเดียวกับ Interland คุมทุกอย่างเอง แต่ต้องจัดการ state เอง |

โมเดลฟรีใช้เชิงพาณิชย์ได้: Kenney.nl, Quaternius, Poly Pizza (CC0) แต่งต่อใน Blender แล้ว export เป็น `.glb`
