# วิเคราะห์สื่อ UI

ตรวจจากไฟล์ใน `UI/` วันที่ 1 พ.ย. 2026 โดยดูภาพทุกไฟล์และแยกเฟรมจาก `1015.mp4` จำนวน 5 เฟรมใน `/tmp` แล้ว เป้าหมาย route อ้างอิงจาก App Router และโค้ดปัจจุบัน ไม่ได้แก้ app code

> ในโฟลเดอร์มีไฟล์ทั้งหมด 39 รายการ แต่เป็นสื่อ 38 รายการ + `.DS_Store` 1 รายการ จึงไม่มีไฟล์ภาพลำดับที่ 39

## 1. รายการไฟล์ทั้งหมด

`alpha` เป็นค่าจาก metadata ของไฟล์ ไม่ใช่การเดาจากพื้นหลังที่มองเห็น

| ไฟล์ | ขนาด / alpha | แสดงอะไร | หน้าหรือ route เป้าหมาย | ประเภท | หมายเหตุ |
|---|---|---|---|---|---|
| `Welcome/bg.png` | 941×1672 / ไม่ | อ่าว เมืองริมทะเล ทางเดิน ท้องฟ้า | `/` landing/welcome | พื้นหลัง | ภาพเต็มจอ มีพื้นที่ฟ้ากลางบนสำหรับโลโก้/CTA; 2.1 MB |
| `Welcome/logo.png` | 1536×1024 / มี | โลโก้ CEO Domain Quest | `/` | โลโก้ | โปร่งใส; ตัวอักษรฝังในภาพ แก้ข้อความไม่ได้ |
| `Welcome/Dome.png` | 1154×1363 / มี | โดมยิ้มยกมือ มีแผนที่/กระเป๋า | `/` | ตัวละคร cutout | โปร่งใส เหมาะวางซ้อนพื้นหลัง |
| `Welcome/effect.png` | 1536×1024 / มี | ใบไม้ ประกาย วงแสง เมฆ พอร์ทัล | `/` และ global decoration | effect/decor | โปร่งใสแต่เป็น atlas รวมหลายชิ้น ต้องตัดหรือใช้เป็น layer ใหญ่ |
| `Welcome/option.png` | 1536×1024 / มี | ชุดปุ่ม เข้าเรียน/ต่อไป/เริ่มเกม/บันทึก/ยืนยัน/ย้อนกลับ/ยกเลิก/ถัดไป/หน้าหลัก | `/`, `/join`, flow ต่าง ๆ | sliced asset / button sheet | โปร่งใส; ข้อความทั้งหมดฝังภาพ; มีหลายสีและหลาย state ในภาพเดียว |
| `02 — เข้าสู่ห้องเรียน/bg.png` | 941×1672 / ไม่ | พื้นหลังอ่าวเมืองริมทะเลเหมือน Welcome | `/join` | พื้นหลัง | ซ้ำ pixel กับ `Welcome/bg.png` |
| `02 — เข้าสู่ห้องเรียน/กรอบ.png` | 1086×1448 / มี | กรอบไม้ครีม มีโดมโผล่จากด้านบนและช่องว่างใส่ฟอร์ม | `/join` | frame/panel | โปร่งใส; ช่องกลางว่างสำหรับรหัสห้อง/PIN HTML |
| `02 — เข้าสู่ห้องเรียน/ปุ่ม.png` | 2048×768 / มี | ปุ่ม Enter class / ต่อไป / เริ่มเกม / บันทึก / ยืนยัน และปุ่มล่าง | `/join` และ global CTA | button sheet | เหมือนชุดปุ่มใน `Welcome/option.png`; ไม่ควรใช้ทั้งภาพเป็นปุ่มเดียว |
| `02 — เข้าสู่ห้องเรียน/ป้าย.png` | 1717×916 / มี | ป้าย “สร้างร้านในฝัน เรียนรู้โดเมนอย่างสนุก / พร้อมเริ่มภารกิจหรือยัง / เริ่มเกม” | `/join` หรือ intro ก่อนเข้าเรียน | full mockup/composite | มีข้อความและ CTA ฝังภาพ จึงไม่เหมาะกับฟอร์มจริง/การเข้าถึง |
| `03 คุยกับโดม/bg.png` | 941×1672 / ไม่ | โดมนั่งโต๊ะใส่ headset มี laptop ฉากห้องเรียนและทะเล | `/dome` chat | full scene background | ภาพแนวตั้ง มีพื้นที่โต๊ะ/เบลอด้านล่างสำหรับแชต |
| `03 คุยกับโดม/1.png` | 941×1672 / ไม่ | แผนที่ภารกิจ: m1–m4 เปิดทั้งหมด | `/map` | full mockup/state | ข้อความ ปุ่มย้อนกลับ และสถานะฝังภาพ; ไม่ใช่ sliced asset |
| `03 คุยกับโดม/2.png` | 941×1672 / ไม่ | แผนที่: m1–m3 เปิด, m4 ล็อก | `/map` | full mockup/state | state ความคืบหน้าหนึ่งแบบ |
| `03 คุยกับโดม/3.png` | 941×1672 / ไม่ | แผนที่: m1–m2 เปิด, m3–m4 ล็อก | `/map` | full mockup/state | state ความคืบหน้าหนึ่งแบบ |
| `03 คุยกับโดม/4.png` | 941×1672 / ไม่ | แผนที่: m1 เปิด, m2–m4 ล็อก | `/map` | full mockup/state | state เริ่มต้น |
| `03 คุยกับโดม/ปุ่ม.png` | 1247×1261 / มี | ปุ่ม “พาฉันไปทำภารกิจเลย” | `/dome` หรือ `/map` | sliced CTA | โปร่งใส; ข้อความฝังภาพ; เป็นปุ่มกว้างพร้อม effect รอบข้าง |
| `03 คุยกับโดม/แชท.png` | 1536×1024 / มี | โดม avatar 3 แบบกับ speech bubble 3 ข้อความ | `/dome` | chat composite | โปร่งใส; ข้อความฝังภาพ; ใช้เป็น reference มากกว่า UI จริง |
| `ภารกิจที่ 1/map.png` | 941×1672 / ไม่ | แผนที่ภารกิจฉบับ m1 เปิด ด่านถัดไปล็อก | `/map` | full mockup/state | เกี่ยวกับ m1 โดยตรง แต่ route จริงเป็น map รวมทุก mission |
| `ภารกิจที่ 1/popup.png` | 1122×1402 / มี | popup เลือกวิธีเรียน ดู/อ่าน/ลงมือทำ พร้อมโดมและ CTA | `/mission/m1` learn-path intro | full popup mockup | โปร่งใส; ข้อความและ radio ฝังภาพ; target ใกล้กับ `components/learn/*` ที่สุด |
| `LINE_ALBUM_กราฟิก_261101_1.jpg` | 2048×768 / ไม่ | รวมปุ่ม: เข้าเรียน/ต่อไป/เริ่มเกม/บันทึก/ยืนยัน/ย้อนกลับ/ยกเลิก/ถัดไป/หน้าหลัก | global UI, `/`, `/join`, `/dome` | button sheet | JPG พื้นขาว ไม่มี alpha; ตัดใช้ต้อง remove background |
| `LINE_ALBUM_กราฟิก_261101_2.jpg` | 1717×916 / ไม่ | ป้าย intro “สร้างร้านในฝัน...” และ CTA | `/join`/intro | composite | ซ้ำเนื้อหากับ `02/ป้าย.png` แต่เป็น JPG พื้นขาว |
| `LINE_ALBUM_กราฟิก_261101_3.jpg` | 1086×1448 / ไม่ | กรอบโดมพร้อมช่องว่าง | `/join` | frame/panel | ซ้ำ `02/กรอบ.png` แบบ JPG |
| `LINE_ALBUM_กราฟิก_261101_4.jpg` | 941×1672 / ไม่ | พื้นหลังเมืองริมทะเล | `/`/`/join` | background | hash ตรงกับ `Welcome/bg.png` และ `02/bg.png` แต่ JPEG |
| `LINE_ALBUM_กราฟิก_261101_5.jpg` | 1247×1261 / ไม่ | CTA “พาฉันไปทำภารกิจเลย” | `/dome`/`/map` | sliced CTA | คู่ JPG ของ `03/ปุ่ม.png`; พื้นขาวทำให้ใช้ตรง ๆ ไม่ได้ |
| `LINE_ALBUM_กราฟิก_261101_6.jpg` | 1536×1024 / ไม่ | ชุด speech bubbles ของโดม | `/dome` | chat composite | คู่ JPG ของ `03/แชท.png`; ข้อความฝังภาพ |
| `LINE_ALBUM_กราฟิก_261101_7.jpg` | 941×1672 / ไม่ | โดมนั่งโต๊ะใส่ headset กับ laptop | `/dome` | full scene | เทียบได้กับ `03/bg.png` แต่เป็นภาพฉากเต็ม ไม่ใช่พื้นหลังล้วน |
| `LINE_ALBUM_กราฟิก_261101_8.jpg` | 941×1672 / ไม่ | แผนที่ทุกด่านเปิด | `/map` | full mockup/state | state ปลดล็อกครบ |
| `LINE_ALBUM_กราฟิก_261101_9.jpg` | 941×1672 / ไม่ | แผนที่ m1–m3 เปิด, m4 ล็อก | `/map` | full mockup/state | state เดียวกับ `03/2` ในเชิงความหมาย |
| `LINE_ALBUM_กราฟิก_261101_10.jpg` | 941×1672 / ไม่ | แผนที่ m1–m2 เปิด, m3–m4 ล็อก | `/map` | full mockup/state | state เดียวกับ `03/3` ในเชิงความหมาย |
| `LINE_ALBUM_กราฟิก_261101_11.jpg` | 941×1672 / ไม่ | แผนที่ m1 เปิด, m2–m4 ล็อก | `/map` | full mockup/state | state เดียวกับ `03/4` ในเชิงความหมาย |
| `LINE_ALBUM_กราฟิก_261101_12.jpg` | 1122×1402 / ไม่ | popup เลือก ดู/อ่าน/ลงมือทำ ภารกิจ 1 | `/mission/m1` learn-path intro | full popup mockup | คู่ JPG ของ `ภารกิจที่ 1/popup.png`; พื้นขาว |
| `LINE_ALBUM_กราฟิก_261101_13.jpg` | 941×1672 / ไม่ | แผนที่ถูก blur/dim ด้านหลัง popup | `/map` + mission selection overlay | overlay/full mockup | เป็นสถานะ modal ไม่ใช่พื้นหลังถาวร |
| `LINE_ALBUM_กราฟิก_261101_14.jpg` | 1717×916 / ไม่ | ป้าย intro และปุ่ม “เริ่มเกม” | `/join`/welcome intro | composite | คล้าย `02/ป้าย.png` แต่จัดวาง/ข้อความอีกแบบ |
| `LINE_ALBUM_กราฟิก_261101_15.jpg` | 1536×1024 / ไม่ | โลโก้ CEO Domain Quest | `/` | logo | คู่ JPG ของ `Welcome/logo.png`; พื้นขาว |
| `LINE_ALBUM_กราฟิก_261101_16.jpg` | 1536×1024 / ไม่ | effect ใบไม้ ประกาย วงแสง เมฆ | global decoration | effect atlas | คู่ JPG ของ `Welcome/effect.png`; พื้นขาว |
| `LINE_ALBUM_กราฟิก_261101_17.jpg` | 1154×1363 / ไม่ | โดม full-body cutout | `/`, `/dome`, popup | character | คู่ JPG ของ `Welcome/Dome.png`; พื้นขาว |
| `LINE_ALBUM_กราฟิก_261101_18.jpg` | 941×1672 / ไม่ | พื้นหลังเมืองริมทะเล | `/`/`/join` | background | hash ตรงกับ `LINE_ALBUM..._4.jpg` และ `Welcome/bg.png` |
| `messageImage_1793467941503.jpg` | 941×1672 / ไม่ | full welcome screen: โลโก้ โดม พื้นทะเล และไอคอนเสียง | `/` landing/welcome | full mockup | ข้อความ/โลโก้/ปุ่มเสียงฝังภาพ; ใช้เป็น reference หรือ hero ภาพเดียว |
| `1015.mp4` | 960×540, 31.32 s / ไม่มี alpha | ร้านขนมบ้านยาย → มีน/ฟ้า → laptop แสดง globe/DNS → เว็บร้านเปิด | `/mission/m1` learn-path `watch` | video | ตรงกับ m1.watch: โดเมนคือชื่อเว็บ, DNS ค้น IP; ควรเป็น `watch.video` ไม่ใช่ `/dome` |
| `.DS_Store` | ไม่ใช่ภาพ/วิดีโอ | metadata ของ macOS | ไม่มี route | ไฟล์ระบบ | ไม่ควร deploy หรือถือเป็น design media; เป็นสาเหตุที่จำนวนไฟล์รวมเป็น 39 |

