import { describe, expect, it } from 'vitest'
import { classifyAiWait } from './stale-grading'

const now = Date.parse('2026-11-03T10:00:00Z')
const ago = (m: number) => new Date(now - m * 60000).toISOString()

describe('classifyAiWait', () => {
  it('ignores non-pending and proposed', () => {
    expect(classifyAiWait('not-requested', false, [], now)).toBe('none')
    expect(classifyAiWait('pending-ai', true, [], now)).toBe('none')
  })
  it('pending-ai without job is stale', () => {
    expect(classifyAiWait('pending-ai', false, [], now)).toBe('stale')
  })
  it('failed / done-without-writeback jobs are stale', () => {
    expect(classifyAiWait('pending-ai', false, [{ status: 'failed', updated_at: ago(1) }], now)).toBe('stale')
    expect(classifyAiWait('pending-ai', false, [{ status: 'done', updated_at: ago(1) }], now)).toBe('stale')
    expect(classifyAiWait('ai-failed', false, [], now)).toBe('stale')
  })
  it('recent live job is pending, old one stale', () => {
    expect(classifyAiWait('pending-ai', false, [{ status: 'claimed', updated_at: ago(2) }], now)).toBe('pending')
    expect(classifyAiWait('pending-ai', false, [{ status: 'pending', updated_at: ago(30) }], now)).toBe('stale')
  })
})
