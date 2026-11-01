# -*- coding: utf-8 -*-
from pathlib import Path
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'คู่มือใช้งาน'
OUT.mkdir(parents=True, exist_ok=True)
DOCX = OUT / 'คู่มือการใช้งาน-CEO-Domain-Quest.docx'

def shade(cell, fill='FFF1D0'):
    tcPr = cell._tc.get_or_add_tcPr(); shd = OxmlElement('w:shd'); shd.set(qn('w:fill'), fill); tcPr.append(shd)

def page_field(p):
    r = p.add_run(); f = OxmlElement('w:fldSimple'); f.set(qn('w:instr'), 'PAGE'); r._r.append(f)

def pic(doc, rel, width=6.4):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    path = ROOT / 'public' / rel.lstrip('/')
    if path.suffix == '.webp': path = ROOT / 'public' / 'manual' / (path.stem + '.png')
    if path.exists(): p.add_run().add_picture(str(path), width=Cm(width))

def step(doc, n, title, instruction, tip, image):
    doc.add_heading(f'{n}. {title}', level=2)
    doc.add_paragraph(instruction)
    t = doc.add_table(rows=1, cols=1); t.alignment = WD_TABLE_ALIGNMENT.CENTER; c = t.cell(0, 0); shade(c)
    c.text = f'เคล็ดลับ: {tip}'
    pic(doc, image)
    p = doc.add_paragraph(f'รูปที่ {n} · {title}'); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.runs[0].italic = True

doc = Document(); sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21), Cm(29.7); sec.top_margin = sec.bottom_margin = Cm(1.8); sec.left_margin = Cm(2.1); sec.right_margin = Cm(1.8)
for name, size, color in [('Normal', 15, '342014'), ('Title', 30, '6239A4'), ('Heading 1', 24, '6239A4'), ('Heading 2', 19, '7F4B22')]:
    s = doc.styles[name]; s.font.name = 'Sarabun'; s._element.rPr.rFonts.set(qn('w:eastAsia'), 'Sarabun'); s.font.size = Pt(size); s.font.color.rgb = RGBColor.from_string(color)
doc.styles['Heading 1'].font.bold = True; doc.styles['Heading 2'].font.bold = True
doc.sections[0].header.paragraphs[0].text = 'CEO Domain Quest  |  คู่มือการใช้งาน'
f = doc.sections[0].footer.paragraphs[0]; f.alignment = WD_ALIGN_PARAGRAPH.CENTER; f.add_run('วิชา 21910-2002  •  หน้า '); page_field(f)

p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before = Pt(40); p.add_run().add_picture(str(ROOT/'public/manual/logo.png'), width=Cm(10.5))
pic(doc, '/landing/dome-wave.webp', 5.4)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; r = p.add_run('คู่มือการใช้งาน'); r.bold = True; r.font.size = Pt(30); r.font.color.rgb = RGBColor(127,75,34)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.add_run('CEO Domain Quest\n').bold = True; p.add_run('วิชา 21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล')
doc.add_page_break(); doc.add_heading('สารบัญ', level=1)
p = doc.add_paragraph(); fld = OxmlElement('w:fldSimple'); fld.set(qn('w:instr'), 'TOC \\o "1-3" \\h \\z \\u'); p._p.append(fld)
doc.add_paragraph('เปิดไฟล์ใน Microsoft Word แล้วเลือก Update Field เพื่ออัปเดตเลขหน้าในสารบัญ.'); doc.add_page_break()

