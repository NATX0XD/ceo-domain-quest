/**
 * ตรวจคลังเนื้อหาทั้งโฟลเดอร์เทียบกับสเปกหัวข้อ 11
 *
 * เทสต์ชุดนี้ไม่ได้ทดสอบตรรกะ แต่ทดสอบ "ของในคลัง" ว่าครบและไม่หลุด
 * มี 2 เรื่อง
 * 1. จำนวนของแต่ละคลังตรงกับที่สเปกกำหนด
 * 2. ไฟล์ที่ส่งไปเบราว์เซอร์ได้ ต้องไม่มีเฉลยปนอยู่แม้แต่คีย์เดียว
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { checkContent } from './content-filter'
import bigMissionJson from '../content/big-mission.json' with { type: 'json' }
import bonusAnswersJson from '../content/bonus-missions-answers.json' with { type: 'json' }
import bonusJson from '../content/bonus-missions.json' with { type: 'json' }
import businessIdeasJson from '../content/business-ideas.json' with { type: 'json' }
import businessTypesJson from '../content/business-types.json' with { type: 'json' }
import checkAnswersJson from '../content/check-questions-answers.json' with { type: 'json' }
import checkQuestionsJson from '../content/check-questions.json' with { type: 'json' }
import coachThresholdsJson from '../content/coach-thresholds.json' with { type: 'json' }
import contentFilterJson from '../content/content-filter.json' with { type: 'json' }
import domeLinesJson from '../content/dome-lines.json' with { type: 'json' }
import introCardsJson from '../content/intro-cards.json' with { type: 'json' }
import messagesJson from '../content/messages.json' with { type: 'json' }
import missionTasksAnswersJson from '../content/mission-tasks-answers.json' with { type: 'json' }
import missionTasksJson from '../content/mission-tasks.json' with { type: 'json' }
import learnCounterJson from '../content/learn-counter.json' with { type: 'json' }
import learnCounterAnswersJson from '../content/learn-counter-answers.json' with { type: 'json' }
import learnPathsJson from '../content/learn-paths.json' with { type: 'json' }
import learnPathsAnswersJson from '../content/learn-paths-answers.json' with { type: 'json' }
import learnRegistrarJson from '../content/learn-registrar.json' with { type: 'json' }
import learnRegistrarAnswersJson from '../content/learn-registrar-answers.json' with { type: 'json' }
import missionsAnswersJson from '../content/missions-answers.json' with { type: 'json' }
import missionsJson from '../content/missions.json' with { type: 'json' }
import quizAnswersJson from '../content/quiz-answers.json' with { type: 'json' }
import quizJson from '../content/quiz.json' with { type: 'json' }
import reflectionJson from '../content/reflection.json' with { type: 'json' }
import reservedNamesJson from '../content/reserved-names.json' with { type: 'json' }
import rubricJson from '../content/rubric.json' with { type: 'json' }
import selfProfileAnswersJson from '../content/self-profile-answers.json' with { type: 'json' }
import selfProfileJson from '../content/self-profile.json' with { type: 'json' }
import storySeedsJson from '../content/story-seeds.json' with { type: 'json' }
import surveyJson from '../content/survey.json' with { type: 'json' }
import takenDomainsJson from '../content/taken-domains.json' with { type: 'json' }
import tldsJson from '../content/tlds.json' with { type: 'json' }

const CONTENT_DIR = join(import.meta.dirname, '..', 'content')

const ACTIVE_M2_TASK_IDS = ['m2-b1', 'm2-b2', 'm2-c1', 'm2-c2'] as const
type ActiveM2TaskShape = { id: string; target?: string; slots?: string[]; parts?: string[] }

function activeM2Task(id: (typeof ACTIVE_M2_TASK_IDS)[number]) {
  return missionTasksJson.missions.find((mission) => mission.id === 'm2')!.tasks.find((task) => task.id === id)! as ActiveM2TaskShape
}

function activeM2Answer(id: (typeof ACTIVE_M2_TASK_IDS)[number]) {
  return missionTasksAnswersJson.tasks.find((answer) => answer.id === id)!
}

describe('จำนวนในคลังเนื้อหาตรงกับสเปกหัวข้อ 11', () => {
  it('11.1 บทพูดโดม 15 จังหวะ ประโยคตอบรับสำรอง 5 ชื่อส่วนของร้าน 5 ขั้น', () => {
    expect(domeLinesJson.lines.length).toBe(15)
    expect(domeLinesJson.fallbackAcks.items).toHaveLength(5)
    expect(domeLinesJson.shopParts.items).toHaveLength(5)
    // 2 จังหวะที่สเปกให้ AI เขียน คือคำตอบรับหลังแต่ละคำตอบ และส่วนเล่าเรื่องของโจทย์
    expect(domeLinesJson.aiSlots.items).toHaveLength(2)
  })

  it('11.2 เช็กความเข้าใจ 2 ชุด ชุดละ 4 ข้อ ข้อละ 3 ตัวเลือก และเฉลยครบ 8 ข้อ', () => {
    expect(checkQuestionsJson.sets).toHaveLength(2)
    for (const set of checkQuestionsJson.sets) {
      expect(set.questions).toHaveLength(checkQuestionsJson.meta.questionCount)
      for (const q of set.questions) {
        expect(q.choices).toHaveLength(checkQuestionsJson.meta.choicesPerQuestion)
      }
    }
    expect(checkAnswersJson.questions).toHaveLength(8)
  })

  it('11.3 ภารกิจหลัก 4 ภารกิจ ผูกกับจุดประสงค์ข้อ 1 ถึง 4', () => {
    expect(missionsJson.missions).toHaveLength(4)
    expect(missionsJson.missions.map((m) => m.objectiveId)).toEqual([
      'obj-1',
      'obj-2',
      'obj-3',
      'obj-4',
    ])
  })

  it('11.4 แม่แบบสถานการณ์ด่านบอส 7 แม่แบบ และตารางกลุ่มลูกค้าใหม่ 3 คู่', () => {
    expect(bigMissionJson.scenarioTemplates.items).toHaveLength(7)
    expect(bigMissionJson.scenarioTemplates._newCustomerMap.pairs).toHaveLength(3)
  })

  it('11.5 รูบริก 4 ด้าน และคำสำคัญสำรอง 4 ประเด็น', () => {
    expect(rubricJson.dimensions).toHaveLength(rubricJson.meta.dimensionCount)
    expect(rubricJson.objectiveKeywords).toHaveLength(4)
    for (const item of rubricJson.objectiveKeywords) {
      expect(item.keywords.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('11.6 ข้อความตอบกลับครบทุกสถานการณ์ ปุ่มลัดครู 8 ปุ่ม คำขึ้นต้นความเห็นเพื่อน 4', () => {
    expect(messagesJson.feedback.length).toBeGreaterThanOrEqual(8)
    for (const f of messagesJson.feedback) {
      // สเปกบอกว่าระบบสุ่มไม่ซ้ำติดกัน ถ้ามีประโยคเดียวจะซ้ำทุกครั้ง
      expect(f.lines.length).toBeGreaterThanOrEqual(2)
    }
    expect(messagesJson.teacherQuickComments.praise).toHaveLength(4)
    expect(messagesJson.teacherQuickComments.suggest).toHaveLength(4)
    expect(messagesJson.peerCommentStarters.items).toHaveLength(4)
  })

  it('11.7 ภารกิจเสริม 3 ชุด ชุดละ 2 ข้อ รวม 6 ข้อ', () => {
    expect(bonusJson.missions).toHaveLength(3)
    expect(bonusJson.missions.reduce((n, m) => n + m.items.length, 0)).toBe(6)
  })

  it('11.8 แบบทดสอบก่อนและหลังเรียน ชุดละ 10 ข้อ ข้อละ 4 ตัวเลือก', () => {
    expect(quizJson.pre).toHaveLength(10)
    expect(quizJson.post).toHaveLength(10)
    for (const item of [...quizJson.pre, ...quizJson.post]) {
      expect(item.choices).toHaveLength(4)
    }
  })

  it('11.8 การกระจายจุดประสงค์ตรงกับตารางในสเปก', () => {
    const count = (set: typeof quizJson.pre, objectiveId: string) =>
      set.filter((q) => q.objectiveIds.includes(objectiveId)).length
    for (const set of [quizJson.pre, quizJson.post]) {
      expect(count(set, 'obj-1')).toBe(3)
      expect(count(set, 'obj-2')).toBe(3)
      expect(count(set, 'obj-3')).toBe(2)
      expect(count(set, 'obj-4')).toBe(2)
      expect(count(set, 'obj-5')).toBe(1)
    }
  })

  it('11.9 คำถามสะท้อนคิด 3 ข้อ ไอเดียการนำไปใช้ 4 เป้าครั้งหน้า 5', () => {
    expect(reflectionJson.questions).toHaveLength(3)
    for (const q of reflectionJson.questions) {
      expect(q.starterPhrases.length).toBeGreaterThanOrEqual(1)
      expect(q.followUpQuestion.length).toBeGreaterThan(0)
    }
    expect(reflectionJson.applyIdeas.items).toHaveLength(4)
    expect(reflectionJson.nextGoals.items).toHaveLength(5)
  })

  it('11.10 กับ S-40 แบบสอบถาม 10 ข้อ มาตร 5 ระดับ เกณฑ์แปลผล 5 ช่วง', () => {
    expect(surveyJson.items).toHaveLength(10)
    expect(surveyJson.scale.points).toHaveLength(5)
    expect(surveyJson.interpretation.bands).toHaveLength(5)
    // ข้อ 1 ถึง 8 เป็นมาตรประมาณค่า ข้อ 9 กับ 10 เป็นปลายเปิด
    expect(surveyJson.items.filter((i) => i.type === 'rating')).toHaveLength(8)
    expect(surveyJson.items.filter((i) => i.type === 'openText')).toHaveLength(2)
  })

  it('11.11 ไอเดียธุรกิจสำรอง 8 งานอดิเรก งานอดิเรกละ 3 ไอเดีย', () => {
    expect(businessIdeasJson.hobbies).toHaveLength(8)
    for (const hobby of businessIdeasJson.hobbies) {
      expect(hobby.ideas).toHaveLength(3)
    }
  })

  it('E-06 นามสกุลโดเมน 12 แบบ และประเภทธุรกิจ 8 แบบ', () => {
    expect(tldsJson.items).toHaveLength(12)
    expect(businessTypesJson.items).toHaveLength(8)
  })

  it('จุดประสงค์ทั้งหมด 6 ข้อ และเป้าดาวรวมไม่เกิน 15', () => {
    expect(selfProfileJson.objectives).toHaveLength(6)
    expect(selfProfileJson.starBudget.maxStars).toBe(15)
    expect(selfProfileJson.starBudget.missionStarsTotal).toBe(12)
    expect(selfProfileJson.starBudget.bigMissionMax).toBe(3)
  })
})

describe('โมเดลชื่อเว็บของ M2 ใช้โดเมน .com สามส่วนแบบเดียวกัน', () => {
  it('โจทย์ M2 ที่ใช้งานอยู่ยึด www.{slug}.com และไม่ต้องมี sldPart/th', () => {
    expect(activeM2Task('m2-b1').target).toBe('www.{slug}.com')
    expect(activeM2Task('m2-b1').slots).toEqual(['www', '{slug}', 'com'])
    expect(activeM2Task('m2-b2').parts).toEqual([
      'https://',
      'www.',
      '{slug}.',
      'com',
      '/menu',
    ])

    const serialized = JSON.stringify(ACTIVE_M2_TASK_IDS.map(activeM2Task))
    expect(serialized).not.toContain('sldPart')
    expect(serialized).not.toContain('{tld}')
    expect(serialized).not.toMatch(/\.th|"th"/)
  })

  it('เฉลย M2 ใช้ com เป็นส่วนที่สาม และไม่ต้องมี sldPart/th', () => {
    expect((activeM2Answer('m2-b1') as { slotKey: Array<{ slot: string }> }).slotKey.map((entry) => entry.slot)).toEqual([
      'www',
      '{slug}',
      'com',
    ])
    expect((activeM2Answer('m2-b2') as { acceptedSelections: string[][] }).acceptedSelections).toEqual([
      ['www.', '{slug}.', 'com'],
      ['{slug}.', 'com'],
    ])
    expect((activeM2Answer('m2-c1') as { acceptedAnswers: string[] }).acceptedAnswers).toEqual([
      'shop.{slug}.com',
      '{slug}.com',
    ])
    expect((activeM2Answer('m2-c2') as { sampleAnswer: string }).sampleAnswer).toContain('.com')

    const serialized = JSON.stringify(ACTIVE_M2_TASK_IDS.map(activeM2Answer))
    expect(serialized).not.toContain('sldPart')
    expect(serialized).not.toContain('{tld}')
    expect(serialized).not.toMatch(/\.th|"th"/)
  })
})

/**
 * ไฟล์กลุ่มนี้เคยไม่มีเทสต์นับจำนวนเลย ทีมลบรายการทิ้งหรือเพิ่มเกินได้โดยไม่มีอะไรเตือน
 * ตรึงไว้ทั้งจำนวนและความสอดคล้องกับไฟล์คำถามที่มันเป็นเฉลยของ
 */
