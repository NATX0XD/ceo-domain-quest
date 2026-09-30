import { describe, expect, it } from 'vitest'
import {
  REFLECTION_QUESTION_COUNT,
  type RouteChange,
  type StudentReport,
  type RubricBreakdown,
  type StudentReportInput,
  adaptiveEvidence,
  certificateData,
  classStatistics,
  classSummary,
  encouragement,
  evidenceSentences,
  objectiveGaps,
  objectiveOutcomes,
  studentReport,
} from './report'

const T0 = 1_759_000_000_000

function makeInput(over: Partial<StudentReportInput> = {}): StudentReportInput {
  return {
    studentId: 'stu-1',
    nickname: 'นิด',
    shopName: 'ขนมหวาน',
    domainName: 'kanomwan',
    tldSuffix: '.co.th',
    goal: 'goal-good',
    preScore: 1,
    postScore: 3,
    routeSuggested: 'card',
    routeChosen: 'card',
    startedAt: T0,
    finishedAt: T0 + 20 * 60 * 1000,
    missions: [
      { missionId: 'mission-1', objectiveId: 'obj-1', passed: true, stars: 3, route: 'card' },
      { missionId: 'mission-2', objectiveId: 'obj-2', passed: true, stars: 2, route: 'card' },
      { missionId: 'mission-3', objectiveId: 'obj-3', passed: false, stars: 0, route: 'card' },
      { missionId: 'mission-4', objectiveId: 'obj-4', passed: true, stars: 1, route: 'card' },
    ],
    ...over,
  }
}

function makeReport(over: Partial<StudentReportInput> = {}): StudentReport {
  return studentReport(makeInput(over))
}

describe('สรุปผลรายคน', () => {
  it('รวมดาว เวลาที่ใช้ และชื่อเว็บเต็มได้ถูกต้อง', () => {
    const r = makeReport()
    expect(r.starsTotal).toBe(6)
    expect(r.starsMax).toBe(12)
    expect(r.domainFull).toBe('kanomwan.co.th')
    expect(r.timeSpentSec).toBe(1200)
  })

  it('เทียบดาวกับเป้าที่ตั้งเองแบบใส่จำนวนดาวตรง ๆ', () => {
    expect(makeReport({ goal: 5 }).goalLevel).toBe(5)
    expect(makeReport({ goal: 5 }).goalOutcome).toBe('exceeded')
    expect(makeReport({ goal: 6 }).goalOutcome).toBe('met')
    expect(makeReport({ goal: 9 }).goalOutcome).toBe('below')
  })

  it('ใส่เป็นรหัสเป้าหมายก็แปลงเป็นจำนวนดาวให้ โดยอ่านจากไฟล์เนื้อหา', () => {
    // ไม่ตรึงตัวเลขไว้ในเทสต์ เพราะครูปรับจำนวนดาวเป้าในไฟล์เนื้อหาได้
    const r = makeReport({ goal: 'goal-basic' })
    expect(r.goalLevel).toBeGreaterThan(0)
    expect(['below', 'met', 'exceeded']).toContain(r.goalOutcome)
  })

  it('คะแนนที่ลดลงต้องรายงานเป็นค่าติดลบ ไม่ปัดเป็นศูนย์', () => {
    const r = makeReport({ preScore: 4, postScore: 1 })
    expect(r.gain).toBe(-3)
  })

  it('คะแนนเท่าเดิมได้ศูนย์ คะแนนขึ้นได้ค่าบวก', () => {
    expect(makeReport({ preScore: 2, postScore: 2 }).gain).toBe(0)
    expect(makeReport({ preScore: 0, postScore: 4 }).gain).toBe(4)
  })

  it('นับช่องทางที่ใช้และจำนวนครั้งที่สลับได้ถูก', () => {
    const r = makeReport({
      missions: [
        { missionId: 'mission-1', objectiveId: 'obj-1', passed: true, stars: 3, route: 'card' },
        { missionId: 'mission-2', objectiveId: 'obj-2', passed: true, stars: 2, route: 'clip' },
        { missionId: 'mission-3', objectiveId: 'obj-3', passed: true, stars: 1, route: 'clip', routeSwitches: 1 },
      ],
    })
    expect(r.routesUsed).toEqual(['card', 'clip'])
    expect(r.switchCount).toBe(2)
  })

  it('ยังไม่จบคาบ ใช้เวลาปัจจุบันที่ส่งเข้ามาแทน ไม่เรียกเวลาเครื่องเอง', () => {
    const r = studentReport(makeInput({ finishedAt: undefined }), T0 + 5 * 60 * 1000)
    expect(r.timeSpentSec).toBe(300)
  })

  it('ไม่ส่งเวลามาเลยได้ศูนย์ ไม่พัง', () => {
    const r = studentReport(makeInput({ startedAt: undefined, finishedAt: undefined }))
    expect(r.timeSpentSec).toBe(0)
  })

  it('ยังไม่มีนามสกุลที่ยื่นผ่าน คืนชื่อโดเมนเปล่า ๆ ไม่มีจุดห้อยท้าย', () => {
    const r = makeReport({ tldSuffix: undefined })
    expect(r.domainFull).toBe('kanomwan')
  })

  it('ยังไม่ได้ทำภารกิจเลยไม่พัง', () => {
    const r = makeReport({ missions: [] })
    expect(r.starsTotal).toBe(0)
    expect(r.starsMax).toBe(0)
    expect(r.routesUsed).toEqual([])
    expect(r.switchCount).toBe(0)
  })
})

