import { describe, expect, it } from 'vitest'
import { calibrationFlag } from './personalize'
import {
  JUDGEMENT_WORDS,
  SELF_ASSESS_DIMENSION_IDS,
  SELF_SCORE_MAX,
  SELF_SCORE_MIN,
  calibrationRecordsFrom,
  calibrationSummary,
  compareThreeSources,
  levelLabelOf,
  normalizeSelfScores,
  selfAssessForm,
} from './self-assess'

const [d1, d2, d3, d4] = SELF_ASSESS_DIMENSION_IDS as [string, string, string, string]

function scores(a: number, b: number, c: number, d: number): Record<string, number> {
  return { [d1]: a, [d2]: b, [d3]: c, [d4]: d }
}

/** ทุกข้อความที่ผู้เรียนเห็นจากตารางนี้ */
function learnerTexts(table: ReturnType<typeof compareThreeSources>): string[] {
  return [table.headline, table.summary, ...table.rows.map((r) => r.note), ...table.talkingPoints]
}

describe('แบบให้คะแนนตัวเองรายด้าน', () => {
  it('อ่านด้านและระดับจากไฟล์เนื้อหาจริง ไม่ได้ฝังไว้ในโค้ด', () => {
    const form = selfAssessForm()
    expect(form.dimensions).toHaveLength(SELF_ASSESS_DIMENSION_IDS.length)
    for (const dimension of form.dimensions) {
      expect(dimension.name.length).toBeGreaterThan(0)
      expect(dimension.question.length).toBeGreaterThan(0)
      // ทุกระดับต้องมีคำบรรยาย ผู้เรียนจะได้เทียบกับงานตัวเองได้ ไม่ใช่เดาจากตัวเลข
      for (const level of dimension.levels) expect(level.descriptor.length).toBeGreaterThan(10)
    }
  })

  it('ระดับเรียงจากน้อยไปมาก และช่วงคะแนนมาจากไฟล์เนื้อหา', () => {
    const form = selfAssessForm()
    for (const dimension of form.dimensions) {
      const values = dimension.levels.map((l) => l.score)
      expect(values).toEqual([...values].sort((a, b) => a - b))
    }
    expect(form.min).toBe(SELF_SCORE_MIN)
    expect(form.max).toBe(SELF_SCORE_MAX)
    expect(form.max).toBeGreaterThan(form.min)
  })

  it('คำชี้แจงบอกชัดว่าคะแนนนี้ไม่ได้เอาไปรวมกับคะแนนครู', () => {
    const form = selfAssessForm()
    expect(form.prompt.length).toBeGreaterThan(0)
    expect(form.helper).toContain('ครู')
  })
})

describe('ตรวจคะแนนที่ผู้เรียนให้ตัวเอง', () => {
  it('ครบทุกด้านและอยู่ในช่วง = ผ่าน', () => {
    const out = normalizeSelfScores(scores(3, 2, 1, 2))
    expect(out.ok).toBe(true)
    if (out.ok) expect(Object.keys(out.scores)).toHaveLength(SELF_ASSESS_DIMENSION_IDS.length)
  })

  it('ขาดด้านไหนต้องบอกชื่อด้านนั้น ไม่ใช่ปฏิเสธเฉย ๆ', () => {
    const out = normalizeSelfScores({ [d1]: 3, [d2]: 2 })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.message).toContain('ยังไม่ได้ให้คะแนนด้าน')
  })

  it('คะแนนนอกช่วงหรือไม่ใช่จำนวนเต็ม ไม่รับ', () => {
    expect(normalizeSelfScores(scores(4, 2, 1, 2)).ok).toBe(false)
    expect(normalizeSelfScores(scores(0, 2, 1, 2)).ok).toBe(false)
    expect(normalizeSelfScores(scores(2.5, 2, 1, 2)).ok).toBe(false)
  })

  it('ส่งด้านที่ไม่รู้จักมา ไม่รับ', () => {
    expect(normalizeSelfScores({ ...scores(3, 3, 3, 3), 'dim-ไม่มีจริง': 2 }).ok).toBe(false)
  })

  it('ส่งของที่ไม่ใช่ออบเจกต์มา ไม่พัง', () => {
    for (const bad of [null, undefined, 'สาม', [1, 2, 3]]) {
      expect(normalizeSelfScores(bad).ok).toBe(false)
    }
  })
})

