import { describe, expect, it } from 'vitest'
import {
  agreementRate,
  classNormalizedGain,
  descriptive,
  effectSize,
  hedgesCorrection,
  itemAnalysis,
  normalizedGain,
  pairedTTest,
  tDistributionTwoTailedP,
} from './statistics'

describe('ค่าเฉลี่ยและส่วนเบี่ยงเบนมาตรฐาน (สเปกข้อ 9.4)', () => {
  it('คำนวณตรงกับที่คิดมือ', () => {
    // ข้อมูล 2, 4, 4, 4, 5, 5, 7, 9 -> ค่าเฉลี่ย 5 · SD กลุ่มตัวอย่าง (n-1) = 2.1381
    const d = descriptive([2, 4, 4, 4, 5, 5, 7, 9])
    expect(d.n).toBe(8)
    expect(d.sum).toBe(40)
    expect(d.mean).toBe(5)
    expect(d.sd).toBeCloseTo(2.1381, 4)
    expect(d.min).toBe(2)
    expect(d.max).toBe(9)
  })

  it('ห้องว่างไม่พัง และไม่หารด้วยศูนย์', () => {
    const d = descriptive([])
    expect(d).toEqual({ n: 0, sum: 0, mean: 0, sd: null, min: null, max: null })
  })

  it('คนเดียวคำนวณค่าเฉลี่ยได้ แต่ SD คืน null ไม่ใช่ 0', () => {
    const d = descriptive([7])
    expect(d.mean).toBe(7)
    expect(d.sd).toBeNull()
  })

  it('ค่าที่อ่านไม่ได้ถูกตัดทิ้ง ไม่ลากค่าเฉลี่ยเป็น NaN', () => {
    const d = descriptive([3, Number.NaN, 5, Number.POSITIVE_INFINITY])
    expect(d.n).toBe(2)
    expect(d.mean).toBe(4)
  })
})

describe('การทดสอบค่าทีแบบกลุ่มตัวอย่างไม่อิสระ', () => {
  it('ค่า t, df และ p ตรงกับที่คิดมือ', () => {
    // ผลต่าง 3, 2, 2 -> ค่าเฉลี่ย 2.3333 · SD 0.5774 · SE 0.3333 · t = 7.000 · df = 2
    const r = pairedTTest([
      { pre: 5, post: 8 },
      { pre: 6, post: 8 },
      { pre: 7, post: 9 },
    ])
    expect(r.n).toBe(3)
    expect(r.df).toBe(2)
    expect(r.meanDiff).toBeCloseTo(2.3333, 4)
    expect(r.sdDiff).toBeCloseTo(0.5774, 4)
    expect(r.t).toBeCloseTo(7, 3)
    expect(r.p).toBeCloseTo(0.0198, 3)
    expect(r.significant).toBe(true)
    expect(r.direction).toBe('higher')
  })

  it('ค่า p เทียบกับค่าวิกฤตในตารางที (t = 4.303, df = 2 -> p = .05)', () => {
    expect(tDistributionTwoTailedP(4.302653, 2)).toBeCloseTo(0.05, 5)
    expect(tDistributionTwoTailedP(2.228139, 10)).toBeCloseTo(0.05, 5)
    expect(tDistributionTwoTailedP(2.093024, 19)).toBeCloseTo(0.05, 5)
  })

  it('คะแนนหลังต่ำกว่าก่อน ยังคำนวณได้และคืนค่าติดลบ ไม่ปัดเป็นศูนย์', () => {
    const r = pairedTTest([
      { pre: 8, post: 5 },
      { pre: 7, post: 5 },
      { pre: 9, post: 7 },
    ])
    expect(r.meanDiff).toBeCloseTo(-2.3333, 4)
    expect(r.t!).toBeLessThan(0)
    expect(r.direction).toBe('lower')
    // ค่า p เป็นสองทาง จึงยังบอกว่าแตกต่างอย่างมีนัยสำคัญ แม้ทิศทางจะลดลง
    expect(r.significant).toBe(true)
  })

  it('ห้องว่างและคนเดียวไม่พัง คืนเหตุผลแทนตัวเลขมั่ว', () => {
    const empty = pairedTTest([])
    expect(empty.n).toBe(0)
    expect(empty.t).toBeNull()
    expect(empty.significant).toBeNull()
    expect(empty.reason).toContain('อย่างน้อย 2 คน')

    const single = pairedTTest([{ pre: 3, post: 9 }])
    expect(single.n).toBe(1)
    expect(single.meanDiff).toBe(6)
    expect(single.t).toBeNull()
  })

  it('ทุกคนเปลี่ยนเท่ากันเป๊ะ ตัวหารเป็นศูนย์ จึงคืนเหตุผล ไม่ใช่ t เป็นอนันต์', () => {
    const r = pairedTTest([
      { pre: 4, post: 6 },
      { pre: 5, post: 7 },
      { pre: 6, post: 8 },
    ])
    expect(r.meanDiff).toBe(2)
    expect(r.sdDiff).toBe(0)
    expect(r.t).toBeNull()
    expect(r.reason).toContain('ส่วนเบี่ยงเบนมาตรฐานเป็น 0')
  })
})

