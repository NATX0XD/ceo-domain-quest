import { describe, expect, it } from 'vitest'
import { SKIP_EARNED_STARS, SKIP_TEACHER_STARS } from './personalize'
import {
  EFFICIENCY_STANDARD,
  IN_CLASS_MAX,
  MISSION_POINTS_MAX,
  POST_TEST_MAX,
  RUBRIC_POINTS_MAX,
  SKIP_POINTS,
  TEACHER_SKIP_POINTS,
  type InClassScoreInput,
  efficiencyE1,
  efficiencyE1BySetting,
  efficiencyE2,
  inClassScore,
  mediaEfficiency,
} from './efficiency'

/** คะแนนเต็มของสเปกข้อ 9.3 (A = 28) ใช้ตอนตรวจว่าเลขตรงกับตัวอย่างในเอกสาร */
const SPEC_IN_CLASS_MAX = 28

const FOUR_MISSIONS = ['m1', 'm2', 'm3', 'm4']

/** นักเรียนที่เก็บดาวครบทุกภารกิจ และได้คะแนนรูบริกตามที่กำหนด */
function student(id: string, stars: number[], rubricScore: number): InClassScoreInput {
  return {
    studentId: id,
    missions: FOUR_MISSIONS.map((missionId, i) => ({ missionId, stars: stars[i] ?? 0 })),
    rubricScore,
  }
}

describe('คะแนนเต็มอ่านจากไฟล์เนื้อหา ไม่ตรึงไว้ในโค้ด', () => {
  it('A มาจากคะแนนเต็มภารกิจย่อยบวกคะแนนเต็มรูบริก', () => {
    expect(MISSION_POINTS_MAX).toBe(12)
    expect(RUBRIC_POINTS_MAX).toBe(15)
    expect(IN_CLASS_MAX).toBe(MISSION_POINTS_MAX + RUBRIC_POINTS_MAX)
    expect(SKIP_POINTS).toBe(3)
  })

  it('B คือจำนวนข้อของแบบทดสอบหลังเรียน = 10 ตามสเปกข้อ 9.3', () => {
    expect(POST_TEST_MAX).toBe(10)
    expect(EFFICIENCY_STANDARD).toBe(80)
  })
})

describe('คะแนนระหว่างเรียนรายคน (X ในสูตร E1)', () => {
  it('ภารกิจที่ข้ามนับเต็ม ตามข้อควรระวังในสเปกข้อ 9.3', () => {
    const r = inClassScore({
      studentId: 'stu-1',
      missions: [
        { missionId: 'm1', skipped: true },
        { missionId: 'm2', stars: 3 },
        { missionId: 'm3', skipped: true },
        { missionId: 'm4', stars: 2 },
      ],
      rubricScore: 15,
    })
    // ตัวอย่างของพลอยในสเปก E-17: 3 + 3 + 3 + 2 = 11 คะแนนภารกิจ
    expect(r.missionPoints).toBe(11)
    expect(r.rubricPoints).toBe(15)
    expect(r.total).toBe(26)
    expect(r.skippedCount).toBe(2)
  })

  it('ยังไม่ส่งด่านบอสหรือครูยังไม่ยืนยัน คะแนนรูบริกเป็น 0', () => {
    expect(inClassScore(student('stu-2', [3, 3, 3, 3], 0)).total).toBe(12)
    expect(inClassScore({ studentId: 'stu-3', missions: [], rubricScore: null }).total).toBe(0)
  })

  it('ค่าที่เกินเพดานถูกบีบลง ไม่ให้ข้อมูลเพี้ยนดันค่าเฉลี่ยทั้งห้อง', () => {
    const r = inClassScore(student('stu-4', [9, 9, 9, 9], 99))
    expect(r.missionPoints).toBe(MISSION_POINTS_MAX)
    expect(r.rubricPoints).toBe(RUBRIC_POINTS_MAX)
    expect(r.total).toBe(IN_CLASS_MAX)
    expect(r.percent).toBe(100)
  })
})

