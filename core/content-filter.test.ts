import { describe, expect, it } from 'vitest'
import filterJson from '../content/content-filter.json'
import {
  checkContent,
  famousBrandMessage,
  findFamousBrands,
  gateAiText,
  maskText,
  normalizeForFilter,
  reviewStudentText,
  safeToShowPeers,
} from './content-filter'

describe('รายการคำอยู่ในไฟล์เนื้อหา ไม่ฝังในโค้ด', () => {
  it('ครูเติมคำเองได้ และทุกกลุ่มมีระดับที่ไฟล์นิยามไว้', () => {
    const levels = filterJson.meta.levels.map((l) => l.level)
    for (const group of filterJson.words) {
      expect(levels).toContain(group.level)
      expect(group.terms.length).toBeGreaterThan(0)
    }
  })
})

describe('ชั้นที่ 1 รายการคำ', () => {
  it('ข้อความปกติผ่าน ไม่ถูกกันผิดพลาด', () => {
    const r = checkContent('ร้านขนมบ้านยายขายขนมไทย ลูกค้าเป็นคนในชุมชน')
    expect(r.ok).toBe(true)
    expect(r.level).toBe(0)
    expect(r.studentMessage).toBeNull()
    expect(r.notifyTeacher).toBe(false)
  })

  it('คำไม่สุภาพทั่วไปได้ระดับ 1 บอกนักเรียนแต่ไม่แจ้งครู', () => {
    const r = checkContent('มึงอย่ามายุ่ง')
    expect(r.level).toBe(1)
    expect(r.studentMessage).toBe(filterJson.messages.mild)
    expect(r.notifyTeacher).toBe(false)
  })

  it('คำหยาบรุนแรงและการพนันได้ระดับ 2 แจ้งครูพร้อมข้อความปิดบางส่วน', () => {
    const r = checkContent('เปิดเว็บบาคาร่าดีกว่า')
    expect(r.level).toBe(2)
    expect(r.notifyTeacher).toBe(true)
    expect(r.teacherPriority).toBe('medium')
    expect(r.teacherText).not.toBe(r.original)
    expect(r.teacherText).toContain('•')
    expect(r.studentMessage).toBe(filterJson.messages.severe)
  })

  it('สัญญาณทำร้ายตัวเองได้ระดับ 3 แจ้งครูทันทีและข้อความถึงนักเรียนอ่อนโยน', () => {
    const r = checkContent('เบื่อจัง อยากตายเลย')
    expect(r.level).toBe(3)
    expect(r.notifyTeacher).toBe(true)
    expect(r.teacherPriority).toBe('high')
    // ระดับ 3 ครูต้องเห็นข้อความเต็มเพื่อดูแลได้ถูก
    expect(r.teacherText).toBe(r.original)
    expect(r.studentMessage).toContain('ครู')
    for (const word of ['ผิด', 'ห้าม', 'ไม่ดี']) {
      expect(r.studentMessage).not.toContain(word)
    }
  })

  it('เจอหลายระดับพร้อมกัน ใช้ระดับสูงสุด', () => {
    expect(checkContent('มึงโง่ อยากตาย').level).toBe(3)
  })

  it('**ห้ามลบข้อความเงียบ ๆ** — คืนข้อความเดิมครบทุกตัวอักษรเสมอ', () => {
    const text = 'ร้านนี้ห่วยมาก บาคาร่า 0812345678'
    const r = checkContent(text)
    expect(r.original).toBe(text)
    expect(r.ok).toBe(false)
    // มีธงและมีข้อความบอกนักเรียน ผู้เรียกจึงตัดสินใจต่อได้ ไม่ใช่ข้อความหายไปเฉย ๆ
    expect(r.matches.length).toBeGreaterThan(0)
    expect(r.studentMessage).toBeTruthy()
  })
})

describe('จับคำที่เลี่ยงด้วยช่องว่าง จุด ตัวซ้ำ และตัวเลขแทนตัวอักษร', () => {
  it('ทำข้อความเป็นรูปมาตรฐานก่อนเทียบ', () => {
    expect(normalizeForFilter('พ น ั น')).toBe(normalizeForFilter('พนัน'))
    expect(normalizeForFilter('c-a-s-i-n-o')).toBe('casino')
    expect(normalizeForFilter('c4s1n0')).toBe('casino')
  })

  it('เลี่ยงด้วยช่องว่างและจุดยังถูกจับได้', () => {
    expect(checkContent('อยากเปิดร้าน พ.นัน').level).toBe(2)
    expect(checkContent('เว็บ c a s i n o').level).toBe(2)
  })

  it('ยืดตัวอักษรก็ยังถูกจับได้', () => {
    expect(checkContent('พนันนนนนน').level).toBe(2)
  })

  it('ไม่กันข้อความปกติที่บังเอิญมีตัวซ้ำ', () => {
    expect(checkContent('ขนมอร่อยยยย').ok).toBe(true)
    expect(checkContent('ร้านกาแฟดีมากก').ok).toBe(true)
  })
})

