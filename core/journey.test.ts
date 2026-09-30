/**
 * เทสต์จำลองทั้งคาบจากต้นจนจบ
 *
 * เรียกของจริงจาก core/ และอ่านเนื้อหาจริงจาก content/ ไม่ mock ข้อมูลเนื้อหาเลย
 * เป้าหมายคือพิสูจน์ว่าเอาชิ้นส่วนมาต่อกันแล้วผู้เรียนเดินจบคาบได้จริง ไม่มีจุดตัน
 */
import { describe, expect, it } from 'vitest'
import {
  BIG_MISSION_ID,
  type JourneyScript,
  type MissionAttemptScript,
  TOTAL_STARS_MAX,
  readinessFromWrongIds,
  runJourney,
} from './journey'
import { WEIGHTED_MAX, WEIGHTED_MIN, starBands, starsFromWeighted } from '../lib/ai/rubric'
import { CONFIDENCE_MAX, type RouteId, canRaiseGoal } from './personalize'
import { quiz } from './quiz'
import { adaptiveEvidence, classSummary, evidenceSentences, objectiveGaps } from './report'

const T0 = 1_759_000_000_000

/** คะแนนเต็มของแบบทดสอบ อ่านจากไฟล์เนื้อหา ไม่ตรึงเลขไว้ในเทสต์ */
const QUIZ_TOTAL = quiz.pre.length
const ONE_HOUR = 60 * 60 * 1000

/**
 * คะแนนถ่วงน้ำหนักของภารกิจใหญ่อ่านจากไฟล์เนื้อหา ไม่ตรึงเลขไว้ในเทสต์
 * ฝั่งเนื้อหาปรับสเกลได้ (เคยเป็น 10-12/7-9/4-6 ตอนนี้เป็น 13-15/9-12/5-8) เทสต์จึงต้องไม่พังตาม
 */
function weightedScoreFor(stars: number): number {
  const band = starBands.find((b) => b.stars === stars)
  if (!band) throw new Error(`ไฟล์เนื้อหาไม่มีช่วงคะแนนของ ${stars} ดาว`)
  return band.minWeighted
}

/** ดาวสูงสุดของภารกิจใหญ่ตามไฟล์เนื้อหา */
const BIG_MISSION_STARS_MAX = Math.max(...starBands.map((b) => b.stars))
/** คะแนนถ่วงน้ำหนักที่ทำให้ได้ดาวเต็มของภารกิจใหญ่ */
const FULL_WEIGHTED_SCORE = WEIGHTED_MAX

/** ภารกิจย่อย 4 อันในไฟล์เนื้อหา ผูกกับวัตถุประสงค์ตามลำดับ */
const MISSION_PLAN = [
  { missionId: 'm1', objectiveId: 'obj-1' },
  { missionId: 'm2', objectiveId: 'obj-2' },
  { missionId: 'm3', objectiveId: 'obj-3' },
  { missionId: 'm4', objectiveId: 'obj-4' },
] as const

/** คำตอบแบบสำรวจของคนที่ชอบอ่านเอง ใช้เป็นค่าตั้งต้นของทุกเคส */
const READER_ANSWERS = {
  'pref-1': 'pref-1-b',
  'pref-2': 'pref-2-b',
  'pref-3': 'pref-3-b',
  'pref-4': 'pref-4-a',
  'pref-5': 'pref-5-a',
}

function missions(
  make: (plan: (typeof MISSION_PLAN)[number], index: number) => Partial<MissionAttemptScript>,
): MissionAttemptScript[] {
  return MISSION_PLAN.map((plan, index) => ({ ...plan, ...make(plan, index) }))
}

function baseScript(over: Partial<JourneyScript> = {}): JourneyScript {
  return {
    studentId: 'stu-1',
    nickname: 'นิด',
    shopName: 'ขนมหวาน',
    domainName: 'kanomwan',
    tldSuffix: '.in.th',
    prefAnswers: READER_ANSWERS,
    preScore: 2,
    preWrongIds: ['pre-3', 'pre-4'],
    postScore: 4,
    goal: 'goal-basic',
    missions: missions(() => ({ passed: true, attempts: 1, hintsUsed: 0 })),
    bigMission: { submitted: true, rubricTotal: FULL_WEIGHTED_SCORE },
    startedAt: T0,
    finishedAt: T0 + ONE_HOUR,
    ...over,
  }
}

