import { describe, expect, it } from 'vitest'
import {
  TLD_CATEGORIES,
  businessTypes,
  findTld,
  reservedReason,
  tlds,
  tldsByCategory,
} from './content'
import { type ShopProfile, acceptableTldIds, evaluateAll, evaluateTld, hintsForLevel } from './tld-rules'

const student: ShopProfile = {
  isRegisteredCompany: false,
  audience: 'thai',
  domainName: 'cakeshop',
}

function verdict(tldId: string, profile: ShopProfile) {
  return evaluateTld(findTld(tldId)!, profile)
}

describe('ไฟล์เนื้อหา JSON', () => {
  it('โหลดประเภทธุรกิจได้และทุกรายการมีคำสำคัญ', () => {
    expect(businessTypes.length).toBeGreaterThan(0)
    for (const b of businessTypes) expect(b.keywords.length).toBeGreaterThan(0)
  })

  it('โหลดนามสกุลโดเมนได้ และ id ไม่ซ้ำกัน', () => {
    expect(tlds.length).toBeGreaterThanOrEqual(5)
    expect(new Set(tlds.map((t) => t.id)).size).toBe(tlds.length)
  })

  it('5 แบบเดิมที่สถานี B ใช้อยู่ยังอยู่ครบ', () => {
    for (const id of ['com', 'co-th', 'in-th', 'shop', 'thai']) {
      expect(findTld(id)).toBeDefined()
    }
  })
})