describe('ไฟล์ที่เหลือในคลังก็ต้องมีจำนวนถูกตรึงไว้', () => {
  it('การ์ดแนะนำการใช้งาน 3 ใบ เรียงลำดับไม่ซ้ำ และมีปุ่มครบทั้ง 3 ปุ่ม', () => {
    expect(introCardsJson.cards).toHaveLength(3)
    expect(introCardsJson.cards.map((c) => c.order)).toEqual([1, 2, 3])
    expect(new Set(introCardsJson.cards.map((c) => c.id)).size).toBe(3)
    for (const card of introCardsJson.cards) {
      expect(card.title.length).toBeGreaterThan(0)
      expect(card.lines.length).toBeGreaterThan(0)
    }
    for (const label of [
      introCardsJson.meta.skipLabel,
      introCardsJson.meta.nextLabel,
      introCardsJson.meta.startLabel,
    ]) {
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('ชื่อที่ถูกจองไปแล้ว 58 ชื่อ ตัวพิมพ์เล็กล้วน ไม่ซ้ำกัน', () => {
    expect(takenDomainsJson.items).toHaveLength(58)
    expect(new Set(takenDomainsJson.items).size).toBe(takenDomainsJson.items.length)
    for (const name of takenDomainsJson.items) {
      // ระบบเทียบแบบไม่สนตัวพิมพ์ใหญ่เล็ก ถ้าในไฟล์มีตัวใหญ่ปนจะอ่านยากเวลาทีมไล่ดู
      expect(name).toBe(name.toLowerCase())
      expect(name.trim()).toBe(name)
    }
  })

  it('ธงเตือนครู 3 ระดับ เวลานิ่งไล่จากน้อยไปมาก และทุกระดับมีป้ายบอกครูว่าต้องทำอะไร', () => {
    const order = ['yellow', 'orange', 'red'] as const
    expect(Object.keys(coachThresholdsJson.levels)).toEqual([...order])
    const seconds = order.map((k) => coachThresholdsJson.levels[k].idleSeconds)
    expect(seconds).toEqual([...seconds].sort((a, b) => a - b))
    expect(new Set(seconds).size).toBe(order.length)
    for (const key of order) expect(coachThresholdsJson.levels[key].label.length).toBeGreaterThan(0)
  })

  it('เฉลยแบบทดสอบครบทั้ง 2 ชุด ตรงรหัสกับคำถาม และเลขคำตอบไม่หลุดขอบ', () => {
    for (const set of ['pre', 'post'] as const) {
      const questions = quizJson[set]
      const answers = quizAnswersJson[set]
      expect(answers).toHaveLength(questions.length)
      expect(answers.map((a) => a.id)).toEqual(questions.map((q) => q.id))
      for (const [i, answer] of answers.entries()) {
        expect(answer.answerIndex).toBeGreaterThanOrEqual(0)
        expect(answer.answerIndex).toBeLessThan(questions[i]!.choices.length)
        expect(answer.explanation.length).toBeGreaterThan(10)
      }
    }
  })

  it('เฉลยภารกิจหลักครบ 4 ภารกิจ ตรงรหัสกับคำถามในภารกิจ', () => {
    expect(missionsAnswersJson.missions).toHaveLength(missionsJson.missions.length)
    expect(missionsAnswersJson.missions.map((m) => m.id)).toEqual(
      missionsJson.missions.map((m) => m.id),
    )
    for (const answer of missionsAnswersJson.missions) {
      const mission = missionsJson.missions.find((m) => m.id === answer.id)!
      expect(answer.checkId).toBe(mission.check.id)
      expect(answer.answerIndex).toBeLessThan(mission.check.choices.length)
    }
  })

  it('เฉลยคลังโจทย์ย่อย 21 ข้อ รหัสไม่ซ้ำ และครอบคลุมโจทย์หลัก 13 ข้อครบทุกข้อ', () => {
    // 21 ไม่ใช่ 26 เพราะข้อสำรองบางข้อยังไม่มีใครเขียนเนื้อหา ดูรายการที่ยังขาดใน docs/content-request.md
    expect(missionTasksAnswersJson.tasks).toHaveLength(21)
    expect(new Set(missionTasksAnswersJson.tasks.map((t) => t.id)).size).toBe(21)
    expect(missionTasksAnswersJson.tasks.length).toBeGreaterThanOrEqual(
      missionTasksJson.meta.taskCount,
    )
    const answerIds = new Set(missionTasksAnswersJson.tasks.map((t) => t.id))
    for (const mission of missionTasksJson.missions) {
      for (const task of mission.tasks) expect(answerIds.has(task.id)).toBe(true)
    }
  })

  it('เฉลยภารกิจเสริม 6 ข้อ เท่ากับ 3 ชุด ชุดละ 2 ข้อ', () => {
    expect(bonusAnswersJson.items).toHaveLength(
      bonusJson.meta.missionCount * bonusJson.meta.itemsPerMission,
    )
    const bonusIds = new Set(bonusJson.missions.flatMap((m) => m.items.map((i) => i.id)))
    for (const answer of bonusAnswersJson.items) expect(bonusIds.has(answer.id)).toBe(true)
  })

  it('แก่นเรื่อง 10 เรื่องตรงกับจำนวนที่ประกาศไว้ และทุกประเภทธุรกิจมีหมวดเรื่องรองรับ', () => {
    expect(storySeedsJson.stories).toHaveLength(storySeedsJson.meta.storyCount)
    expect(new Set(storySeedsJson.stories.map((s) => s.id)).size).toBe(
      storySeedsJson.meta.storyCount,
    )
    expect(storySeedsJson.businessTypeToCategory).toHaveLength(businessTypesJson.items.length)
    const categoryIds = new Set(storySeedsJson.categories.map((c) => c.id))
    expect(categoryIds.has(storySeedsJson.defaultCategoryId)).toBe(true)
    for (const row of storySeedsJson.businessTypeToCategory) {
      expect(businessTypesJson.items.some((b) => b.id === row.businessTypeId)).toBe(true)
      expect(categoryIds.has(row.categoryId)).toBe(true)
    }
  })

  it('ตัวกรองคำ 10 กลุ่ม ระดับ 1 ถึง 3 เรียงจากเบาไปหนัก และทุกกลุ่มมีคำอยู่จริง', () => {
    expect(contentFilterJson.words).toHaveLength(10)
    const levels = contentFilterJson.words.map((w) => w.level)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
    expect(Math.min(...levels)).toBe(1)
    expect(Math.max(...levels)).toBe(3)
    for (const group of contentFilterJson.words) expect(group.terms.length).toBeGreaterThan(0)
    expect(contentFilterJson.personalInfoPatterns).toHaveLength(4)
  })

  it('ชื่อที่สงวนไว้ 4 กลุ่ม ทุกกลุ่มมีข้อความบอกผู้เรียน และคำที่ใส่ไว้ใช้เทียบได้จริง', () => {
    // grp-inappropriate ตั้งใจว่างไว้ให้ครูเติมเอง (ดู _status ในไฟล์) คำหยาบทั่วไปกันด้วย content-filter.json อยู่แล้ว
    const INTENTIONALLY_EMPTY = new Set(['grp-inappropriate'])
    expect(reservedNamesJson.groups).toHaveLength(4)
    for (const group of reservedNamesJson.groups) {
      expect(group.message.length).toBeGreaterThan(0)
      if (!INTENTIONALLY_EMPTY.has(group.id)) expect(group.items.length).toBeGreaterThan(0)
      for (const term of group.items) {
        // คำว่างในกลุ่มแบบ contains จะแมตช์ชื่อทุกชื่อ ผู้เรียนจะตั้งชื่ออะไรก็ไม่ผ่าน
        expect(term.trim().length).toBeGreaterThan(0)
      }
    }
    for (const id of INTENTIONALLY_EMPTY) {
      expect(reservedNamesJson.groups.some((g) => g.id === id)).toBe(true)
    }
  })

  /**
   * กติกาข้อสำรอง (S-20) — คีย์ที่ session ภารกิจขอมาใน scratchpad/result-t69.md
   *
   * offerAfterWrongAttempts เป็น null โดยตั้งใจ แปลว่า "ใช้เกณฑ์เดียวกับธงเตือนครู"
   * ซึ่งรักษาแหล่งความจริงเดียว ถ้าทีมใส่เป็นตัวเลข ต้องเป็นจำนวนเต็มตั้งแต่ 1
   * zod ตรวจที่นี่เพราะเป็นกติกาของเนื้อหา ไม่ใช่ของโค้ดเส้นใดเส้นหนึ่ง
   */
  it('กติกาข้อสำรองในรูบริกอ่านได้ด้วย zod และไม่มีเลขดาวซ้ำกับที่อื่น', () => {
    const AltItemRule = z.object({
      id: z.string().min(1),
      specRef: z.string().min(1),
      offerAfterWrongAttempts: z.union([z.int().min(1), z.null()]),
      offerAfterWrongAttemptsNote: z.string().min(1),
      offerOnHintsExhausted: z.boolean(),
      offerOnHintsExhaustedNote: z.string().min(1),
      // ชี้ไปที่ชื่อคีย์ ไม่ใช่ตัวเลข เพื่อไม่ให้ดาวของข้อสำรองเลื่อนหลุดจาก passedMinStars
      starsOnPass: z.literal('passedMinStars'),
      starsOnPassNote: z.string().min(1),
      wrongAnswerPenalty: z.literal(0),
      wrongAnswerPenaltyNote: z.string().min(1),
    })
    const rule = AltItemRule.parse(
      (rubricJson.missionStars as unknown as { altItem: unknown }).altItem,
    )

    // ค่าเริ่มต้นตั้งใจให้ยืมเกณฑ์ธงส้มของครู ปลายทางที่ยืมต้องมีอยู่จริง
    if (rule.offerAfterWrongAttempts === null) {
      expect(coachThresholdsJson.levels.orange.attempts).toBeGreaterThanOrEqual(1)
    }
    const passedMinStars = (rubricJson.missionStars as unknown as { passedMinStars: number })
      .passedMinStars
    expect(passedMinStars).toBeGreaterThanOrEqual(1)
  })

  it('ไฟล์เฉลยหน้าทำความรู้จักว่างโดยตั้งใจ และบอกเหตุผลไว้ในไฟล์', () => {
    // ว่างเพราะหน้า /profile ไม่มีคำถามถูกผิด ถ้าวันหนึ่งมีของโผล่มา ต้องมีคนมาคิดเรื่องการรั่วของเฉลยก่อน
    expect(selfProfileAnswersJson.items).toHaveLength(0)
    expect(selfProfileAnswersJson._status.length).toBeGreaterThan(50)
  })

  /**
   * มาตรฐานคำพูดของโปรเจกต์ ไม่มีคำตัดสินบนจอผู้เรียน
   *
   * คำที่ยอมให้ใช้ได้เป็นคำที่พลิกความหมายไปอีกทาง เช่น ยังไม่ผ่าน (แปลว่ายังมีรอบต่อไป)
   * ไม่ยอมแพ้ (คำชม) และ ไม่ใช่การตก (ปฏิเสธคำตัดสินตรง ๆ)
   * ส่วนคีย์ที่เป็นบันทึกถึงทีมหรือกฎการเขียน ไม่ได้ขึ้นจอใคร จึงไม่นับ
   */
  it('ไม่มีคำตัดสินว่าตก ไม่ผ่าน หรือล้มเหลว หลุดเข้าข้อความที่ขึ้นจอ', () => {
    const SOFTENED = [/ยังไม่ผ่าน/g, /ยังไม่ยอมแพ้/g, /ไม่ยอมแพ้/g, /ไม่ใช่การตก/g]
    const VERDICT = /(สอบตก|ตกแล้ว|ตกซ้ำ|ล้มเหลว|ไม่ผ่าน|คุณตก|เธอตก)/
    const isNoteKey = (path: string) => /(^_|\._|Note$|Rule$|Comment$|_status$)/.test(path)
    const hits: string[] = []

    const walk = (node: unknown, path: string, file: string): void => {
      if (typeof node === 'string') {
        if (isNoteKey(path)) return
        let text = node
        for (const soft of SOFTENED) text = text.replace(soft, '')
        if (VERDICT.test(text)) hits.push(`${file}.${path}`)
        return
      }
      if (Array.isArray(node)) {
        node.forEach((item, i) => walk(item, `${path}[${i}]`, file))
        return
      }
      if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          walk(value, path ? `${path}.${key}` : key, file)
        }
      }
    }

    for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json'))) {
      walk(JSON.parse(readFileSync(join(CONTENT_DIR, file), 'utf8')), '', file)
    }
    expect(hits).toEqual([])
  })

  it('ข้อความที่ผู้เรียนอ่านไม่มีวรรคยาวเกิน 95 ตัวอักษรติดกัน ภาษาไทยไม่มีช่องว่างระหว่างคำ', () => {
    // วรรคยาวติดกันคืออุปสรรคการอ่านของ ปวช.1 ที่วัดได้ ช่องว่างในภาษาไทยทำหน้าที่คั่นวรรค ไม่ใช่คั่นคำ
    const MAX_RUN = 95
    const tooLong: string[] = []

    const walk = (node: unknown, path: string, file: string): void => {
      if (typeof node === 'string') {
        if (/(^_|\._|Note$|Rule$|Comment$|_status$|specRef)/.test(path)) return
        for (const run of node.split(/[\s·]+/)) {
          if (run.length > MAX_RUN && !run.startsWith('http')) tooLong.push(`${file}.${path} (${run.length})`)
        }
        return
      }
      if (Array.isArray(node)) {
        node.forEach((item, i) => walk(item, `${path}[${i}]`, file))
        return
      }
      if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          walk(value, path ? `${path}.${key}` : key, file)
        }
      }
    }

    for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json'))) {
      walk(JSON.parse(readFileSync(join(CONTENT_DIR, file), 'utf8')), '', file)
    }
    expect(tooLong).toEqual([])
  })

  it('ทุกไฟล์ใน content/ ถูกอ้างถึงในเทสต์อย่างน้อย 1 ที่ ไฟล์ใหม่จะไม่หลุดไปแบบไม่มีคนตรวจ', () => {
    const testDir = import.meta.dirname
    const testSources = readdirSync(testDir)
      .filter((f) => f.endsWith('.test.ts'))
      .map((f) => readFileSync(join(testDir, f), 'utf8'))
      .join('\n')
    const untested = readdirSync(CONTENT_DIR)
      .filter((f) => f.endsWith('.json'))
      .filter((f) => !testSources.includes(f))
    expect(untested).toEqual([])
  })
})