## 2. Design system ที่เห็น เทียบกับของปัจจุบัน

### สิ่งที่สื่อส่งมาสื่อสาร

- **Palette:** ฟ้าทะเล/ฟ้าใสประมาณ `#20A9F3`, cyan `#19D5E6`, ม่วงโดม `#8B35F5`, น้ำเงินเข้ม `#1555C8`, ส้ม `#FF7411`, เหลืองทอง `#FFC51B`, เขียว `#2CCB62`, ครีม `#FFF1D6`, น้ำตาลไม้ `#6B2D12`, ชมพู accent `#F58CD5` และเทาเงินสำหรับล็อก/disabled
- **Typography:** ตัวหนากลมแบบ display/cartoon, เส้นขอบขาว/น้ำตาล/น้ำเงินและเงา 3D; ฟอนต์ที่ใช้จริงในภาพระบุไม่ได้จากไฟล์ จึงไม่ควรถือว่าเป็นฟอนต์เว็บ
- **ปุ่ม:** ทรงแคปซูล/สี่เหลี่ยมมุมมนมาก, gradient เหลือง→ส้ม, highlight สีขาว, ขอบสว่างหลายชั้น, เงาลึก, ลูกศรใหญ่; state ใช้สีเขียว/น้ำเงิน/ม่วง/แดง/เทา
- **กรอบ:** ป้ายไม้/กรอบครีมแบบหนา มีใบไม้/โดม/ประกายเป็นส่วนหนึ่งของภาพ; radius โดยสายตาประมาณ 24–40px เมื่อแสดงบน viewport มือถือ
- **Composition:** mobile-first 941×1672 ประมาณ 9:16, ภาพพื้นหลังเต็มจอ, มีข้อความไทยฝังใน artwork จำนวนมาก, character ใหญ่และรายละเอียดแน่น