describe('ขนาดอิทธิพล', () => {
  it('d = ค่าเฉลี่ยผลต่าง ÷ SD ของผลต่าง', () => {
    const t = pairedTTest([
      { pre: 5, post: 8 },
      { pre: 6, post: 8 },
      { pre: 7, post: 9 },
    ])
    const d = effectSize(t)
    expect(d.d).toBeCloseTo(4.0415, 3)
    expect(d.level).toBe('ใหญ่')
  })

  it('คำนวณไม่ได้คืน null พร้อมเหตุผล ไม่ใช่ 0', () => {
    expect(effectSize(pairedTTest([])).d).toBeNull()
    expect(effectSize(pairedTTest([])).hedgesG).toBeNull()
    expect(effectSize(pairedTTest([])).hedgesReason).toContain('อย่างน้อย 2 คน')
  })

  /**
   * ชุดข้อมูล 8 คนชุดเดียวกับที่ UAT-5 ยิงผ่าน API จริงแล้วคำนวณมือเทียบไว้
   * ตัวเลขทุกตัวข้างล่างมาจากการคำนวณมือ ไม่ได้ลอกจากผลลัพธ์ของโค้ด
   */
  describe("Hedges' g — ตัวแก้อคติของกลุ่มเล็ก", () => {
    const eightStudents = pairedTTest([
      { pre: 2, post: 9 },
      { pre: 3, post: 8 },
      { pre: 4, post: 7 },
      { pre: 4, post: 5 },
      { pre: 5, post: 6 },
      { pre: 6, post: 7 },
      { pre: 7, post: 8 },
      { pre: 8, post: 9 },
    ])

    it('ตัวคูณแก้อคติตรงสูตร J = 1 − 3/(4·df − 1)', () => {
      // df = 7 -> 1 − 3/27 = 0.888888...
      expect(hedgesCorrection(7)).toBeCloseTo(0.888889, 6)
      // ยิ่งคนเยอะ ตัวคูณยิ่งเข้าใกล้ 1 (แทบไม่ต่างจาก d)
      expect(hedgesCorrection(99)).toBeGreaterThan(0.99)
    })

    it('ห้อง 8 คน: d = 1.0730 และ g = 0.9538 ตามที่คำนวณมือ', () => {
      const e = effectSize(eightStudents)
      // ผลต่างเฉลี่ย 2.5 ÷ SD ผลต่าง 2.3299 = 1.0730
      expect(e.d).toBeCloseTo(1.073, 3)
      // 1.0730 × 0.888889 = 0.9538
      expect(e.hedgesG).toBeCloseTo(0.9538, 4)
      expect(e.hedgesReason).toBeNull()
      expect(e.hedgesLevel).toBe('ใหญ่')
    })

    it("ไม่ใช่ค่าเดียวกับคะแนนพัฒนาการของ Hake ที่ชุดข้อมูลเดียวกัน", () => {
      // ห้องเดียวกัน คะแนนเต็ม 10: เฉลี่ยก่อน 4.875 หลัง 7.375
      // Hake g = (73.75 − 48.75) ÷ (100 − 48.75) = 0.4878 ซึ่งคนละตัวกับ Hedges' g
      const hake = classNormalizedGain(
        [
          { pre: 2, post: 9 },
          { pre: 3, post: 8 },
          { pre: 4, post: 7 },
          { pre: 4, post: 5 },
          { pre: 5, post: 6 },
          { pre: 6, post: 7 },
          { pre: 7, post: 8 },
          { pre: 8, post: 9 },
        ],
        10,
      )
      expect(hake.hakeG).toBeCloseTo(0.4878, 4)
      expect(hake.hakeG).toBe(hake.g)
      expect(effectSize(eightStudents).hedgesG).not.toBeCloseTo(hake.hakeG!, 2)
    })

    it('g น้อยกว่า d เสมอเมื่อทิศทางเป็นบวก และตกระดับได้ถ้าอยู่ใกล้เส้นแบ่ง', () => {
      const e = effectSize(eightStudents)
      expect(e.hedgesG!).toBeLessThan(e.d!)
      // ห้อง 3 คนที่ d = 0.9 จะเหลือ g = 0.9 × (1 − 3/7) = 0.5143 ซึ่งตกจาก "ใหญ่" เป็น "ปานกลาง"
      const tiny = effectSize({ ...eightStudents, df: 2, t: 0.9 * Math.sqrt(8) })
      expect(tiny.level).toBe('ใหญ่')
      expect(tiny.hedgesG).toBeCloseTo(0.5143, 4)
      expect(tiny.hedgesLevel).toBe('ปานกลาง')
    })

    it('คนน้อยเกินกว่าจะแก้อคติได้ คืน null พร้อมเหตุผล ไม่ใช่ 0', () => {
      const twoStudents = pairedTTest([
        { pre: 3, post: 8 },
        { pre: 5, post: 7 },
      ])
      const e = effectSize(twoStudents)
      expect(e.d).not.toBeNull()
      expect(e.hedgesG).toBeNull()
      expect(e.hedgesLevel).toBeNull()
      expect(e.hedgesReason).toContain('df = 1')
      expect(hedgesCorrection(1)).toBeNull()
    })

    it('คะแนนตกลง g ติดลบตามจริง ไม่พลิกเป็นบวก', () => {
      const dropped = pairedTTest([
        { pre: 9, post: 4 },
        { pre: 8, post: 5 },
        { pre: 7, post: 2 },
        { pre: 6, post: 4 },
      ])
      const e = effectSize(dropped)
      expect(e.d!).toBeLessThan(0)
      expect(e.hedgesG!).toBeLessThan(0)
      expect(e.hedgesG!).toBeGreaterThan(e.d!)
    })
  })
})

