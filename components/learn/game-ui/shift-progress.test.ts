import { describe, expect, it } from 'vitest'
import { nextTut, skipTut, startTut, TUT_STEPS, type TutState } from './coach-steps'
import { START_PROGRESS, advanceProgress, afterCheck, restartCurrentCustomer, restoreProgress, startRetry, type ShiftProgress } from './shift-progress'

/** จำลอง PixelShift ที่ถูก remount ได้ทุกเมื่อ: state อยู่ใน store ของผู้เรียก */
function makeStore() {
  let saved: ShiftProgress | undefined
  return { get: () => saved, set: (p: ShiftProgress) => void (saved = p) }
}

describe('shift progress: ตอบผิดต้องอยู่ลูกค้าคนเดิม', () => {
  for (const total of [2, 4]) {
    it(`กะ ${total} คน: ผิดที่คนที่ N อยู่คนที่ N แม้ถูก remount`, () => {
      for (let n = 0; n < total; n++) {
        const store = makeStore()
        let p = START_PROGRESS
        for (let i = 0; i < n; i++) p = advanceProgress(p, total)
        store.set(p)
        const checked = afterCheck(p, { correct: false, wrongTags: ['x.co.th'] })
        expect(checked.retry).toBe(true)
        expect(checked.progress.caseIndex).toBe(n)
        store.set(startRetry(checked.progress))
        // remount กลางรอบลองใหม่ (เดิมเด้งกลับลูกค้า 1)
        const restored = restoreProgress(store.get(), total)
        expect(restored.caseIndex).toBe(n)
        expect(restored.attempt).toBe(2)
        expect(restored.wrongHint).toEqual(['x.co.th'])
        // ผิดครั้งที่ 2 = เฉลย ยังอยู่คนเดิมจนกว่าจะกดคนต่อไป
        const second = afterCheck(restored, { correct: false, wrongTags: [] })
        expect(second.retry).toBe(false)
        expect(second.progress.caseIndex).toBe(n)
      }
    })
  }

  it('ไม่มีของเดิม = ลูกค้าคนแรก · เลขเกินจำนวนถูกกันไว้', () => {
    expect(restoreProgress(undefined, 2)).toEqual(START_PROGRESS)
    expect(restoreProgress({ ...START_PROGRESS, caseIndex: 5, attempt: 2 }, 2)).toMatchObject({ caseIndex: 1, attempt: 1 })
  })

  it('หมดเวลาในโหมดซ้อม เริ่มคนนี้ใหม่ ไม่ย้อนไปคนที่ 1', () => {
    const p = startRetry({ ...START_PROGRESS, caseIndex: 1, wrongHint: ['a'] })
    expect(restartCurrentCustomer(p)).toMatchObject({ caseIndex: 1, attempt: 1, wrongHint: [] })
  })
})

describe('บทแนะนำ: สั้น และเฉพาะลูกค้าคนแรก', () => {
  const s = (x: Partial<TutState>): TutState => ({ caseIndex: 0, page: 'queue', asked: 0, hasFeedback: false, ...x })
  it('ไม่เกิน 5 ขั้น', () => expect(TUT_STEPS).toBeLessThanOrEqual(5))
  it('เริ่มเฉพาะลูกค้าคนแรก', () => {
    expect(startTut(true, 0)).toBe('call')
    expect(startTut(true, 1)).toBeNull()
    expect(startTut(false, 0)).toBeNull()
  })
  it('เดินตามการเล่นจริง แล้วจบเมื่อได้ผล หรือเมื่อถึงลูกค้าคนที่ 2', () => {
    expect(nextTut('call', s({ page: 'card' }))).toBe('card')
    expect(nextTut('card', s({ page: 'interview' }))).toBe('ask')
    expect(nextTut('ask', s({ page: 'interview', asked: 1 }))).toBe('tools')
    expect(skipTut('tools')).toBe('stamp')
    expect(nextTut('stamp', s({ page: 'stamp', hasFeedback: true }))).toBeNull()
    expect(nextTut('card', s({ caseIndex: 1, page: 'card' }))).toBeNull()
  })
})
