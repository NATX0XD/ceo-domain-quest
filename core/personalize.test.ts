import { describe, expect, it } from 'vitest'
import coachPrompts from '../content/coach-prompts.json'
import rubricJson from '../content/rubric.json'
import { quiz } from './quiz'
import {
  CONFIDENCE_MAX,
  CONFIDENCE_MIN,
  type MissionRecord,
  ROUTE_IDS,
  type TraceEvent,
  adaptiveTrace,
  applyLearnerChoice,
  bonusUnlocked,
  calibrationFlag,
  SKIP_EARNED_STARS,
  SKIP_MIN_CONFIDENCE,
  SKIP_TEACHER_STARS,
  canRaiseGoal,
  coachThresholds,
  evaluateSkip,
  goalOutcome,
  goalStarTarget,
  missionDifficulty,
  missionStarBands,
  nextHintLevel,
  progressSummary,
  rankChannelsByEffectiveness,
  recommendLevel,
  recommendRoute,
  shouldCoach,
  starsFor,
} from './personalize'

/** คะแนนเต็มของชุดก่อนเรียน อ่านจากไฟล์เนื้อหา เพิ่มข้อสอบแล้วเทสต์ต้องไม่พังเอง */
const PRE_TOTAL = quiz.pre.length

/** เวลาอ้างอิงคงที่ ไม่เรียก Date.now() ในเทสต์ จะได้ผลเดิมทุกครั้ง */
const T0 = 1_759_000_000_000

describe('เสนอช่องทางการเรียนรู้', () => {
  it('คนที่ตอบแนวดูคลิปทุกข้อได้ข้อเสนอเป็นสายคลิป', () => {
    const r = recommendRoute({
      'pref-1': 'pref-1-a',
      'pref-2': 'pref-2-a',
      'pref-3': 'pref-3-a',
    })
    expect(r.suggested).toBe('clip')
    expect(r.scores.clip).toBeGreaterThan(r.scores.card)
  })

  it('คนที่ตอบแนวชวนเพื่อนได้ข้อเสนอเป็นสายคู่หู', () => {
    const r = recommendRoute({
      'pref-1': 'pref-1-d',
      'pref-2': 'pref-2-d',
      'pref-4': 'pref-4-c',
    })
    expect(r.suggested).toBe('buddy')
  })

  it('คืนคะแนนครบทั้ง 4 ช่องทาง ไม่ใช่คืนแค่ตัวที่ชนะ', () => {
    const r = recommendRoute({ 'pref-1': 'pref-1-c' })
    expect(Object.keys(r.scores).sort()).toEqual(['buddy', 'card', 'clip', 'game'])
    expect(r.reason.length).toBeGreaterThan(0)
  })

  it('เรียกซ้ำด้วยคำตอบเดิมได้ผลเดิมทุกครั้ง ไม่มีการสุ่ม', () => {
    const answers = { 'pref-1': 'pref-1-b', 'pref-3': 'pref-3-c' }
    const runs = Array.from({ length: 20 }, () => recommendRoute(answers))
    for (const r of runs) {
      expect(r.suggested).toBe(runs[0]!.suggested)
      expect(r.scores).toEqual(runs[0]!.scores)
    }
  })

  it('คะแนนเสมอกันตัดสินด้วยลำดับคงที่ การ์ดมาก่อน', () => {
    // pref-4-a ให้ clip กับ card เท่ากันข้างละ 2
    const r = recommendRoute({ 'pref-4': 'pref-4-a' })
    expect(r.scores.clip).toBe(r.scores.card)
    expect(r.suggested).toBe('card')
  })

  it('คำตอบว่างไม่พัง ได้ค่าตั้งต้นเป็นสายการ์ด', () => {
    const empty = recommendRoute({})
    expect(empty.suggested).toBe('card')
    expect(empty.scores).toEqual({ clip: 0, card: 0, game: 0, buddy: 0 })
    expect(() => recommendRoute()).not.toThrow()
  })

  it('รหัสตัวเลือกที่ไม่มีอยู่จริงถูกข้าม ไม่ทำให้พัง', () => {
    const r = recommendRoute({ 'pref-1': 'ไม่มีตัวเลือกนี้', 'pref-9': 'pref-9-z' })
    expect(r.scores.clip).toBe(0)
    expect(r.suggested).toBe('card')
  })

  it('คนที่ตอบผิดแบบทดสอบก่อนเรียนหลายข้อ ถูกดันไปทางที่มีคนช่วย', () => {
    const answers = { 'pref-1': 'pref-1-c' }
    const alone = recommendRoute(answers, { 'obj-1': true, 'obj-2': true, 'obj-3': true, 'obj-4': true })
    const struggling = recommendRoute(answers, {
      'obj-1': false,
      'obj-2': false,
      'obj-3': false,
      'obj-4': true,
    })
    expect(struggling.scores.buddy).toBeGreaterThan(alone.scores.buddy)
    expect(struggling.scores.game).toBeLessThan(alone.scores.game)
  })

  it('ยังไม่มีผลแบบทดสอบก่อนเรียน ต้องไม่ถูกนับว่าตอบถูกหมด', () => {
    const answers = { 'pref-1': 'pref-1-c' }
    const noReadiness = recommendRoute(answers)
    const allCorrect = recommendRoute(answers, { 'obj-1': true, 'obj-2': true })
    expect(allCorrect.scores.game).toBeGreaterThan(noReadiness.scores.game)
  })
})