describe('E1/E2 ตรงกับตัวอย่างการคำนวณในสเปกข้อ 9.3', () => {
  /**
   * ตัวอย่างในสเปก: นักเรียน 20 คน ผลรวมคะแนนระหว่างเรียน 472 (เฉลี่ย 23.60 จาก 28) = 84.29
   * และผลรวมคะแนนหลังเรียน 166 (เฉลี่ย 8.30 จาก 10) = 83.00
   */
  const twentyStudents: InClassScoreInput[] = [
    // 12 คนได้ 24 คะแนน (ภารกิจเต็ม 12 + รูบริก 12)
    ...Array.from({ length: 12 }, (_, i) => student(`a${i}`, [3, 3, 3, 3], 12)),
    // 8 คนได้ 23 คะแนน (ภารกิจเต็ม 12 + รูบริก 11)
    ...Array.from({ length: 8 }, (_, i) => student(`b${i}`, [3, 3, 3, 3], 11)),
  ]
  // 6 คนได้ 9 คะแนน และ 14 คนได้ 8 คะแนน รวม 166
  const twentyPostScores = [...Array(6).fill(9), ...Array(14).fill(8)]

  it('ΣX = 472 เฉลี่ย 23.60 จาก 28 ได้ E1 = 84.29', () => {
    const e1 = efficiencyE1(twentyStudents, { inClassMax: SPEC_IN_CLASS_MAX })
    expect(e1.sum).toBe(472)
    expect(e1.n).toBe(20)
    expect(e1.mean).toBe(23.6)
    expect(e1.max).toBe(28)
    expect(e1.percent).toBe(84.29)
    expect(e1.meetsStandard).toBe(true)
  })

  it('ΣF = 166 เฉลี่ย 8.30 จาก 10 ได้ E2 = 83.00', () => {
    const e2 = efficiencyE2(twentyPostScores)
    expect(e2.sum).toBe(166)
    expect(e2.mean).toBe(8.3)
    expect(e2.max).toBe(10)
    expect(e2.percent).toBe(83)
    expect(e2.meetsStandard).toBe(true)
  })

  it('สรุปเป็น E1/E2 = 84.29/83.00 สูงกว่าเกณฑ์ 80/80', () => {
    const r = mediaEfficiency(twentyStudents, twentyPostScores, {
      inClassMax: SPEC_IN_CLASS_MAX,
    })
    expect(r.label).toBe('84.29/83.00')
    expect(r.standardLabel).toBe('80/80')
    expect(r.meetsStandard).toBe(true)
    expect(r.summary).toContain('84.29/83.00')
    expect(r.perStudent).toHaveLength(20)
  })

  it('ใช้คะแนนเต็มจริงของสื่อนี้ (A = 27) ค่าจะสูงกว่าเล็กน้อย แต่สูตรเดียวกัน', () => {
    const e1 = efficiencyE1(twentyStudents)
    expect(e1.max).toBe(27)
    expect(e1.percent).toBe(87.41) // (23.60 ÷ 27) × 100
  })
})

describe('ไม่ถึงเกณฑ์ก็ต้องรายงานตามจริง', () => {
  it('ต่ำกว่า 80 ต้องบอกว่าไม่ผ่าน ไม่ใช่ปัดขึ้น', () => {
    const r = mediaEfficiency(
      [student('s1', [1, 1, 1, 1], 5), student('s2', [1, 1, 1, 1], 5)],
      [4, 5],
    )
    expect(r.e1.percent).toBeLessThan(80)
    expect(r.e2.percent).toBe(45)
    expect(r.meetsStandard).toBe(false)
    expect(r.summary).toContain('ยังไม่ถึงเกณฑ์')
  })
})

