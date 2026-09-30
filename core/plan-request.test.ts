import { describe, expect, it } from 'vitest'
import {
  describeAnswer,
  describeRequest,
  isPending,
  MAX_EXTRA_MINUTES,
  normalizeRequestedValue,
} from './plan-request'

describe('normalizeRequestedValue', () => {
  it('ระดับรับ 1-3 เท่านั้น', () => {
    expect(normalizeRequestedValue('level', '2')).toEqual({ ok: true, value: '2' })
    expect(normalizeRequestedValue('level', ' 3 ')).toEqual({ ok: true, value: '3' })
    expect(normalizeRequestedValue('level', '4').ok).toBe(false)
    expect(normalizeRequestedValue('level', '').ok).toBe(false)
  })

  it('ช่องทางรับ 4 ทางที่ระบบมีจริง', () => {
    expect(normalizeRequestedValue('channel', 'buddy')).toEqual({ ok: true, value: 'buddy' })
    const bad = normalizeRequestedValue('channel', 'ครู')
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.message).toContain('clip')
  })

  it('ขอข้ามไม่ต้องมีค่า คืน null และไม่เคยตก', () => {
    expect(normalizeRequestedValue('skip', undefined)).toEqual({ ok: true, value: null })
    expect(normalizeRequestedValue('skip', 'อะไรก็ได้')).toEqual({ ok: true, value: null })
  })

  it('ขอเวลาเพิ่มรับจำนวนเต็มในช่วงที่กำหนด', () => {
    expect(normalizeRequestedValue('time', '5')).toEqual({ ok: true, value: '5' })
    expect(normalizeRequestedValue('time', 5)).toEqual({ ok: true, value: '5' })
    expect(normalizeRequestedValue('time', '0').ok).toBe(false)
    expect(normalizeRequestedValue('time', String(MAX_EXTRA_MINUTES + 1)).ok).toBe(false)
    expect(normalizeRequestedValue('time', '2.5').ok).toBe(false)
    expect(normalizeRequestedValue('time', 'ห้านาที').ok).toBe(false)
  })

  it('ขอเกินเพดานแล้วข้อความบอกทางออก ไม่ใช่แค่บอกว่าผิด', () => {
    const out = normalizeRequestedValue('time', '60')
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.message).toContain('คุยกับครู')
  })
})

describe('describeRequest', () => {
  it('เล่าคำขอเปลี่ยนช่องทางเป็นภาษาคน พร้อมบอกว่าภารกิจไหน', () => {
    expect(describeRequest({ kind: 'channel', requestedValue: 'buddy', missionId: 'm2' })).toBe(
      'ขอเปลี่ยนช่องทางการเรียน เป็น เรียนกับเพื่อน (ภารกิจที่ 2)',
    )
  })

  it('ขอข้ามไม่มีค่า ก็ยังอ่านรู้เรื่อง', () => {
    expect(describeRequest({ kind: 'skip', missionId: 'm3' })).toBe('ขอข้ามภารกิจนี้ (ภารกิจที่ 3)')
  })

  it('ด่านบอสเรียกว่าด่านบอส ไม่ใช่ภารกิจที่ 5', () => {
    expect(describeRequest({ kind: 'time', requestedValue: '5', missionId: 'boss' })).toContain(
      'ด่านบอส',
    )
  })

  it('ไม่ระบุภารกิจก็ได้ ไม่มีวงเล็บห้อยท้าย', () => {
    expect(describeRequest({ kind: 'level', requestedValue: '1' })).toBe(
      'ขอเปลี่ยนระดับความยาก เป็น ระดับ 1',
    )
  })
})

describe('describeAnswer', () => {
  it('ครูให้ตามที่ขอ', () => {
    expect(
      describeAnswer({ kind: 'time', status: 'approved', requestedValue: '5', grantedValue: '5' }),
    ).toBe('ครูให้แล้ว: 5 นาที')
  })

  it('ครูให้ไม่ตรงกับที่ขอ ต้องเห็นทั้งของที่ขอและของที่ได้', () => {
    const line = describeAnswer({
      kind: 'level',
      status: 'changed',
      requestedValue: '1',
      grantedValue: '2',
    })
    expect(line).toContain('ระดับ 1')
    expect(line).toContain('ระดับ 2')
  })

  it('ครูไม่ให้ พร้อมเหตุผลของครู', () => {
    const line = describeAnswer({
      kind: 'skip',
      status: 'rejected',
      teacherResponse: 'ลองอีกรอบนะ ครูจะไปนั่งด้วย',
    })
    expect(line).toContain('ยังไม่ให้')
    expect(line).toContain('ครูจะไปนั่งด้วย')
  })

  it('ไม่มีเหตุผลของครูก็ยังได้ประโยคที่อ่านได้', () => {
    expect(describeAnswer({ kind: 'skip', status: 'approved' }).trim().length).toBeGreaterThan(0)
  })
})

describe('isPending', () => {
  it('ยังไม่ตอบถือว่ารออยู่', () => {
    expect(isPending('pending')).toBe(true)
    expect(isPending(null)).toBe(true)
    expect(isPending('approved')).toBe(false)
    expect(isPending('rejected')).toBe(false)
  })
})