doc.add_heading('ภาพรวมระบบ', level=1)
doc.add_paragraph('CEO Domain Quest เป็นสื่อการสอนแบบเกมสำหรับวิชา 21910-2002 นักเรียนจะสร้างร้านในฝัน เรียนรู้เรื่องโดเมนและ DNS ผ่าน 4 ภารกิจ ก่อนนำความรู้ไปใช้ในด่านบอส CEO โดยครูสามารถเปิดห้อง คุมเวลา ดูความคืบหน้า และช่วยเหลือได้จากแผงควบคุมครู')
t = doc.add_table(rows=1, cols=3); t.alignment = WD_TABLE_ALIGNMENT.CENTER
for c, txt in zip(t.rows[0].cells, ['นักเรียน', 'ภารกิจ', 'ครู']): c.text = txt; shade(c, 'E9DDFC')
for row in [('เข้าห้องด้วยรหัส + PIN', 'M1–M4 และบอส CEO', 'เปิดห้องและคุมเฟส'), ('ดู อ่าน ลงมือทำ', 'ดาว เหรียญ และความรู้', 'ตรวจงาน/รายงาน/โชว์เคส')]:
    cells = t.add_row().cells
    for c, txt in zip(cells, row): c.text = txt
doc.add_paragraph('อุปกรณ์แนะนำ: โทรศัพท์หรือแท็บเล็ตสำหรับนักเรียน (390 × 844) และจอ 1440 × 900 สำหรับครูหรือโปรเจกเตอร์')

student = [('เข้าห้องเรียน','เปิดลิงก์จากครู ใส่รหัสห้อง ชื่อเล่น และ PIN 4 หลัก','จำ PIN ไว้สำหรับย้ายเครื่องหรือกลับมาเล่นต่อ','/manual/student-join.png'),('บทนำและบ้านของเรา','อ่านคำทักทายจากโดม แล้วดูหน้า Home เพื่อเช็กดาว ร้าน และภารกิจถัดไป','กดไอคอนบ้านเพื่อกลับหน้าเริ่มต้น','/landing/shot-home.webp'),('แชตกับโดม','เปิด Dome chat ถามเรื่องบทเรียน และอ่านคำตอบที่ให้เป็นคำใบ้','โดมตอบเฉพาะบทเรียนที่ปลดล็อก','/landing/shot-dome.webp'),('ตั้งค่าร้าน','เลือกประเภทร้าน ชื่อร้าน และของตกแต่งให้ตรงกับไอเดียธุรกิจ','เลือกตามเหตุผลของตัวเอง','/setup/bakery.webp'),('แผนที่ภารกิจ','เปิด Map แตะเกาะที่พร้อมเล่น แล้วอ่านเป้าหมายก่อนเริ่ม','ทำตามลำดับ M1 ถึง M4','/landing/shot-map.webp'),('Pretest และวิธีเรียน','ตอบก่อนเรียน 3 ข้อ แล้วเลือก ดู / อ่าน / ลงมือทำ','เลือกวิธีที่เหมาะกับตัวเอง','/landing/shot-choose.webp'),('M1 และ M2','เรียนรู้โดเมน โครงสร้างชื่อ และ DNS ผ่านวิดีโอ บัตรความรู้ และกิจกรรม','กดถัดไปเมื่ออ่านจบ','/learn/m1/watch-s1.webp'),('M3 Pixel Counter','จับคู่ลูกค้ากับชื่อโดเมนให้ถูกประเภท แล้วตรวจคะแนน','สังเกต .com, .org และ .net','/learn/m3/bg-pixel-office.webp'),('M4 Registrar','ค้นหาและจดทะเบียนชื่อโดเมน ตรวจความพร้อม แล้วส่งคำตอบ','อ่านชื่อร้านทีละส่วนก่อนยืนยัน','/learn/m4/boss-door.webp'),('บอส CEO และรางวัล','เลือกชื่อเว็บ ตอบคำถามบอส แล้วดู rewards, knowledge และ profile','เปิดโปรไฟล์เพื่อทบทวนสิ่งที่เรียน','/landing/shot-play.webp'),('ย้ายอุปกรณ์','ใส่รหัสห้อง ชื่อเล่นเดิม และ PIN เดิมบนอุปกรณ์ใหม่','ใช้ชื่อเล่นเดิมเพื่อรักษาความคืบหน้า','/manual/student-join.png'),('ขอความช่วยเหลือ','แตะปุ่มขอความช่วยเหลือ เลือกหัวข้อ และรอคำตอบจากครู','เขียนสิ่งที่ลองทำแล้วสั้น ๆ','/landing/shot-dome.webp')]
doc.add_heading('ส่วนที่ 1 สำหรับนักเรียน', level=1); doc.add_paragraph('ทำตามหมายเลขบนหน้าจอทีละขั้น หากปุ่มยังล็อก แปลว่ายังมีบทเรียนหรือเฟสที่ต้องทำก่อน')
for i, x in enumerate(student, 1): step(doc, i, *x)

