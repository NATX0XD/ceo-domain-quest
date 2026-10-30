# -*- coding: utf-8 -*-
import math
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE = "/private/tmp/claude-501/-Users-nattakit-Desktop-Project-TCT-KMUTNB-Computer-Assisted-Instruction-digital-biz-quest/dd1bd986-1731-45c7-98b3-0299de527455/scratchpad/chrome-boards"
SRC = "../screens-v5"

PHONE = {
    "v2-board-1-m1-m2": ("ภารกิจ 1 และ 2 เลือกวิธีเรียน ดู อ่าน", "ระบบแนะนำจากเช็กพื้นฐาน ผู้เรียนเลือกเอง ตอบโดมได้เกิน 60 ครบเกณฑ์", [
        ("m1-01-choose", "เลือกวิธีเรียน"), ("m1-02-watch", "ด่าน 1 ดู"), ("m1-03-scene", "ด่าน 1 ฉากร้านขนม"),
        ("m1-04-qa", "ตอบโดม"), ("m2-01-read", "ด่าน 2 อ่าน แชต"), ("m2-03-all", "ด่าน 2 ชิปตอบด่วน"),
        ("m2-04-qa", "ตอบโดม"), ("m2-05-result", "ครบเกณฑ์")]),
    "v2-board-2-m3": ("ภารกิจ 3 เกม Pixel Counter", "รับลูกค้า 4 คน ถาม ติดป้ายประเภท ประทับตรา มีคู่มือและถามโดมได้", [
        ("m3-01-intro", "เปิดกะ"), ("m3-03-request-card", "ใบคำขอ"), ("m3-04-interview", "ถามลูกค้า"),
        ("m3-06-tag", "ติดป้ายประเภท"), ("m3-08-stamp", "ประทับตรา"), ("m3-12-handbook", "คู่มือ"),
        ("m3-15-dome-hint", "ถามโดม"), ("m3-20-shift-report", "รายงานปิดกะ")]),
    "v2-board-3-m4": ("ภารกิจ 4 ด่านบอส จดชื่อเว็บ", "ค้นชื่อจริง วางขั้นตอน รับมือเหตุการณ์ จ่ายเหรียญจำลอง ตั้งค่า DNS", [
        ("m4-01-intro", "เปิดด่านบอส"), ("m4-14-search-result", "ค้นชื่อจริง"), ("m4-21-docs", "เลือกเอกสาร"),
        ("m4-27-inbox", "อีเมลเหตุการณ์"), ("m4-30-pay", "จ่ายค่าธรรมเนียม"), ("m4-35-dns-filled", "ตั้งค่า DNS"),
        ("m4-37-timeskip", "ข้ามเวลา 1 ปี"), ("m4-47-certificate", "ใบประกาศ")]),
}
DESK = {
    "v2-board-4-teacher": ("แผงครูแบบ CMS บนจอคอม", "แถบเมนูซ้าย เลือกห้อง ตัวเลขสรุป ตารางกรองและเรียงได้ แผงข้างแสดงคำตอบผู้เรียน", [
        ("teacher-report-learn-d", "รายงานเส้นทางเรียนทั้งห้อง"), ("teacher-report-drawer-answers-d", "แผงข้างรายคนพร้อมคำตอบ"),
        ("teacher-student-d", "นักเรียนรายคน"), ("teacher-review-d", "งานรอตรวจ")]),
}

BASE = """body{margin:0;background:#FDF9F1;font-family:'Noto Sans Thai',sans-serif;color:#2B2540;padding:32px}
h1{color:#6041AD;font-size:30px;margin:0 0 6px}p.s{margin:0 0 22px;font-size:18px;color:#4a4560}figure{margin:0}
figcaption{text-align:center;font-size:17px;font-weight:700;margin-top:8px}
img{border-radius:16px;box-shadow:0 6px 18px rgba(53,39,94,.18);display:block;object-fit:cover;object-position:top}"""
PH = ".g{display:grid;grid-template-columns:repeat(4,270px);gap:22px}img{width:270px;height:585px}"
DK = ".g{display:grid;grid-template-columns:repeat(2,560px);gap:24px}img{width:560px;height:350px}"

def render(key, title, sub, items, css, width, row_h):
    figs = "".join(f'<figure><img src="{SRC}/{f}.png"><figcaption>{c}</figcaption></figure>' for f, c in items)
    html = HERE / f"{key}.html"
    html.write_text(f'<!doctype html><meta charset="utf-8"><style>{BASE}{css}</style><h1>{title}</h1><p class="s">{sub}</p><div class="g">{figs}</div>', encoding="utf-8")
    height = 150 + math.ceil(len(items) / (4 if css == PH else 2)) * row_h
    subprocess.run([CHROME, "--headless=new", f"--user-data-dir={PROFILE}", "--disable-gpu", "--hide-scrollbars",
                    f"--window-size={width},{height}", f"--screenshot={HERE / (key + '.png')}", f"file://{html}"], check=True, capture_output=True)
    html.unlink()
    print(key, height)

for k, (t, s, i) in PHONE.items():
    render(k, t, s, i, PH, 1240, 640)
for k, (t, s, i) in DESK.items():
    render(k, t, s, i, DK, 1240, 410)
