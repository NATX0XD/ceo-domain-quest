# M1 watch captions

สถานะ: ฉบับร่าง (draft)

เครื่องนี้มี `ffmpeg` แต่ไม่มี `whisper`/โมเดลถอดเสียงภาษาไทยที่ใช้งานได้ใน local session จึงทำ WebVTT จากลำดับฉากและบทพูด `watch.scenes` ใน `content/learn-paths.json` พร้อมปรับเวลาโดยประมาณให้ครอบคลุมวิดีโอ 31.324 วินาที

ไฟล์ runtime: `public/captions/m1-watch.th.vtt`

ก่อนเผยแพร่จริงควรตรวจทานกับเสียงใน `UI/1015.mp4` และแก้ timing/คำพูดให้ตรงเสียงทุก cue