describe('เฉลยต้องอยู่ในไฟล์ฝั่งเซิร์ฟเวอร์เท่านั้น', () => {
  /** คีย์ที่ถือว่าเป็นเฉลย ถ้าโผล่ในไฟล์ที่เบราว์เซอร์โหลดได้ ถือว่าหลุด */
  const ANSWER_KEYS = [
    'answerIndex',
    'answerIndexes',
    'answerKey',
    'correctIndex',
    'correctAnswer',
    'groupKey',
    'pairKey',
    'slotKey',
    'orderRule',
    'correctOrder',
    'acceptedAnswers',
    'acceptedSelections',
    'sampleAnswer',
    'gameKey',
  ]

  function keysOf(value: unknown, found: Set<string> = new Set()): Set<string> {
    if (Array.isArray(value)) {
      for (const v of value) keysOf(v, found)
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        found.add(k)
        keysOf(v, found)
      }
    }
    return found
  }

  const allFiles = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json'))
  const publicFiles = allFiles.filter((f) => !f.endsWith('-answers.json'))

  it('ไฟล์ที่ไม่ใช่ไฟล์เฉลย ต้องไม่มีคีย์เฉลยอยู่เลย', () => {
    const leaks: string[] = []
    for (const file of publicFiles) {
      const parsed: unknown = JSON.parse(readFileSync(join(CONTENT_DIR, file), 'utf8'))
      const keys = keysOf(parsed)
      for (const key of ANSWER_KEYS) {
        if (keys.has(key)) leaks.push(`${file} มีคีย์ ${key}`)
      }
    }
    expect(leaks).toEqual([])
  })

  it('ทุกไฟล์คำถามที่มีเฉลย ต้องมีไฟล์เฉลยคู่กันจริง', () => {
    for (const file of allFiles.filter((f) => f.endsWith('-answers.json'))) {
      const questionFile = file.replace('-answers.json', '.json')
      expect(allFiles).toContain(questionFile)
    }
  })

  it('ไม่มี client component ไหน import ไฟล์เฉลยหรือโมดูลที่ถือเฉลย', () => {
    const roots = ['components', 'app'].map((d) => join(import.meta.dirname, '..', d))
    /** จับเฉพาะบรรทัด import จริง ไม่จับคอมเมนต์ที่เขียนเตือนว่าห้าม import */
    const importsAnswers =
      /^\s*import\s[^\n]*(['"][^'"]*-answers\.json['"]|core\/quiz['"]|content-library-answers['"])/m
    const offenders: string[] = []

    function walk(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(path)
          continue
        }
        if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) continue
        const source = readFileSync(path, 'utf8')
        const isClient = /^\s*['"]use client['"]/m.test(source.slice(0, 400))
        if (isClient && importsAnswers.test(source)) offenders.push(path)
      }
    }

    for (const root of roots) walk(root)
    expect(offenders).toEqual([])
  })

  it('ไฟล์เฉลยต้องประกาศคำเตือนไว้ในไฟล์ ให้คนที่เปิดอ่านรู้ทันทีว่าห้ามส่งไปเบราว์เซอร์', () => {
    const missing: string[] = []
    for (const file of allFiles.filter((f) => f.endsWith('-answers.json'))) {
      const raw = readFileSync(join(CONTENT_DIR, file), 'utf8')
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const notes = Object.entries(parsed)
        .filter(([k, v]) => k.startsWith('_') && typeof v === 'string')
        .map(([, v]) => v as string)
        .join(' ')
      if (!notes.includes('เซิร์ฟเวอร์') && !notes.includes('เฉลย')) missing.push(file)
    }
    expect(missing).toEqual([])
  })
})

