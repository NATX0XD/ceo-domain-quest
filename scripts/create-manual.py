# -*- coding: utf-8 -*-
"""Build the Thai Word/PDF user manual matching the competition template format."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from tempfile import TemporaryDirectory
import docx
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

FONT_NAME = 'TH Sarabun New'
USER_FONTS = Path('/Users/nattakit/Library/Fonts')
PUB_FONTS = ROOT / 'public' / 'fonts'

def to_thai_num(n):
    thai_digits = '๐๑๒๓๔๕๖๗๘๙'
    return ''.join(thai_digits[int(d)] if d.isdigit() else d for d in str(n))

def set_font(target, size=None, bold=None):
    if hasattr(target, 'font'):
        target.font.name = FONT_NAME
        if size: target.font.size = Pt(size)
        if bold is not None: target.font.bold = bold
        target.font.color.rgb = RGBColor(0, 0, 0)
        rpr = target._element.get_or_add_rPr()
    else:
        for run in target.runs:
            set_font(run, size, bold)
        return
    rfonts = rpr.rFonts
    if rfonts is None:
        rfonts = OxmlElement('w:rFonts')
        rpr.insert(0, rfonts)
    for attr in ('ascii', 'hAnsi', 'eastAsia', 'cs'):
        rfonts.set(qn(f'w:{attr}'), FONT_NAME)
    if size:
        sz_cs = rpr.find(qn('w:szCs'))
        if sz_cs is None:
            sz_cs = OxmlElement('w:szCs')
            rpr.append(sz_cs)
        sz_cs.set(qn('w:val'), str(int(size * 2)))

def style_font(style, size, bold=False):
    style.font.name = FONT_NAME
    style.font.size = Pt(size)
    style.font.bold = bold
    style.font.color.rgb = RGBColor(0, 0, 0)
    rpr = style._element.get_or_add_rPr()
    rfonts = rpr.rFonts
    if rfonts is None:
        rfonts = OxmlElement('w:rFonts')
        rpr.insert(0, rfonts)
    for attr in ('ascii', 'hAnsi', 'eastAsia', 'cs'):
        rfonts.set(qn(f'w:{attr}'), FONT_NAME)
    sz_cs = rpr.find(qn('w:szCs'))
    if sz_cs is None:
        sz_cs = OxmlElement('w:szCs')
        rpr.append(sz_cs)
    sz_cs.set(qn('w:val'), str(int(size * 2)))

def add_page_field(paragraph):
    fld = OxmlElement('w:fldSimple')
    fld.set(qn('w:instr'), ' PAGE ')
    r = OxmlElement('w:r')
    rpr = OxmlElement('w:rPr')
    sz = OxmlElement('w:sz')
    sz.set(qn('w:val'), '28') # 14 pt
    rpr.append(sz)
    sz_cs = OxmlElement('w:szCs')
    sz_cs.set(qn('w:val'), '28')
    rpr.append(sz_cs)
    rf = OxmlElement('w:rFonts')
    for a in ('ascii', 'hAnsi', 'eastAsia', 'cs'):
        rf.set(qn(f'w:{a}'), FONT_NAME)
    rpr.append(rf)
    r.append(rpr)
    t = OxmlElement('w:t')
    t.text = '1'
    r.append(t)
    fld.append(r)
    paragraph._p.append(fld)

def add_hyperlink(paragraph, url, text):
    part = paragraph.part
    r_id = part.relate_to(url, docx.opc.constants.RELATIONSHIP_TYPE.HYPERLINK, is_external=True)
    hyperlink = OxmlElement('w:hyperlink')
    hyperlink.set(qn('r:id'), r_id)
    new_run = OxmlElement('w:r')
    rPr = OxmlElement('w:rPr')
    u = OxmlElement('w:u')
    u.set(qn('w:val'), 'single')
    rPr.append(u)
    c = OxmlElement('w:color')
    c.set(qn('w:val'), '000000')
    rPr.append(c)
    rf = OxmlElement('w:rFonts')
    for a in ('ascii', 'hAnsi', 'eastAsia', 'cs'):
        rf.set(qn(f'w:{a}'), FONT_NAME)
    rPr.append(rf)
    sz = OxmlElement('w:sz')
    sz.set(qn('w:val'), '32') # 16 pt
    rPr.append(sz)
    sz_cs = OxmlElement('w:szCs')
    sz_cs.set(qn('w:val'), '32')
    rPr.append(sz_cs)
    new_run.append(rPr)
    t = OxmlElement('w:t')
    t.text = text
    new_run.append(t)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)

def add_picture(paragraph, image, width_cm):
    path = ROOT / 'public' / image.lstrip('/')
    if not path.exists():
        raise FileNotFoundError(path)
    run = paragraph.add_run()
    run.add_picture(str(path), width=Cm(width_cm))
    set_font(run, 16)

def set_table_borders(table):
    tblPr = table._tbl.tblPr
    tblBorders = OxmlElement('w:tblBorders')
    for border_name in ['top', 'left', 'bottom', 'right', 'insideH']:
        border = OxmlElement(f'w:{border_name}')
        border.set(qn('w:val'), 'single')
        border.set(qn('w:sz'), '4') # 0.5 pt
        border.set(qn('w:space'), '0')
        border.set(qn('w:color'), '000000')
        tblBorders.append(border)
    border = OxmlElement('w:insideV')
    border.set(qn('w:val'), 'single')
    border.set(qn('w:sz'), '4')
    border.set(qn('w:space'), '0')
    border.set(qn('w:color'), '000000')
    tblBorders.append(border)
    tblPr.append(tblBorders)

# Initialize Document
doc = Document()

# Page Setup: A4, 1-inch (2.54 cm) margins on all sides
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21), Cm(29.7)
sec.top_margin = Cm(2.54)
sec.bottom_margin = Cm(2.54)
sec.left_margin = Cm(2.54)
sec.right_margin = Cm(2.54)

# Styles
for name, size, bold in [
    ('Normal', 16, False),
    ('Title', 50, True),
    ('Heading 1', 18, True),
    ('Heading 2', 16, True),
    ('Heading 3', 16, True),
]:
    style_font(doc.styles[name], size, bold)

doc.styles['Normal'].paragraph_format.space_before = Pt(0)
doc.styles['Normal'].paragraph_format.space_after = Pt(4)
doc.styles['Normal'].paragraph_format.line_spacing = 1.0

# Header and Footer: No header. Centered page number in footer on later pages.
sec.different_first_page_header_footer = True
sec.header.paragraphs[0].text = ''

footer = sec.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_page_field(footer)

# ==============================================================================
# PAGE 1: COVER (Matching Page 38 of reference docs/แข่งสื่อ-2.pdf)
# Vertically and horizontally centered title, 50 pt Bold, black, no images.
# ==============================================================================
p_cover = doc.add_paragraph()
p_cover.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_cover.paragraph_format.space_before = Pt(255)
p_cover.paragraph_format.space_after = Pt(12)
p_cover.paragraph_format.line_spacing = 1.15

r = p_cover.add_run('คู่มือการใช้งาน\n')
set_font(r, 50, True)

r = p_cover.add_run('เกม CEO Domain Quest\n')
set_font(r, 44, True)

r = p_cover.add_run('วิชา 21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล')
set_font(r, 18, True)

doc.add_page_break()

# ==============================================================================
# PAGE 2: TITLE & OVERVIEW (Matching Page 39 of reference)
# ==============================================================================
# Title at top of content section (20 pt Bold, Centered)
p_title = doc.add_paragraph()
p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_title.paragraph_format.space_before = Pt(0)
p_title.paragraph_format.space_after = Pt(8)
r = p_title.add_run('คู่มือการใช้งานเกม CEO Domain Quest')
set_font(r, 20, True)

# Overview Paragraph (Indented 1.27 cm, 16 pt Regular)
p_intro = doc.add_paragraph()
p_intro.paragraph_format.first_line_indent = Cm(1.27)
p_intro.paragraph_format.space_after = Pt(6)
p_intro.paragraph_format.line_spacing = 1.0
r = p_intro.add_run(
    'CEO Domain Quest เป็นสื่อการสอนแบบเกมสำหรับวิชา 21910-2002 '
    'นักเรียนสร้างร้าน เรียนรู้โดเมนและ DNS ผ่าน 4 ภารกิจ '
    'แล้วนำความรู้ไปตัดสินใจในด่านบอส CEO ครูเปิดห้อง คุมเวลา ดูความคืบหน้า '
    'ตรวจงาน และช่วยเหลือจากแผงควบคุม'
)
set_font(r, 16, False)

# System Overview Table (Clean borders, no shading, all black text)
tbl = doc.add_table(rows=1, cols=3)
tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
tbl.autofit = False
set_table_borders(tbl)

headers = ['นักเรียน', 'ภารกิจ', 'ครู']
for i, (c, txt) in enumerate(zip(tbl.rows[0].cells, headers)):
    c.width = Cm(5.0)
    c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    p = c.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(txt)
    set_font(r, 16, True)

rows_data = [
    ('เข้าห้องด้วยรหัส + PIN', '4 ภารกิจ และด่านบอส', 'เปิดห้องและคุมเวลาเรียน'),
    ('ดู อ่าน ลงมือทำ', 'ดาว เหรียญ และคลังความรู้', 'ตรวจงาน ดูผลการเรียน ผลงานเด่น')
]
for row in rows_data:
    cells = tbl.add_row().cells
    for c, txt in zip(cells, row):
        c.width = Cm(5.0)
        c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(3)
        r = p.add_run(txt)
        set_font(r, 15, False)

p_url = doc.add_paragraph()
p_url.paragraph_format.first_line_indent = Cm(1.27)
p_url.paragraph_format.space_before = Pt(8)
r = p_url.add_run('เข้าใช้งานได้ที่ ')
set_font(r, 16, False)
add_hyperlink(p_url, 'https://ceo-domain-quest.vercel.app', 'https://ceo-domain-quest.vercel.app')
r = p_url.add_run(' ใช้ลิงก์เดียวกันทั้งนักเรียนและครู เปิดได้ทั้งมือถือและคอมพิวเตอร์')
set_font(r, 16, False)

p_note = doc.add_paragraph()
p_note.paragraph_format.first_line_indent = Cm(1.27)
p_note.paragraph_format.space_before = Pt(4)
p_note.paragraph_format.space_after = Pt(12)
r = p_note.add_run('ภาพในคู่มือนี้ถ่ายจากระบบจริง ฝั่งนักเรียนใช้มือถือ ฝั่งครูใช้คอมพิวเตอร์')
set_font(r, 16, False)

# Section 1 Header on Page 2
p_s1 = doc.add_paragraph()
p_s1.paragraph_format.space_before = Pt(8)
p_s1.paragraph_format.space_after = Pt(4)
r = p_s1.add_run('ส่วนที่ ๑ สำหรับนักเรียน')
set_font(r, 18, True)

p_s1_sub = doc.add_paragraph()
p_s1_sub.paragraph_format.first_line_indent = Cm(1.27)
p_s1_sub.paragraph_format.space_after = Pt(8)
r = p_s1_sub.add_run('ใช้มือถือหรือแท็บเล็ตแนวตั้ง เปิดลิงก์จากครู แล้วทำตามหมายเลขทีละขั้น ภาพในคู่มือเป็นหน้าจอจริงของเกม')
set_font(r, 16, False)

doc.add_page_break()

# ==============================================================================
# STUDENT STEPS (Pages 3 to 8: 2 steps per page)
# ==============================================================================
student = [
    ('เข้าห้องเรียน', 'เปิดลิงก์จากครู ใส่รหัสห้อง ชื่อเล่น และ PIN 4 หลัก', 'จำ PIN ไว้สำหรับย้ายเครื่อง', '/manual/student-join.png'),
    ('ทำความรู้จักเกม', 'อ่านการ์ดแนะนำ แล้วเริ่มรู้จักกันเพื่อไปยังเส้นทางของตัวเอง', 'กดข้ามได้ถ้าครูบอกให้เริ่มทันที', '/manual/shot-home.png'),
    ('ถามโดม', 'เปิดแชต ถามเรื่องบทเรียน และอ่านคำตอบที่ปลดล็อกแล้ว', 'โดมตอบเฉพาะเนื้อหาของบทเรียนที่ถึงแล้ว', '/manual/shot-dome.png'),
    ('แต่งร้าน', 'เลือกประเภทร้าน ชื่อร้าน และชื่อเว็บให้ครบ 5 ข้อ', 'เลือกข้อมูลที่ตรงกับไอเดียธุรกิจของตัวเอง', '/manual/student-setup.png'),
    ('แผนที่ภารกิจ', 'แตะแผนที่เพื่อดูเกาะที่พร้อมเล่น และอ่านเป้าหมายของด่าน', 'เล่นตามลำดับ ภารกิจที่ 1 ถึง 4', '/manual/shot-map.png'),
    ('แบบทดสอบและเลือกวิธีเรียน', 'ตอบคำถามสั้น ๆ 3 ข้อ แล้วเลือกวิธีเรียนที่ชอบ: ดู อ่าน หรือ ลงมือทำ', 'เลือกช่องทางที่เหมาะกับตัวเองได้', '/manual/m1-gameplay.png'),
    ('ภารกิจที่ 1–2: รู้จักชื่อเว็บ', 'ดูคลิป อ่านเรื่อง หรือเล่นเกมตามวิธีที่เลือก แล้วตอบคำถาม', 'กดอ่านเรื่องเต็มก่อนตอบ', '/manual/m2-gameplay.png'),
    ('ภารกิจที่ 3: ร้านรับจดชื่อเว็บ', 'ฟังลูกค้าแต่ละคน แล้วแนะนำนามสกุลชื่อเว็บที่เหมาะกับเขา', 'สังเกต .com, .org และ .net', '/manual/m3-gameplay.png'),
    ('ภารกิจที่ 4: จดชื่อเว็บให้ร้าน', 'ค้นหาชื่อเว็บที่ยังว่าง กรอกข้อมูล แล้วยืนยันการจด', 'ทำทีละขั้น: ค้นหา → กรอก → ตรวจ → ยืนยัน', '/manual/m4-gameplay.png'),
    ('ด่านบอส และรางวัล', 'ใช้ความรู้ทั้งหมดตอบคำถามบอส แล้วดูผล รางวัล และหน้าของฉัน', 'ตรวจคำตอบก่อนกดยืนยัน', '/manual/ceo-boss.png'),
    ('ย้ายเครื่อง', 'เปิดลิงก์เดิม กด “เคยเข้าแล้ว ย้ายเครื่อง” แล้วใส่ชื่อเดิมกับ PIN เดิม', 'ใช้ชื่อเล่นเดิมเพื่อรักษาความคืบหน้า', ['/manual/student-move-start.png', '/manual/student-move-form.png']),
    ('ขอความช่วยเหลือ', 'ในภารกิจ กด “ถามโดม” เพื่อขอคำใบ้ ถ้ายังติดอยู่ กด “ตัวช่วย” แล้วเลือก “ขอให้ครูช่วย”', 'บอกสิ่งที่ลองทำแล้ว ครูจะช่วยได้เร็วขึ้น', '/manual/m3-gameplay.png'),
]

for idx, (title, instruction, tip, image) in enumerate(student, 1):
    # Step heading (Bold 16 pt, left margin)
    p_step = doc.add_paragraph()
    p_step.paragraph_format.space_before = Pt(4)
    p_step.paragraph_format.space_after = Pt(2)
    r = p_step.add_run(f'{to_thai_num(idx)}. {title}')
    set_font(r, 16, True)

    # Step instruction (indented 1.27 cm, regular 16 pt)
    p_ins = doc.add_paragraph()
    p_ins.paragraph_format.first_line_indent = Cm(1.27)
    p_ins.paragraph_format.space_after = Pt(2)
    r = p_ins.add_run(f'{instruction} ดังภาพ')
    set_font(r, 16, False)

    # Tip (indented 1.27 cm, regular 16 pt, no shading, no box)
    p_tip = doc.add_paragraph()
    p_tip.paragraph_format.first_line_indent = Cm(1.27)
    p_tip.paragraph_format.space_after = Pt(3)
    r = p_tip.add_run(f'คำแนะนำการเล่น: {tip}')
    set_font(r, 16, False)

    # Screenshot(s) centered
    p_img = doc.add_paragraph()
    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_before = Pt(2)
    p_img.paragraph_format.space_after = Pt(2)
    if isinstance(image, list):
        for im in image:
            add_picture(p_img, im, 3.4)
    else:
        add_picture(p_img, image, 3.5)

    # Caption (ภาพที่ x ...) centered
    p_cap = doc.add_paragraph()
    p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap.paragraph_format.space_before = Pt(0)
    p_cap.paragraph_format.space_after = Pt(6)
    r = p_cap.add_run(f'ภาพที่ {to_thai_num(idx)} {title}')
    set_font(r, 16, False)

    # 2 student steps per page
    if idx % 2 == 0 and idx < len(student):
        doc.add_page_break()

doc.add_page_break()

# ==============================================================================
# SECTION 2: FOR TEACHERS (ส่วนที่ ๒ สำหรับครูผู้สอน)
# ==============================================================================
p_s2 = doc.add_paragraph()
p_s2.paragraph_format.space_before = Pt(4)
p_s2.paragraph_format.space_after = Pt(4)
r = p_s2.add_run('ส่วนที่ ๒ สำหรับครู')
set_font(r, 18, True)

p_s2_sub = doc.add_paragraph()
p_s2_sub.paragraph_format.first_line_indent = Cm(1.27)
p_s2_sub.paragraph_format.space_after = Pt(8)
r = p_s2_sub.add_run('ภาพครูเป็นหน้าจอจริงหลังเข้าสู่ระบบ ใช้กับคอมพิวเตอร์หรือโปรเจกเตอร์ เลือกเมนูด้านซ้ายเพื่อไปแต่ละหน้า')
set_font(r, 16, False)

teacher = [
    ('เข้าสู่ระบบครู', 'สมัครด้วยรหัสเชิญครู หรือเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน แล้วเลือกห้องเรียนจากแถบด้านบน', 'อย่าแชร์รหัสผ่านหรือภาพ QR ของห้องนอกชั้นเรียน', '/manual/teacher-captures/live.png'),
    ('คุมคาบสด', 'ดูว่าตอนนี้อยู่ช่วงไหน เพิ่มเวลา หยุด ตั้งเวลาใหม่ หรือไปช่วงถัดไป', 'บอกเป้าหมายของช่วงนั้นให้นักเรียนฟังก่อนเริ่ม', '/manual/teacher-captures/live-2.png'),
    ('จอฉายหน้าห้อง', 'เปิดหน้าจอสำหรับฉายบนโปรเจกเตอร์ ให้ทั้งห้องเห็นความคืบหน้ารวม', 'ใช้จอฉายห้องเมื่อไม่ต้องการแสดงรายละเอียดรายคน', '/manual/teacher-captures/board.png'),
    ('นักเรียนรายคน', 'เลือกชื่อเพื่อดูดาว เป้าหมาย ช่องทางเรียน และความคืบหน้ารายภารกิจ', 'ใช้หน้ารายงานรายคนเมื่อต้องคุยแบบเฉพาะบุคคล', '/manual/teacher-captures/student.png'),
    ('งานรอตรวจ', 'เปิดงานที่นักเรียนส่งมา อ่าน ให้คะแนน แล้วยืนยันหรือส่งกลับให้แก้', 'เขียนคำแนะนำที่บอกว่าควรแก้อะไรต่อ', '/manual/teacher-captures/review.png'),
    ('คำขอจากนักเรียน', 'ดูคำขอ เช่น ขอเวลาเพิ่ม หรือขอเปลี่ยนวิธีเรียน แล้วตอบรับ เสนอทางอื่น หรือปฏิเสธ', 'ตอบคำขอที่ค้างก่อนไปช่วงถัดไป', '/manual/teacher-captures/requests.png'),
    ('รายงานผลการเรียน', 'ดูคะแนนก่อนเรียนและหลังเรียน กราฟความเข้าใจแต่ละภารกิจ และดาวน์โหลดเป็นไฟล์ตาราง', 'ตรวจชื่อห้องก่อนดาวน์โหลดหรือพิมพ์รายงาน', '/manual/teacher-captures/report.png'),
    ('ผลงานเด่น', 'เลือกผลงานของนักเรียนที่ดี ปักหมุด หรือซ่อนชื่อ แล้วฉายบนจอหน้าห้อง', 'ขออนุญาตก่อนนำชื่อ/ผลงานขึ้นจอ', '/manual/teacher-captures/showcase.png'),
    ('ตั้งค่าห้องเรียน', 'เปิดแบบทดสอบก่อน/หลังเรียน ตั้งค่าห้อง เปิดหรือปิดผู้ช่วย AI และโหมดสาธิต', 'ทดสอบสวิตช์ก่อนเริ่มคาบจริง', '/manual/teacher-captures/settings.png'),
]

for idx, (title, instruction, tip, image) in enumerate(teacher, 13):
    # Step heading
    p_step = doc.add_paragraph()
    p_step.paragraph_format.space_before = Pt(4)
    p_step.paragraph_format.space_after = Pt(2)
    r = p_step.add_run(f'{to_thai_num(idx)}. {title}')
    set_font(r, 16, True)

    # Instruction
    p_ins = doc.add_paragraph()
    p_ins.paragraph_format.first_line_indent = Cm(1.27)
    p_ins.paragraph_format.space_after = Pt(2)
    r = p_ins.add_run(f'{instruction} ดังภาพ')
    set_font(r, 16, False)

    # Tip
    p_tip = doc.add_paragraph()
    p_tip.paragraph_format.first_line_indent = Cm(1.27)
    p_tip.paragraph_format.space_after = Pt(3)
    r = p_tip.add_run(f'คำแนะนำการเล่น: {tip}')
    set_font(r, 16, False)

    # Screenshot centered
    p_img = doc.add_paragraph()
    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_before = Pt(2)
    p_img.paragraph_format.space_after = Pt(2)
    add_picture(p_img, image, 11.0)

    # Caption (ภาพที่ x ...) centered
    p_cap = doc.add_paragraph()
    p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap.paragraph_format.space_before = Pt(0)
    p_cap.paragraph_format.space_after = Pt(6)
    r = p_cap.add_run(f'ภาพที่ {to_thai_num(idx)} {title}')
    set_font(r, 16, False)

    # Page break after every 2 teacher steps (13 & 14, 15 & 16, 17 & 18, 19 & 20)
    if idx in (14, 16, 18, 20):
        doc.add_page_break()

doc.save(DOCX)

# ==============================================================================
# FONT EMBEDDING: Embed TH Sarabun New into DOCX package
# ==============================================================================
regular_font_src = USER_FONTS / 'THSarabunNew.ttf' if (USER_FONTS / 'THSarabunNew.ttf').exists() else (PUB_FONTS / 'Sarabun-Regular.ttf')
bold_font_src = USER_FONTS / 'THSarabunNew-Bold.ttf' if (USER_FONTS / 'THSarabunNew-Bold.ttf').exists() else (PUB_FONTS / 'Sarabun-Bold.ttf')

with TemporaryDirectory() as tmp:
    tmp_path = Path(tmp)
    with ZipFile(DOCX) as z:
        z.extractall(tmp_path)
    
    # 1. Update fontTable.xml
    font_table = tmp_path / 'word' / 'fontTable.xml'
    xml = font_table.read_text(encoding='utf-8')
    
    # 2. Update [Content_Types].xml
    content_types = tmp_path / '[Content_Types].xml'
    content_xml = content_types.read_text(encoding='utf-8')
    if 'PartName="/word/fonts/THSarabunNew.ttf"' not in content_xml:
        content_xml = content_xml.replace(
            '</Types>',
            '<Override PartName="/word/fonts/THSarabunNew.ttf" ContentType="application/x-font-ttf"/>'
            '<Override PartName="/word/fonts/THSarabunNew-Bold.ttf" ContentType="application/x-font-ttf"/>'
            '</Types>'
        )
        content_types.write_text(content_xml, encoding='utf-8')
    
    # 3. Update fontTable.xml.rels
    rels = tmp_path / 'word' / '_rels' / 'fontTable.xml.rels'
    rel_xml = rels.read_text(encoding='utf-8') if rels.exists() else '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
    if 'rIdTHSarabun' not in rel_xml:
        rel_xml = rel_xml.replace(
            '</Relationships>',
            '<Relationship Id="rIdTHSarabun" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/THSarabunNew.ttf"/>'
            '<Relationship Id="rIdTHSarabunBold" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/THSarabunNew-Bold.ttf"/>'
            '</Relationships>'
        )
    rels.parent.mkdir(parents=True, exist_ok=True)
    rels.write_text(rel_xml, encoding='utf-8')
    
    # 4. Declare font in fontTable.xml
    font_entry = (
        f'<w:font w:name="{FONT_NAME}">'
        '<w:embedRegular r:id="rIdTHSarabun"/>'
        '<w:embedBold r:id="rIdTHSarabunBold"/>'
        '</w:font>'
    )
    if f'w:name="{FONT_NAME}"' not in xml:
        xml = xml.replace('</w:fonts>', f'{font_entry}</w:fonts>')
    font_table.write_text(xml, encoding='utf-8')
    
    # 5. Write font binary files
    fonts_dir = tmp_path / 'word' / 'fonts'
    fonts_dir.mkdir(exist_ok=True)
    (fonts_dir / 'THSarabunNew.ttf').write_bytes(regular_font_src.read_bytes())
    (fonts_dir / 'THSarabunNew-Bold.ttf').write_bytes(bold_font_src.read_bytes())
    
    with ZipFile(DOCX, 'w', ZIP_DEFLATED) as z:
        for file in tmp_path.rglob('*'):
            if file.is_file():
                z.write(file, file.relative_to(tmp_path).as_posix())

print(f'Successfully built {DOCX}')