describe('ความคืบหน้าการสะท้อนคิด', () => {
  it('บอกทั้งเกณฑ์ที่ต้องถึงและจำนวนข้อทั้งหมด ไม่ให้ครูเข้าใจผิดว่ายังไม่ครบ', () => {
    const r = makeReport({ selfRegulation: { reflectionAnswered: REFLECTION_QUESTION_COUNT } })
    expect(r.reflectionProgress.required).toBe(REFLECTION_QUESTION_COUNT)
    expect(r.reflectionProgress.total).toBeGreaterThanOrEqual(REFLECTION_QUESTION_COUNT)
    expect(r.reflectionProgress.met).toBe(true)
    expect(r.reflectionProgress.text).toContain('ครบตามเกณฑ์')
  })

  it('ยังตอบไม่ครบ บอกว่าขาดอีกกี่ข้อจากเกณฑ์ ไม่ใช่จากจำนวนข้อทั้งหมด', () => {
    const r = makeReport({ selfRegulation: { reflectionAnswered: 0 } })
    expect(r.reflectionProgress.met).toBe(false)
    expect(r.reflectionProgress.text).toContain(`0 จาก ${REFLECTION_QUESTION_COUNT} ข้อ`)
  })
})

describe('ใบประกาศ', () => {
  it('ทุกคนที่เข้าร่วมได้ใบประกาศ แม้ได้ 0 ดาว', () => {
    const zero = certificateData(
      makeReport({
        missions: [
          { missionId: 'mission-1', objectiveId: 'obj-1', passed: false, stars: 0, route: 'card' },
        ],
      }),
    )
    expect(zero.eligible).toBe(true)
    expect(zero.starsTotal).toBe(0)
    expect(zero.level).toBe('เข้าร่วม')
    expect(zero.lines.length).toBeGreaterThan(0)
  })

  it('ระดับบนใบประกาศไล่ตามดาวที่เก็บได้', () => {
    const full = makeReport({
      missions: [
        { missionId: 'mission-1', objectiveId: 'obj-1', passed: true, stars: 3, route: 'card' },
        { missionId: 'mission-2', objectiveId: 'obj-2', passed: true, stars: 3, route: 'card' },
      ],
    })
    expect(certificateData(full).level).toBe('ยอดเยี่ยม')
    // 6 จาก 12 ดวง = ครึ่งหนึ่ง ยังไม่ถึงเกณฑ์ 'ทำได้ดี' ที่ 60%
    expect(certificateData(makeReport()).level).toBe('ผ่าน')
    const good = makeReport({
      missions: [
        { missionId: 'mission-1', objectiveId: 'obj-1', passed: true, stars: 3, route: 'card' },
        { missionId: 'mission-2', objectiveId: 'obj-2', passed: true, stars: 2, route: 'card' },
      ],
    })
    expect(certificateData(good).level).toBe('ทำได้ดี')
  })

  it('มีชื่อเล่น ชื่อร้าน และชื่อเว็บอยู่บนใบประกาศ', () => {
    const c = certificateData(makeReport(), T0)
    expect(c.lines.join(' ')).toContain('นิด')
    expect(c.lines.join(' ')).toContain('ขนมหวาน')
    expect(c.lines.join(' ')).toContain('kanomwan.co.th')
    expect(c.issuedAt).toBe(T0)
  })

  it('ชื่อร้านที่ขึ้นต้นด้วยคำว่า "ร้าน" อยู่แล้ว ไม่ถูกเติมซ้ำเป็น "ร้าน ร้าน"', () => {
    const text = certificateData(makeReport({ shopName: 'ร้านกาแฟแม่' })).lines.join(' ')
    expect(text).toContain('CEO ร้านกาแฟแม่')
    expect(text).not.toContain('ร้าน ร้าน')
  })

  it('ไม่มีข้อความตัดสิทธิ์หรือคำว่าไม่ผ่านบนใบประกาศ', () => {
    const text = certificateData(makeReport({ preScore: 4, postScore: 0 })).lines.join(' ')
    expect(text).not.toContain('ไม่ผ่าน')
    expect(text).not.toContain('ตก')
  })
})