### ของปัจจุบันใน repo

- ฟอนต์หลักคือ `Noto Sans Thai` จาก `app/layout.tsx`; มี Sarabun ใน `public/fonts` แต่ยังไม่ใช่ default ของแอป
- `app/globals.css` ใช้ semantic OKLCH: brand ม่วง, quest เขียว, spark ส้ม, reward ทอง, surface ครีม; มี `scene-sky`, `btn-base`, `btn-quest`, `btn-go`
- ปุ่มปัจจุบันสูง 48/56px, radius `rounded-lg`/`rounded-xl`, shadow นุ่ม, transition และ focus ring 3px; สีเป็น flat/soft มากกว่า glossy 3D
- การ์ดปัจจุบัน radius 16–32px, shadow นุ่มและ ring บาง; speech bubble ใช้ HTML/CSS และ Dome ใช้ SVG mood (`public/dome/*.svg`)
- `/`, `/home`, `/map`, `/dome` ใช้ `AppShell` สูง `100dvh`, เน้นอ่านได้/ข้อมูลจริง/ไม่ให้ทั้งหน้า scroll; `/map` ใช้ timeline HTML, `/home` ใช้ `ShopStages`, `/dome` ใช้ `DomeChatClient`
- `components/learn/learn-path-scene.tsx` วาดฉาก `shop/dome/diagram/computer/counter/office` ด้วย SVG token; `learn-path-client.tsx` รองรับ `watch.video` และ fallback เป็น still scene