describe('เสนอระดับตัวช่วย', () => {
  it('คะแนนเต็มได้ระดับ 3 และไม่มีวัตถุประสงค์ที่อ่อน', () => {
    const r = recommendLevel({ score: PRE_TOTAL, total: PRE_TOTAL, wrongIds: [] })
    expect(r.suggested).toBe(3)
    expect(r.weakObjectives).toEqual([])
  })

  it('คะแนนศูนย์ได้ระดับ 1 และอ่อนครบทุกวัตถุประสงค์', () => {
    const r = recommendLevel({
      score: 0,
      total: PRE_TOTAL,
      wrongIds: ['pre-1', 'pre-2', 'pre-3', 'pre-4'],
    })
    expect(r.suggested).toBe(1)
    expect(r.weakObjectives).toEqual(['obj-1', 'obj-2', 'obj-3', 'obj-4'])
  })

  it('วัตถุประสงค์ที่อ่อนตรงกับข้อที่ตอบผิดจริง', () => {
    const r = recommendLevel({
      score: PRE_TOTAL - 2,
      total: PRE_TOTAL,
      wrongIds: ['pre-2', 'pre-4'],
    })
    expect(r.weakObjectives).toEqual(['obj-2', 'obj-4'])
    expect(r.suggested).toBe(2)
  })

  it('คะแนนที่อ่านไม่ได้ไม่ทำให้พัง และไม่โยนเด็กเข้าโหมดยากสุด', () => {
    const r = recommendLevel({ score: Number.NaN, total: PRE_TOTAL, wrongIds: ['pre-1'] })
    expect(r.suggested).toBe(1)
    expect(r.weakObjectives).toEqual(['obj-1'])
  })

  it('ข้อที่ตอบผิดแต่ไม่อยู่ในผังถูกข้าม ไม่ทำให้พัง', () => {
    const r = recommendLevel({ score: PRE_TOTAL - 1, total: PRE_TOTAL, wrongIds: ['ข้อที่ไม่มีในผัง'] })
    expect(r.weakObjectives).toEqual([])
    expect(r.reason).toBeTruthy()
  })
})

describe('ผู้เรียนเป็นคนตัดสินใจ ไม่ใช่ระบบ', () => {
  it('ผู้เรียนเปลี่ยนไปช่องทางที่ระบบไม่ได้เสนอ ต้องผ่านเสมอ และถูกบันทึกว่าเปลี่ยนเอง', () => {
    const r = applyLearnerChoice('card', 'buddy', T0)
    expect(r.accepted).toBe(true)
    expect(r.overridden).toBe(true)
    expect(r.record.chosenBy).toBe('student')
    expect(r.record.suggested).toBe('card')
    expect(r.record.chosen).toBe('buddy')
    expect(r.record.at).toBe(T0)
  })

  it('ไม่ว่าเปลี่ยนไปช่องทางไหน ระบบไม่ปฏิเสธสักกรณีเดียว', () => {
    for (const chosen of ['clip', 'card', 'game', 'buddy']) {
      const r = applyLearnerChoice('card', chosen)
      expect(r.accepted).toBe(true)
    }
  })

  it('รับข้อเสนอของระบบ บันทึกว่าไม่ได้เปลี่ยนเอง', () => {
    const r = applyLearnerChoice('game', 'game', T0)
    expect(r.accepted).toBe(true)
    expect(r.overridden).toBe(false)
    expect(r.record.chosenBy).toBe('system')
  })

  it('ใช้กับระดับตัวช่วยที่เป็นตัวเลขได้ด้วย', () => {
    const r = applyLearnerChoice<number>(1, 3, T0)
    expect(r.overridden).toBe(true)
    expect(r.record.chosenBy).toBe('student')
  })

  it('เก็บทั้งสิ่งที่ระบบเสนอและสิ่งที่ผู้เรียนเลือกจริงคู่กันเสมอ', () => {
    const r = applyLearnerChoice('card', 'clip')
    expect(r.record).toHaveProperty('suggested')
    expect(r.record).toHaveProperty('chosen')
  })
})