describe('ข้อความให้กำลังใจ', () => {
  const BLAME_WORDS = ['ไม่เก่ง', 'อ่อน', 'แย่', 'ล้มเหลว', 'ไม่ผ่าน', 'น่าเสียดาย', 'ควรตั้งใจ']
  const COMPARE_WORDS = ['เพื่อน', 'ค่าเฉลี่ย', 'อันดับ', 'คนอื่น', 'ทั้งห้อง']

  it('ไม่มีคำตำหนิ แม้คะแนนหลังเรียนจะตกลง', () => {
    const text = encouragement(makeReport({ preScore: 4, postScore: 0 }))
    for (const word of BLAME_WORDS) expect(text).not.toContain(word)
  })

  it('ไม่เปรียบเทียบกับเพื่อนหรือค่าเฉลี่ยของห้อง', () => {
    const text = encouragement(makeReport())
    for (const word of COMPARE_WORDS) expect(text).not.toContain(word)
  })

  it('อ้างสิ่งที่ผู้เรียนทำได้จริง ทั้งการเปลี่ยนวิธีเรียนและการยกเป้า', () => {
    const text = encouragement(
      makeReport({
        goalRaisedCount: 2,
        missions: [
          { missionId: 'mission-1', objectiveId: 'obj-1', passed: true, stars: 3, route: 'card' },
          { missionId: 'mission-2', objectiveId: 'obj-2', passed: true, stars: 2, route: 'buddy' },
        ],
      }),
    )
    expect(text).toContain('เปลี่ยนวิธีเรียนด้วยตัวเอง')
    expect(text).toContain('ยกเป้าหมายของตัวเองให้สูงขึ้นเอง 2 ครั้ง')
    expect(text).toContain('นิด')
  })

  it('คนที่ยังไม่ผ่านสักภารกิจก็ยังได้ข้อความที่พูดถึงสิ่งที่ลงมือทำ', () => {
    const text = encouragement(
      makeReport({
        preScore: 2,
        postScore: 2,
        missions: [
          { missionId: 'mission-1', objectiveId: 'obj-1', passed: false, stars: 0, route: 'card' },
        ],
      }),
    )
    expect(text).toContain('ลงมือทำครบทุกขั้น')
    for (const word of BLAME_WORDS) expect(text).not.toContain(word)
  })
})