describe('ชิ้นส่วนที่ใช้ประกอบร่างเส้นทาง', () => {
  it('ดาวเต็มทั้งคาบตรงกับที่ไฟล์เนื้อหากำหนด', () => {
    expect(TOTAL_STARS_MAX).toBe(15)
  })

  it('คะแนนรูบริกของภารกิจใหญ่แปลงเป็นดาวได้ตามตาราง และส่งงานแล้วต้องได้อย่างน้อย 1 ดาว', () => {
    for (const band of starBands) {
      expect(starsFromWeighted(band.minWeighted, true)).toBe(band.stars)
      expect(starsFromWeighted(band.maxWeighted, true)).toBe(band.stars)
    }
    // ต่ำกว่าช่วงต่ำสุดแต่ส่งงานแล้ว ต้องได้อย่างน้อย 1 ดาว
    expect(starsFromWeighted(WEIGHTED_MIN - 1, true)).toBeGreaterThanOrEqual(1)
    expect(starsFromWeighted(0, true)).toBe(1)
    // ไม่ส่งงาน ได้ 0 ดาว ไม่ว่าคะแนนจะเป็นเท่าไหร่
    expect(starsFromWeighted(WEIGHTED_MAX, false)).toBe(0)
  })

  it('ผลชุดก่อนเรียนแตกเป็นรายวัตถุประสงค์ได้ครบ 4 ข้อ', () => {
    const readiness = readinessFromWrongIds(['pre-2'])
    expect(Object.keys(readiness).sort()).toEqual(['obj-1', 'obj-2', 'obj-3', 'obj-4'])
    expect(readiness['obj-2']).toBe(false)
    expect(readiness['obj-1']).toBe(true)
  })
})

describe('เคสที่ 1 เด็กที่ผ่านทุกภารกิจครั้งแรกโดยไม่ใช้คำใบ้', () => {
  const journey = runJourney(baseScript({ preWrongIds: [], preScore: QUIZ_TOTAL, postScore: QUIZ_TOTAL }))

  it('เดินจบคาบและได้ดาวเต็มทั้งคาบ', () => {
    expect(journey.report.starsTotal).toBe(TOTAL_STARS_MAX)
    expect(journey.report.starsMax).toBe(TOTAL_STARS_MAX)
    expect(journey.bigMissionStars).toBe(BIG_MISSION_STARS_MAX)
  })

  it('ตั้งเป้าพื้นฐาน 6 ดาว ผลออกมาเกินเป้า', () => {
    expect(journey.goalFinal).toBe(6)
    expect(journey.report.goalOutcome).toBe('exceeded')
  })

  it('ตอบถูกครบตั้งแต่ก่อนเรียน ระบบเสนอระดับตัวช่วยสูงสุดและไม่มีวัตถุประสงค์ที่อ่อน', () => {
    expect(journey.suggestedLevel).toBe(3)
    expect(journey.weakObjectives).toEqual([])
  })

  it('ได้ใบประกาศระดับยอดเยี่ยม พร้อมชื่อเว็บเต็ม', () => {
    expect(journey.certificate.eligible).toBe(true)
    expect(journey.certificate.level).toBe('ยอดเยี่ยม')
    expect(journey.report.domainFull).toBe('kanomwan.in.th')
  })
})