describe('ชั้นที่ 2 ข้อมูลส่วนตัว', () => {
  it('เบอร์โทร อีเมล และเลขบัตรประชาชนถูกกันทุกกรณี', () => {
    for (const text of [
      'โทรมาที่ 0812345678 นะ',
      'ติดต่อ 081-234-5678',
      'เมลมาที่ somchai@example.com',
      'เลขบัตร 1234567890123',
      'บ้านเลขที่ 99 หมู่ 4',
    ]) {
      const r = checkContent(text)
      expect(r.hasPersonalInfo).toBe(true)
      expect(r.ok).toBe(false)
      expect(r.studentMessage).toBe(filterJson.messages.personal)
    }
  })

  it('ข้อมูลส่วนตัวไม่แจ้งครู ตามตารางในสเปก', () => {
    const r = checkContent('โทร 0812345678')
    expect(r.notifyTeacher).toBe(false)
    expect(r.teacherText).toBeNull()
  })

  it('เลขทั่วไปที่ไม่ใช่เบอร์โทรไม่ถูกกัน', () => {
    expect(checkContent('ขายขนม 25 บาท 100 ชิ้น').hasPersonalInfo).toBe(false)
    expect(checkContent('เปิดร้านปี 2569').hasPersonalInfo).toBe(false)
  })
})

describe('ชั้นที่ 3 แบรนด์ของผู้อื่น', () => {
  it('จับชื่อแบรนด์ดังในชื่อแบรนด์ของนักเรียน', () => {
    expect(findFamousBrands('ร้าน Nike ของฉัน')).toContain('nike')
    expect(findFamousBrands('ขนมเป๊ปซี่บ้านยาย')).toContain('เป๊ปซี่')
  })

  it('ไม่ใช่การทำผิด — ไม่ขึ้นระดับและไม่แจ้งครู แต่มีข้อความชวนคุยเรื่องเครื่องหมายการค้า', () => {
    const r = checkContent('อยากเปิดร้าน nike ของตัวเอง')
    expect(r.famousBrands.length).toBeGreaterThan(0)
    expect(r.level).toBe(0)
    expect(r.notifyTeacher).toBe(false)
    expect(famousBrandMessage(r.famousBrands)).toContain('เครื่องหมายการค้า')
  })

  it('ชื่อที่นักเรียนคิดเองไม่ถูกจับ', () => {
    expect(findFamousBrands('ขนมบ้านยาย')).toEqual([])
  })
})

describe('ชั้นที่ 5 ข้อความจาก AI', () => {
  it('ข้อความ AI ที่สะอาดผ่าน', () => {
    const gate = gateAiText('ยายของขนมบ้านยายอยากให้ช่วยคิดชื่อร้าน')
    expect(gate.usable).toBe(true)
    expect(gate.reason).toBeNull()
  })

  it('ข้อความ AI ที่ติดตัวกรองใช้ไม่ได้ ต้องสลับไปใช้ข้อความสำรอง', () => {
    const gate = gateAiText('ร้านนี้ขายบุหรี่ไฟฟ้าด้วย')
    expect(gate.usable).toBe(false)
    expect(gate.reason).toContain('ตัวกรอง')
    // ข้อความจาก AI ไม่ต้องมีข้อความบอกนักเรียน เพราะผู้เรียกจะสลับข้อความให้เอง
    expect(gate.result.studentMessage).toBeNull()
  })

  it('ข้อความ AI ที่พาดพิงแบรนด์ของผู้อื่นใช้ไม่ได้', () => {
    const gate = gateAiText('ร้านเราจะดังเท่า starbucks เลย')
    expect(gate.usable).toBe(false)
    expect(gate.reason).toContain('แบรนด์')
  })
})

describe('ข้อความที่เพื่อนเห็นบนผนังผลงาน', () => {
  it('เข้มกว่าปกติ ระดับ 1 ก็ไม่ปล่อยขึ้นจอเพื่อน', () => {
    expect(safeToShowPeers('ชื่อร้านนี้เท่มาก')).toBe(true)
    expect(safeToShowPeers('ชื่อร้านมึงห่วย')).toBe(false)
    expect(safeToShowPeers('ติดต่อ 0812345678')).toBe(false)
  })
})