describe('สรุปทั้งห้อง', () => {
  const classroom: StudentReport[] = [
    makeReport(),
    makeReport({
      studentId: 'stu-2',
      nickname: 'ก้อง',
      preScore: 2,
      postScore: 4,
      missions: [
        { missionId: 'mission-1', objectiveId: 'obj-1', passed: true, stars: 3, route: 'clip' },
        { missionId: 'mission-2', objectiveId: 'obj-2', passed: false, stars: 0, route: 'clip' },
      ],
    }),
    makeReport({
      studentId: 'stu-3',
      nickname: 'ฟ้า',
      preScore: 3,
      postScore: 1,
      stuck: { objectiveId: 'obj-3', cause: 'many-attempts' },
      missions: [
        { missionId: 'mission-1', objectiveId: 'obj-1', passed: true, stars: 2, route: 'buddy' },
      ],
    }),
  ]

  it('ห้องว่างไม่พัง และไม่หารด้วยศูนย์', () => {
    const s = classSummary([])
    expect(s.headcount).toBe(0)
    expect(s.avgStars).toBe(0)
    expect(s.avgGain).toBe(0)
    expect(s.stuckNow).toEqual([])
    expect(Object.keys(s.passedByObjective).sort()).toEqual(['obj-1', 'obj-2', 'obj-3', 'obj-4'])
  })

  it('มีนักเรียนคนเดียวก็สรุปได้', () => {
    const s = classSummary([makeReport()])
    expect(s.headcount).toBe(1)
    expect(s.avgStars).toBe(6)
    expect(s.avgGain).toBe(2)
  })

  it('เฉลี่ยดาวและเฉลี่ยคะแนนที่เพิ่มขึ้นถูกต้อง รวมกรณีคะแนนตก', () => {
    const s = classSummary(classroom)
    expect(s.headcount).toBe(3)
    expect(s.avgStars).toBe(round2((6 + 3 + 2) / 3))
    expect(s.avgGain).toBe(round2((2 + 2 - 2) / 3))
  })

  it('นับคนที่ผ่านแต่ละวัตถุประสงค์ได้ถูก แม้บางคนทำไม่ครบทุกภารกิจ', () => {
    const s = classSummary(classroom)
    expect(s.passedByObjective['obj-1']).toBe(3)
    expect(s.passedByObjective['obj-2']).toBe(1)
    expect(s.passedByObjective['obj-3']).toBe(0)
    expect(s.passedByObjective['obj-4']).toBe(1)
  })

  it('เก็บรายชื่อคนที่กำลังติดไว้ให้ครูเห็น', () => {
    const s = classSummary(classroom)
    expect(s.stuckNow).toHaveLength(1)
    expect(s.stuckNow[0]).toEqual({
      studentId: 'stu-3',
      nickname: 'ฟ้า',
      objectiveId: 'obj-3',
      cause: 'many-attempts',
    })
  })
})

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

describe('วัตถุประสงค์ที่ต้องทบทวนท้ายคาบ', () => {
  const summary = {
    headcount: 10,
    avgStars: 4,
    avgGain: 1,
    passedByObjective: { 'obj-1': 9, 'obj-2': 5, 'obj-3': 1, 'obj-4': 3 },
    stuckNow: [],
  }

  it('เอาเฉพาะข้อที่คนผ่านน้อยกว่า 60% และเรียงจากแย่สุด', () => {
    const gaps = objectiveGaps(summary)
    expect(gaps.map((g) => g.objectiveId)).toEqual(['obj-3', 'obj-4', 'obj-2'])
    expect(gaps[0]!.passRate).toBe(0.1)
  })

  it('ข้อที่คนผ่านเกินเกณฑ์ไม่ถูกหยิบมา', () => {
    expect(objectiveGaps(summary).map((g) => g.objectiveId)).not.toContain('obj-1')
  })

  it('มีข้อความแนะนำครูว่าให้ทบทวนเรื่องอะไร', () => {
    const [worst] = objectiveGaps(summary)
    expect(worst!.advice).toContain('1 จาก 10 คน')
    expect(worst!.advice).toContain('ประเภทของนามสกุลโดเมน')
  })

  /**
   * บทสอนเสริมกับคำถามชวนคิดอยู่ใน content/coach-prompts.json มาตั้งแต่ต้น (สเปกหัวข้อ 11.12)
   * แต่ไม่มีใครอ่าน ตอนนี้ติดมากับช่องว่างรายจุดประสงค์ ครูจึงได้ของสอนซ่อมพร้อมใช้
   */
  it('ข้อที่ยังอ่อนมีบทสอนเสริม 3 นาทีกับคำถามชวนคิดติดมาด้วย', () => {
    const [worst] = objectiveGaps(summary)
    expect(worst!.miniLesson).not.toBeNull()
    expect(worst!.miniLesson!.minutes).toHaveLength(3)
    expect(worst!.coachQuestions.length).toBeGreaterThan(0)
    for (const q of worst!.coachQuestions) {
      expect(q.question.length).toBeGreaterThan(0)
      expect(q.misconception.length).toBeGreaterThan(0)
    }
  })

  it('ห้องว่างคืนรายการว่าง ไม่ใช่ทุกข้อเป็นช่องว่าง', () => {
    expect(objectiveGaps(classSummary([]))).toEqual([])
  })

  it('ทุกคนผ่านหมดไม่มีข้อไหนต้องทบทวน', () => {
    expect(
      objectiveGaps({
        headcount: 5,
        avgStars: 6,
        avgGain: 2,
        passedByObjective: { 'obj-1': 5, 'obj-2': 5, 'obj-3': 5, 'obj-4': 5 },
        stuckNow: [],
      }),
    ).toEqual([])
  })
})