describe('เคสที่ 2 เด็กที่ผิดหลายครั้งและใช้คำใบ้ครบทุกระดับ', () => {
  const journey = runJourney(
    baseScript({
      studentId: 'stu-2',
      nickname: 'ก้อง',
      preScore: 0,
      preWrongIds: ['pre-1', 'pre-2', 'pre-3', 'pre-4'],
      postScore: 2,
      missions: missions(() => ({ passed: true, attempts: 5, hintsUsed: 3 })),
      bigMission: { submitted: true, rubricTotal: weightedScoreFor(1) },
    }),
  )

  it('ยังเดินจบคาบได้ และได้ดาวมากกว่าศูนย์', () => {
    expect(journey.report.starsTotal).toBeGreaterThan(0)
    expect(journey.report.missions.every((m) => m.stars >= 1)).toBe(true)
  })

  it('ได้ใบประกาศเหมือนทุกคน ไม่ถูกตัดสิทธิ์เพราะใช้คำใบ้', () => {
    expect(journey.certificate.eligible).toBe(true)
    expect(journey.certificate.lines.join(' ')).toContain('ก้อง')
  })

  it('ระบบเสนอตัวช่วยระดับต่ำสุด และบอกได้ว่าอ่อนวัตถุประสงค์ไหนบ้าง', () => {
    expect(journey.suggestedLevel).toBe(1)
    expect(journey.weakObjectives).toEqual(['obj-1', 'obj-2', 'obj-3', 'obj-4'])
  })

  it('ข้อความให้กำลังใจไม่มีคำตำหนิและไม่เทียบกับเพื่อน', () => {
    for (const word of ['ไม่เก่ง', 'แย่', 'ล้มเหลว', 'ไม่ผ่าน']) {
      expect(journey.encouragement).not.toContain(word)
    }
    for (const word of ['เพื่อน', 'ค่าเฉลี่ย', 'อันดับ']) {
      expect(journey.encouragement).not.toContain(word)
    }
  })
})

describe('เคสที่ 3 เด็กที่สลับช่องทางทุกภารกิจ', () => {
  const routes: RouteId[] = ['card', 'clip', 'game', 'buddy']
  const switcher = runJourney(
    baseScript({
      studentId: 'stu-3',
      missions: missions((_plan, index) => ({
        passed: true,
        attempts: 1,
        hintsUsed: 0,
        route: routes[index],
      })),
    }),
  )
  const stayer = runJourney(baseScript({ studentId: 'stu-3b' }))

  it('นับจำนวนครั้งที่สลับได้ถูก', () => {
    // card -> clip -> game -> buddy แล้วภารกิจใหญ่กลับไปช่องทางที่เลือกไว้ตอนต้น = 4 ครั้ง
    expect(switcher.report.switchCount).toBe(4)
    expect(switcher.report.routesUsed).toEqual(['card', 'clip', 'game', 'buddy'])
  })

  it('สลับช่องทางแล้วไม่ถูกหักดาวเลย ได้ดาวเท่ากับคนที่อยู่ช่องทางเดียว', () => {
    expect(switcher.report.starsTotal).toBe(stayer.report.starsTotal)
    expect(stayer.report.switchCount).toBe(0)
  })

  it('ข้อความให้กำลังใจพูดถึงการเปลี่ยนวิธีเรียนด้วยตัวเองเป็นเรื่องดี', () => {
    expect(switcher.encouragement).toContain('เปลี่ยนวิธีเรียนด้วยตัวเอง')
  })
})

describe('เคสที่ 4 เด็กที่กดข้ามภารกิจ 1 อัน', () => {
  const journey = runJourney(
    baseScript({
      studentId: 'stu-4',
      missions: missions((plan) =>
        plan.missionId === 'm3'
          ? { skipped: true }
          : { passed: true, attempts: 1, hintsUsed: 0 },
      ),
    }),
  )

  it('ยังเดินจบคาบได้ ไม่มีการล็อกภารกิจถัดไป', () => {
    expect(journey.report.missions).toHaveLength(MISSION_PLAN.length + 1)
    // ข้าม 1 ภารกิจ = เสียดาวของภารกิจนั้นไป 3 ดวง ที่เหลือได้เต็ม
    expect(journey.report.starsTotal).toBe(TOTAL_STARS_MAX - 3)
  })

  it('รายงานบอกชัดว่าข้ามภารกิจไหน และภารกิจนั้นยังอยู่ในรายการ ไม่ได้หายไป', () => {
    expect(journey.skippedMissionIds).toEqual(['m3'])
    const skipped = journey.report.missions.find((m) => m.missionId === 'm3')
    expect(skipped).toBeDefined()
    expect(skipped!.passed).toBe(false)
    expect(skipped!.stars).toBe(0)
  })

  it('วัตถุประสงค์ของภารกิจที่ข้ามไม่ถูกนับว่าผ่าน', () => {
    const summary = classSummary([journey.report])
    expect(summary.passedByObjective['obj-3']).toBe(0)
    expect(summary.passedByObjective['obj-4']).toBe(1)
  })
})