describe('เป้าหมายยกขึ้นได้ ลดลงไม่ได้', () => {
  it('ยกเป้าจากน้อยไปมากได้', () => {
    expect(canRaiseGoal(3, 5)).toBe(true)
    expect(canRaiseGoal('goal-basic', 'goal-challenge')).toBe(true)
  })

  it('ลดเป้าไม่ได้', () => {
    expect(canRaiseGoal(6, 3)).toBe(false)
    expect(canRaiseGoal('goal-challenge', 'goal-basic')).toBe(false)
  })

  it('เป้าเท่าเดิมไม่นับว่ายกเป้า', () => {
    expect(canRaiseGoal(5, 5)).toBe(false)
    expect(canRaiseGoal('goal-good', 'goal-good')).toBe(false)
  })

  it('รหัสเป้าที่ไม่รู้จักคืน false ไม่พัง', () => {
    expect(canRaiseGoal('goal-basic', 'ไม่มีเป้านี้')).toBe(false)
    expect(goalStarTarget('ไม่มีเป้านี้')).toBeNull()
  })

  it('รหัสเป้าทั้ง 3 ระดับแปลงเป็นจำนวนดาวได้ และเรียงจากน้อยไปมาก', () => {
    // อ่านค่าจากไฟล์เนื้อหา ไม่ตรึงตัวเลขไว้ในเทสต์ เพราะครูปรับจำนวนดาวเป้าได้
    const basic = goalStarTarget('goal-basic')!
    const good = goalStarTarget('goal-good')!
    const challenge = goalStarTarget('goal-challenge')!
    expect(basic).toBeGreaterThan(0)
    expect(good).toBeGreaterThan(basic)
    expect(challenge).toBeGreaterThan(good)
  })
})

describe('บันไดคำใบ้ ปล่อยทีละระดับ', () => {
  it('ผิดครั้งแรกได้คำใบ้ระดับ 1 ไม่ใช่ปล่อยหมดทีเดียว', () => {
    expect(nextHintLevel(1, 0, 3)).toBe(1)
  })

  it('ไม่ข้ามระดับ ระดับถัดไปนับจากที่ใช้ไปแล้วเสมอ', () => {
    expect(nextHintLevel(5, 1, 3)).toBe(2)
    expect(nextHintLevel(5, 2, 3)).toBe(3)
  })

  it('ยังผิดไม่ถึงจังหวะ ระบบยังไม่ยื่นคำใบ้ให้เอง', () => {
    expect(nextHintLevel(0, 0, 3)).toBeNull()
    expect(nextHintLevel(1, 1, 3)).toBeNull()
  })

  it('ใช้คำใบ้ครบทุกระดับแล้วคืน null', () => {
    expect(nextHintLevel(9, 3, 3)).toBeNull()
    expect(nextHintLevel(9, 4, 3)).toBeNull()
  })

  it('ภารกิจที่ไม่มีคำใบ้เลยคืน null', () => {
    expect(nextHintLevel(5, 0, 0)).toBeNull()
  })
})