describe('หลักฐานว่าเป็นการเรียนรู้ส่วนบุคคลจริง', () => {
  const reports: StudentReport[] = [
    // รับตามที่ระบบเสนอ และไม่เปลี่ยนเลยทั้งคาบ
    makeReport({ studentId: 'stu-1', routeSuggested: 'card', routeChosen: 'card' }),
    // ระบบเสนอการ์ด แต่เลือกคู่หูเอง
    makeReport({ studentId: 'stu-2', routeSuggested: 'card', routeChosen: 'buddy' }),
    // รับตามที่เสนอ แต่สลับกลางคัน และยกเป้าเอง
    makeReport({
      studentId: 'stu-3',
      routeSuggested: 'clip',
      routeChosen: 'clip',
      goalRaisedCount: 1,
      missions: [
        { missionId: 'mission-1', objectiveId: 'obj-1', passed: true, stars: 3, route: 'clip' },
        { missionId: 'mission-2', objectiveId: 'obj-2', passed: true, stars: 3, route: 'game' },
      ],
    }),
  ]

  it('ห้องว่างไม่พัง', () => {
    const e = adaptiveEvidence([], [])
    expect(e.headcount).toBe(0)
    expect(e.switchedCount).toBe(0)
    expect(e.overrodeSuggestionCount).toBe(0)
    expect(e.samePathCount).toBe(0)
    expect(e.routeDistribution).toEqual({ clip: 0, card: 0, game: 0, buddy: 0 })
  })

  it('นับคนตามช่องทางที่เลือกจริง ไม่ใช่ที่ระบบเสนอ', () => {
    const e = adaptiveEvidence(reports)
    expect(e.routeDistribution).toEqual({ clip: 1, card: 1, game: 0, buddy: 1 })
  })

  it('นับเฉพาะคนที่เลือกต่างจากที่ระบบเสนอจริง', () => {
    expect(adaptiveEvidence(reports).overrodeSuggestionCount).toBe(1)
  })

  it('คนที่ระบบไม่ได้เสนออะไรไว้ ไม่ถูกนับว่าเปลี่ยนจากข้อเสนอ', () => {
    const e = adaptiveEvidence([makeReport({ routeSuggested: null, routeChosen: 'buddy' })])
    expect(e.overrodeSuggestionCount).toBe(0)
  })

  it('นับคนที่สลับช่องทางกลางคัน และคนที่เดินทางเดียวตลอดคาบ', () => {
    const e = adaptiveEvidence(reports)
    expect(e.switchedCount).toBe(1)
    expect(e.samePathCount).toBe(2)
  })

  it('ตาราง route_changes ช่วยจับคนที่สลับ แม้ภารกิจจะบันทึกช่องทางไม่ครบ', () => {
    const changes: RouteChange[] = [
      { studentId: 'stu-2', missionId: 'mission-2', fromRoute: 'buddy', toRoute: 'card', changedAt: T0 },
    ]
    const e = adaptiveEvidence(reports, changes)
    expect(e.switchedCount).toBe(2)
    expect(e.samePathCount).toBe(1)
  })

  it('นับคนที่ยกเป้าหมายของตัวเอง', () => {
    expect(adaptiveEvidence(reports).raisedGoalCount).toBe(1)
  })
})