describe('เคสที่ 5 เด็กที่ยกเป้าหมายกลางคัน', () => {
  const journey = runJourney(
    baseScript({ studentId: 'stu-5', goal: 'goal-basic', raiseGoalTo: 'goal-challenge' }),
  )

  it('ระบบอนุญาตให้ยกเป้าขึ้น', () => {
    expect(canRaiseGoal('goal-basic', 'goal-challenge')).toBe(true)
    expect(journey.goalRaised).toBe(true)
    expect(journey.goalStart).toBe(6)
    expect(journey.goalFinal).toBe(14)
  })

  it('ผลเทียบกับเป้าใหม่ ไม่ใช่เป้าเดิม', () => {
    expect(journey.report.goalLevel).toBe(14)
    expect(journey.report.starsTotal).toBe(TOTAL_STARS_MAX)
    expect(journey.report.goalOutcome).toBe('exceeded')
  })

  it('เก็บดาวไม่ถึงเป้าใหม่ ผลเป็นต่ำกว่าเป้า แต่ยังเดินจบและได้ใบประกาศ', () => {
    const modest = runJourney(
      baseScript({
        studentId: 'stu-5b',
        goal: 'goal-basic',
        raiseGoalTo: 'goal-challenge',
        missions: missions(() => ({ passed: true, attempts: 3, hintsUsed: 2 })),
        bigMission: { submitted: true, rubricTotal: weightedScoreFor(1) },
      }),
    )
    // ภารกิจย่อย 4 อันได้อันละ 1 ดาว + ภารกิจใหญ่ 1 ดาว
    expect(modest.report.starsTotal).toBe(5)
    expect(modest.report.goalOutcome).toBe('below')
    expect(modest.certificate.eligible).toBe(true)
  })

  it('ลดเป้าไม่ได้ ถ้าขอลดจะคงเป้าเดิมไว้', () => {
    const lower = runJourney(
      baseScript({ studentId: 'stu-5c', goal: 'goal-challenge', raiseGoalTo: 'goal-basic' }),
    )
    expect(lower.goalRaised).toBe(false)
    expect(lower.goalFinal).toBe(14)
  })

  it('ร่องรอยการเรียนบันทึกว่าผู้เรียนยกเป้าเอง', () => {
    expect(journey.trace.some((line) => line.includes('ยกเป้าหมายเอง'))).toBe(true)
  })
})

