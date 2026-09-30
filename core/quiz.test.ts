import { describe, expect, it } from 'vitest'
import {
  type QuizAnswers,
  type QuizSetName,
  getQuizSet,
  getQuizSetWithAnswers,
  gradeQuiz,
  isDomainTaken,
  quiz,
  suggestScaffoldLevel,
  takenDomains,
} from './quiz'

const sets: QuizSetName[] = ['pre', 'post']

/** จำนวนข้ออ่านจากไฟล์เนื้อหา ไม่ตรึงเลขไว้ในเทสต์ เพิ่มข้อสอบแล้วเทสต์ต้องไม่พังเอง */
const PRE_COUNT = quiz.pre.length
const POST_COUNT = quiz.post.length

/** คำตอบที่ถูกทุกข้อของชุดที่ระบุ */
function allCorrect(set: QuizSetName): QuizAnswers {
  return Object.fromEntries(getQuizSetWithAnswers(set).map((q) => [q.id, q.answerIndex]))
}

/** คำตอบที่ผิดทุกข้อ เลือกตัวเลือกอื่นที่ไม่ใช่เฉลย */
function allWrong(set: QuizSetName): QuizAnswers {
  return Object.fromEntries(
    getQuizSetWithAnswers(set).map((q) => [q.id, (q.answerIndex + 1) % 4]),
  )
}

describe('ไฟล์แบบทดสอบ', () => {
  it('มีข้อสอบครบ 10 ข้อทั้งสองชุดตามสเปกข้อ 11.8', () => {
    // สเปกข้อ 11.8 กำหนดปรนัย 4 ตัวเลือก 10 ข้อ และเลข 10 นี้คือ B ในสูตร E2 ของข้อ 9.3
    expect(quiz.pre).toHaveLength(10)
    expect(quiz.post).toHaveLength(10)
  })

  it('ชุดหลังเรียนเป็นแบบคู่ขนานของชุดก่อนเรียน วัดจุดประสงค์ตรงกันข้อต่อข้อ', () => {
    expect(POST_COUNT).toBe(PRE_COUNT)
    for (let i = 0; i < PRE_COUNT; i += 1) {
      expect([...quiz.post[i]!.objectiveIds].sort()).toEqual([...quiz.pre[i]!.objectiveIds].sort())
    }
  })

  it('ข้อสอบครอบคลุมจุดประสงค์ข้อ 1-5 ตามสเปกข้อ 11.8', () => {
    for (const set of sets) {
      const covered = new Set(quiz[set].flatMap((q) => q.objectiveIds))
      expect([...covered].sort()).toEqual(['obj-1', 'obj-2', 'obj-3', 'obj-4', 'obj-5'])
    }
  })

  it('การกระจายข้อต่อจุดประสงค์เท่ากันทั้งสองชุด', () => {
    const countByObjective = (set: QuizSetName) => {
      const counts: Record<string, number> = {}
      for (const q of quiz[set]) for (const id of q.objectiveIds) counts[id] = (counts[id] ?? 0) + 1
      return counts
    }
    expect(countByObjective('post')).toEqual(countByObjective('pre'))
  })

  it('ทุกข้อมี 4 ตัวเลือก และ answerIndex อยู่ในช่วง 0-3', () => {
    for (const set of sets) {
      for (const q of getQuizSetWithAnswers(set)) {
        expect(q.choices).toHaveLength(4)
        expect(q.answerIndex).toBeGreaterThanOrEqual(0)
        expect(q.answerIndex).toBeLessThanOrEqual(3)
      }
    }
  })

  it('รหัสข้อไม่ซ้ำกันทั้งสองชุดรวมกัน', () => {
    const ids = [...quiz.pre, ...quiz.post].map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ทุกข้อมีคำอธิบายเฉลยภาษาไทย', () => {
    for (const set of sets) {
      for (const q of getQuizSetWithAnswers(set)) {
        expect(q.explanation.length).toBeGreaterThan(10)
        expect(q.explanation).toMatch(/[ก-๙]/)
      }
    }
  })
})

describe('เฉลยต้องแยกออกจากโจทย์ ไม่หลุดไปฝั่งเบราว์เซอร์', () => {
  it('โจทย์ที่ส่งให้เบราว์เซอร์ไม่มี answerIndex และไม่มี explanation', () => {
    for (const set of sets) {
      for (const q of getQuizSet(set)) {
        expect(q).not.toHaveProperty('answerIndex')
        expect(q).not.toHaveProperty('explanation')
        expect(Object.keys(q).sort()).toEqual(['choices', 'id', 'objectiveIds', 'question'])
      }
    }
  })

  it('ชุดฝั่งเซิร์ฟเวอร์ต่อเฉลยเข้ากับโจทย์ได้ครบทุกข้อ', () => {
    for (const set of sets) {
      const withAnswers = getQuizSetWithAnswers(set)
      expect(withAnswers).toHaveLength(getQuizSet(set).length)
      for (const q of withAnswers) {
        expect(typeof q.answerIndex).toBe('number')
        expect(q.explanation).toBeTruthy()
      }
    }
  })
})