describe('ประโยคขึ้นสไลด์', () => {
  it('ได้ 5 บรรทัด และมีตัวเลขจริงอยู่ในประโยค', () => {
    const lines = evidenceSentences(adaptiveEvidence([makeReport(), makeReport({ studentId: 'stu-2' })]))
    expect(lines).toHaveLength(5)
    expect(lines[1]).toContain('จาก 2 คน')
  })

  it('ถ้าไม่มีใครเปลี่ยนจากที่ระบบเสนอ ต้องเตือนว่ายังเป็นระบบปรับเหมาะล้วน', () => {
    const lines = evidenceSentences(
      adaptiveEvidence([makeReport({ routeSuggested: 'card', routeChosen: 'card' })]),
    )
    expect(lines[2]).toContain('ยังไม่มีใครเปลี่ยนจากที่ระบบเสนอ')
  })

  it('ถ้ามีคนเปลี่ยนเอง ประโยคต้องชี้ว่าเป็นการเรียนรู้ส่วนบุคคล', () => {
    const lines = evidenceSentences(
      adaptiveEvidence([makeReport({ routeSuggested: 'card', routeChosen: 'buddy' })]),
    )
    expect(lines[2]).toContain('เลือกเส้นทางเองแทน')
    expect(lines[2]).toContain('ไม่ใช่ระบบปรับเหมาะล้วน')
  })

  it('ยังไม่มีนักเรียนในคาบ คืนข้อความบอกว่ายังไม่มีข้อมูล', () => {
    expect(evidenceSentences(adaptiveEvidence([]))).toEqual(['ยังไม่มีข้อมูลผู้เรียนในคาบนี้'])
  })
})

describe('คะแนนรายด้านของภารกิจใหญ่ในรายงาน', () => {
  const rubric = {
    dimensions: [
      { id: 'dim-naming', name: 'ชื่อจำง่ายและสะกดถูกกฎ', score: 3, emphasized: true },
      { id: 'dim-tld-fit', name: 'นามสกุลเหมาะกับประเภทธุรกิจ', score: 2 },
      { id: 'dim-customer-reason', name: 'เหตุผลอ้างอิงลูกค้าเป้าหมาย', score: 2 },
      { id: 'dim-business-link', name: 'เชื่อมโยงกับธุรกิจตัวเอง', score: 1 },
    ],
    emphasisDimensionId: 'dim-naming',
    weightedTotal: 11,
    weightedMax: 15,
    stars: 2,
    needsTeacherConfirm: true as const,
  }

  it('รายงานแสดงคะแนนได้ครบทั้ง 4 ด้าน', () => {
    const r = makeReport({ rubric })
    expect(r.rubric?.dimensions).toHaveLength(4)
    expect(r.rubric?.weightedTotal).toBe(11)
    expect(r.rubric?.emphasisDimensionId).toBe('dim-naming')
  })

  it('คะแนนรายด้านยังต้องให้ครูยืนยันเสมอ', () => {
    expect(makeReport({ rubric }).rubric?.needsTeacherConfirm).toBe(true)
  })

  it('ยังไม่ได้ส่งงานหรือยังไม่ตรวจ คืน null ไม่ใช่ค่าว่างมั่ว ๆ', () => {
    expect(makeReport().rubric).toBeNull()
  })
})