describe('คลังเนื้อหาต้องไม่ติดตัวกรองคำไม่เหมาะสมของตัวเอง', () => {
  /**
   * เคยเจอของจริง: คำว่า hints-exhausted ถูกตัดขีดออกกลายเป็น hintsexhausted
   * ซึ่งมีคำว่า sex อยู่กลางคำ แล้วติดแบน (ปัญหา Scunthorpe)
   * ถ้าข้อความในคลังติดตัวกรองของตัวเอง ครูจะได้ธงเตือนจากข้อความที่ระบบเขียนเอง
   * ไม่ใช่จากที่ผู้เรียนพิมพ์ แล้วธงจริงจะจมอยู่ในกองธงปลอม
   */
  const SKIP_FILES = new Set([
    // ไฟล์นี้เก็บรายการคำต้องห้ามเอาไว้ ต้องติดตัวกรองอยู่แล้วโดยธรรมชาติ
    'content-filter.json',
    // กลุ่มคำไม่เหมาะสมในไฟล์นี้ตั้งใจเว้นว่างให้ครูเติมเอง เติมแล้วต้องติดตัวกรอง
    'reserved-names.json',
  ])

  function stringsOf(value: unknown, path: string, out: Array<[string, string]>): void {
    if (typeof value === 'string') {
      out.push([path, value])
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => stringsOf(v, `${path}[${i}]`, out))
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) stringsOf(v, `${path}.${k}`, out)
    }
  }

  /**
   * ข้อความเดียวที่ยกเว้นเป็นรายบรรทัด
   * เป็นกฎความปลอดภัยที่ส่งไปบอก AI ว่าห้ามเขียนเรื่องอะไร จึงต้องเอ่ยชื่อเรื่องพวกนั้นตรง ๆ
   * ข้อความนี้ไม่เคยถูกแสดงให้ผู้เรียนเห็น และไม่เคยถูกเอาไปตรวจด้วยตัวกรอง
   * ยกเว้นแบบระบุตำแหน่งชัด เพื่อให้ข้อความใหม่ที่ติดตัวกรองยังทำให้เทสต์พัง
   */
  const ALLOWED_PATHS = new Set([
    'story-seeds.json.promptRules[5]',
    // ผลบวกลวง: "กู้คืน" (ชื่อโดเมนที่หมดอายุ) มีพยางค์ "กู" ซ้อนอยู่ ตัวกรองจึงเห็นเป็นคำไม่สุภาพระดับ 1
    // เป็นศัพท์จริงของระบบทะเบียน (redemption) เนื้อหาเดิมจึงไม่แก้ ยกเว้นแบบระบุตำแหน่งเท่านั้น
    'learn-paths-answers.json.paths[3].rubrics.m4-wq2.modelAnswer',
    'learn-paths-answers.json.paths[3].rubrics.m4-wq2.concepts[1].any[11]',
    'learn-paths.json.paths[3].watch.scenes[5].line',
    'learn-registrar-answers.json.eventExplanations.ev-expire',
    'learn-registrar.json.events[3].choices[2]',
  ])

  const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json') && !SKIP_FILES.has(f))

  it('ทุกข้อความในทุกไฟล์ผ่านตัวกรองระดับ 0', () => {
    const hits: string[] = []
    let scanned = 0
    for (const file of files) {
      const parsed: unknown = JSON.parse(readFileSync(join(CONTENT_DIR, file), 'utf8'))
      const strings: Array<[string, string]> = []
      stringsOf(parsed, file, strings)
      for (const [path, text] of strings) {
        scanned += 1
        if (ALLOWED_PATHS.has(path)) continue
        const result = checkContent(text)
        if (result.level > 0) {
          hits.push(`${path} ระดับ ${result.level} ชน ${result.matches.map((m) => m.category).join(',')}`)
        }
      }
    }
    // กันไว้ว่าการสแกนทำงานจริง ไม่ใช่ผ่านเพราะไม่ได้อ่านอะไรเลย
    expect(scanned).toBeGreaterThan(2000)
    expect(hits).toEqual([])
  })

  it('รายการยกเว้นไม่ค้างเก่า ทุกบรรทัดที่ยกเว้นต้องยังติดตัวกรองจริง', () => {
    for (const allowed of ALLOWED_PATHS) {
      const [file] = allowed.split('.json')
      const parsed: unknown = JSON.parse(readFileSync(join(CONTENT_DIR, `${file}.json`), 'utf8'))
      const strings: Array<[string, string]> = []
      stringsOf(parsed, `${file}.json`, strings)
      const found = strings.find(([path]) => path === allowed)
      expect(found, `${allowed} ไม่มีอยู่แล้ว ให้ลบออกจากรายการยกเว้น`).toBeDefined()
      const level = checkContent(found![1]).level
      expect(level, `${allowed} ไม่ติดตัวกรองแล้ว ให้ลบออกจากรายการยกเว้น`).toBeGreaterThan(0)
    }
  })

  it('ไม่มีข้อความไหนถูกจับว่าเป็นข้อมูลส่วนตัว เช่น เบอร์โทรหรือเลขบัตรประชาชน', () => {
    const hits: string[] = []
    for (const file of files) {
      const parsed: unknown = JSON.parse(readFileSync(join(CONTENT_DIR, file), 'utf8'))
      const strings: Array<[string, string]> = []
      stringsOf(parsed, file, strings)
      for (const [path, text] of strings) {
        if (checkContent(text).hasPersonalInfo) hits.push(path)
      }
    }
    expect(hits).toEqual([])
  })
})

