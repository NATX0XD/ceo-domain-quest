# -*- coding: utf-8 -*-
"""Build the Thai Word/PDF manual from checked-in, real UI captures."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from tempfile import TemporaryDirectory
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'คู่มือใช้งาน'
OUT.mkdir(parents=True, exist_ok=True)
DOCX = OUT / 'คู่มือการใช้งาน-CEO-Domain-Quest.docx'
FONT_DIR = ROOT / 'public' / 'fonts'
FONT = 'Sarabun'

def shade(cell, fill='FFF1D0'):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd'); shd.set(qn('w:fill'), fill); tcPr.append(shd)

def set_font(target, size=None, bold=None, color=None):
    if hasattr(target, 'font'):
        target.font.name = FONT
        if size: target.font.size = Pt(size)
        if bold is not None: target.font.bold = bold
        if color: target.font.color.rgb = RGBColor.from_string(color)
        rpr = target._element.get_or_add_rPr()
    else:
        for run in target.runs:
            set_font(run, size, bold, color)
        return
    rfonts = rpr.rFonts
    if rfonts is None:
        rfonts = OxmlElement('w:rFonts'); rpr.insert(0, rfonts)
    for attr in ('ascii', 'hAnsi', 'eastAsia', 'cs'):
        rfonts.set(qn(f'w:{attr}'), FONT)

def style_font(style, size, color='342014', bold=False):
    set_font(style, size, bold, color)
    style._element.get_or_add_rPr().rFonts.set(qn('w:cs'), FONT)

def add_page_field(paragraph):
    fld = OxmlElement('w:fldSimple'); fld.set(qn('w:instr'), ' PAGE ')
    r = OxmlElement('w:r'); rpr = OxmlElement('w:rPr'); sz = OxmlElement('w:sz'); sz.set(qn('w:val'), '18'); rpr.append(sz)
    rf = OxmlElement('w:rFonts')
    for a in ('ascii', 'hAnsi', 'eastAsia', 'cs'): rf.set(qn(f'w:{a}'), FONT)
    rpr.insert(0, rf); r.append(rpr)
    t = OxmlElement('w:t'); t.text = '1'; r.append(t); fld.append(r); paragraph._p.append(fld)

def add_picture(paragraph, image, width_cm):
    path = ROOT / 'public' / image.lstrip('/')
    if not path.exists(): raise FileNotFoundError(path)
    run = paragraph.add_run(); run.add_picture(str(path), width=Cm(width_cm)); set_font(run, 10)

def caption(doc, n, text):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(f'รูปที่ {n} · {text}'); set_font(r, 10, False, '725B43'); r.italic = True

def student_pair(doc, items):
    table = doc.add_table(rows=1, cols=2); table.alignment = WD_TABLE_ALIGNMENT.CENTER; table.autofit = False
    for cell, (n, title, instruction, tip, image) in zip(table.rows[0].cells, items):
        cell.width = Cm(8.0); cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
        p = cell.paragraphs[0]; r = p.add_run(f'{n}. {title}'); set_font(r, 14, True, '7F4B22')
        p = cell.add_paragraph(instruction); set_font(p, 10); p.paragraph_format.space_after = Pt(4)
        p = cell.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for im in ([image] if isinstance(image, str) else image): add_picture(p, im, 6.8 if isinstance(image, str) else 3.35)
        p = cell.add_paragraph(f'เคล็ดลับ: {tip}'); shade(cell, 'FFF8E8'); set_font(p, 9, False, '8A4A14')
        p = cell.add_paragraph(f'รูปที่ {n} · {title}'); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; set_font(p, 9, False, '725B43')

def teacher_step(doc, n, title, instruction, tip, image):
    p = doc.add_paragraph(); p.paragraph_format.page_break_before = n > 13 and (n - 13) % 2 == 0; r = p.add_run(f'{n}. {title}'); set_font(r, 17, True, '7F4B22')
    p = doc.add_paragraph(instruction); set_font(p, 11); p.paragraph_format.space_after = Pt(4)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; add_picture(p, image, 13.4)
    caption(doc, n, title)
    t = doc.add_table(rows=1, cols=1); c = t.cell(0, 0); shade(c); c.text = f'เคล็ดลับ: {tip}'; set_font(c.paragraphs[0], 10, False, '8A4A14')

doc = Document(); sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21), Cm(29.7)
sec.top_margin = Cm(1.4); sec.bottom_margin = Cm(1.3); sec.left_margin = Cm(1.7); sec.right_margin = Cm(1.7)
for name, size, color, bold in [('Normal', 12, '342014', False), ('Title', 30, '6239A4', True), ('Heading 1', 23, '6239A4', True), ('Heading 2', 17, '7F4B22', True), ('Heading 3', 14, '7F4B22', True)]:
    style_font(doc.styles[name], size, color, bold)
doc.styles['Normal'].paragraph_format.space_after = Pt(5)
header = sec.header.paragraphs[0]; header.text = 'CEO Domain Quest  |  คู่มือการใช้งาน'; set_font(header, 9, False, '725B43')
footer = sec.footer.paragraphs[0]; footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = footer.add_run('วิชา 21910-2002  •  หน้า '); set_font(r, 9); add_page_field(footer)

p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before = Pt(35); add_picture(p, '/manual/logo.png', 10)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; add_picture(p, '/manual/dome-wave.png', 5.2)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; r = p.add_run('คู่มือการใช้งาน'); set_font(r, 30, True, '7F4B22')
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; r = p.add_run('CEO Domain Quest\n'); set_font(r, 22, True, '6239A4'); r = p.add_run('วิชา 21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล'); set_font(r, 14, True)
doc.add_page_break()

doc.add_heading('สารบัญ', level=1)
toc = [('ภาพรวมระบบ', 3), ('ส่วนที่ 1 สำหรับนักเรียน', 4), ('1 เข้าห้องเรียน · 2 ทำความรู้จักเกม', 4), ('3 ถามโดม · 4 แต่งร้าน', 5), ('5 แผนที่ภารกิจ · 6 Pretest', 6), ('7 M1–M2 · 8 M3 Pixel Counter', 7), ('9 M4 Registrar · 10 บอส CEO', 8), ('11 ย้ายเครื่อง · 12 ขอความช่วยเหลือ', 9), ('ส่วนที่ 2 สำหรับครู', 10), ('13–14 เข้าสู่ระบบและคุมคาบสด', 10), ('15 Board · 16 นักเรียน', 11), ('17 Review queue · 18 Requests', 12), ('19 Reports · 20 Showcase', 13), ('21 Settings / Demo / AI', 14)]
for title, page in toc:
    p = doc.add_paragraph(); p.paragraph_format.left_indent = Cm(.4); r = p.add_run(f'{title}  {"·" * 6}  {page}'); set_font(r, 12, title.startswith('ส่วนที่'))
doc.add_paragraph('ภาพหน้าจอในคู่มือนี้ถ่ายจากระบบจริง: นักเรียน 390 × 844 และครู 1440 × 900 หลังเข้าสู่ระบบแล้ว')
doc.add_page_break()

doc.add_heading('ภาพรวมระบบ', level=1)
doc.add_paragraph('CEO Domain Quest เป็นสื่อการสอนแบบเกมสำหรับวิชา 21910-2002 นักเรียนสร้างร้าน เรียนรู้โดเมนและ DNS ผ่าน 4 ภารกิจ แล้วนำความรู้ไปตัดสินใจในด่านบอส CEO ครูเปิดห้อง คุมเวลา ดูความคืบหน้า ตรวจงาน และช่วยเหลือจากแผงควบคุม')
t = doc.add_table(rows=1, cols=3); t.alignment = WD_TABLE_ALIGNMENT.CENTER
for c, txt in zip(t.rows[0].cells, ['นักเรียน', 'ภารกิจ', 'ครู']): c.text = txt; shade(c, 'E9DDFC'); set_font(c.paragraphs[0], 13, True, '6239A4')
for row in [('เข้าห้องด้วยรหัส + PIN', 'M1–M4 และบอส CEO', 'เปิดห้องและคุมเฟส'), ('ดู อ่าน ลงมือทำ', 'ดาว เหรียญ และคลังความรู้', 'ตรวจงาน/รายงาน/โชว์เคส')]:
    cells = t.add_row().cells
    for c, txt in zip(cells, row): c.text = txt; set_font(c.paragraphs[0], 11)
doc.add_heading('ส่วนที่ 1 สำหรับนักเรียน', level=1)
doc.add_paragraph('ใช้มือถือหรือแท็บเล็ตแนวตั้ง เปิดลิงก์จากครู แล้วทำตามหมายเลขทีละขั้น ภาพภารกิจใช้หน้าจอเกมจริงที่มีโจทย์และปุ่มดำเนินการ')
doc.add_page_break()

student = [
('เข้าห้องเรียน','เปิดลิงก์จากครู ใส่รหัสห้อง ชื่อเล่น และ PIN 4 หลัก','จำ PIN ไว้สำหรับย้ายเครื่อง','/manual/student-join.png'),
('ทำความรู้จักเกม','อ่านการ์ดแนะนำ แล้วเริ่มรู้จักกันเพื่อไปยังเส้นทางของตัวเอง','กดข้ามได้ถ้าครูบอกให้เริ่มทันที','/manual/shot-home.png'),
('ถามโดม','เปิดแชต ถามเรื่องบทเรียน และอ่านคำตอบที่ปลดล็อกแล้ว','โดมตอบเฉพาะเนื้อหาของบทเรียนที่ถึงแล้ว','/manual/shot-dome.png'),
('แต่งร้าน','เลือกประเภทร้าน ชื่อร้าน และชื่อเว็บให้ครบ 5 ข้อ','เลือกข้อมูลที่ตรงกับไอเดียธุรกิจของตัวเอง','/manual/student-setup.png'),
('แผนที่ภารกิจ','แตะแผนที่เพื่อดูเกาะที่พร้อมเล่น และอ่านเป้าหมายของด่าน','ทำตามลำดับ M1 ถึง M4','/manual/shot-map.png'),
('Pretest และวิธีเรียน','เริ่มพื้นฐาน 3 ข้อ แล้วเลือก ดู อ่าน หรือ ลงมือทำ','เลือกช่องทางที่เหมาะกับตัวเองได้','/manual/m1-gameplay.png'),
('M1–M2','อ่านโจทย์จริงของด่าน แล้วเลือกคำตอบหรือวิธีเรียนตามที่ระบบขอ','กดอ่านเรื่องเต็มก่อนตอบ','/manual/m2-gameplay.png'),
('M3 Pixel Counter','จับคู่ลูกค้า/คำขอกับชนิดโดเมน แล้วตรวจผลในเกม','สังเกต .com, .org และ .net','/manual/m3-gameplay.png'),
('M4 Registrar','ค้นหาชื่อโดเมน กรอกข้อมูลนายทะเบียน และตรวจเอกสาร','ทำทีละขั้น: ค้นหา → กรอก → ตรวจ → ยืนยัน','/manual/m4-gameplay.png'),
('บอส CEO และรางวัล','ใช้ความรู้ทั้งหมดส่งคำตอบบอส แล้วดูผล รางวัล และโปรไฟล์','ตรวจคำตอบก่อนกดยืนยัน','/manual/ceo-boss.png'),
('ย้ายเครื่อง','เปิดลิงก์เดิม กด “เคยเข้าแล้ว ย้ายเครื่อง” แล้วใส่ชื่อเดิมกับ PIN เดิม','ใช้ชื่อเล่นเดิมเพื่อรักษาความคืบหน้า',['/manual/student-move-start.png','/manual/student-move-form.png']),
('ขอความช่วยเหลือ','ในภารกิจ กด “ถามโดม” เพื่อขอคำใบ้ หรือกด “ตัวช่วย” แล้วเลือก “ขอให้ครูช่วย” เมื่อติดจริง','บอกสิ่งที่ลองทำแล้ว ครูจะช่วยได้เร็วขึ้น','/manual/m3-gameplay.png'),
]
for start in range(0, len(student), 2):
    if start: doc.add_page_break()
    student_pair(doc, [(i+1, *student[i]) for i in range(start, min(start+2, len(student)))])

doc.add_page_break(); doc.add_heading('ส่วนที่ 2 สำหรับครู', level=1); doc.add_paragraph('ภาพครูเป็นหน้าจอจริงหลังเข้าสู่ระบบ ใช้จอ 1440 × 900 หรือโปรเจกเตอร์ เมนูด้านซ้ายใช้เปลี่ยนบริบทการสอน')
teacher = [
('เข้าสู่ระบบครู','ใช้บัญชีครูที่ผู้ดูแลสร้างไว้ แล้วเลือกห้องเรียนจากแถบด้านบน','อย่าแชร์รหัสผ่านหรือภาพ QR ของห้องนอกชั้นเรียน','/manual/teacher-captures/live.png'),
('คุมคาบสด','ดู phase และเวลา เพิ่ม/หยุด/ตั้งเวลาใหม่ หรือไปช่วงถัดไป','ประกาศเป้าหมายก่อนเปิดเฟสให้ผู้เรียน','/manual/teacher-captures/live-2.png'),
('Board / Projector','เปิดห้องเรียนสดเพื่อฉายสถานะ คำขอ และข้อมูลรวมหน้าห้อง','ใช้จอฉายห้องเมื่อไม่ต้องการแสดงรายละเอียดรายคน','/manual/teacher-captures/board.png'),
('นักเรียนรายคน','เลือกชื่อเพื่อดูดาว เป้าหมาย ช่องทางเรียน และความคืบหน้ารายภารกิจ','ใช้หน้ารายงานรายคนเมื่อต้องคุยแบบเฉพาะบุคคล','/manual/teacher-captures/student.png'),
('Review queue','เปิดงานที่รอตรวจ อ่านหลักฐาน ให้คะแนน และยืนยันหรือส่งกลับ','เขียน feedback ที่บอกการกระทำถัดไป','/manual/teacher-captures/review.png'),
('Requests','ดูคำขอจากนักเรียน เลือกให้ตามคำขอ ให้ทางเลือกอื่น หรือยังไม่ให้','ตอบคำขอที่ค้างก่อนเปลี่ยนเฟส','/manual/teacher-captures/requests.png'),
('Reports และ CSV','ดู E1/E2 กราฟเป้าหมาย และกดส่งออกข้อมูลของห้อง','ตรวจชื่อห้องก่อนดาวน์โหลดหรือพิมพ์รายงาน','/manual/teacher-captures/report.png'),
('Showcase','เลือกผลงานเด่น ปักหมุดหรือซ่อนข้อความ แล้วเปิดบนจอหน้าห้อง','ขออนุญาตก่อนนำชื่อ/ผลงานขึ้นจอ','/manual/teacher-captures/showcase.png'),
('Settings / Demo / AI','เปิดการทดสอบก่อนเรียน ตั้งค่าห้อง และสลับ AI ช่วยคิดตามบริบท','ทดสอบสวิตช์ก่อนเริ่มคาบจริง','/manual/teacher-captures/settings.png'),
]
for n, data in enumerate(teacher, 13):
    teacher_step(doc, n, *data)

doc.save(DOCX)

# Add the full OFL font file to the DOCX package and declare it embeddable.
with TemporaryDirectory() as tmp:
    tmp_path = Path(tmp)
    with ZipFile(DOCX) as z: z.extractall(tmp_path)
    font_table = tmp_path / 'word' / 'fontTable.xml'
    xml = font_table.read_text(encoding='utf-8')
    content_types = tmp_path / '[Content_Types].xml'
    content_xml = content_types.read_text(encoding='utf-8')
    if 'PartName="/word/fonts/Sarabun-Regular.ttf"' not in content_xml:
        content_xml = content_xml.replace('</Types>', '<Override PartName="/word/fonts/Sarabun-Regular.ttf" ContentType="application/x-font-ttf"/></Types>')
        content_types.write_text(content_xml, encoding='utf-8')
    rels = tmp_path / 'word' / '_rels' / 'fontTable.xml.rels'
    rel_xml = rels.read_text(encoding='utf-8') if rels.exists() else '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
    rel_id = 'rIdSarabun'
    if rel_id not in rel_xml:
        rel_xml = rel_xml.replace('</Relationships>', f'<Relationship Id="{rel_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/Sarabun-Regular.ttf"/></Relationships>')
    if f'w:name="{FONT}"' not in xml:
        xml = xml.replace('</w:fonts>', f'<w:font w:name="{FONT}"><w:embedRegular r:id="{rel_id}"/></w:font></w:fonts>')
    font_table.write_text(xml, encoding='utf-8'); rels.parent.mkdir(parents=True, exist_ok=True); rels.write_text(rel_xml, encoding='utf-8')
    (tmp_path / 'word' / 'fonts').mkdir(exist_ok=True)
    (tmp_path / 'word' / 'fonts' / 'Sarabun-Regular.ttf').write_bytes((FONT_DIR / 'Sarabun-Regular.ttf').read_bytes())
    with ZipFile(DOCX, 'w', ZIP_DEFLATED) as z:
        for file in tmp_path.rglob('*'):
            if file.is_file(): z.write(file, file.relative_to(tmp_path).as_posix())
print(DOCX)
