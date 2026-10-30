# -*- coding: utf-8 -*-
import math
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE = "/private/tmp/claude-501/-Users-nattakit-Desktop-Project-TCT-KMUTNB-Computer-Assisted-Instruction-digital-biz-quest/dd1bd986-1731-45c7-98b3-0299de527455/scratchpad/chrome-boards"

BOARDS = {
    "board-1-start": ("เริ่มด่าน เช็กพื้นฐานและเลือกวิธีเรียน", "ทุกภารกิจเริ่มเหมือนกัน ระบบแนะนำ ผู้เรียนเลือกเอง", [
        ("01-intro", "1 เปิดด่าน"), ("02-warmup-q1", "2 เช็กพื้นฐาน 3 ข้อ"), ("03-recommend-choose", "3 ระบบแนะนำ เลือกวิธี"),
        ("09-done-summary", "4 ครบเกณฑ์ สรุปผล"), ("10-mission-after-learn", "5 เข้าจอภารกิจเดิม")]),
    "board-2-watch-read": ("วิธีดู และวิธีอ่าน", "ดูฉากหรืออ่านแชต แล้วตอบโดม 2 ข้อ ได้เกิน 60 ครบเกณฑ์ ถ้ายังไม่ถึงบอกรายข้อว่ายังขาดเรื่องไหน", [
        ("04-watch-scene1", "ดู ฉากที่ 1"), ("05-watch-scene3", "ดู ฉากที่ 3"), ("06-watch-questions", "ตอบโดม 2 ข้อ"),
        ("07-watch-feedback-retry", "ยังไม่ครบ ลองอีกนิด"), ("08-watch-feedback-pass", "ครบเกณฑ์"),
        ("11-read-chat-start", "อ่าน แชตเริ่ม"), ("12-read-chat-mid", "อ่าน แชตกลางเรื่อง"), ("13-read-questions", "อ่านจบ ตอบโดม")]),
    "board-3-do": ("วิธีลงมือทำ ภารกิจ 3 และ 4", "ด่าน 3 เกมเคาน์เตอร์รับจดโดเมน ด่าน 4 จดชื่อเว็บด้วยข้อมูลจริง จ่ายด้วยเหรียญจำลอง", [
        ("17-m3-recommend-do", "ด่าน 3 แนะนำลงมือทำ"), ("18-m3-counter-tag", "ด่าน 3 ติดป้ายประเภท"),
        ("19-m3-counter-stamp", "ด่าน 3 ถามและประทับตรา"), ("20-m3-counter-result", "ด่าน 3 รายงานปิดกะ"),
        ("21-m4-search-result", "ด่าน 4 ค้นชื่อจริง"), ("22-m4-board-empty", "ด่าน 4 แผงเดินเรื่อง"),
        ("23-m4-event", "ด่าน 4 เหตุการณ์"), ("24-m4-board-filled", "ด่าน 4 วางครบ 10 ขั้น"),
        ("25-m4-dns", "ด่าน 4 ตั้งค่า DNS"), ("26-m4-done-summary", "ด่าน 4 สรุปผล")]),
    "board-4-teacher": ("สิ่งที่ครูเห็น", "คะแนนเช็กพื้นฐาน วิธีที่แนะนำกับที่เลือก คะแนน และข้อความที่นักเรียนตอบ", [
        ("14-teacher-report-learn-panel", "รายงานทั้งห้อง"), ("15-teacher-student-qaA-watch", "รายคน สายดู พร้อมคำตอบ"),
        ("16-teacher-student-qaB-do", "รายคน สายลงมือทำ")]),
}

CSS = """body{margin:0;background:#FDF9F1;font-family:'Noto Sans Thai',sans-serif;color:#2B2540;padding:32px}
h1{color:#6041AD;font-size:30px;margin:0 0 6px}p.s{margin:0 0 22px;font-size:18px;color:#4a4560}
.g{display:grid;grid-template-columns:repeat(4,270px);gap:22px}figure{margin:0}
img{width:270px;height:486px;object-fit:cover;object-position:top;border-radius:18px;box-shadow:0 6px 18px rgba(53,39,94,.18);display:block}
figcaption{text-align:center;font-size:17px;font-weight:700;margin-top:8px}"""

for key, (title, sub, items) in BOARDS.items():
    figs = "".join(
        f'<figure><img src="../screens/{f}.png"><figcaption>{c}</figcaption></figure>' for f, c in items
    )
    html = HERE / f"{key}.html"
    html.write_text(
        f'<!doctype html><meta charset="utf-8"><style>{CSS}</style><h1>{title}</h1><p class="s">{sub}</p><div class="g">{figs}</div>',
        encoding="utf-8",
    )
    rows = math.ceil(len(items) / 4)
    height = 150 + rows * 540
    subprocess.run([
        CHROME, "--headless=new", f"--user-data-dir={PROFILE}", "--disable-gpu", "--hide-scrollbars",
        f"--window-size=1240,{height}", f"--screenshot={HERE / (key + '.png')}", f"file://{html}",
    ], check=True, capture_output=True)
    print(key, height)