describe('คำหยาบที่ซ่อนในชื่อเว็บและคำไทยแบบเลี่ยง (ผนังผลงานเพื่อน)', () => {
  it('ชื่อเว็บที่ซ่อนคำหยาบกลางคำไม่ขึ้นจอเพื่อน', () => {
    expect(safeToShowPeers('mykuyyhaieieie.in.th')).toBe(false)
    expect(safeToShowPeers('KUYshop.com')).toBe(false)
    expect(safeToShowPeers('k.u.y-store.co.th')).toBe(false)
    expect(safeToShowPeers('superfuckshop.com')).toBe(false)
    expect(checkContent('mykuyyhaieieie.in.th').level).toBe(2)
  })

  it('คำหยาบไทยและแบบเว้นวรรค/ยืดตัวอักษรถูกจับ', () => {
    for (const text of ['ควย', 'ค ว ย', 'ควยยยย', 'เหี้ยมาก', 'สัสส', 'เย็ดแม่', 'เงี่ยน']) {
      expect(safeToShowPeers(text)).toBe(false)
    }
  })

  it('ชื่อเว็บปกติไม่ถูกกันผิดพลาด (ก๋วยเตี๋ยว sushi phuket)', () => {
    for (const text of [
      'kuytiewnaimon.com',
      'sushiyummy.co.th',
      'phuketseafood.com',
      'beamdrip.com',
      'fasaisecond.com',
      'ชื่อนี้ตรงกับป้ายหน้าร้าน ลูกค้าพิมพ์ตามได้ทันที',
    ]) {
      expect(safeToShowPeers(text)).toBe(true)
    }
  })
})

describe('ปิดบางส่วนสำหรับให้ครูดู', () => {
  it('เก็บตัวแรกและตัวท้ายของคำไว้ ครูพอเดาบริบทได้', () => {
    const masked = maskText('คำหยาบมาก นะ')
    expect(masked).not.toBe('คำหยาบมาก นะ')
    expect(masked.startsWith('ค')).toBe(true)
    expect(masked).toContain('•')
  })

  it('คำสั้นไม่ถูกปิด เพราะปิดแล้วอ่านไม่ออกทั้งประโยค', () => {
    expect(maskText('นะ')).toBe('นะ')
  })
})

describe('เคสสุดขอบ', () => {
  it('ข้อความว่างและค่าที่อ่านไม่ได้ไม่ทำให้พัง', () => {
    expect(checkContent('').ok).toBe(true)
    expect(checkContent(undefined as unknown as string).ok).toBe(true)
    expect(normalizeForFilter(undefined as unknown as string)).toBe('')
  })
})

describe('บั๊กที่เจอตอนสแกนคลังเนื้อหาจริง 2,301 ก้อน', () => {
  it('คำอังกฤษที่ซ่อนอยู่กลางคำอื่นต้องไม่ถูกจับ (hints-exhausted ไม่ใช่คำหยาบ)', () => {
    // ตัวกรองตัดขีดกลางออกก่อนเทียบ hints-exhausted จึงกลายเป็น hintsexhausted
    // ถ้าเทียบแบบหาชิ้นส่วนกลางคำ รหัสภายในของเราเองจะติดตัวกรองทันที
    expect(checkContent('reason-hints-exhausted').ok).toBe(true)
    expect(checkContent('idleSeconds · attempts · hintsExhausted').ok).toBe(true)
    // แต่คำเดียวกันที่ยืนอยู่เดี่ยว ๆ ยังต้องถูกจับ
    expect(checkContent('ขายคลิป sex').level).toBe(2)
    expect(checkContent('s.e.x').level).toBe(2)
  })

  it('เลขคนละชุดในประโยคเดียวกันต้องไม่ถูกต่อกันจนกลายเป็นเลขบัตรประชาชน', () => {
    expect(checkContent('ข้อ 1-8 ตรงกับ q1 ถึง q8 ในตาราง · ข้อ 9 ตรงกับ like_text').hasPersonalInfo).toBe(
      false,
    )
    expect(checkContent('ดูไฟล์ 20261001000000_session_control.sql').hasPersonalInfo).toBe(false)
    // เลข 13 หลักติดกันพอดียังถูกจับ
    expect(checkContent('เลขบัตร 1234567890123').hasPersonalInfo).toBe(true)
  })

  it('ข้อความในคลังเนื้อหาของโปรเจกต์ต้องไม่ถูกกันผิดพลาด', () => {
    // ตัวอย่างจริงจากไฟล์เนื้อหาที่เคยติดตัวกรองรอบแรก
    for (const text of [
      'ผู้เรียนเปิดตัวช่วยครบทุกระดับแล้ว (hints-exhausted)',
      'ขนมอร่อยมากกก ร้านกาแฟเปิด 7 โมง',
      'เปิดร้านปี 2569 ขาย 25 บาท 100 ชิ้น',
    ]) {
      expect(checkContent(text).ok).toBe(true)
    }
  })
})