describe('คะแนนพัฒนาการแบบปรับมาตรฐาน', () => {
  it('g คำนวณตรงสูตรและแปลผลตามเกณฑ์ในสเปก', () => {
    // ก่อน 4/10 = 40% หลัง 8/10 = 80% -> g = (80-40)/(100-40) = 0.6667 ปานกลาง
    const g = normalizedGain(4, 8, 10)
    expect(g.prePercent).toBe(40)
    expect(g.postPercent).toBe(80)
    expect(g.g).toBeCloseTo(0.6667, 4)
    expect(g.level).toBe('ปานกลาง')
    expect(g.meetsTarget).toBe(true)
  })

  it('ระดับสูงตั้งแต่ 0.70 ขึ้นไป และต่ำเมื่อน้อยกว่า 0.30', () => {
    expect(normalizedGain(5, 9, 10).level).toBe('สูง')
    expect(normalizedGain(5, 6, 10).level).toBe('ต่ำ')
    expect(normalizedGain(5, 6, 10).meetsTarget).toBe(false)
  })

  it('คะแนนตกลง g ติดลบ ไม่ปัดเป็นศูนย์', () => {
    const g = normalizedGain(8, 5, 10)
    expect(g.g).toBeCloseTo(-1.5, 4)
    expect(g.level).toBe('ต่ำ')
  })

  it('ก่อนเรียนเต็มอยู่แล้ว คืน null พร้อมเหตุผล ไม่หารด้วยศูนย์', () => {
    const g = normalizedGain(10, 10, 10)
    expect(g.g).toBeNull()
    expect(g.reason).toContain('ก่อนเรียนได้คะแนนเต็ม')
  })

  it('ห้องว่างคืนเหตุผล ไม่ใช่ 0', () => {
    expect(classNormalizedGain([], 10).g).toBeNull()
  })

  it('ของทั้งห้องคิดจากค่าเฉลี่ยของห้อง', () => {
    const g = classNormalizedGain(
      [
        { pre: 4, post: 8 },
        { pre: 6, post: 8 },
      ],
      10,
    )
    // ค่าเฉลี่ยก่อน 5 (50%) หลัง 8 (80%) -> g = 30/50 = 0.6
    expect(g.g).toBeCloseTo(0.6, 4)
  })
})

