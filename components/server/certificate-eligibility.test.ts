import { describe, expect, it } from 'vitest'
import type { Submission } from '@/lib/db/repo'
import { certificateStandingOf, ceoScoreOf } from './certificate-eligibility'

function ceo(over: Partial<Submission> = {}): Submission {
  return {
    emphasis_criterion: 'bm-r1',
    teacher_confirmed_scores: null,
    ai_scores: {
      gradingStatus: 'pending-ai',
      ruleScores: { weightedTotal: 11, weightedMax: 15 },
      weightedTotal: 11,
      weightedMax: 15,
      aiProposed: null,
    },
    ...over,
  } as unknown as Submission
}

describe('เกียรติบัตรออกทันทีไม่ต้องรอครู (มติเจ้าของ 2 พ.ย.)', () => {
  it('ส่งใบเสนอ + ภารกิจครบ = ได้ใบทันที ครูยังไม่ยืนยันก็ได้', () => {
    const s = certificateStandingOf([ceo()], { missionsDone: true })
    expect(s.status).toBe('pending-teacher')
    expect(s.eligible).toBe(true)
    expect(s.nextHref).toBe('/api/certificate')
    expect(s.score).toMatchObject({ source: 'rules', weightedTotal: 11, grading: true })
  })

  it('ภารกิจย่อยยังไม่ครบ = ยังไม่ได้ใบ แต่บอกทางไปต่อ', () => {
    const s = certificateStandingOf([ceo()], { missionsDone: false })
    expect(s.eligible).toBe(false)
    expect(s.nextHref).toBe('/map')
  })

  it('ยังไม่ส่งใบเสนอ = ยังไม่ได้ใบ', () => {
    expect(certificateStandingOf([], { missionsDone: true }).eligible).toBe(false)
  })

  it('คะแนนที่โชว์: ครู > AI ที่ตรวจเสร็จ > กฎ', () => {
    const ai = ceo({
      ai_scores: {
        gradingStatus: 'done',
        ruleScores: { weightedTotal: 11, weightedMax: 15 },
        aiProposed: { weightedTotal: 13, weightedMax: 15 },
      },
    } as Partial<Submission>)
    expect(ceoScoreOf(ai)).toMatchObject({ source: 'ai', weightedTotal: 13, grading: false })
    const teacher = { ...ai, teacher_confirmed_scores: { weightedTotal: 14, weightedMax: 15 } } as Submission
    expect(ceoScoreOf(teacher)).toMatchObject({ source: 'teacher', weightedTotal: 14, percent: 93 })
    // ครูให้ไม่ถึงระดับ 3 ก็ไม่ดึงใบคืน
    expect(certificateStandingOf([teacher], { missionsDone: true }).eligible).toBe(true)
  })
})