/* ------------------------------------------------------------------ *
 * บทเรียนของภารกิจต้องไม่บอกคำตอบของข้อตรวจภารกิจเดียวกัน
 * ------------------------------------------------------------------ */

interface AuditGameItem {
  id?: string
  type?: string
  text?: string
  label?: string
}

interface AuditMission {
  id: string
  intro: string
  hints: string[]
  stuckMessage: string
  channels: Record<string, unknown>
  check: Record<string, unknown>
}

interface AuditMissionAnswer {
  id: string
  choiceFeedback?: unknown[]
  gameKey?: {
    kind: string
    placements?: Array<{ slot: string; piece: string }>
    distractors?: string[]
  }
}

const auditMissions = missionsJson.missions as unknown as AuditMission[]
const auditAnswers = missionsAnswersJson.missions as unknown as AuditMissionAnswer[]

/** ข้อความที่ผู้เรียนอ่านได้ "ก่อน" ตอบข้อตรวจ — ตัว check ไม่นับ เพราะนั่นคือโจทย์เอง */
function learnTextsOf(mission: AuditMission): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') out.push([path, node])
    else if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`))
    else if (node && typeof node === 'object')
      for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`)
  }
  walk(mission.channels, 'channels')
  walk(mission.intro, 'intro')
  walk(mission.hints, 'hints')
  walk(mission.stuckMessage, 'stuckMessage')
  return out
}