describe('ธงชวนครูเข้ามาช่วย', () => {
  const base = { attempts: 0, hintsUsed: 0, maxHints: 3, solved: false, lastActionAt: T0, now: T0 }
  /** อ่านเกณฑ์จากไฟล์เนื้อหา ไม่ตรึงวินาทีไว้ในเทสต์ เพราะทีมจะปรับหลังทดลองสอนจริง */
  const { yellow, orange, red } = coachThresholds.levels
  const idleAt = (seconds: number) => T0 + seconds * 1000

  it('เกณฑ์ที่โหลดมาต้องไล่จากเบาไปหนัก และอ่านจากไฟล์เนื้อหาไม่ใช่ฝังในโค้ด', () => {
    expect(yellow.idleSeconds).toBe(60)
    expect(orange.idleSeconds).toBe(90)
    expect(red.idleSeconds).toBe(150)
    expect(yellow.idleSeconds!).toBeLessThan(orange.idleSeconds!)
    expect(orange.idleSeconds!).toBeLessThan(red.idleSeconds!)
  })

  it('ไม่ขยับถึงเกณฑ์แรกขึ้นธงเหลือง', () => {
    const r = shouldCoach({ ...base, now: idleAt(yellow.idleSeconds!) })
    expect(r.flag).toBe(true)
    expect(r.level).toBe('yellow')
    expect(r.cause).toBe('idle-too-long')
    expect(r.label).toBe(yellow.label)
  })

  it('ไม่ขยับนานขึ้นอีกขั้นเป็นธงส้ม', () => {
    const r = shouldCoach({ ...base, now: idleAt(orange.idleSeconds!) })
    expect(r.level).toBe('orange')
    expect(r.cause).toBe('idle-too-long')
  })

  it('ลองแล้วไม่ผ่านครบตามเกณฑ์ ขึ้นธงส้มแม้เพิ่งขยับ', () => {
    const r = shouldCoach({ ...base, attempts: orange.attempts! })
    expect(r.level).toBe('orange')
    expect(r.cause).toBe('many-attempts')
  })

  it('ไม่ขยับถึงเกณฑ์สุดท้ายขึ้นธงแดง', () => {
    const r = shouldCoach({ ...base, now: idleAt(red.idleSeconds!) })
    expect(r.level).toBe('red')
    expect(r.cause).toBe('idle-too-long')
  })

  it('ใช้คำใบ้ครบทุกระดับแล้วยังไม่ผ่าน ขึ้นธงแดงทันทีไม่ต้องรอเวลา', () => {
    const r = shouldCoach({ ...base, hintsUsed: 3, maxHints: 3 })
    expect(r.level).toBe('red')
    expect(r.cause).toBe('hints-exhausted')
  })

  it('เข้าเกณฑ์หลายข้อพร้อมกัน เอาสีที่ด่วนที่สุด', () => {
    const r = shouldCoach({
      ...base,
      attempts: 9,
      hintsUsed: 3,
      maxHints: 3,
      now: idleAt(orange.idleSeconds!),
    })
    expect(r.level).toBe('red')
  })

  it('ยังอยู่ในเกณฑ์ปกติไม่ต้องโค้ช', () => {
    expect(
      shouldCoach({ ...base, attempts: 2, hintsUsed: 1, now: idleAt(yellow.idleSeconds! - 1) }),
    ).toEqual({ flag: false, level: null, cause: null, label: null })
  })

  it('ผ่านภารกิจแล้วไม่ต้องเรียกครู แม้จะลองหลายครั้งและใช้คำใบ้หมด', () => {
    expect(
      shouldCoach({ ...base, attempts: 9, hintsUsed: 3, solved: true, now: idleAt(300) }),
    ).toEqual({ flag: false, level: null, cause: null, label: null })
  })
})