describe('เคสสุดขอบที่ห้ามพัง', () => {
  it('ห้องว่างคืนศูนย์พร้อมเหตุผล ไม่หารด้วยศูนย์', () => {
    const r = mediaEfficiency([], [])
    expect(r.e1.n).toBe(0)
    expect(r.e1.percent).toBe(0)
    expect(r.e1.reason).toContain('ยังไม่มีข้อมูล')
    expect(r.meetsStandard).toBe(false)
    expect(r.summary).toContain('ยังคำนวณประสิทธิภาพไม่ได้')
  })

  it('นักเรียนคนเดียวคำนวณได้ปกติ', () => {
    const r = mediaEfficiency([student('s1', [3, 3, 3, 3], 15)], [10])
    expect(r.e1.n).toBe(1)
    expect(r.e1.percent).toBe(100)
    expect(r.e2.percent).toBe(100)
    expect(r.meetsStandard).toBe(true)
  })

  it('คะแนนหลังเรียนต่ำกว่าก่อนเรียนก็ยังคำนวณ E2 ได้ ไม่ปัดเป็นศูนย์', () => {
    const e2 = efficiencyE2([2, 3, 1])
    expect(e2.mean).toBe(2)
    expect(e2.percent).toBe(20)
    expect(e2.meetsStandard).toBe(false)
  })

  it('คะแนนติดลบหรือเกินเต็มถูกบีบเข้าช่วงก่อนคิดค่าเฉลี่ย', () => {
    expect(efficiencyE2([-5, 99]).sum).toBe(10)
  })
})

describe('แยก E1 ของงานในคาบกับงานที่บ้าน (ข้อควรระวังท้ายสเปกข้อ 9.3)', () => {
  it('แยกสองกลุ่มได้ และกลุ่มที่ไม่มีคนคืนเหตุผลแทนศูนย์ลอย ๆ', () => {
    const r = efficiencyE1BySetting([
      { ...student('s1', [3, 3, 3, 3], 15), doneInClass: true },
      { ...student('s2', [1, 1, 1, 1], 5), doneInClass: false },
    ])
    expect(r.inClass.n).toBe(1)
    expect(r.atHome.n).toBe(1)
    expect(r.all.n).toBe(2)
    expect(r.inClass.percent).toBeGreaterThan(r.atHome.percent)

    const noneAtHome = efficiencyE1BySetting([student('s1', [3, 3, 3, 3], 15)])
    expect(noneAtHome.atHome.n).toBe(0)
    expect(noneAtHome.atHome.reason).toBeTruthy()
  })
})

describe('ข้ามภารกิจใน E1 ต้องตรงกับกติกาดาว (มติ T46)', () => {
  it('ข้ามเองโดยผ่านเงื่อนไขนับเต็มเท่ากับทำผ่านเอง', () => {
    const skipped = inClassScore({
      studentId: 's1',
      missions: [
        { missionId: 'm1', skipped: true },
        { missionId: 'm2', stars: 3 },
        { missionId: 'm3', stars: 3 },
        { missionId: 'm4', stars: 3 },
      ],
      rubricScore: 15,
    })
    const played = inClassScore(student('s2', [3, 3, 3, 3], 15))
    expect(skipped.total).toBe(played.total)
    expect(skipped.skippedCount).toBe(1)
    expect(skipped.teacherSkippedCount).toBe(0)
  })

  it('**ครูสั่งให้ข้ามได้ 0 คะแนน** และแยกให้เห็นในผลรายคน', () => {
    const r = inClassScore({
      studentId: 's1',
      missions: [
        { missionId: 'm1', skipped: true, skippedBy: 'teacher' },
        { missionId: 'm2', stars: 3 },
        { missionId: 'm3', stars: 3 },
        { missionId: 'm4', stars: 3 },
      ],
      rubricScore: 15,
    })
    expect(r.missionPoints).toBe(9)
    expect(r.skippedCount).toBe(1)
    expect(r.teacherSkippedCount).toBe(1)
  })

  it('คะแนนของการข้ามมาจากแหล่งเดียวกับดาว ไม่ได้คำนวณซ้ำ', () => {
    expect(SKIP_POINTS).toBe(SKIP_EARNED_STARS)
    expect(TEACHER_SKIP_POINTS).toBe(SKIP_TEACHER_STARS)
    expect(SKIP_POINTS).toBe(3)
    expect(TEACHER_SKIP_POINTS).toBe(0)
  })

  it('ข้ามครบทั้ง 4 ภารกิจก็ยังไม่เกินเพดานคะแนนภารกิจย่อย', () => {
    const r = inClassScore({
      studentId: 's1',
      missions: FOUR_MISSIONS.map((missionId) => ({ missionId, skipped: true })),
      rubricScore: 0,
    })
    expect(r.missionPoints).toBe(MISSION_POINTS_MAX)
  })
})