describe('สถิติรายห้องสำหรับรายงานผล (สเปกข้อ 9.4)', () => {
  const classReports = [
    makeReport({ studentId: 's1', preScore: 4, postScore: 8 }),
    makeReport({ studentId: 's2', preScore: 5, postScore: 8 }),
    makeReport({ studentId: 's3', preScore: 3, postScore: 9 }),
    makeReport({ studentId: 's4', preScore: 6, postScore: 7 }),
  ]

  it('รายงานค่าเฉลี่ย ส่วนเบี่ยงเบนมาตรฐาน และค่าทีของคะแนนก่อน-หลัง', () => {
    const s = classStatistics(classReports)
    expect(s.headcount).toBe(4)
    expect(s.quizMax).toBe(10)
    expect(s.pre.mean).toBe(4.5)
    expect(s.post.mean).toBe(8)
    expect(s.gain.mean).toBe(3.5)
    expect(s.tTest.df).toBe(3)
    expect(s.tTest.t).not.toBeNull()
    expect(s.tTest.significant).toBe(true)
    expect(s.effectSize.d).not.toBeNull()
    expect(s.normalizedGain.g).toBeCloseTo(0.6364, 3)
    expect(s.summary).toContain('t =')
  })

  /**
   * สถิติตัวที่ 6 ของสเปกข้อ 9.4 — เดิมมีฟังก์ชันอยู่แต่ไม่มีใครเรียก
   * คิดเป็นคู่รายเกณฑ์ เทียบกับคะแนนที่ครูยืนยันเสมอ
   */
  describe('ร้อยละความตรงกัน', () => {
    const rubricOf = (scores: Record<string, number>): RubricBreakdown => ({
      dimensions: Object.entries(scores).map(([id, score]) => ({ id, name: id, score })),
      emphasisDimensionId: null,
      weightedTotal: 0,
      weightedMax: 12,
      stars: 3,
      needsTeacherConfirm: true,
    })
    const graded = (over: Partial<StudentReportInput>) =>
      makeReport({
        rubricConfirmedByTeacher: true,
        rubric: rubricOf({ 'dim-naming': 3, 'dim-tld-fit': 2 }),
        ...over,
      } as Partial<StudentReportInput>)

    it('AI ตรงกับครูพอดี 1 ใน 2 เกณฑ์ และต่างไม่เกิน 1 ระดับทั้งคู่', () => {
      const s = classStatistics([
        graded({
          rubricAiSuggestion: rubricOf({ 'dim-naming': 3, 'dim-tld-fit': 3 }),
        }),
      ])
      expect(s.agreement.aiVsTeacher.pairCount).toBe(2)
      expect(s.agreement.aiVsTeacher.exactPercent).toBe(50)
      expect(s.agreement.aiVsTeacher.withinOnePercent).toBe(100)
    })

    it('คนที่ครูยังไม่ยืนยันไม่ถูกนับ ไม่ใช่นับเป็นไม่ตรงกัน', () => {
      const s = classStatistics([
        makeReport({
          rubricAiSuggestion: rubricOf({ 'dim-naming': 1 }),
        } as Partial<StudentReportInput>),
      ])
      expect(s.agreement.aiVsTeacher.pairCount).toBe(0)
      expect(s.agreement.aiVsTeacher.exactPercent).toBe(0)
    })

    it('คะแนนตัวเองเทียบครูก็คิดจากตารางเทียบ 3 แหล่ง (ตัวชี้วัด PL7)', () => {
      const s = classStatistics([graded({ selfRubricScores: { 'dim-naming': 3, 'dim-tld-fit': 3 } })])
      expect(s.agreement.selfVsTeacher.pairCount).toBeGreaterThan(0)
      expect(s.agreement.selfVsTeacher.withinOnePercent).toBe(100)
    })
  })

  it('คะแนนรายคนมีร้อยละก่อน-หลังติดมาด้วย', () => {
    const r = makeReport({ preScore: 4, postScore: 9 })
    expect(r.quizMax).toBe(10)
    expect(r.prePercent).toBe(40)
    expect(r.postPercent).toBe(90)
    expect(r.gain).toBe(5)
  })

  it('คะแนนหลังต่ำกว่าก่อน ยังคำนวณได้และติดลบตามจริง', () => {
    const s = classStatistics([
      makeReport({ studentId: 's1', preScore: 8, postScore: 5 }),
      makeReport({ studentId: 's2', preScore: 7, postScore: 6 }),
      makeReport({ studentId: 's3', preScore: 9, postScore: 5 }),
    ])
    expect(s.gain.mean).toBeCloseTo(-2.6667, 3)
    expect(s.tTest.direction).toBe('lower')
    expect(s.normalizedGain.g!).toBeLessThan(0)
  })

  it('ห้องว่างและคนเดียวไม่พัง', () => {
    const empty = classStatistics([])
    expect(empty.headcount).toBe(0)
    expect(empty.tTest.t).toBeNull()
    expect(empty.summary).toContain('ยังไม่มีข้อมูล')

    const single = classStatistics([makeReport({ preScore: 2, postScore: 8 })])
    expect(single.headcount).toBe(1)
    expect(single.pre.sd).toBeNull()
    expect(single.tTest.t).toBeNull()
    expect(single.tTest.reason).toBeTruthy()
  })
})