### ความต่าง/ผลกระทบ

1. สื่อใหม่เป็น **glossy 3D + saturated blue/orange/purple** และมี texture/ภาพละเอียดมาก ขณะที่ระบบปัจจุบันเป็น **flat clay + OKLCH soft palette**; การวางภาพตรง ๆ จะทำให้ visual language ขาดความต่อเนื่อง
2. ภาพใหม่มีข้อความไทยขนาดใหญ่ฝังภาพและใช้ display font กลม ส่วนระบบปัจจุบันใช้ HTML text ที่อ่านได้/ปรับได้; ต้องเลือกว่าจะใช้ภาพเป็น art direction หรือทำข้อความใหม่ทับ/แยก layer
3. asset บางชุดเป็นภาพเต็มจอ/ภาพเต็ม popup ไม่ใช่ชุด component ที่ยืดหยุ่น; การใช้บน 390px ต้องคุม `object-position`, crop และ safe area ไม่ให้ข้อความ/ปุ่มในภาพถูกตัด
4. `Welcome/option.png`, `02/ปุ่ม.png` และ JPG คู่กันมีหลายปุ่มอยู่ในภาพเดียว ไม่ตรงกับ `Button` component ที่มี semantic label, disabled/loading/focus/accessibility
5. `1015.mp4` เป็นสื่อที่เข้ากับระบบปัจจุบันที่สุด เพราะ component รองรับ `watch.video` อยู่แล้ว แต่ `m1.watch.video` ใน `content/learn-paths.json` ตอนนี้ยังเป็น `null`; ต้องเพิ่มข้อมูลและยืนยัน path ที่จะ copy ไป public