describe('เคสที่ 6 เด็กที่เลือกสวนทางกับที่ระบบแนะนำ', () => {
  const compliant = runJourney(baseScript({ studentId: 'stu-6a' }))
  const rebel = runJourney(baseScript({ studentId: 'stu-6b', routeChosen: 'buddy' }))

  it('ระบบเสนอทางหนึ่ง ผู้เรียนเลือกอีกทางหนึ่งได้', () => {
    expect(compliant.routeSuggested).toBe('card')
    expect(rebel.routeSuggested).toBe('card')
    expect(rebel.routeChosen).toBe('buddy')
    expect(rebel.overrodeSuggestion).toBe(true)
    expect(rebel.routeChosenBy).toBe('student')
  })

  it('ไม่มีอะไรในระบบขัดขวางเลย เดินจบคาบได้เหมือนกันทุกประการ', () => {
    expect(rebel.report.starsTotal).toBe(compliant.report.starsTotal)
    expect(rebel.report.goalOutcome).toBe(compliant.report.goalOutcome)
    expect(rebel.certificate.eligible).toBe(true)
    expect(rebel.certificate.level).toBe(compliant.certificate.level)
  })

  it('การเลือกสวนทางถูกนับเป็นหลักฐานของการเรียนรู้ส่วนบุคคล', () => {
    const evidence = adaptiveEvidence([compliant.report, rebel.report])
    expect(evidence.overrodeSuggestionCount).toBe(1)
    expect(evidence.routeDistribution.buddy).toBe(1)
    expect(evidence.routeDistribution.card).toBe(1)
  })

  it('ร่องรอยการเรียนเขียนไว้ชัดว่าผู้เรียนเปลี่ยนเอง', () => {
    expect(rebel.trace.some((line) => line.includes('ผู้เรียนเปลี่ยนเอง'))).toBe(true)
    expect(compliant.trace.some((line) => line.includes('รับข้อเสนอ'))).toBe(true)
  })
})