describe('จำแนกประเภทของโดเมนเนม', () => {
  it('ทุกนามสกุลอยู่ในหมวดใดหมวดหนึ่งใน 3 หมวด', () => {
    for (const t of tlds) {
      expect(TLD_CATEGORIES).toContain(t.category)
    }
  })

  it('ทั้ง 3 หมวดมีตัวอย่างให้สอนอย่างน้อยหมวดละ 2 รายการ', () => {
    for (const category of TLD_CATEGORIES) {
      expect(tldsByCategory(category).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('gTLD ทั่วไปใครก็จดได้ ไม่ต้องใช้เอกสารและไม่จำกัดว่าลูกค้าอยู่ไทย', () => {
    for (const t of tldsByCategory('gTLD ทั่วไป')) {
      expect(t.requiresCompany).toBe(false)
      expect(t.thaiOnlyAudience).toBe(false)
      expect(t.reserved).toBe(false)
    }
  })

  it('ccTLD ไทยทุกตัวมุ่งลูกค้าในไทย', () => {
    for (const t of tldsByCategory('ccTLD ไทย')) {
      expect(t.thaiOnlyAudience).toBe(true)
    }
  })
})

describe('หมวดเฉพาะที่สงวน ร้านของนักเรียนจดไม่ได้', () => {
  it('.ac.th .go.th .or.th .net.th .mi.th ถูกทำเครื่องหมายว่าสงวน', () => {
    for (const id of ['ac-th', 'go-th', 'or-th', 'net-th', 'mi-th']) {
      const tld = findTld(id)
      expect(tld).toBeDefined()
      expect(tld!.reserved).toBe(true)
    }
  })

  it('นามสกุลที่นักเรียนใช้ได้ต้องไม่ถูกทำเครื่องหมายว่าสงวน', () => {
    for (const id of ['com', 'co-th', 'in-th', 'shop', 'thai', 'net', 'org']) {
      expect(findTld(id)!.reserved).toBe(false)
    }
  })

  it('ทุกหมวดที่สงวนต้องบอกได้ว่าใครใช้ได้ พร้อมนามสกุลในข้อความ', () => {
    for (const t of tlds.filter((t) => t.reserved)) {
      const reason = reservedReason(t)
      expect(reason).toBeTruthy()
      expect(reason).toContain(t.suffix)
      expect(reason).toContain(t.reservedFor!)
    }
  })

  it('หมวดที่ไม่ได้สงวนไม่มีข้อความปฏิเสธแบบสงวน', () => {
    expect(reservedReason(findTld('com')!)).toBeNull()
  })

  it('สถานี B เปิดทุกช่อง แต่หมวดสงวนต้องถูกดีดกลับตั้งแต่เงื่อนไขแรก ไม่ต้องกรองรายการก่อน', () => {
    const profile = { isRegisteredCompany: true, audience: 'thai' as const, domainName: 'ร้านเค้ก' }
    const reserved = tlds.filter((t) => t.reserved)
    expect(reserved.length).toBeGreaterThan(0)
    for (const tld of reserved) expect(evaluateTld(tld, profile).accepted).toBe(false)
  })
})

describe('.com และ .shop ใครก็จดได้', () => {
  it('ผ่านเสมอไม่ว่าโปรไฟล์เป็นแบบไหน', () => {
    const inter: ShopProfile = { ...student, audience: 'international' }
    for (const id of ['com', 'shop']) {
      expect(verdict(id, student).accepted).toBe(true)
      expect(verdict(id, inter).accepted).toBe(true)
    }
  })
})

describe('.co.th ต้องเป็นนิติบุคคล', () => {
  it('ร้านที่ยังไม่จดทะเบียนถูกดีดกลับ พร้อมบอกเหตุผล', () => {
    const v = verdict('co-th', student)
    expect(v.accepted).toBe(false)
    expect(v.reason).toContain('.co.th')
    expect(v.reason).toContain('จดทะเบียน')
  })

  it('บริษัทที่จดทะเบียนแล้วและขายคนไทยผ่าน', () => {
    expect(verdict('co-th', { ...student, isRegisteredCompany: true }).accepted).toBe(true)
  })
})

describe('.in.th สำหรับบุคคลธรรมดาในไทย', () => {
  it('นักเรียนที่ยังไม่จดทะเบียนผ่าน', () => {
    expect(verdict('in-th', student).accepted).toBe(true)
  })

  it('ถ้าลูกค้าอยู่ต่างประเทศถูกดีดกลับ', () => {
    const v = verdict('in-th', { ...student, audience: 'international' })
    expect(v.accepted).toBe(false)
    expect(v.reason).toContain('ต่างประเทศ')
  })
})

describe('.ไทย ต้องใช้ชื่ออักษรไทย', () => {
  it('ชื่ออักษรอังกฤษถูกดีดกลับ', () => {
    const v = verdict('thai', student)
    expect(v.accepted).toBe(false)
    expect(v.reason).toContain('อักษรไทย')
  })

  it('ชื่ออักษรไทยและขายคนไทยผ่าน', () => {
    expect(verdict('thai', { ...student, domainName: 'ร้านเค้ก' }).accepted).toBe(true)
  })
})

describe('โจทย์ต้องไม่ตัน', () => {
  const profiles: ShopProfile[] = [
    { isRegisteredCompany: false, audience: 'thai', domainName: 'cakeshop' },
    { isRegisteredCompany: false, audience: 'international', domainName: 'cakeshop' },
    { isRegisteredCompany: true, audience: 'thai', domainName: 'cakeshop' },
    { isRegisteredCompany: true, audience: 'international', domainName: 'cakeshop' },
  ]

  it('ทุกโปรไฟล์ที่เป็นไปได้ต้องมีนามสกุลที่ยื่นผ่านอย่างน้อย 1 แบบ', () => {
    for (const p of profiles) expect(acceptableTldIds(p).length).toBeGreaterThan(0)
  })

  it('ตรวจทุกช่องแล้วได้ผลครบทุกนามสกุล', () => {
    expect(evaluateAll(student)).toHaveLength(tlds.length)
  })

  it('ช่องที่ถูกดีดกลับต้องมีเหตุผลเสมอ ช่องที่ผ่านต้องไม่มี', () => {
    for (const v of evaluateAll(student)) {
      if (v.accepted) expect(v.reason).toBeNull()
      else expect(v.reason).toBeTruthy()
    }
  })
})

describe('หมวดสงวนถูกดีดกลับทุกโปรไฟล์', () => {
  const profiles: ShopProfile[] = [
    { isRegisteredCompany: false, audience: 'thai', domainName: 'cakeshop' },
    { isRegisteredCompany: false, audience: 'international', domainName: 'cakeshop' },
    { isRegisteredCompany: true, audience: 'thai', domainName: 'ร้านเค้ก' },
    { isRegisteredCompany: true, audience: 'international', domainName: 'ร้านเค้ก' },
  ]

  it('ไม่ว่าจดทะเบียนบริษัทแล้ว ตั้งชื่ออักษรไทย หรือขายใคร ก็ยื่นหมวดสงวนไม่ผ่าน', () => {
    const reservedTlds = tlds.filter((t) => t.reserved)
    expect(reservedTlds.length).toBeGreaterThan(0)
    for (const tld of reservedTlds) {
      for (const p of profiles) {
        const v = evaluateTld(tld, p)
        expect(v.accepted).toBe(false)
        expect(v.reason).toContain(tld.suffix)
        expect(v.reason).toContain(tld.reservedFor!)
      }
    }
  })

  it('หมวดสงวนไม่โผล่ในรายการที่ยื่นผ่านได้ของโปรไฟล์ไหนเลย', () => {
    const reservedIds = tlds.filter((t) => t.reserved).map((t) => t.id)
    for (const p of profiles) {
      for (const id of acceptableTldIds(p)) {
        expect(reservedIds).not.toContain(id)
      }
    }
  })

  it('เหตุผลที่ดีดกลับต้องเป็นเรื่องหมวดสงวน ไม่ใช่เรื่องจดทะเบียนหรืออักษรไทย', () => {
    const goTh = findTld('go-th')!
    const v = evaluateTld(goTh, { isRegisteredCompany: true, audience: 'thai', domainName: 'ร้านเค้ก' })
    expect(v.reason).toContain('สงวน')
    expect(v.reason).toBe(reservedReason(goTh))
  })
})

describe('ตัวช่วยตามระดับผู้เรียน', () => {
  const com = findTld('com')!

  it('ระดับ 1 เห็นข้อมูลครบ', () => {
    const h = hintsForLevel(com, 1)
    expect(h.whoCanRegister).toBeTruthy()
    expect(h.goodFor).toBeTruthy()
    expect(h.watchOut).toBeTruthy()
  })

  it('ระดับ 2 เห็นแค่ว่าใครจดได้', () => {
    const h = hintsForLevel(com, 2)
    expect(h.whoCanRegister).toBeTruthy()
    expect(h.goodFor).toBeNull()
  })

  it('ระดับ 3 ไม่เห็นอะไรเลย', () => {
    const h = hintsForLevel(com, 3)
    expect(h.whoCanRegister).toBeNull()
    expect(h.goodFor).toBeNull()
    expect(h.watchOut).toBeNull()
  })
})