## 3. แผน integration ต่อหน้าจอ

| หน้าจอ | สิ่งที่ควรเพิ่ม/แทน | ไฟล์ที่น่าจะต้องแตะเมื่ออนุมัติ | การเตรียม asset | effort | ความเสี่ยง |
|---|---|---|---|---|---|
| `/` landing/welcome | ใช้ `Welcome/bg`, logo, Dome และ effect เป็น layered hero; คง CTA เป็น HTML เพื่อเข้าถึงได้ | `app/page.tsx`, `app/globals.css`, อาจ `components/app-shell.tsx` | แปลง bg เป็น WebP/AVIF หลายขนาด; optimize logo/Dome เป็น WebP/PNG; ตัด effect เป็นชิ้นเล็กถ้าจะ animate | M | ภาพใหม่แทน `ShopStages` จะเปลี่ยนความหมายหน้าแรก; logo/ชื่อวิชาในภาพแก้ไม่ได้; ต้องมี alt และ contrast |
| `/join` เข้าสู่ห้องเรียน | ใช้ฉากทะเล + frame เป็น decorative layer แล้ววาง room code/PIN/ปุ่มจริงทับ | `components/join-client.tsx`, `app/join/page.tsx`, `app/globals.css` | ใช้ PNG alpha เท่านั้น; JPG คู่ต้องไม่ใช้; ทำ responsive frame background-position | M | กรอบอาจบีบพื้นที่ฟอร์ม; ข้อความในป้าย/ปุ่มฝังภาพทำให้ validation และ screen reader เสีย |
| `/dome` chat | ใช้ `03/bg.png` เป็นฉาก, ใช้ Dome/แชตเป็น reference; ใช้ `DomeChatClient` HTML bubble จริง | `components/dome-chat-client.tsx`, `components/ui/speech-bubble.tsx`, `components/app-shell.tsx` | Compress background; แยก Dome cutout ถ้าต้องใช้; ไม่ใช้ chat composite เป็นข้อความจริง | M | ฉากสว่าง/รายละเอียดสูงทำให้ bubble อ่านยาก; ภาพ `แชท.png` มีข้อความที่อาจไม่ตรงกับ state/AI จริง |
| `/home` | ยังไม่ควรแทน `ShopStages` ด้วย map artwork; ถ้าต้องการ global skin ให้ใช้ effect/background บางส่วนเท่านั้น | `app/home/page.tsx`, `components/shop-stages.tsx` (เฉพาะเมื่อ product ตัดสินใจ) | ทำ crop/overlay ให้ชื่อร้านและ progress HTML ยังอ่านได้ | M | home ปัจจุบันสะท้อน progress ร้านจากฐานข้อมูล; full mockup ไม่มีพื้นที่สำหรับ dynamic name/progress |
| `/map` mission map | ใช้ภาพ map เป็น reference/state หรือใช้ `map.png` เป็นฉากถ้าจำนวน mission คงที่; แนะนำคง timeline HTML แล้วเพิ่ม illustration/thumbnail | `app/map/page.tsx`, `components/ui/icons.tsx`, อาจ `app/globals.css` | ถ้าใช้ full mockup ต้องทำ 4 state เป็น WebP; ถ้าใช้จริงต้องตัดเกาะ/ป้าย/ล็อกออกเป็น layer | L | ภาพฝังชื่อ m1–m4 และสถานะล็อก; route จริงคำนวณ mission จำนวนเปลี่ยนได้ จึง mismatch ได้ทันที |
| `/mission/m1` learn-path intro | ใช้ `ภารกิจที่ 1/popup.png` เป็น visual reference; คง radio/CTA HTML จาก `learn-path-client.tsx` | `components/learn/learn-path-client.tsx`, `components/learn/learn-path-result.tsx`, `components/learn/app/theme.ts` | ทำ PNG frame/character แยกจากข้อความ; ถ้าใช้ภาพทั้ง popup ต้องทำ interactive overlay | L | radio/ข้อความในภาพแก้ไม่ได้; popup ที่ส่งมาคือ m1 เท่านั้น แต่ component ใช้ทุก mission; เสี่ยงทำ flow เฉพาะ m1 แบบ hardcode |
| `/mission/m1` watch | เพิ่ม `1015.mp4` เป็น `path.watch.video`; เก็บ fallback still/SVG และคำถาม HTML | `content/learn-paths.json`, `components/learn/learn-path-client.tsx`, `public/ui/m1/1015.mp4` | ย้าย video ไป `public/ui/`; encode H.264 + poster WebP; พิจารณา 360/540p; ทำ captions/transcript และ fallback | S | ต้องยืนยัน caption/audio/controls และเกณฑ์ว่าดูจบเมื่อใด; 7 MB ยังหนักสำหรับเครือข่ายโรงเรียน; video ปัจจุบัน 16:9 ขณะที่ app หลัก 9:16 |
| global navigation/CTA | ใช้สี/shape เป็นแรงบันดาลใจ แต่สร้าง `Button`/SVG/HTML ใหม่แทน button sheet | `components/ui/button.tsx`, `components/ui/icons.tsx`, `app/globals.css` | ไม่ใช้ JPG white background; ถ้าต้องการ glossy ให้ export sliced PNG แยกทุก state และทำ @1x/@2x | L | baked text, hover/pressed/disabled/focus ไม่ครบ, ขนาดปุ่มภาพอาจไม่ถึงมาตรฐานนิ้วทุก viewport |