describe('ทั้งห้อง 30 คนแบบผสมกัน', () => {
  const ROUTES: RouteId[] = ['clip', 'card', 'game', 'buddy']
  const PREF_SETS: Record<string, string>[] = [
    READER_ANSWERS,
    { 'pref-1': 'pref-1-a', 'pref-2': 'pref-2-a', 'pref-3': 'pref-3-a' },
    { 'pref-1': 'pref-1-c', 'pref-2': 'pref-2-c', 'pref-4': 'pref-4-d' },
    { 'pref-1': 'pref-1-d', 'pref-2': 'pref-2-d', 'pref-4': 'pref-4-c' },
    {},
  ]

  /** สร้างห้อง 30 คนแบบคงที่ ไม่มีการสุ่ม เพื่อให้ผลซ้ำเดิมทุกครั้ง */
  const classroom = Array.from({ length: 30 }, (_, i) => {
    const flavor = i % 5
    const wrongIds = ['pre-1', 'pre-2', 'pre-3', 'pre-4'].slice(0, i % 5)
    return runJourney(
      baseScript({
        studentId: `stu-${i + 1}`,
        nickname: `นักเรียน ${i + 1}`,
        domainName: `shop${i + 1}`,
        prefAnswers: PREF_SETS[flavor]!,
        routeChosen: i % 3 === 0 ? ROUTES[i % ROUTES.length] : undefined,
        preScore: QUIZ_TOTAL - wrongIds.length,
        preWrongIds: wrongIds,
        postScore: Math.min(QUIZ_TOTAL, QUIZ_TOTAL - wrongIds.length + (i % 3)),
        goal: flavor === 0 ? 'goal-challenge' : 'goal-basic',
        raiseGoalTo: i % 7 === 0 ? 'goal-good' : undefined,
        missions: missions((_plan, index) => {
          if (flavor === 4 && index === 2) return { skipped: true }
          return {
            passed: flavor !== 3 || index < 3,
            attempts: 1 + (flavor % 3),
            hintsUsed: flavor % 3,
            route: i % 4 === 0 ? ROUTES[(i + index) % ROUTES.length] : undefined,
          }
        }),
        bigMission: {
          submitted: flavor !== 2,
          rubricTotal: WEIGHTED_MIN + ((i * 2) % (WEIGHTED_MAX - WEIGHTED_MIN + 1)),
        },
      }),
    )
  })
  const reports = classroom.map((j) => j.report)
  const summary = classSummary(reports)

  it('ทุกคนเดินจบคาบได้ ไม่มีใครตัน', () => {
    expect(classroom).toHaveLength(30)
    for (const journey of classroom) {
      expect(journey.report.missions.length).toBeGreaterThan(0)
      expect(journey.certificate.eligible).toBe(true)
      expect(journey.encouragement.length).toBeGreaterThan(0)
      expect(journey.trace.length).toBeGreaterThan(0)
    }
  })

  it('สรุปทั้งห้องคำนวณได้ และตัวเลขอยู่ในช่วงที่เป็นไปได้', () => {
    expect(summary.headcount).toBe(30)
    expect(summary.avgStars).toBeGreaterThan(0)
    expect(summary.avgStars).toBeLessThanOrEqual(TOTAL_STARS_MAX)
    for (const objectiveId of ['obj-1', 'obj-2', 'obj-3', 'obj-4']) {
      const passed = summary.passedByObjective[objectiveId]!
      expect(passed).toBeGreaterThanOrEqual(0)
      expect(passed).toBeLessThanOrEqual(summary.headcount)
    }
  })

  it('ดาวของทุกคนไม่ติดลบและไม่เกินดาวเต็มของคาบ', () => {
    for (const report of reports) {
      expect(report.starsTotal).toBeGreaterThanOrEqual(0)
      expect(report.starsTotal).toBeLessThanOrEqual(TOTAL_STARS_MAX)
    }
  })

  it('ช่องว่างของวัตถุประสงค์เรียงจากแย่สุด และไม่มีข้อไหนเกินจำนวนคนในห้อง', () => {
    const gaps = objectiveGaps(summary)
    for (const gap of gaps) {
      expect(gap.passedCount).toBeLessThanOrEqual(30)
      expect(gap.passRate).toBeLessThan(0.6)
    }
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]!.passRate).toBeGreaterThanOrEqual(gaps[i - 1]!.passRate)
    }
  })

  it('หลักฐานความเป็นส่วนบุคคลนับได้ และไม่มีตัวเลขไหนเกินจำนวนคน', () => {
    const evidence = adaptiveEvidence(reports)
    const distributionTotal = Object.values(evidence.routeDistribution).reduce((a, b) => a + b, 0)

    expect(evidence.headcount).toBe(30)
    expect(distributionTotal).toBe(30)
    expect(evidence.switchedCount + evidence.samePathCount).toBe(30)
    for (const value of [
      evidence.switchedCount,
      evidence.overrodeSuggestionCount,
      evidence.raisedGoalCount,
      evidence.samePathCount,
    ]) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(30)
    }
  })

  it('ห้องนี้ต้องมีคนที่เลือกสวนทางกับที่ระบบเสนอจริง ไม่ใช่ศูนย์', () => {
    const evidence = adaptiveEvidence(reports)
    expect(evidence.overrodeSuggestionCount).toBeGreaterThan(0)
  })

  it('ประโยคขึ้นสไลด์เขียนออกมาได้ครบ และมีบรรทัดที่ชี้ว่าเป็นการเรียนรู้ส่วนบุคคล', () => {
    const lines = evidenceSentences(adaptiveEvidence(reports))
    expect(lines).toHaveLength(5)
    expect(lines[2]).toContain('ไม่ใช่ระบบปรับเหมาะล้วน')
    for (const line of lines) expect(line.length).toBeGreaterThan(0)
  })

  it('ภารกิจใหญ่ของทุกคนถูกบันทึกไว้ในรายงานเสมอ แม้คนที่ยังไม่ส่งงาน', () => {
    for (const report of reports) {
      const big = report.missions.find((m) => m.missionId === BIG_MISSION_ID)
      expect(big).toBeDefined()
      expect(big!.stars).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('กลไกใหม่ที่ต่อเข้าเส้นทางทั้งคาบ', () => {
  it('ลำดับช่องทางที่ได้ผลจริงถูกคำนวณให้เสมอ และครบทุกช่องทาง', () => {
    const journey = runJourney(
      baseScript({
        missions: missions((_plan, index) => ({
          passed: true,
          attempts: 1,
          hintsUsed: index === 0 ? 0 : 3,
          route: index === 0 ? 'card' : 'buddy',
          elapsedSeconds: index === 0 ? 40 : 260,
        })),
      }),
    )
    expect(journey.channelRanking).toHaveLength(4)
    expect(journey.channelRanking[0]!.route).toBe('card')
    expect(journey.channelRanking.map((r) => r.route).sort()).toEqual(
      ['buddy', 'card', 'clip', 'game'].sort(),
    )
  })

  it('ตั้งเป้าสูงสุดได้ภารกิจเสริมตั้งแต่ต้น', () => {
    const journey = runJourney(baseScript({ goal: 'goal-challenge' }))
    expect(journey.bonusUnlocked).toBe(true)
  })

  it('ตั้งเป้าพื้นฐานแล้วทำถึงเป้า ได้ภารกิจเสริมเช่นกัน', () => {
    expect(runJourney(baseScript({ goal: 'goal-basic' })).bonusUnlocked).toBe(true)
  })

  it('ตั้งเป้าพื้นฐานแต่ยังไม่ถึงเป้า ยังไม่เปิดภารกิจเสริม', () => {
    const journey = runJourney(
      baseScript({
        goal: 'goal-basic',
        missions: missions((_plan, index) => ({
          passed: index === 0,
          attempts: 4,
          hintsUsed: 3,
        })),
        bigMission: { submitted: false, rubricTotal: 0 },
      }),
    )
    expect(journey.report.starsTotal).toBeLessThan(journey.goalFinal)
    expect(journey.bonusUnlocked).toBe(false)
  })
})

describe('ภารกิจใหญ่ที่ส่งคะแนนมารายด้าน', () => {
  const rubricScores = {
    'dim-naming': 3,
    'dim-tld-fit': 3,
    'dim-customer-reason': 3,
    'dim-business-link': 3,
  }

  it('ระบบถ่วงน้ำหนักและแปลงเป็นดาวให้เอง ไม่ต้องกรอกคะแนนรวมมา', () => {
    const journey = runJourney(
      baseScript({
        bigMission: {
          submitted: true,
          rubric: { scores: rubricScores, emphasisCriterion: 'emphasis-naming' },
        },
      }),
    )
    expect(journey.rubric?.weightedTotal).toBe(WEIGHTED_MAX)
    expect(journey.bigMissionStars).toBe(BIG_MISSION_STARS_MAX)
    expect(journey.report.starsTotal).toBe(TOTAL_STARS_MAX)
  })

  it('คะแนนรายด้านติดไปกับรายงานให้หน้าสรุปผลใช้ได้ทั้ง 4 ด้าน', () => {
    const journey = runJourney(
      baseScript({ bigMission: { submitted: true, rubric: { scores: rubricScores } } }),
    )
    expect(journey.report.rubric?.dimensions).toHaveLength(4)
    expect(journey.report.rubric?.needsTeacherConfirm).toBe(true)
  })

  it('ใส่คะแนนรวมมาตรง ๆ แบบเดิมก็ยังทำงานได้เหมือนเดิม', () => {
    const journey = runJourney(baseScript({ bigMission: { submitted: true, rubricTotal: WEIGHTED_MAX } }))
    expect(journey.bigMissionStars).toBe(BIG_MISSION_STARS_MAX)
    expect(journey.rubric).toBeNull()
  })
})

describe('ข้ามภารกิจตามมติ T46 — เดินทั้งเส้นทางจริง', () => {
  /** ข้าม m3 แบบผ่านเงื่อนไข: ตอบข้อที่วัด obj-3 ถูก และบอกว่ามั่นใจ */
  const earned = runJourney(
    baseScript({
      studentId: 'stu-skip-earned',
      preWrongIds: [],
      preScore: QUIZ_TOTAL,
      postScore: QUIZ_TOTAL,
      missions: missions((plan) =>
        plan.missionId === 'm3'
          ? { skipped: true, checkCorrect: true, checkConfidence: CONFIDENCE_MAX }
          : { passed: true, attempts: 1, hintsUsed: 0 },
      ),
    }),
  )

  it('ข้ามโดยผ่านเงื่อนไขได้ 3 ดาวเต็ม และนับว่าผ่านจุดประสงค์', () => {
    const m3 = earned.report.missions.find((m) => m.missionId === 'm3')!
    expect(m3.stars).toBe(3)
    expect(m3.passed).toBe(true)
    expect(m3.skippedBy).toBe('student')
    expect(m3.skipOutcome).toBe('earned')
    expect(earned.skippedEarnedMissionIds).toEqual(['m3'])
    expect(earned.skippedByTeacherMissionIds).toEqual([])
  })

  it('**ดาวรวมทั้งคาบยังไม่เกิน 15** แม้จะข้ามแล้วได้ดาวเต็ม', () => {
    expect(earned.report.starsTotal).toBe(TOTAL_STARS_MAX)
    expect(earned.report.starsTotal).toBeLessThanOrEqual(TOTAL_STARS_MAX)
    expect(earned.report.starsMax).toBe(TOTAL_STARS_MAX)
  })

  it('ครูสั่งให้ข้าม = 0 ดาว แต่ยังผ่านจุดประสงค์ และแยกกลุ่มไม่ปนกัน', () => {
    const byTeacher = runJourney(
      baseScript({
        studentId: 'stu-skip-teacher',
        missions: missions((plan) =>
          plan.missionId === 'm3'
            ? { skipped: true, skippedBy: 'teacher' }
            : { passed: true, attempts: 1, hintsUsed: 0 },
        ),
      }),
    )
    const m3 = byTeacher.report.missions.find((m) => m.missionId === 'm3')!
    expect(m3.stars).toBe(0)
    expect(m3.passed).toBe(true)
    expect(m3.skippedBy).toBe('teacher')
    expect(byTeacher.skippedByTeacherMissionIds).toEqual(['m3'])
    expect(byTeacher.skippedEarnedMissionIds).toEqual([])
    // ดาวหายไป 3 เทียบกับเคสข้ามเอง เพราะยังไม่ได้พิสูจน์เอง
    expect(byTeacher.report.starsTotal).toBe(earned.report.starsTotal - 3)
  })

  it('กดข้ามโดยยังไม่เข้าเงื่อนไข ถูกปฏิเสธ ไม่ได้ดาวและไม่นับว่าผ่าน', () => {
    const rejected = runJourney(
      baseScript({
        studentId: 'stu-skip-rejected',
        preWrongIds: ['pre-3'],
        missions: missions((plan) =>
          plan.missionId === 'm3'
            ? { skipped: true, checkCorrect: false }
            : { passed: true, attempts: 1, hintsUsed: 0 },
        ),
      }),
    )
    const m3 = rejected.report.missions.find((m) => m.missionId === 'm3')!
    expect(m3.stars).toBe(0)
    expect(m3.passed).toBe(false)
    expect(m3.skippedBy).toBeNull()
    expect(rejected.skipRejectedMissionIds).toEqual(['m3'])
  })

  it('ผลเช็กความเข้าใจอ่านจาก preWrongIds ให้เองถ้าไม่ได้ระบุมา', () => {
    // ตอบถูกทุกข้อ + บอกว่ามั่นใจ -> ข้ามได้
    const ok = runJourney(
      baseScript({
        preWrongIds: [],
        missions: missions((plan) =>
          plan.missionId === 'm1'
            ? { skipped: true, checkConfidence: CONFIDENCE_MAX }
            : { passed: true, attempts: 1 },
        ),
      }),
    )
    expect(ok.skippedEarnedMissionIds).toEqual(['m1'])

    // ตอบผิดข้อที่วัด obj-1 -> ข้ามไม่ได้แม้จะบอกว่ามั่นใจ
    const no = runJourney(
      baseScript({
        preWrongIds: ['pre-1'],
        missions: missions((plan) =>
          plan.missionId === 'm1'
            ? { skipped: true, checkConfidence: CONFIDENCE_MAX }
            : { passed: true, attempts: 1 },
        ),
      }),
    )
    expect(no.skipRejectedMissionIds).toEqual(['m1'])
  })

  it('รายงานรายห้องนับคนที่ข้ามตามเงื่อนไขว่าผ่านจุดประสงค์นั้นด้วย', () => {
    const summary = classSummary([earned.report])
    expect(summary.passedByObjective['obj-3']).toBe(1)
  })
})