describe('ตรวจคำตอบ', () => {
  it('ตอบถูกหมดได้คะแนนเต็ม และไม่มีข้อผิด', () => {
    for (const set of sets) {
      const r = gradeQuiz(allCorrect(set), set)
      expect(r.score).toBe(r.total)
      expect(r.total).toBe(quiz[set].length)
      expect(r.wrongIds).toEqual([])
    }
  })

  it('ตอบผิดหมดได้ศูนย์ และคืนรหัสข้อที่ผิดครบทุกข้อ', () => {
    const r = gradeQuiz(allWrong('pre'), 'pre')
    expect(r.score).toBe(0)
    expect(r.wrongIds).toEqual(quiz.pre.map((q) => q.id))
  })

  it('นับเฉพาะข้อที่ถูก และบอกรหัสข้อที่ตอบผิด', () => {
    const first = getQuizSetWithAnswers('pre')[0]!
    const answers: QuizAnswers = { ...allCorrect('pre'), [first.id]: (first.answerIndex + 2) % 4 }
    const r = gradeQuiz(answers, 'pre')
    expect(r.score).toBe(PRE_COUNT - 1)
    expect(r.wrongIds).toEqual([first.id])
  })

  it('ข้อที่ไม่ได้ตอบนับเป็นผิด', () => {
    const r = gradeQuiz({}, 'post')
    expect(r.score).toBe(0)
    expect(r.wrongIds).toHaveLength(POST_COUNT)
  })

  it('คำตอบที่มาเป็น string จากฟอร์ม HTML ยังนับถูกต้อง', () => {
    const answers: QuizAnswers = Object.fromEntries(
      getQuizSetWithAnswers('pre').map((q) => [q.id, String(q.answerIndex)]),
    )
    const r = gradeQuiz(answers, 'pre')
    expect(r.score).toBe(PRE_COUNT)
    expect(r.wrongIds).toEqual([])
  })

  it('ค่าที่อ่านไม่ได้ ค่าว่าง และ null นับเป็นผิด ไม่ใช่นับเป็นข้อ 0', () => {
    const [q1, q2, q3] = getQuizSetWithAnswers('post')
    const answers: QuizAnswers = {
      [q1!.id]: 'ตอบมั่ว',
      [q2!.id]: '',
      [q3!.id]: null,
    }
    const r = gradeQuiz(answers, 'post')
    expect(r.wrongIds).toContain(q1!.id)
    expect(r.wrongIds).toContain(q2!.id)
    expect(r.wrongIds).toContain(q3!.id)
  })
})

describe('ระดับตัวช่วยจากคะแนนก่อนเรียน', () => {
  it('คะแนนน้อยได้ระดับ 1 ตัวช่วยเยอะที่สุด', () => {
    expect(suggestScaffoldLevel(0)).toBe(1)
    expect(suggestScaffoldLevel(1)).toBe(1)
  })

  it('คะแนนกลางได้ระดับ 2', () => {
    // ครึ่งหนึ่งขึ้นไปแต่ยังไม่เต็ม = ระดับ 2 คิดจากจำนวนข้อจริงในไฟล์เนื้อหา
    expect(suggestScaffoldLevel(Math.ceil(PRE_COUNT / 2))).toBe(2)
    expect(suggestScaffoldLevel(PRE_COUNT - 1)).toBe(2)
  })

  it('คะแนนเต็มได้ระดับ 3 ไม่มีตัวช่วย', () => {
    expect(suggestScaffoldLevel(PRE_COUNT)).toBe(3)
  })

  it('คะแนนที่อ่านไม่ได้หรือติดลบ ต้องได้ระดับ 1 ไม่ใช่โหมดยากสุด', () => {
    expect(suggestScaffoldLevel(Number.NaN)).toBe(1)
    expect(suggestScaffoldLevel(-1)).toBe(1)
    expect(suggestScaffoldLevel(Number.NEGATIVE_INFINITY)).toBe(1)
  })

  it('คะแนนเกินคะแนนเต็มถูกบีบลงมาเป็นเต็ม', () => {
    expect(suggestScaffoldLevel(99)).toBe(3)
    expect(suggestScaffoldLevel(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe('ชื่อโดเมนที่ถูกจองแล้ว', () => {
  it('มีรายชื่อพอสำหรับให้นักเรียนชนของจริง', () => {
    expect(takenDomains.length).toBeGreaterThanOrEqual(30)
    expect(new Set(takenDomains).size).toBe(takenDomains.length)
  })

  it('ชื่อยอดนิยมที่นักเรียนมักพิมพ์ถูกจองไปแล้ว', () => {
    expect(isDomainTaken('cakeshop')).toBe(true)
    expect(isDomainTaken('coffee')).toBe(true)
    expect(isDomainTaken('mystore')).toBe(true)
  })

  it('ชื่อทับศัพท์ไทยและชื่ออักษรไทยก็ถูกจองแล้วเหมือนกัน', () => {
    expect(isDomainTaken('ranmuk')).toBe(true)
    expect(isDomainTaken('somtam')).toBe(true)
    expect(isDomainTaken('ร้านขนม')).toBe(true)
    expect(isDomainTaken('กาแฟ')).toBe(true)
  })

  it('ชื่อที่ไม่ซ้ำใครยังจดได้', () => {
    expect(isDomainTaken('nidscakeshop2569')).toBe(false)
  })

  it('เทียบโดยไม่สนตัวพิมพ์ใหญ่เล็กและช่องว่างหัวท้าย', () => {
    expect(isDomainTaken('CakeShop')).toBe(true)
    expect(isDomainTaken('  COFFEE  ')).toBe(true)
  })

  it('ชื่อว่างหรือช่องว่างล้วนถือว่าใช้ไม่ได้', () => {
    expect(isDomainTaken('')).toBe(true)
    expect(isDomainTaken('   ')).toBe(true)
  })
})