describe('reviewStudentText — ด่านเดียวที่ route ฝั่งเซิร์ฟเวอร์เรียก (T46b)', () => {
  it('ข้อความปกติผ่าน ไม่มีธง ไม่มีข้อความเตือน', () => {
    const r = reviewStudentText('เลือก .in.th เพราะลูกค้าเป็นคนไทยในย่านเดียวกัน', {
      field: 'reason',
      studentId: 'stu-1',
    })
    expect(r.accepted).toBe(true)
    expect(r.flag).toBeNull()
    expect(r.studentMessage).toBeNull()
    expect(r.result.original).toContain('.in.th')
  })

  it('ข้อมูลส่วนตัวไม่รับ บอกนักเรียน แต่ไม่แจ้งครู', () => {
    const r = reviewStudentText('ทักมาที่ 0812345678', { field: 'reason', studentId: 'stu-1' })
    expect(r.accepted).toBe(false)
    expect(r.hasPersonalInfo).toBe(true)
    expect(r.studentMessage).toBe(filterJson.messages.personal)
    expect(r.flag).toBeNull()
  })

  it('ระดับ 2 คืนแถวที่พร้อมบันทึกลง content_flags พร้อมข้อความปิดบางส่วน', () => {
    const r = reviewStudentText('อยากเปิดเว็บบาคาร่า', {
      field: 'dome-chat',
      studentId: 'stu-7',
    })
    expect(r.accepted).toBe(false)
    expect(r.flag).toMatchObject({
      studentId: 'stu-7',
      field: 'dome-chat',
      level: 2,
      priority: 'medium',
    })
    expect(r.flag!.categories).toContain('การพนัน')
    expect(r.flag!.teacherText).toContain('•')
  })

  it('ระดับ 3 แจ้งครูความสำคัญสูง และครูเห็นข้อความเต็ม', () => {
    const text = 'ช่วงนี้อยากตายมากเลย'
    const r = reviewStudentText(text, { field: 'reflection', studentId: 'stu-9' })
    expect(r.flag!.priority).toBe('high')
    expect(r.flag!.teacherText).toBe(text)
    expect(r.studentMessage).toContain('ครู')
  })

  it('ข้อความที่เพื่อนเห็น เข้มขึ้น 1 ขั้น', () => {
    const mild = 'ชื่อร้านมึงห่วย'
    expect(reviewStudentText(mild, { field: 'peer-comment', sharedWithPeers: true }).accepted).toBe(
      false,
    )
    expect(
      reviewStudentText('ชื่อร้านน่ารักดี', { field: 'peer-comment', sharedWithPeers: true })
        .accepted,
    ).toBe(true)
  })

  it('ชื่อแบรนด์ที่ชนแบรนด์ของผู้อื่น ยังรับได้ แต่มีข้อความชวนคุยติดมา', () => {
    const r = reviewStudentText('ร้าน nike ของฉัน', { field: 'brand-name', studentId: 'stu-2' })
    expect(r.accepted).toBe(true)
    expect(r.famousBrands).toContain('nike')
    expect(r.famousBrandMessage).toContain('เครื่องหมายการค้า')
    expect(r.flag).toBeNull()
  })

  it('**ข้อความเดิมถูกส่งกลับให้บันทึกเสมอ ไม่ถูกแก้**', () => {
    const text = 'ร้านนี้ห่วย บาคาร่า'
    const r = reviewStudentText(text, { field: 'reason', studentId: 'stu-1' })
    expect(r.result.original).toBe(text)
  })

  it('ไม่ระบุ studentId ก็ใช้ได้ (เช่น ตรวจก่อนล็อกอิน)', () => {
    const r = reviewStudentText('บาคาร่า', { field: 'brand-name' })
    expect(r.flag!.studentId).toBeNull()
  })
})

describe('ระดับ 1 บันทึกสถิติแต่ไม่แจ้งครู (ตามตารางในสเปก)', () => {
  it('ระดับ 1 ไม่มี flag แต่ recordStat เป็น true', () => {
    const r = reviewStudentText('มึงอย่ามายุ่ง', { field: 'reason', studentId: 'stu-1' })
    expect(r.level).toBe(1)
    expect(r.flag).toBeNull()
    expect(r.recordStat).toBe(true)
  })

  it('ข้อความปกติไม่ต้องนับสถิติ', () => {
    expect(reviewStudentText('ขนมบ้านยายอร่อย', { field: 'reason' }).recordStat).toBe(false)
  })
})
