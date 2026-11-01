import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { REFLECT_LOCKED_MESSAGE, reflectUnlocked } from './reflect-gate'

describe('reflectUnlocked', () => {
  it('ยังไม่ส่งแบบทดสอบหลังเรียน = ล็อก', () => {
    expect(reflectUnlocked(null)).toBe(false)
    expect(reflectUnlocked(undefined)).toBe(false)
    expect(reflectUnlocked({ post_test_score: null })).toBe(false)
  })
  it('ส่งแล้ว (แม้ได้ 0 คะแนน) = เปิด', () => {
    expect(reflectUnlocked({ post_test_score: 0 })).toBe(true)
    expect(reflectUnlocked({ post_test_score: 7 })).toBe(true)
  })
  it('ข้อความบอกว่าต้องทำอะไรก่อน', () => {
    expect(REFLECT_LOCKED_MESSAGE).toContain('แบบทดสอบหลังเรียน')
  })
})

const read = (p: string) => readFileSync(p, 'utf8')

describe('ลำดับ บอส -> posttest -> reflect ถูกเดินสายครบ', () => {
  it('หน้า /reflect เด้งกลับ /posttest ถ้ายังไม่ส่ง', () => {
    const src = read('app/reflect/page.tsx')
    expect(src).toContain('reflectUnlocked')
    expect(src).toContain("redirect('/posttest')")
  })
  it('GET และ POST /api/reflect ตอบ 403 posttest-first ก่อนส่ง', () => {
    const src = read('app/api/reflect/route.ts')
    expect(src.match(/posttest-first/g)?.length).toBe(2)
    expect(src.indexOf('posttest-first')).toBeLessThan(src.indexOf('await saveReflectionDb'))
  })
  it('ลิงก์หลังบอสทุกจุดไป /posttest ไม่ข้ามไป /reflect', () => {
    expect(read('app/api/ceo/route.ts')).toContain("nextHref: '/posttest'")
    expect(read('app/api/ceo/route.ts')).not.toContain("nextHref: '/reflect'")
    expect(read('components/ceo-client.tsx')).not.toContain('href="/reflect"')
    expect(read('components/server/next-step.ts')).not.toContain("href: '/reflect'")
    expect(read('app/showcase/page.tsx')).not.toContain('href="/reflect"')
  })
  it('ส่ง posttest เสร็จแล้วไป /reflect และมีหน้ารอครูเปิดที่ถามซ้ำเอง', () => {
    const src = read('components/posttest-client.tsx')
    expect(src).toContain('ctaHref="/reflect"')
    expect(src).toContain('router.refresh()')
    expect(src).toContain('รอครูเปิดแบบทดสอบหลังเรียนนะ')
  })
})