describe('ผลรายจุดประสงค์ครบ 6 ข้อ (สเปกข้อ 1.6 และตัวชี้วัด K1 K2 K4)', () => {
  const fullDimensions = [
    { id: 'dim-naming', name: 'ชื่อ', score: 3 },
    { id: 'dim-tld-fit', name: 'นามสกุล', score: 3 },
    { id: 'dim-customer-reason', name: 'เหตุผล', score: 3 },
    { id: 'dim-business-link', name: 'โยงกับร้าน', score: 3 },
  ]

  function rubricOf(scores: number[]) {
    return {
      dimensions: fullDimensions.map((d, i) => ({ ...d, score: scores[i] ?? d.score })),
      emphasisDimensionId: null,
      weightedTotal: 15,
      weightedMax: 15,
      stars: 3,
      needsTeacherConfirm: true as const,
    }
  }

  it('รายงานครบทั้ง 6 ข้อ พร้อมเป้าหมายของแต่ละข้อ', () => {
    const rows = objectiveOutcomes([makeReport()])
    expect(rows.map((r) => r.objectiveId)).toEqual([
      'obj-1',
      'obj-2',
      'obj-3',
      'obj-4',
      'obj-5',
      'obj-6',
    ])
    expect(rows.find((r) => r.objectiveId === 'obj-6')!.target).toBe(0.9)
    expect(rows.find((r) => r.objectiveId === 'obj-1')!.target).toBe(0.8)
  })

  it('ข้อ 1-4 ผ่านตามภารกิจที่ผ่านจริง', () => {
    const rows = objectiveOutcomes([makeReport()])
    expect(rows.find((r) => r.objectiveId === 'obj-1')!.passedCount).toBe(1)
    // mission-3 ไม่ผ่านในข้อมูลตั้งต้น
    expect(rows.find((r) => r.objectiveId === 'obj-3')!.passedCount).toBe(0)
  })

  it('ข้อ 5 ผ่านเมื่อครูยืนยันและทุกเกณฑ์ได้ระดับ 3 ขึ้นไป', () => {
    const confirmedFull = makeReport({
      rubric: rubricOf([3, 3, 3, 3]),
      rubricConfirmedByTeacher: true,
    })
    const confirmedPartial = makeReport({
      rubric: rubricOf([3, 2, 3, 3]),
      rubricConfirmedByTeacher: true,
    })
    const notConfirmed = makeReport({ rubric: rubricOf([3, 3, 3, 3]) })

    const pass = (r: StudentReport) =>
      objectiveOutcomes([r]).find((o) => o.objectiveId === 'obj-5')!.passedCount

    expect(pass(confirmedFull)).toBe(1)
    expect(pass(confirmedPartial)).toBe(0)
    expect(pass(notConfirmed)).toBe(0)
  })

  it('ข้อ 6 ผ่านเมื่อตั้งเป้า ประเมินตนเอง และสะท้อนคิดครบตามที่คาบกำหนด', () => {
    // จำนวนข้อที่ต้องตอบอ่านจากกติกาในไฟล์เนื้อหา ไม่ตรึงเลขไว้ในเทสต์
    // แผนการสอนให้ตอบ 2 ข้อในคาบ ข้อที่เหลือเป็นของแถม ตอบครบ 3 ข้อก็ยังผ่าน
    const complete = makeReport({
      selfRegulation: {
        goalSet: true,
        selfAssessed: true,
        reflectionAnswered: REFLECTION_QUESTION_COUNT,
      },
    })
    const allThree = makeReport({
      selfRegulation: {
        goalSet: true,
        selfAssessed: true,
        reflectionAnswered: REFLECTION_QUESTION_COUNT,
      },
    })
    const missingReflection = makeReport({
      selfRegulation: {
        goalSet: true,
        selfAssessed: true,
        reflectionAnswered: REFLECTION_QUESTION_COUNT - 1,
      },
    })
    const pass = (r: StudentReport) =>
      objectiveOutcomes([r]).find((o) => o.objectiveId === 'obj-6')!.passedCount

    expect(pass(complete)).toBe(1)
    expect(pass(allThree)).toBe(1)
    expect(pass(missingReflection)).toBe(0)
    expect(pass(makeReport())).toBe(0)
  })

  it('เทียบกับเป้าหมายร้อยละของแต่ละข้อได้ถูกต้อง', () => {
    // 5 คน ผ่าน obj-1 ทั้งหมด = 100% ผ่านเกณฑ์ 80%
    const passing = Array.from({ length: 5 }, (_, i) => makeReport({ studentId: `s${i}` }))
    const rows = objectiveOutcomes(passing)
    expect(rows.find((r) => r.objectiveId === 'obj-1')!.passRate).toBe(1)
    expect(rows.find((r) => r.objectiveId === 'obj-1')!.meetsTarget).toBe(true)
    expect(rows.find((r) => r.objectiveId === 'obj-3')!.meetsTarget).toBe(false)
  })

  it('ห้องว่างไม่พังและไม่หารด้วยศูนย์', () => {
    const rows = objectiveOutcomes([])
    expect(rows).toHaveLength(6)
    for (const row of rows) {
      expect(row.headcount).toBe(0)
      expect(row.passRate).toBe(0)
      expect(row.meetsTarget).toBe(false)
    }
  })
})
