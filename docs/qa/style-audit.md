# CEO Domain Quest — visual style audit

วันที่ตรวจ: 2026-11-02  
เกณฑ์: P = ผ่าน, F = ไม่ผ่าน, → = ก่อนแก้ → หลังแก้  
Before อ้างอิงจาก sweep sheet และ priority review ที่ส่งมา; After คือ shared skin/primitives ที่ใช้กับ AppShell/StudentShell และการตรวจ responsive ที่ 390×844 / 1440×844

R1 ฉากเกาะ/ทะเล · R2 ป้ายไม้/หัวข้อแบรนด์ · R3 cream card + ขอบ/เงา · R4 glossy game button · R5 Dome เมื่อมี guidance · R6 ฟอนต์/ขนาดอ่านง่าย · R7 ไม่ล้น/ทับที่มือถือ · R8 desktop มีฉากเบลอและ card กลาง · R9 ใช้ asset ทางการเมื่อมี

| Route | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P |
| /join | P→P | P→P | P→P | F→P | P→P | P→P | P→P | P→P | P→P |
| /teacher | F→P | F→P | F→P | F→P | F→P | P→P | P→P | F→P | P→P |
| /teacher/signup | F→P | F→P | F→P | F→P | F→P | P→P | P→P | F→P | P→P |
| /intro | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P |
| /dome | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P |
| /setup | F→P | F→P | F→P | F→P | P→P | P→P | P→P | F→P | P→P |
| /home | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P |
| /map | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P |
| /pretest | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P |
| /mission/m1 | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P |
| /mission/m2 | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P |
| /mission/m3 | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P |
| /mission/m4 | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P |
| /ceo | F→P | F→P | F→P | F→P | P→P | P→P | P→P | P→P | P→P |
| /posttest | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P |
| /reflect | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P |
| /result | F→P | F→P | F→P | F→P | P→P | P→P | P→P | F→P | P→P |
| /profile | F→P | F→P | F→P | F→P | P→P | P→P | P→P | P→P | P→P |
| /knowledge | F→P | F→P | F→P | F→P | P→P | P→P | P→P | P→P | P→P |
| /rewards | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P |
| /my-site | F→P | F→P | F→P | F→P | P→P | P→P | P→P | P→P | P→P |
| /survey | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P | P→P |
| /check | F→P | F→P | F→P | F→P | P→P | P→P | P→P | P→P | P→P |

## Shared changes

- GameButton, WoodSign, CreamCard, and ThemedPage are reusable primitives in components/ui/game-primitives.tsx.
- Student AppShell/StudentShell pages inherit the island backdrop, cream material cards, wood-sign headings, and one glossy orange primary/cream secondary button language.
- Teacher auth has its own purple glossy primary override while sharing the same material system.
- public/ui/teacher/use-computer.webp is a generated, optimized 3D infographic used by the small-screen teacher recommendation dialog.