function gameItemsOf(mission: AuditMission): AuditGameItem[] {
  return (mission.channels.game as { items: AuditGameItem[] }).items
}

/**
 * ข้อตรวจของ m2 ถูกเปลี่ยนเป็น "ประกอบชิ้นส่วนชื่อเว็บเอง" (UX-2) โดยใช้ชิ้นส่วนชุดเดียวกับมินิเกม
 * ผลข้างเคียงคือบทเรียนของ m2 ที่เคยยกชื่อร้านชุดเดียวกันเป็นตัวอย่าง กลายเป็นบอกคำตอบไปด้วย
 * ผู้เรียนที่เปิดแผ่นความรู้ก่อนตอบจะลอกได้เลยโดยไม่ต้องรู้ว่าชิ้นไหนคือโฮสต์ ชื่อโดเมน นามสกุล
 * ซึ่งทำให้ข้อนี้เลิกวัดจุดประสงค์ของตัวเอง (แยกส่วนประกอบของชื่อเว็บได้ถูกต้อง)
 *
 * ทางแก้คือย้ายตัวอย่างในบทเรียนไปใช้ร้านอื่น แล้วให้ข้อตรวจเป็นการเอาหลักไปใช้กับร้านใหม่
 * ข้อตรวจแบบตัวเลือกเดิมออกแบบแบบนี้อยู่แล้ว (บทเรียนยก kanomwan · ข้อตรวจถาม fastfix)
 *
 * ⚠️ เทสต์นี้ดูภายในภารกิจเดียวกันเท่านั้น **ข้ามภารกิจยังมีช่องเหลืออยู่จริง**
 *    m1 เล่าเรื่องร้านขนมหวานและยกชื่อเว็บของร้านนั้นเต็ม ๆ ซึ่งเป็นชื่อเดียวกับที่ m2 ให้ประกอบ
 *    ปิดช่องนั้นสนิทต้องเปลี่ยนชิ้นส่วนของข้อตรวจ m2 ไปเป็นร้านที่บทเรียนไม่เคยประกอบให้ดู
 *    เป็นการเปลี่ยนตัวข้อสอบ ไม่ใช่การเปลี่ยนข้อความ จึงรอเจ้าของสื่อตัดสิน (T81 · result-t81.md)
 */