describe('ตารางเทียบ 3 แหล่ง', () => {
  const system = scores(2, 2, 2, 2)

  it('เคสให้ตัวเองสูงกว่าครู — ชวนอ่านเกณฑ์อีกรอบแล้วคุยกับครู ไม่ตัดสิน', () => {
    const table = compareThreeSources({
      self: scores(3, 3, 3, 3),
      system,
      teacher: scores(2, 2, 2, 2),
      teacherConfirmed: true,
      teacherNote: 'ครูชอบเหตุผลข้อสองมากนะ',
    })

    expect(table.status).toBe('ready')
    expect(table.rows.every((r) => r.verdict === 'self-higher')).toBe(true)
    expect(table.rows.every((r) => r.gap === 1)).toBe(true)
    expect(table.talkingPoints).toHaveLength(4)
    expect(table.rows[0]!.note).toContain('ชวนครูคุย')
    expect(table.teacherNote).toBe('ครูชอบเหตุผลข้อสองมากนะ')
  })

  it('เคสให้ตัวเองต่ำกว่าครู — บอกว่าครูเห็นข้อดีที่อาจมองข้าม', () => {
    const table = compareThreeSources({
      self: scores(1, 1, 1, 1),
      system,
      teacher: scores(3, 3, 3, 3),
      teacherConfirmed: true,
    })

    expect(table.rows.every((r) => r.verdict === 'self-lower')).toBe(true)
    expect(table.rows.every((r) => r.gap === -2)).toBe(true)
    expect(table.rows[0]!.note).toContain('ข้อดี')
    expect(table.sameCount).toBe(0)
  })

  it('เคสตรงกัน — ชมว่ามองงานตัวเองได้ตรงกับเกณฑ์', () => {
    const table = compareThreeSources({
      self: scores(2, 3, 1, 2),
      system,
      teacher: scores(2, 3, 1, 2),
      teacherConfirmed: true,
    })

    expect(table.rows.every((r) => r.verdict === 'same')).toBe(true)
    expect(table.sameCount).toBe(4)
    expect(table.comparableCount).toBe(4)
    expect(table.talkingPoints).toHaveLength(0)
    expect(table.summary).toContain('ตรง')
  })

  it('ทั้ง 3 เคส ไม่มีคำตัดสินแม้แต่คำเดียว', () => {
    const cases = [
      compareThreeSources({ self: scores(3, 3, 3, 3), system, teacher: scores(1, 1, 1, 1), teacherConfirmed: true }),
      compareThreeSources({ self: scores(1, 1, 1, 1), system, teacher: scores(3, 3, 3, 3), teacherConfirmed: true }),
      compareThreeSources({ self: scores(2, 2, 2, 2), system, teacher: scores(2, 2, 2, 2), teacherConfirmed: true }),
      compareThreeSources({ self: scores(2, 2, 2, 2), system }),
      compareThreeSources({}),
    ]

    for (const table of cases) {
      for (const text of learnerTexts(table)) {
        for (const word of JUDGEMENT_WORDS) {
          expect(text).not.toContain(word)
        }
      }
    }
  })

  it('ทุกเคสต้องมีข้อความให้อ่านเสมอ ไม่มีช่องว่าง', () => {
    const table = compareThreeSources({ self: scores(3, 2, 2, 1), system, teacherConfirmed: false })
    expect(table.status).toBe('waiting-teacher')
    for (const text of learnerTexts(table)) expect(text.trim().length).toBeGreaterThan(0)
    // ยังไม่ยืนยันก็ยังไม่มีคอลัมน์ครู และยังไม่ชวนเทียบ
    expect(table.rows.every((r) => r.teacher === null)).toBe(true)
    expect(table.talkingPoints).toHaveLength(0)
  })

  it('ครูยังไม่ยืนยัน ห้ามเอาคะแนนครูมาโชว์แม้จะมีค่าส่งมาแล้ว', () => {
    const table = compareThreeSources({
      self: scores(3, 3, 3, 3),
      teacher: scores(1, 1, 1, 1),
      teacherConfirmed: false,
    })
    expect(table.rows.every((r) => r.teacher === null)).toBe(true)
    expect(table.status).toBe('waiting-teacher')
  })

  it('ยังไม่ได้ให้คะแนนตัวเอง = ชวนให้เริ่มก่อน', () => {
    const table = compareThreeSources({ system, teacher: scores(2, 2, 2, 2), teacherConfirmed: true })
    expect(table.status).toBe('no-self')
    expect(table.rows.every((r) => r.verdict === 'not-comparable')).toBe(true)
  })

  it('คอลัมน์ระบบยังขึ้นได้แม้ครูยังไม่ยืนยัน และป้ายระดับตรงกับไฟล์เนื้อหา', () => {
    const table = compareThreeSources({ self: scores(1, 1, 1, 1), system, teacherConfirmed: false })
    expect(table.rows[0]!.system).toBe(2)
    expect(table.rows[0]!.systemLabel).toBe(levelLabelOf(d1, 2))
    expect(table.rows[0]!.systemLabel.length).toBeGreaterThan(0)
  })
})