describe('ความยากและอำนาจจำแนกรายข้อ', () => {
  const sheets = [
    { correctByItem: { q1: true, q2: true, q3: true, q4: true } },
    { correctByItem: { q1: true, q2: true, q3: true, q4: false } },
    { correctByItem: { q1: true, q2: true, q3: false, q4: false } },
    { correctByItem: { q1: true, q2: false, q3: false, q4: false } },
    { correctByItem: { q1: true, q2: false, q3: false, q4: false } },
  ]

  it('ความยากคือสัดส่วนคนตอบถูก', () => {
    const stats = itemAnalysis(sheets)
    const q1 = stats.find((s) => s.itemId === 'q1')!
    const q4 = stats.find((s) => s.itemId === 'q4')!
    expect(q1.difficulty).toBe(1)
    expect(q1.difficultyOk).toBe(false) // ง่ายเกินเกณฑ์ 0.20-0.80
    expect(q4.difficulty).toBe(0.2)
    expect(q4.difficultyOk).toBe(true)
  })

  it('อำนาจจำแนกคือสัดส่วนถูกกลุ่มสูงลบกลุ่มต่ำ', () => {
    const stats = itemAnalysis(sheets)
    // 5 คน กลุ่มละ 1 คน (27%) — คนคะแนนสูงสุดตอบ q3 ถูก คนต่ำสุดตอบผิด
    expect(stats.find((s) => s.itemId === 'q3')!.discrimination).toBe(1)
    expect(stats.find((s) => s.itemId === 'q1')!.discrimination).toBe(0)
  })

  it('ห้องเล็กเกินจนแบ่งกลุ่มไม่ได้ คืน null พร้อมเหตุผล', () => {
    const stats = itemAnalysis([{ correctByItem: { q1: true } }, { correctByItem: { q1: false } }])
    expect(stats[0]!.discrimination).toBeNull()
    expect(stats[0]!.reason).toContain('อย่างน้อย 4 คน')
    expect(stats[0]!.difficulty).toBe(0.5)
  })

  it('ไม่มีข้อมูลคืนรายการว่าง ไม่พัง', () => {
    expect(itemAnalysis([])).toEqual([])
  })
})

describe('ร้อยละความตรงกัน', () => {
  it('แยกตรงกันพอดีกับต่างไม่เกิน 1 ระดับ', () => {
    const r = agreementRate([
      { a: 3, b: 3 },
      { a: 3, b: 2 },
      { a: 1, b: 3 },
      { a: 2, b: 2 },
    ])
    expect(r.pairCount).toBe(4)
    expect(r.exactCount).toBe(2)
    expect(r.withinOneCount).toBe(3)
    expect(r.exactPercent).toBe(50)
    expect(r.withinOnePercent).toBe(75)
  })

  it('ไม่มีคู่ให้เทียบก็ไม่หารด้วยศูนย์', () => {
    expect(agreementRate([]).exactPercent).toBe(0)
  })
})