teacher = [('สมัครด้วย Invite code / เข้าสู่ระบบ','เปิด /teacher/signup หากมีหน้า signup ใส่ invite code แล้วใช้ email และรหัสผ่านเข้าสู่ระบบ','อย่าแชร์รหัสผ่านในห้องเรียน','/landing/shot-teacher.webp'),('คุมคาบสด','เลือกห้อง ตั้ง timer และเปลี่ยน phase ระหว่าง intro, learn, practice และ reflect','ประกาศเวลาและเป้าหมายก่อนเปิดเฟส','/manual/teacher-dashboard.png'),('Board / Projector','เปิด Board เพื่อฉายรหัสห้อง คำสั่ง และสถานะรวม','ใช้โหมดเต็มจอเมื่อต่อโปรเจกเตอร์','/manual/teacher-board.png'),('รายชื่อนักเรียน','เปิด Students ดูสถานะ คะแนน และความคืบหน้ารายคน','ใช้ชื่อเล่นที่นักเรียนแจ้ง','/manual/teacher-students.png'),('Review queue','อ่านชิ้นงาน ยืนยันคะแนน หรือส่งกลับให้แก้ไข','เขียน feedback ที่บอกการกระทำถัดไป','/manual/teacher-dashboard.png'),('Requests','ดูคำขอความช่วยเหลือและตอบตามความเร่งด่วน','ปิดคำขอเมื่อช่วยเสร็จ','/manual/teacher-students.png'),('Reports และ CSV','ดูกราฟผลการเรียนรายคน/ทั้งห้อง และกด Export CSV','ตรวจห้องเรียนก่อนดาวน์โหลด','/manual/teacher-report.png'),('Showcase','เลือกผลงานขึ้น Showcase แล้วเปิดบน Board','ขออนุญาตก่อนนำชื่อขึ้นจอ','/manual/teacher-board.png'),('Settings / Demo mode / AI switch','ตั้งค่าห้อง เปิด Demo mode และสลับ AI ตามบริบท','ทดสอบสวิตช์ก่อนเริ่มคาบ','/manual/teacher-settings.png')]
doc.add_heading('ส่วนที่ 2 สำหรับครู', level=1); doc.add_paragraph('แผงครูออกแบบสำหรับจอใหญ่ 1440 × 900 และโปรเจกเตอร์ เมนูด้านข้างใช้เปลี่ยนบริบทการสอน')
for i, x in enumerate(teacher, len(student)+1): step(doc, i, *x)

doc.add_heading('การแก้ปัญหาเบื้องต้น', level=1)
for h, b in [('กลับมาเล่นต่อไม่ได้','ตรวจรหัสห้อง ชื่อเล่น และ PIN ให้ตรงกับครั้งแรก'),('ภาพไม่พอดีจอ','หมุนมือถือเป็นแนวตั้งสำหรับนักเรียน หรือใช้ปุ่มเต็มจอบน Board'),('ไม่เห็นภารกิจถัดไป','ตรวจ phase ของห้องและทำกิจกรรมก่อนหน้าให้เสร็จ'),('ต้องการความช่วยเหลือ','ติดต่อครูพร้อมรหัสห้อง ชื่อเล่น และหน้าที่กำลังเปิด')]: doc.add_heading(h, level=2); doc.add_paragraph(b)
doc.save(DOCX); print(DOCX)