โครงสร้างที่แนะนำเมื่อเริ่ม implement: `public/ui/welcome/`, `public/ui/join/`, `public/ui/dome/`, `public/ui/map/`, `public/ui/m1/`; เก็บ source composite ไว้เป็น reference แยกจาก runtime asset และอย่าใส่ JPG คู่ซ้ำใน production

## 4. คำถามเปิดสำหรับ Product Owner

- จำนวน 39 ที่แจ้งหมายถึงรวม `.DS_Store` หรือมีสื่ออีกหนึ่งไฟล์ที่ยังไม่ถูก copy มา?
- ต้องการแทน visual system เดิมทั้งแอปด้วย glossy 3D ชุดนี้ หรือใช้เฉพาะ welcome/join/mission 1 และคง `/home`, `/map`, `/dome` แบบปัจจุบัน?
- “03 คุยกับโดม” มีไฟล์ `1–4` เป็นแผนที่ภารกิจ ไม่ใช่ภาพแชต — ตั้งใจให้เป็น `/map` หรือเป็นลำดับหลัง `/dome`?
- `/join` ต้องมีขั้น intro “พร้อมเริ่มภารกิจหรือยัง” ก่อนกรอกรหัส หรือผู้เรียนควรเข้าฟอร์มรหัสห้องทันที?
- `/` ต้องใช้ full mockup `messageImage_...jpg` ทั้งภาพ หรือให้ logo/Dome/background แยกชิ้นเพื่อรักษา dynamic CTA และ accessibility?
- ข้อความไทยในภาพอนุมัติให้เป็นข้อความคงที่หรือไม่? ถ้ามีการแก้คำ/เปลี่ยนชื่อวิชา/แปลภาษา ต้องขอ source ที่ไม่มีข้อความฝังภาพหรือไม่?
- ปุ่มภาพต้องมี state hover, pressed, disabled, loading, focus และ keyboard อย่างไร โดยเฉพาะ “ถัดไป” สีเทาและสถานะล็อก?
- ต้องคงการเลือกเส้นทางเรียน 3 แบบของ m1 (`ดู`, `อ่าน`, `ลงมือทำ`) และเปลี่ยนเฉพาะหน้าตา หรือ popup ใหม่เป็น flow แบบเลือกแบบเดียว?
- `1015.mp4` มีเสียงพูด/เพลง/คำบรรยายที่อนุมัติแล้วหรือไม่ และต้องแสดง transcript ภาษาไทยเพื่อ accessibility หรือไม่?
- ยอมรับให้ video auto-play แบบ muted หรือให้ผู้เรียนกดเริ่มทุกครั้ง? “ดูจบ” ต้องนับจาก `ended` เท่านั้นหรือ scrub ได้?
- ต้องการให้แผนที่รองรับจำนวนภารกิจแบบ dynamic ตามระบบปัจจุบัน หรือ lock เป็น 4 เกาะตาม artwork?
- ภาพใหม่ต้องรองรับจอ 390px เป็นหลักตามระบบปัจจุบันหรือมี tablet/desktop composition แยก?
- ต้องการลดน้ำหนัก asset สำหรับเครือข่ายห้องเรียนเป็นเป้าหมายเท่าไร (เช่น initial media < 5 MB)?
- ภาพ character/โลโก้ชุดนี้มีสิทธิ์ใช้งานและไฟล์ต้นฉบับความละเอียดสูง/เลเยอร์แยกหรือไม่?