describe('บทเรียนของภารกิจต้องไม่บอกคำตอบของข้อตรวจภารกิจเดียวกัน', () => {
  it('ข้อตรวจแบบประกอบชิ้นส่วน บทเรียนของภารกิจนั้นต้องไม่มีชื่อที่ประกอบเสร็จแล้ว', () => {
    const builds = auditAnswers.filter((a) => a.gameKey?.kind === 'build')
    // ถ้าวันหนึ่งไม่มีข้อแบบประกอบเลย ให้รู้ตัว ไม่ใช่ผ่านเพราะไม่มีอะไรให้ตรวจ
    expect(builds.length).toBeGreaterThan(0)
    const bare = (s: string) => s.replace(/\s/g, '')
    const hits: string[] = []
    for (const answer of builds) {
      const mission = auditMissions.find((m) => m.id === answer.id)
      expect(mission).toBeDefined()
      const items = gameItemsOf(mission!)
      const assembled = (answer.gameKey?.placements ?? [])
        .map((p) => items.find((i) => i.id === p.piece)?.text ?? '')
        .join('')
      expect(assembled.length).toBeGreaterThan(0)
      for (const [path, text] of learnTextsOf(mission!)) {
        if (path.startsWith('channels.game')) continue
        if (bare(text).includes(bare(assembled))) hits.push(`${answer.id} ${path}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('ชิ้นส่วนที่เป็นชื่อร้านของข้อตรวจ ต้องโผล่ได้แค่ในกองชิ้นส่วน', () => {
    // เฉพาะชิ้นที่เป็นชื่อร้านล้วน ๆ (ไม่มีจุด) เพราะ www. กับ .com บทเรียนต้องพูดถึงได้ตามปกติ
    const SHOP_PIECE = /^[a-z]{4,}$/
    const hits: string[] = []
    for (const answer of auditAnswers.filter((a) => a.gameKey?.kind === 'build')) {
      const mission = auditMissions.find((m) => m.id === answer.id)!
      const items = gameItemsOf(mission)
      const shopPieces = (answer.gameKey?.placements ?? [])
        .map((p) => items.find((i) => i.id === p.piece)?.text ?? '')
        .filter((t) => SHOP_PIECE.test(t))
      expect(shopPieces.length).toBeGreaterThan(0)
      for (const [path, text] of learnTextsOf(mission)) {
        if (path.startsWith('channels.game')) continue
        for (const piece of shopPieces) if (text.includes(piece)) hits.push(`${answer.id} ${path}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('ข้อตรวจแบบตัวเลือกของ m2 ยังถูกเก็บไว้ครบ พร้อมเครื่องหมายบอกว่าตอนนี้ไม่ได้ใช้', () => {
    // เก็บไว้เพราะครูอาจอยากกลับไปใช้แบบตัวเลือก และเพราะไฟล์เฉลยบังคับว่าตัวเลือกที่ยังไม่ถูก
    // ทุกตัวต้องมีข้อความเฉพาะของมัน ลบ choiceFeedback แล้วไฟล์จะพังตั้งแต่โหลด
    const UnusedMark = z.object({ _unusedNote: z.string().min(40) })
    const m2 = auditMissions.find((m) => m.id === 'm2')!
    const note = UnusedMark.parse(m2.check)._unusedNote
    expect(note).toContain('ประกอบชิ้นส่วน')
    expect((m2.check.choices as string[]).length).toBe(4)
    expect(typeof m2.check.question).toBe('string')

    const answer = auditAnswers.find((a) => a.id === 'm2')!
    UnusedMark.parse(answer)
    expect(answer.choiceFeedback).toHaveLength(3)
  })

  it('มินิเกมประกอบของ m2 มี 3 ช่อง 9 ชิ้น และเฉลยอ้างถึงชิ้นที่มีจริงทุกตัว', () => {
    const m2 = auditMissions.find((m) => m.id === 'm2')!
    const items = gameItemsOf(m2)
    expect(items.filter((i) => i.type === 'slot')).toHaveLength(3)
    expect(items.filter((i) => i.type === 'piece')).toHaveLength(9)
    const ids = new Set(items.map((i) => i.id))
    const key = auditAnswers.find((a) => a.id === 'm2')!.gameKey!
    for (const p of key.placements ?? []) {
      expect(ids.has(p.slot)).toBe(true)
      expect(ids.has(p.piece)).toBe(true)
    }
    for (const d of key.distractors ?? []) expect(ids.has(d)).toBe(true)
    // ชิ้นที่ถูก 3 + ชิ้นหลอก 6 = กอง 9 ชิ้นพอดี ไม่มีชิ้นไหนกำพร้าอยู่บนจอแบบไม่มีใครตัดสิน
    expect((key.placements?.length ?? 0) + (key.distractors?.length ?? 0)).toBe(items.filter((i) => i.type === 'piece').length)
  })
})

describe('เนื้อหาเส้นทางเรียน (learn-*) ต้องครบและตรงกับไฟล์เฉลย', () => {
  it('เส้นทางเรียน 4 ด่าน มีเฉลยครบทุกด่านและรหัสตรงกัน', () => {
    expect(learnPathsJson.paths).toHaveLength(4)
    expect(learnPathsAnswersJson.paths.map((p) => p.missionId)).toEqual(
      learnPathsJson.paths.map((p) => (p as { missionId: string }).missionId),
    )
  })

  it('m3/m4 เป็น single-mode do และยังคงเกณฑ์เกมเดิม', () => {
    for (const id of ['m3', 'm4']) {
      const path = learnPathsJson.paths.find((p) => p.missionId === id) as { modes?: string[]; do?: { kind?: string } }
      expect(path.modes).toEqual(['do'])
      expect(path.do?.kind).toBe(id === 'm3' ? 'counter' : 'registrar')
    }
    expect(JSON.stringify(learnPathsJson.paths.find((p) => p.missionId === 'm3')?.warmup)).toContain('m3-w1')
    expect(JSON.stringify(learnPathsJson.paths.find((p) => p.missionId === 'm4')?.warmup)).toContain('m4-w1')
  })

  it('m1-wq1 ย้อนดูฉาก 3 ที่พูดถึงชื่อเว็บ (สเปก OBJ01 ดูวิดีโอ)', () => {
    const m1 = learnPathsJson.paths.find((path) => path.missionId === 'm1')!
    const question = m1.watch.questions.find((item) => item.id === 'm1-wq1') as unknown as {
      review: { from: number; to: number }
    }
    expect(question.review).toEqual({ from: 3, to: 3 })
  })

  it('เกมเคาน์เตอร์ด่าน 3 มีคลังลูกค้าอย่างน้อย 18 คน (สุ่ม 2 คนต่อกะ) และเฉลยรหัสตรงกัน', () => {
    expect(learnCounterJson.cases.length).toBeGreaterThanOrEqual(18)
    expect(learnCounterJson.shiftSize).toBe(2)
    expect(learnCounterAnswersJson.cases.map((c) => c.caseId)).toEqual(
      learnCounterJson.cases.map((c) => c.id),
    )
  })

  it('เกมทะเบียนด่าน 4 มี 10 ขั้น และเฉลยลำดับครบ 10 ขั้นไม่ซ้ำ', () => {
    expect(learnRegistrarJson.steps).toHaveLength(10)
    expect(learnRegistrarAnswersJson.order).toHaveLength(10)
    expect(new Set(learnRegistrarAnswersJson.order).size).toBe(10)
    expect(learnRegistrarJson.events).toHaveLength(4)
  })
})
