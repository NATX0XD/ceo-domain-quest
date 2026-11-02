import { describe, expect, it } from 'vitest'
import { isFreshM3Shift, M3_CUSTOMER_POOL_SIZE, M3_SHIFT_SIZE, rememberM3Customers } from './m3-customer-rotation'

describe('m3 customer rotation', () => {
  it('accepts exactly three customers only when none were seen in the current cycle', () => {
    const seen = ['c1', 'c2', 'c3']
    expect(isFreshM3Shift(['c4', 'c5', 'c6'], seen)).toBe(true)
    expect(isFreshM3Shift(['c4', 'c2', 'c6'], seen)).toBe(false)
    expect(isFreshM3Shift(['c4', 'c5'], seen)).toBe(false)
  })

  it('persists ids per student and clears the local cycle after all 18 customers', () => {
    const values = new Map<string, string>()
    const storage = {
      setItem(key: string, value: string) {
        values.set(key, value)
      },
    }
    let seen: string[] = []
    for (let run = 0; run < M3_CUSTOMER_POOL_SIZE / M3_SHIFT_SIZE; run += 1) {
      const ids = [`c${run * 3 + 1}`, `c${run * 3 + 2}`, `c${run * 3 + 3}`]
      expect(ids.every((id) => !seen.includes(id))).toBe(true)
      seen = rememberM3Customers(storage, 'student-1', seen, ids)
    }
    expect(seen).toEqual([])
    expect(values.get('m3-customers-seen-v1:student-1')).toBe('[]')
  })
})
