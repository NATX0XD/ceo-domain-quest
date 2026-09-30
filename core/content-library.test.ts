import { describe, expect, it } from 'vitest'
import bonusJson from '../content/bonus-missions.json' with { type: 'json' }
import missionTasksJson from '../content/mission-tasks.json' with { type: 'json' }
import {
  BONUS_COUNTS_STARS,
  altItemReady,
  bonusMissions,
  checkReservedName,
  clipScenes,
  findBonusMission,
  findMissionTask,
  incompleteAltItemIds,
  mentorCard,
  miniLessonForObjective,
  miniLessons,
  misconceptions,
  misconceptionsForObjective,
  missionTaskGroups,
  missionTasks,
  objectiveKeywords,
  objectivesMentioned,
  reservedGroups,
  reservedListGaps,
  tasksForMission,
} from './content-library'
import missionsJson from '../content/missions.json' with { type: 'json' }
import {
  bonusAnswers,
  derivedChoiceFeedback,
  findBonusAnswer,
  findMissionAnswer,
  gradeMissionCheck,
  findTaskAnswer,
  gradeAspects,
  gradeChoice,
  gradeMultiChoice,
  missionAnswers,
  missionChoiceFeedback,
  taskAnswers,
} from './content-library-answers'

describe('จำนวนตรงกับสเปกหัวข้อ 11 และอ่านจากไฟล์เนื้อหา ไม่ตรึงในโค้ด', () => {
  it('11.3 ภารกิจ 4 ชุด โจทย์ 13 ข้อ บทคลิป 21 ฉาก การ์ดพี่เลี้ยง 4 ชุด', () => {
    expect(missionTaskGroups).toHaveLength(missionTasksJson.meta.missionCount)
    expect(missionTasks).toHaveLength(missionTasksJson.meta.taskCount)
    expect(missionTaskGroups.reduce((n, m) => n + m.clip.scenes.length, 0)).toBe(
      missionTasksJson.meta.clipSceneCount,
    )
    expect(missionTaskGroups.filter((m) => m.mentorCard).length).toBe(
      missionTasksJson.meta.mentorCardCount,
    )
    // ตัวเลขในสเปก: M1 มี 3 ข้อ · M2 มี 4 ข้อ · M3 มี 3 ข้อ · M4 มี 3 ข้อ
    expect(missionTaskGroups.map((m) => m.tasks.length)).toEqual([3, 4, 3, 3])
    expect(missionTaskGroups.map((m) => m.clip.scenes.length)).toEqual([5, 6, 5, 5])
  })

  it('ทุกภารกิจมีโจทย์ทั้งระดับพื้นฐานและระดับท้าทาย ตามที่ E-03 ต้องใช้', () => {
    for (const group of missionTaskGroups) {
      expect(tasksForMission(group.id, 'basic').length).toBeGreaterThan(0)
      expect(tasksForMission(group.id, 'challenge').length).toBeGreaterThan(0)
    }
    expect(tasksForMission('ไม่มีภารกิจนี้')).toEqual([])
  })

  it('ทุกข้อมีคำใบ้อย่างน้อย 2 ขั้น ตามสเปกหัวข้อ 11.3', () => {
    for (const task of missionTasks) {
      expect(task.hints.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('11.7 ภารกิจเสริม 3 ชุด ชุดละ 2 ข้อ และไม่นับดาว', () => {
    expect(bonusMissions).toHaveLength(bonusJson.meta.missionCount)
    for (const mission of bonusMissions) {
      expect(mission.items).toHaveLength(bonusJson.meta.itemsPerMission)
    }
    expect(BONUS_COUNTS_STARS).toBe(false)
    expect(findBonusMission('x2')?.title).toBe('ชื่อเว็บภาษาไทย')
    expect(findBonusMission('ไม่มี')).toBeUndefined()
  })

  it('11.12 คำถามโค้ชตามความเข้าใจผิด 9 ข้อ และบทสอนเสริม 4 เรื่อง เรื่องละ 3 นาที', () => {
    expect(misconceptions).toHaveLength(9)
    expect(miniLessons).toHaveLength(4)
    for (const lesson of miniLessons) expect(lesson.minutes).toHaveLength(3)
    expect(misconceptionsForObjective('obj-2')).toHaveLength(3)
    expect(miniLessonForObjective('obj-1')?.missionId).toBe('m1')
    expect(miniLessonForObjective('obj-9')).toBeUndefined()
  })

  it('11.5 คำสำคัญสำรองครบ 4 ประเด็น ผูกกับจุดประสงค์ข้อ 1 ถึง 4', () => {
    expect(objectiveKeywords).toHaveLength(4)
    expect(objectiveKeywords.map((o) => o.objectiveId)).toEqual(['obj-1', 'obj-2', 'obj-3', 'obj-4'])
  })

  it('11.13 รายชื่อที่สงวนไว้ 4 กลุ่ม', () => {
    expect(reservedGroups).toHaveLength(4)
    expect(reservedGroups.map((g) => g.matchMode)).toEqual(['exact', 'exact', 'exact', 'contains'])
  })
})

describe('11.13 การเทียบรายชื่อที่สงวนไว้', () => {
  it('กลุ่มที่เทียบตรงทั้งคำ ต้องไม่กันชื่อสุจริตที่มีคำสงวนอยู่ข้างใน', () => {
    // bank อยู่ในรายการคำสงวน แต่ bankhanomyai เป็นชื่อร้านจริงของผู้เรียน
    expect(checkReservedName('bank').reserved).toBe(true)
    expect(checkReservedName('bankhanomyai').reserved).toBe(false)
    expect(checkReservedName('www').reserved).toBe(true)
    expect(checkReservedName('wwwshop').reserved).toBe(false)
  })

  it('ชนแล้วต้องคืนข้อความจากไฟล์เนื้อหา ไม่ใช่ข้อความที่เขียนในโค้ด', () => {
    const hit = checkReservedName('vec')
    expect(hit.reserved).toBe(true)
    expect(hit.groupId).toBe('grp-exercise')
    const group = reservedGroups.find((g) => g.id === 'grp-exercise')!
    expect(hit.message).toBe(group.message)
    expect(hit.matchedTerm).toBe('vec')
  })

  it('ตัวพิมพ์ใหญ่และช่องว่างหัวท้ายไม่ทำให้หลุดการตรวจ', () => {
    expect(checkReservedName('  VEC  ').reserved).toBe(true)
  })

  it('ชื่อว่างหรือชื่อที่ไม่ชนอะไร คืนผลว่าใช้ได้', () => {
    expect(checkReservedName('').reserved).toBe(false)
    expect(checkReservedName('kanomyaisod').reserved).toBe(false)
    expect(checkReservedName('kanomyaisod').message).toBeNull()
  })

  it('กลุ่มที่ยังไม่มีรายการ ต้องรายงานว่ายังไม่มีอะไรให้ตรวจ ไม่ใช่ปล่อยให้เข้าใจว่ากรองผ่านแล้ว', () => {
    const gaps = reservedListGaps()
    const empty = gaps.find((g) => g.have === 0)
    expect(empty?.groupId).toBe('grp-inappropriate')
    expect(empty?.note).toContain('ห้ามเข้าใจว่ากรองทำงานแล้ว')
    // กลุ่มแบรนด์ดังสเปกขอ 100 ชื่อ ตอนนี้ยังไม่ครบ ต้องขึ้นในรายการที่ขาดด้วย
    const brand = gaps.find((g) => g.groupId === 'grp-brand')
    expect(brand?.want).toBe(100)
    expect(brand!.have).toBeLessThan(brand!.want!)
  })
})

describe('ข้อสำรองที่สเปกเขียนไม่ครบ ต้องไม่ถูกหยิบไปแสดง', () => {
  it('ข้อสำรองที่ไม่มีตัวเลือกเลย ถือว่ายังใช้ไม่ได้', () => {
    const ready = findMissionTask('m1-b1')!
    expect(altItemReady(ready)).toBe(true)
    const notReady = findMissionTask('m1-c1')!
    expect(altItemReady(notReady)).toBe(false)
    expect(incompleteAltItemIds()).toContain('m1-c1-alt')
  })

  it('ข้อที่สเปกไม่ได้กำหนดข้อสำรองไว้เลย ก็ต้องไม่พัง', () => {
    const noAlt = findMissionTask('m2-c2')!
    expect(noAlt.altItem).toBeNull()
    expect(altItemReady(noAlt)).toBe(false)
  })
})

describe('ตรวจคำตอบด้วยคำสำคัญ ใช้ตอน AI ใช้ไม่ได้', () => {
  it('บอกได้ว่าคำอธิบายพูดถึงจุดประสงค์ข้อไหนบ้าง', () => {
    expect(objectivesMentioned('ชื่อเว็บใช้แทนตัวเลข IP และมี DNS แปลงให้')).toContain('obj-1')
    expect(objectivesMentioned('อ่านจากขวาไปซ้าย ขวาสุดคือประเทศ')).toContain('obj-2')
    expect(objectivesMentioned('')).toEqual([])
    expect(objectivesMentioned('   ')).toEqual([])
  })

  it('ข้อเขียนของ M1 ตรวจได้ครบ 3 ประเด็น และใบ้เฉพาะประเด็นที่ขาด', () => {
    const answer = findTaskAnswer('m1-c1')
    const full = gradeAspects(answer, 'ชื่อเว็บใช้แทนตัวเลข IP ที่จำยาก ระบบ DNS แปลงให้ ลูกค้าจึงหาเจอ')
    expect(full.metIds).toEqual(['A', 'B', 'C'])
    expect(full.nextHint).toBeNull()

    const partial = gradeAspects(answer, 'ชื่อเว็บใช้แทนตัวเลข IP ที่จำยาก')
    expect(partial.metIds).toContain('A')
    expect(partial.missingIds).toContain('B')
    expect(partial.nextHint).toBe('ลองบอกว่าใครเปลี่ยนชื่อเป็นตัวเลขให้')

    const empty = gradeAspects(answer, '')
    expect(empty.metIds).toEqual([])
    expect(empty.missingIds).toEqual(['A', 'B', 'C'])
  })
})

describe('เฉลยจับคู่กับโจทย์ครบ และตรวจคำตอบได้', () => {
  it('โจทย์ทุกข้อมีเฉลย และเฉลยทุกข้อมีโจทย์', () => {
    for (const task of missionTasks) expect(findTaskAnswer(task.id)).toBeDefined()
    expect(taskAnswers.length).toBeGreaterThanOrEqual(missionTasks.length)
    for (const mission of bonusMissions) {
      for (const item of mission.items) expect(findBonusAnswer(item.id)).toBeDefined()
    }
    expect(bonusAnswers).toHaveLength(6)
  })

  it('เลือกตอบข้อเดียว ตอบผิดได้ข้อความเฉพาะตัวเลือกนั้น ตอบถูกได้คำอธิบาย', () => {
    const answer = findTaskAnswer('m1-b1')
    const right = gradeChoice(answer, 1)
    expect(right.correct).toBe(true)
    expect(right.explanation).toContain('DNS')

    const wrong = gradeChoice(answer, 0)
    expect(wrong.correct).toBe(false)
    expect(wrong.feedback).toBe('ชื่อเว็บไม่ได้ทำให้เน็ตเร็วขึ้นนะ ลองคิดว่าลูกค้าได้อะไร')
    expect(wrong.explanation).toBeNull()
  })

  it('เลือกหลายข้อ ต้องครบพอดี ขาดหรือเกินถือว่ายังไม่ถูก ลำดับที่กดไม่มีผล', () => {
    const answer = findTaskAnswer('m1-b2')
    expect(gradeMultiChoice(answer, [1, 3]).correct).toBe(true)
    expect(gradeMultiChoice(answer, [3, 1]).correct).toBe(true)
    expect(gradeMultiChoice(answer, [1]).correct).toBe(false)
    expect(gradeMultiChoice(answer, [1, 3, 4]).correct).toBe(false)
    expect(gradeMultiChoice(answer, [0, 1]).feedback).toBe(
      'ชื่อเว็บช่วยให้หาเจอ แต่การขายยังต้องมีสินค้าดีและการตลาดนะ',
    )
  })

  it('ข้อภารกิจเสริมตรวจได้ด้วยตัวตรวจเดียวกัน', () => {
    expect(gradeChoice(findBonusAnswer('x1-q1'), 1).correct).toBe(true)
    expect(gradeChoice(findBonusAnswer('x1-q1'), 2).feedback).toContain('promo-ok.com')
    expect(gradeMultiChoice(findBonusAnswer('x1-q2'), [1, 3]).correct).toBe(true)
    expect(gradeChoice(findBonusAnswer('x3-q2'), 1).correct).toBe(true)
  })

  it('ข้อที่ไม่มีเฉลยแบบเลือกตอบ ต้องไม่ตอบว่าถูกลอย ๆ', () => {
    expect(gradeChoice(findBonusAnswer('x2-q1'), 0).correct).toBe(false)
    expect(gradeChoice(undefined, 0).correct).toBe(false)
    expect(gradeMultiChoice(undefined, [0]).correct).toBe(false)
  })

  it('ตำแหน่งคำตอบที่ถูกไม่ได้อยู่ข้อแรกทุกข้อ ผู้เรียนจับทางไม่ได้', () => {
    const singles = [...taskAnswers, ...bonusAnswers]
      .filter((a) => typeof a.answerIndex === 'number')
      .map((a) => a.answerIndex as number)
    expect(singles.length).toBeGreaterThan(4)
    expect(new Set(singles).size).toBeGreaterThan(1)
  })
})

describe('ข้อความตอบกลับรายตัวเลือกของข้อตรวจภารกิจ (11.3 · S-19)', () => {
  for (const mission of missionsJson.missions) {
    it(`${mission.id} ตัวเลือกที่ยังไม่ถูกทุกตัวมีข้อความเฉพาะของมัน และไม่ซ้ำกันเอง`, () => {
      const answer = findMissionAnswer(mission.id)!
      expect(answer).toBeDefined()
      const texts: string[] = []
      for (let i = 0; i < mission.check.choices.length; i += 1) {
        const text = missionChoiceFeedback(mission.id, i)
        if (i === answer.answerIndex) {
          // ตอบถูกไม่ใช้ข้อความจากที่นี่ แต่มาจาก content/messages.json
          expect(text).toBeNull()
          continue
        }
        expect(text, `${mission.id} ตัวเลือกที่ ${i}`).toBeTruthy()
        texts.push(text!)
      }
      expect(new Set(texts).size).toBe(texts.length)
    })
  }

  /**
   * ทางเดียวที่ควรใช้ตรวจข้อเช็ก — รวมเฉลย คำอธิบาย เกณฑ์ดาว และข้อความรายตัวเลือกไว้ที่เดียว
   * เพื่อไม่ให้มีสองที่อ่านไฟล์เฉลยด้วยกติกาคนละชุด
   */
  describe('gradeMissionCheck ทางเดียวของการตรวจข้อเช็ก', () => {
    const mission = missionsJson.missions[0]!
    const answer = findMissionAnswer(mission.id)!

    it('ตอบถูกได้คำอธิบายกับเกณฑ์ดาว และไม่มีข้อความรายตัวเลือก', () => {
      const g = gradeMissionCheck(mission.id, mission.check.id, answer.answerIndex)
      expect(g.found).toBe(true)
      expect(g.correct).toBe(true)
      expect(g.explanation).toBe(answer.explanation)
      expect(g.starCriteria!.length).toBeGreaterThan(0)
      expect(g.choiceFeedback).toBeNull()
    })

    it('ตอบยังไม่ถูกได้ข้อความเฉพาะตัวเลือกนั้น และไม่หลุดเฉลยออกไป', () => {
      const wrong = answer.answerIndex === 0 ? 1 : 0
      const g = gradeMissionCheck(mission.id, mission.check.id, wrong)
      expect(g.correct).toBe(false)
      expect(g.explanation).toBeNull()
      expect(g.starCriteria).toBeNull()
      expect(g.choiceFeedback).toBe(missionChoiceFeedback(mission.id, wrong))
    })

    it('ข้อเช็กไม่ตรงกับเฉลย = ตรวจไม่ได้ ไม่ใช่ตัดสินว่าตอบผิด', () => {
      const g = gradeMissionCheck(mission.id, 'ข้อเช็กของเก่า', answer.answerIndex)
      expect(g.found).toBe(false)
      expect(g.correct).toBe(false)
      expect(gradeMissionCheck('ไม่มีภารกิจนี้', mission.check.id, 0).found).toBe(false)
    })
  })

  it('ไม่มีข้อความไหนใช้คำว่าผิดหรือพลาด ตามกติกาของสื่อ', () => {
    for (const answer of missionAnswers) {
      for (const f of answer.choiceFeedback) {
        expect(f.text, `${answer.id}[${f.index}]`).not.toMatch(/ผิด|พลาด|ล้มเหลว|ไม่เก่ง/)
      }
    }
  })

  it('ไม่มีสัญลักษณ์ตัวแปรหลุดไปหน้าจอ และไม่มีข้อความไหนเฉลยคำตอบ', () => {
    for (const mission of missionsJson.missions) {
      const answer = findMissionAnswer(mission.id)!
      const correct = mission.check.choices[answer.answerIndex]!
      for (const f of answer.choiceFeedback) {
        expect(f.text).not.toMatch(/[{}]/)
        expect(f.text).not.toContain(correct)
      }
    }
  })

  it('ความยาวพอดีสำหรับป๊อปอัปข้างตัวเลือก ไม่ใช่คำอธิบายเต็ม', () => {
    for (const answer of missionAnswers) {
      for (const f of answer.choiceFeedback) {
        expect(f.text.length).toBeGreaterThan(10)
        expect(f.text.length, `${answer.id}[${f.index}]`).toBeLessThanOrEqual(120)
      }
    }
  })

  it('แยกให้เห็นว่าข้อความไหนลอกจากสเปก ข้อความไหนถอดมาเอง เพื่อให้ครูอ่านทวนได้ถูกจุด', () => {
    const fromSpec = missionAnswers.flatMap((a) =>
      a.choiceFeedback.filter((f) => f.source === 'spec-11.3'),
    )
    expect(fromSpec).toHaveLength(5)
    expect(derivedChoiceFeedback()).toHaveLength(7)
    // ทุกข้อความต้องระบุที่มา ไม่มีตัวไหนไม่รู้ที่มา
    const total = missionAnswers.reduce((n, a) => n + a.choiceFeedback.length, 0)
    expect(fromSpec.length + derivedChoiceFeedback().length).toBe(total)
  })

  it('ภารกิจที่ไม่มีอยู่ หรือเลือกตัวเลือกที่ไม่มี ต้องคืน null ไม่ใช่พัง', () => {
    expect(missionChoiceFeedback('ไม่มีภารกิจนี้', 0)).toBeNull()
    expect(missionChoiceFeedback('m1', 99)).toBeNull()
  })
})

describe('บทคลิปและการ์ดพี่เลี้ยงอ่านได้รายภารกิจ', () => {
  it('คืนฉากตามลำดับ และคืนค่าว่างเมื่อไม่มีภารกิจนั้น', () => {
    expect(clipScenes('m2').map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6])
    expect(clipScenes('ไม่มี')).toEqual([])
    expect(mentorCard('m4')?.tips).toHaveLength(3)
    expect(mentorCard('ไม่มี')).toBeUndefined()
  })
})