describe('การให้ดาว — นับเฉพาะครั้งที่ตอบยังไม่ถูก (สเปกข้อ 1.10 · 2.5 ข้อ 6 · 2.7)', () => {
  it('ตอบถูกครั้งแรกได้ 3 ดาว', () => {
    expect(starsFor({ passed: true, attempts: 1, hintsUsed: 0 })).toBe(3)
  })

  it('**เปิดตัวช่วยครบทุกระดับแล้วตอบถูกครั้งแรก ต้องได้ 3 ดาวเต็ม**', () => {
    // นี่คือกฎที่สเปกข้อ 2.7 ประกาศไว้ว่า "ไม่หักดาวเมื่อเปิดตัวช่วย"
    // เด็กที่กลัวเสียดาวจะไม่กล้ากดดูตัวช่วย แล้วนั่งจมอยู่กับความไม่เข้าใจ
    expect(starsFor({ passed: true, attempts: 1, hintsUsed: 3 })).toBe(3)
    expect(starsFor({ passed: true, attempts: 1, hintsUsed: 99 })).toBe(3)
  })

  it('จำนวนคำใบ้ไม่ทำให้ดาวเปลี่ยนเลย ไม่ว่าจะลองกี่ครั้ง', () => {
    for (let attempts = 1; attempts <= 10; attempts++) {
      const withoutHints = starsFor({ passed: true, attempts, hintsUsed: 0 })
      for (let hintsUsed = 1; hintsUsed <= 5; hintsUsed++) {
        expect(starsFor({ passed: true, attempts, hintsUsed })).toBe(withoutHints)
      }
      // ไม่ส่งค่าคำใบ้มาเลยก็ต้องได้เท่ากัน
      expect(starsFor({ passed: true, attempts })).toBe(withoutHints)
    }
  })

  it('ตอบยังไม่ถูก 1 ครั้งแล้วผ่าน ได้ 2 ดาว · ตั้งแต่ 2 ครั้งขึ้นไปได้ 1 ดาว', () => {
    expect(starsFor({ passed: true, attempts: 2, hintsUsed: 0 })).toBe(2)
    expect(starsFor({ passed: true, attempts: 2, hintsUsed: 3 })).toBe(2)
    expect(starsFor({ passed: true, attempts: 3, hintsUsed: 0 })).toBe(1)
    expect(starsFor({ passed: true, attempts: 5, hintsUsed: 3 })).toBe(1)
  })

  it('ผ่านแล้วต้องไม่ได้ 0 ดาว ไม่ว่าลองกี่ครั้งหรือใช้คำใบ้กี่ระดับ', () => {
    for (let attempts = 1; attempts <= 20; attempts++) {
      for (let hintsUsed = 0; hintsUsed <= 5; hintsUsed++) {
        expect(starsFor({ passed: true, attempts, hintsUsed })).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('ยังไม่ผ่านได้ 0 ดาว', () => {
    expect(starsFor({ passed: false, attempts: 3, hintsUsed: 1 })).toBe(0)
  })

  it('กติกาดาวอ่านจากไฟล์เนื้อหา ไม่ตรึงช่วงไว้ในโค้ด', () => {
    expect(missionStarBands.map((b) => b.stars)).toEqual([3, 2, 1])
    for (const band of missionStarBands) {
      const wrongAttempts = band.maxWrongAttempts ?? 5
      expect(starsFor({ passed: true, attempts: wrongAttempts + 1, hintsUsed: 4 })).toBe(band.stars)
    }
  })
})

describe('เทียบดาวกับเป้าหมายที่ตั้งเอง', () => {
  it('ต่ำกว่าเป้า เท่าเป้า และเกินเป้า', () => {
    expect(goalOutcome(2, 5)).toBe('below')
    expect(goalOutcome(5, 5)).toBe('met')
    expect(goalOutcome(6, 5)).toBe('exceeded')
  })

  it('ใช้รหัสเป้าหมายแทนตัวเลขได้ โดยอ่านจำนวนดาวเป้าจากไฟล์เนื้อหา', () => {
    const basic = goalStarTarget('goal-basic')!
    expect(goalOutcome(basic, 'goal-basic')).toBe('met')
    expect(goalOutcome(basic + 1, 'goal-basic')).toBe('exceeded')
    expect(goalOutcome(basic - 1, 'goal-basic')).toBe('below')
  })
})

describe('สรุปความคืบหน้าทั้งคาบ', () => {
  const missions: MissionRecord[] = [
    { missionId: 'mission-1', passed: true, stars: 3, route: 'card' },
    { missionId: 'mission-2', passed: true, stars: 2, route: 'clip' },
    { missionId: 'mission-3', passed: false, stars: 0, route: 'clip' },
    { missionId: 'mission-4', passed: true, stars: 1, route: 'buddy' },
  ]

  it('นับภารกิจที่ผ่าน ดาวรวม และช่องทางที่เคยใช้', () => {
    const s = progressSummary(missions)
    expect(s.done).toBe(3)
    expect(s.total).toBe(4)
    expect(s.stars).toBe(6)
    expect(s.routesUsed).toEqual(['card', 'clip', 'buddy'])
  })

  it('นับจำนวนครั้งที่สลับช่องทางได้ถูกต้อง', () => {
    expect(progressSummary(missions).switchCount).toBe(2)
  })

  it('ใช้ช่องทางเดียวตลอดคาบ นับการสลับเป็นศูนย์', () => {
    const same: MissionRecord[] = [
      { missionId: 'mission-1', passed: true, stars: 3, route: 'card' },
      { missionId: 'mission-2', passed: true, stars: 3, route: 'card' },
    ]
    expect(progressSummary(same).switchCount).toBe(0)
  })

  it('การสลับกลางภารกิจถูกนับรวมด้วย', () => {
    const inMission: MissionRecord[] = [
      { missionId: 'mission-1', passed: true, stars: 2, route: 'card', routeSwitches: 2 },
      { missionId: 'mission-2', passed: true, stars: 3, route: 'card' },
    ]
    expect(progressSummary(inMission).switchCount).toBe(2)
  })

  it('ยังไม่ทำอะไรเลยไม่พัง', () => {
    expect(progressSummary([])).toEqual({
      done: 0,
      total: 0,
      stars: 0,
      routesUsed: [],
      switchCount: 0,
    })
  })
})

describe('บันทึกร่องรอยการปรับเหมาะเป็นภาษาไทย', () => {
  const events: TraceEvent[] = [
    { type: 'route-suggested', at: T0, suggested: 'card' },
    { type: 'route-chosen', at: T0 + 60_000, suggested: 'card', chosen: 'buddy' },
    { type: 'level-chosen', at: T0 + 120_000, suggested: 1, chosen: 3 },
    { type: 'hint-used', at: T0 + 180_000, level: 1, triggeredBy: 'student' },
    { type: 'coach-flagged', at: T0 + 240_000, cause: 'many-attempts' },
    { type: 'goal-raised', at: T0 + 300_000, from: 'goal-basic', to: 'goal-good' },
    { type: 'mission-passed', at: T0 + 360_000, missionId: 'mission-1', stars: 2 },
  ]

  it('ได้บรรทัดครบทุกเหตุการณ์ พร้อมเวลาแบบ HH:MM', () => {
    const lines = adaptiveTrace(events)
    expect(lines).toHaveLength(events.length)
    for (const line of lines) expect(line).toMatch(/^\d{2}:\d{2} /)
  })

  it('แยกให้เห็นชัดว่าอันไหนระบบเสนอ อันไหนผู้เรียนเลือกเอง', () => {
    const lines = adaptiveTrace(events)
    expect(lines[0]).toContain('ระบบเสนอ')
    expect(lines[1]).toContain('ผู้เรียนเปลี่ยนเอง')
    expect(lines[2]).toContain('ผู้เรียนเปลี่ยนระดับตัวช่วยเอง')
    expect(lines[3]).toContain('ผู้เรียนกดขอคำใบ้เอง')
    expect(lines[5]).toContain('ผู้เรียนยกเป้าหมายเอง')
  })

  it('รับข้อเสนอตามที่ระบบเสนอ เขียนคนละแบบกับตอนเปลี่ยนเอง', () => {
    const [line] = adaptiveTrace([
      { type: 'route-chosen', at: T0, suggested: 'card', chosen: 'card' },
    ])
    expect(line).toContain('รับข้อเสนอ')
    expect(line).not.toContain('เปลี่ยนเอง')
  })

  it('เวลาเดิมให้ข้อความเดิมทุกครั้ง ไม่ขึ้นกับเวลาเครื่องที่รัน', () => {
    expect(adaptiveTrace(events)).toEqual(adaptiveTrace(events))
  })

  it('ไม่มีเหตุการณ์เลยได้รายการว่าง', () => {
    expect(adaptiveTrace([])).toEqual([])
  })
})

describe('ธงความมั่นใจเทียบกับผลจริง', () => {
  it('มั่นใจเต็มที่แต่ตอบผิด ระบบบอกครูว่าควรคุย', () => {
    const r = calibrationFlag(CONFIDENCE_MAX, false)
    expect(r.flag).toBe('ควรคุย')
    expect(r.coachPromptId).toBe('reason-overconfident-wrong')
    expect(r.reason).toContain('มั่นใจ')
  })

  it('บอกว่าเดาเอาแต่ตอบถูก ระบบบอกครูว่าควรชม', () => {
    const r = calibrationFlag(CONFIDENCE_MIN, true)
    expect(r.flag).toBe('ควรชม')
    expect(r.coachPromptId).toBe('reason-underconfident-right')
  })

  it('ความมั่นใจตรงกับผลจริง ไม่ต้องรบกวนครู', () => {
    expect(calibrationFlag(CONFIDENCE_MAX, true).flag).toBeNull()
    expect(calibrationFlag(CONFIDENCE_MIN, false).flag).toBeNull()
    expect(calibrationFlag(CONFIDENCE_MAX, true).coachPromptId).toBeNull()
  })

  it('ความมั่นใจระดับกลางไม่ขึ้นธงทั้งสองแบบ', () => {
    const middle = Math.round((CONFIDENCE_MIN + CONFIDENCE_MAX) / 2)
    expect(calibrationFlag(middle, true).flag).toBeNull()
    expect(calibrationFlag(middle, false).flag).toBeNull()
  })

  it('ค่าที่อ่านไม่ได้ไม่ทำให้พัง', () => {
    expect(calibrationFlag(Number.NaN, false).flag).toBeNull()
  })

  it('รหัสที่คืนมาต้องใช้หาคำถามโค้ชได้จริงในไฟล์เนื้อหา และเป็นคำถาม ไม่ใช่คำเฉลย', () => {
    const ids = new Set(coachPrompts.prompts.map((p) => p.reasonId))
    for (const flag of [calibrationFlag(CONFIDENCE_MAX, false), calibrationFlag(CONFIDENCE_MIN, true)]) {
      expect(ids.has(flag.coachPromptId!)).toBe(true)
      const matched = coachPrompts.prompts.filter((p) => p.reasonId === flag.coachPromptId)
      expect(matched.length).toBeGreaterThan(0)
      for (const prompt of matched) expect(prompt.question.length).toBeGreaterThan(0)
    }
  })
})

describe('จัดอันดับช่องทางที่ได้ผลจริง', () => {
  const history = [
    { route: 'card' as const, passed: true, stars: 3, hintsUsed: 0, elapsedSeconds: 60 },
    { route: 'clip' as const, passed: true, stars: 1, hintsUsed: 3, elapsedSeconds: 240 },
    { route: 'buddy' as const, passed: false, stars: 0, hintsUsed: 2, elapsedSeconds: 300 },
  ]

  it('ช่องทางที่ผ่านด้วยดาวสูง ใช้คำใบ้น้อย ใช้เวลาน้อย ถูกเสนอก่อน', () => {
    const ranking = rankChannelsByEffectiveness(history)
    expect(ranking[0]!.route).toBe('card')
    expect(ranking[0]!.score).toBeGreaterThan(ranking[1]!.score)
  })

  it('ไม่เคยตัดช่องทางไหนทิ้งเลย คืนครบทั้ง 4 เสมอ', () => {
    for (const input of [history, [], [history[0]!]]) {
      const ranking = rankChannelsByEffectiveness(input)
      expect(ranking).toHaveLength(ROUTE_IDS.length)
      expect(new Set(ranking.map((r) => r.route))).toEqual(new Set(ROUTE_IDS))
    }
  })

  it('ช่องทางที่ยังไม่เคยลอง ไม่ถูกลงโทษ ได้คะแนนศูนย์และยังอยู่เหนือช่องทางที่ลองแล้วไม่เวิร์ก', () => {
    const ranking = rankChannelsByEffectiveness(history)
    const game = ranking.find((r) => r.route === 'game')!
    const buddy = ranking.find((r) => r.route === 'buddy')!
    expect(game.tried).toBe(false)
    expect(game.score).toBe(0)
    expect(game.score).toBeGreaterThan(buddy.score)
  })

  it('ไม่มีประวัติเลยได้ลำดับคงที่ตามลำดับตัดสินเดิม', () => {
    const ranking = rankChannelsByEffectiveness([])
    expect(ranking.map((r) => r.route)).toEqual(['card', 'clip', 'game', 'buddy'])
    expect(ranking.every((r) => r.tried === false)).toBe(true)
  })

  it('ใช้ช่องทางเดิมหลายครั้งคิดเป็นค่าเฉลี่ย และนับจำนวนครั้งไว้', () => {
    const ranking = rankChannelsByEffectiveness([
      { route: 'clip', passed: true, stars: 3, hintsUsed: 0, elapsedSeconds: 30 },
      { route: 'clip', passed: false, stars: 0, hintsUsed: 4, elapsedSeconds: 300 },
    ])
    const clip = ranking.find((r) => r.route === 'clip')!
    expect(clip.attempts).toBe(2)
    expect(clip.tried).toBe(true)
  })

  it('เรียกซ้ำด้วยข้อมูลเดิมได้ลำดับเดิมทุกครั้ง', () => {
    const a = rankChannelsByEffectiveness(history)
    const b = rankChannelsByEffectiveness(history)
    expect(a).toEqual(b)
  })
})

describe('ระดับภารกิจจากผลก่อนเรียน', () => {
  it('ตอบถูก ได้โจทย์ท้าทายและระบบเสนอให้ข้ามได้', () => {
    const d = missionDifficulty(true)
    expect(d.level).toBe('challenge')
    expect(d.canSkip).toBe(true)
  })

  it('ตอบผิด ได้โจทย์พื้นฐาน และระบบไม่เสนอให้ข้าม', () => {
    const d = missionDifficulty(false)
    expect(d.level).toBe('basic')
    expect(d.canSkip).toBe(false)
    expect(d.reason.length).toBeGreaterThan(0)
  })
})

describe('ภารกิจเสริมเมื่อตั้งเป้าสูง', () => {
  it('ตั้งเป้าระดับสูงสุด เปิดภารกิจเสริมให้ตั้งแต่ยังไม่ได้ดาว', () => {
    expect(bonusUnlocked('goal-challenge', 0)).toBe(true)
  })

  it('ตั้งเป้าต่ำแต่ยังไม่ถึงเป้า ยังไม่เปิด', () => {
    expect(bonusUnlocked('goal-basic', 1)).toBe(false)
  })

  it('ทำถึงเป้าที่ตั้งเองแล้ว เปิดให้มีอะไรทำต่อ', () => {
    const basic = goalStarTarget('goal-basic')!
    expect(bonusUnlocked('goal-basic', basic)).toBe(true)
    expect(bonusUnlocked('goal-basic', basic + 2)).toBe(true)
  })

  it('ยังไม่ได้ตั้งเป้าหรือค่าที่อ่านไม่ได้ ไม่เปิดและไม่พัง', () => {
    expect(bonusUnlocked(0, 10)).toBe(false)
    expect(bonusUnlocked('ไม่มีเป้านี้', 10)).toBe(false)
    expect(bonusUnlocked('goal-basic', Number.NaN)).toBe(false)
  })
})

describe('บั๊กที่ QA เจอ: ตอบถูกหมดต้องได้ตัวช่วยน้อยสุด', () => {
  it('ตอบถูกทุกข้อได้ระดับ 3 ไม่ใช่ระดับ 1', () => {
    expect(recommendLevel({ score: PRE_TOTAL, total: PRE_TOTAL, wrongIds: [] }).suggested).toBe(3)
  })

  it('ตอบผิดหมดได้ระดับ 1', () => {
    const wrongIds = ['pre-1', 'pre-2', 'pre-3', 'pre-4']
    expect(recommendLevel({ score: 0, total: PRE_TOTAL, wrongIds }).suggested).toBe(1)
  })

  it('ระดับที่เสนอเพิ่มขึ้นตามคะแนน ไม่กลับด้าน', () => {
    const levels = Array.from({ length: PRE_TOTAL + 1 }, (_, score) =>
      recommendLevel({ score, total: PRE_TOTAL, wrongIds: [] }).suggested,
    )
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]!).toBeGreaterThanOrEqual(levels[i - 1]!)
    }
    expect(levels[0]).toBe(1)
    expect(levels[PRE_TOTAL]).toBe(3)
  })
})

describe('ข้ามภารกิจ (มติ T46) — ดาวและการผ่านจุดประสงค์', () => {
  it('**ข้ามเองโดยตอบถูกและมั่นใจ = 3 ดาวเต็ม และนับว่าผ่าน**', () => {
    const d = evaluateSkip({ by: 'student', correct: true, confidence: SKIP_MIN_CONFIDENCE })
    expect(d.outcome).toBe('earned')
    expect(d.allowed).toBe(true)
    expect(d.stars).toBe(SKIP_EARNED_STARS)
    expect(d.stars).toBe(3)
    expect(d.passed).toBe(true)
    // ดาวเท่ากับคนที่ทำผ่านเองครั้งแรก ไม่ถูกลงโทษเพราะรู้อยู่แล้ว
    expect(d.stars).toBe(starsFor({ passed: true, attempts: 1 }))
  })

  it('**ครูสั่งให้ข้าม (T-06) = 0 ดาว แต่ยังนับว่าผ่านจุดประสงค์**', () => {
    const d = evaluateSkip({ by: 'teacher' })
    expect(d.outcome).toBe('teacher')
    expect(d.allowed).toBe(true)
    expect(d.stars).toBe(0)
    expect(d.passed).toBe(true)
  })

  it('**กดข้ามโดยยังไม่เข้าเงื่อนไข = ระบบปฏิเสธ** ไม่ใช่ข้ามได้แล้วได้ 0 ดาว', () => {
    // ตอบผิด
    const wrong = evaluateSkip({ by: 'student', correct: false, confidence: SKIP_MIN_CONFIDENCE })
    expect(wrong.outcome).toBe('rejected')
    expect(wrong.allowed).toBe(false)
    expect(wrong.passed).toBe(false)
    expect(wrong.stars).toBe(0)

    // ตอบถูกแต่ไม่ได้บอกว่ามั่นใจเต็มที่
    const unsure = evaluateSkip({ by: 'student', correct: true, confidence: SKIP_MIN_CONFIDENCE - 1 })
    expect(unsure.outcome).toBe('rejected')
    expect(unsure.allowed).toBe(false)

    // ไม่ได้กรอกความมั่นใจมาเลย ก็ยังข้ามไม่ได้
    expect(evaluateSkip({ by: 'student', correct: true, confidence: Number.NaN }).allowed).toBe(false)
    expect(evaluateSkip({ by: 'student', correct: true }).allowed).toBe(false)
  })

  it('เหตุผลที่ปฏิเสธไม่ตำหนิผู้เรียน', () => {
    for (const d of [evaluateSkip({ by: 'student', correct: false, confidence: 3 }), evaluateSkip({ by: 'student', correct: true, confidence: 1 })]) {
      expect(d.reason.length).toBeGreaterThan(10)
      for (const word in { โง่: 1, ไม่เก่ง: 1, ห้าม: 1 }) {
        expect(d.reason).not.toContain(word)
      }
    }
  })

  it('starsFor เป็นทางเดียวที่ใช้ตัดสินดาว ไม่ว่าข้ามหรือเล่น', () => {
    expect(starsFor({ passed: false, attempts: 0, skipped: { by: 'student', correct: true, confidence: 3 } })).toBe(3)
    expect(starsFor({ passed: false, attempts: 0, skipped: { by: 'teacher' } })).toBe(0)
    expect(starsFor({ passed: false, attempts: 0, skipped: { by: 'student', correct: false, confidence: 3 } })).toBe(0)
    // ข้ามแล้ว จำนวนครั้งที่ลองและคำใบ้ไม่มีผล
    expect(
      starsFor({ passed: false, attempts: 9, hintsUsed: 9, skipped: { by: 'student', correct: true, confidence: 3 } }),
    ).toBe(3)
  })

  it('กติกาการข้ามอ่านจากไฟล์เนื้อหา ไม่ตรึงในโค้ด', () => {
    const rule = (rubricJson.missionStars as { skip: Record<string, unknown> }).skip
    expect(rule.earnedStars).toBe(SKIP_EARNED_STARS)
    expect(rule.teacherDirectedStars).toBe(SKIP_TEACHER_STARS)
    expect(rule.countsAsObjectivePassed).toBe(true)
    // ความมั่นใจขั้นต่ำผูกกับสเกลจริงใน self-profile.json ไม่ใช่เลข 3 ที่เขียนทิ้งไว้
    expect(SKIP_MIN_CONFIDENCE).toBe(CONFIDENCE_MAX)
  })
})