describe('ธงการรู้ตัวรวมให้ครู', () => {
  it('มั่นใจสูงแต่ยังไม่ถูก = ควรคุย · มั่นใจต่ำแต่ถูก = ควรชม · ตรงกันไม่ต้องรบกวนครู', () => {
    const summary = calibrationSummary(
      [
        { objectiveId: 'obj-1', label: 'ชื่อเว็บ', confidence: 3, correct: false },
        { objectiveId: 'obj-2', label: 'นามสกุล', confidence: 1, correct: true },
        { objectiveId: 'obj-3', label: 'สิทธิ์จด', confidence: 2, correct: true },
      ],
      calibrationFlag,
    )

    expect(summary.recordCount).toBe(3)
    expect(summary.shouldTalkCount).toBe(1)
    expect(summary.shouldPraiseCount).toBe(1)
    expect(summary.entries).toHaveLength(2)
    expect(summary.entries[0]!.flag).toBe('ควรคุย')
    expect(summary.entries[0]!.coachPromptId.length).toBeGreaterThan(0)
    expect(summary.teacherSummary).toContain('ควรคุย 1')
  })

  it('ไม่มีธงเลย = ข้อความสรุปว่าง ไม่ต้องขึ้นอะไรบนแผงครู', () => {
    const summary = calibrationSummary(
      [{ objectiveId: 'obj-1', confidence: 2, correct: true }],
      calibrationFlag,
    )
    expect(summary.entries).toHaveLength(0)
    expect(summary.teacherSummary).toBe('')
  })

  it('ข้อมูลไม่ครบ ไม่นับเป็นสถิติ ไม่ใช่นับเป็นศูนย์', () => {
    const summary = calibrationSummary(
      [
        { objectiveId: 'obj-1', confidence: Number.NaN, correct: false },
        { objectiveId: 'obj-2', confidence: 3, correct: undefined as unknown as boolean },
      ],
      calibrationFlag,
    )
    expect(summary.recordCount).toBe(0)
    expect(summary.entries).toHaveLength(0)
  })

  it('แปลงจากสองก้อนใน profiles โดยเอาเฉพาะจุดประสงค์ที่มีครบทั้งสองฝั่ง', () => {
    const records = calibrationRecordsFrom(
      { 'obj-2': 3, 'obj-1': 1, 'obj-9': 2 },
      { 'obj-2': false, 'obj-1': true },
      { 'obj-1': 'ชื่อเว็บ' },
    )
    expect(records.map((r) => r.objectiveId)).toEqual(['obj-1', 'obj-2'])
    expect(records[0]!.label).toBe('ชื่อเว็บ')

    const summary = calibrationSummary(records, calibrationFlag)
    expect(summary.shouldTalkCount).toBe(1)
    expect(summary.shouldPraiseCount).toBe(1)
  })

  it('ไม่มีข้อมูลเลยก็ไม่พัง', () => {
    expect(calibrationRecordsFrom(null, null)).toEqual([])
    expect(calibrationSummary([], calibrationFlag).recordCount).toBe(0)
  })
})
