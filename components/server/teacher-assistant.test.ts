import { describe, expect, it } from 'vitest'
import { createAiClient } from '@/lib/ai'
import type { ClassroomReportRaw, RawStudentRow } from '@/lib/db/repo'
import {
  ASSIST_CONTEXT_MAX_CHARS,
  buildAssistContext,
  contextToText,
  fallbackAnswer,
  matchIntent,
} from './teacher-assistant'

const NOW = Date.parse('2026-11-03T05:00:00Z')

function student(id: string, nickname: string, missions: Partial<RawStudentRow['missions'][number]>[] = []): RawStudentRow {
  return {
    studentId: id,
    nickname,
    joinedAt: '2026-11-03T01:00:00Z',
    profile: { earnedStars: 4, postTestScore: null } as RawStudentRow['profile'],
    missions: missions.map((m, i) => ({
      missionId: `m${i + 1}`, channelUsed: null, attempts: 0, hintsUsed: 0, stars: null, passed: false,
      levelOverride: null, forcedPass: false, skippedBy: null, startedAt: null, passedAt: null, secondsSpent: null, ...m,
    })),
    skips: [], routeChanges: 0, reflectionCount: 0, submission: null, overrides: 0,
  }
}

const raw: ClassroomReportRaw = {
  classroomId: 'c1',
  students: [
    student('s1', 'ฟ้าใส', [
      { passed: true, stars: 3, attempts: 1, startedAt: '2026-11-03T02:00:00Z', passedAt: '2026-11-03T02:10:00Z' },
      { passed: true, stars: 2, attempts: 2, startedAt: '2026-11-03T02:20:00Z', passedAt: '2026-11-03T02:40:00Z' },
      { attempts: 5, startedAt: '2026-11-03T03:00:00Z' },
    ]),
    student('s2', 'บีม', []),
    student('s3', 'นุ่น', [{ attempts: 3, startedAt: '2026-11-03T04:30:00Z' }]),
  ],
  survey: null,
  buddy: { requests: 0, helped: 0, passedAfterHelp: 0 },
  overrides: [],
}

const ctx = buildAssistContext({
  raw,
  learn: [],
  pendingByNickname: new Map([['นุ่น', 2]]),
  requestsByStudent: new Map([['s3', 1]]),
  now: NOW,
})

describe('teacher assistant context', () => {
  it('derives passed / stuck / not started', () => {
    const [fa, beam, nun] = ctx.students
    expect(fa).toMatchObject({ passed: 2, stuck: 'm3', started: true })
    expect(beam).toMatchObject({ started: false, stuck: null })
    expect(nun).toMatchObject({ stuck: 'm1', pending: 2, requests: 1 })
  })

  it('text has no ids and respects the cap', () => {
    const text = contextToText(ctx)
    expect(text).not.toMatch(/s1|s2|s3|classroomId/)
    const many = { ...ctx, students: Array.from({ length: 400 }, (_, i) => ({ ...ctx.students[0]!, nickname: `คน${i}` })) }
    expect(contextToText(many).length).toBeLessThanOrEqual(ASSIST_CONTEXT_MAX_CHARS + 60)
  })
})

describe('teacher assistant fallback intents', () => {
  it.each([
    ['ใครยังไม่เริ่ม', 'not-started'],
    ['ใครติด M3', 'stuck'],
    ['ใครติดภารกิจ 2 บ้าง', 'stuck'],
    ['ควรช่วยใครก่อน', 'help-first'],
    ['สรุปห้องนี้', 'summary'],
    ['ฟ้าใสทำอะไรไปแล้ว', 'student'],
  ])('%s -> %s', (q, intent) => {
    expect(matchIntent(q, ctx.students).intent).toBe(intent)
  })

  it('answers from data', () => {
    expect(fallbackAnswer('ใครยังไม่เริ่ม', ctx)).toContain('บีม')
    expect(fallbackAnswer('ใครติด M3', ctx)).toContain('ฟ้าใส')
    expect(fallbackAnswer('ใครติด M3', ctx)).not.toContain('นุ่น')
    expect(fallbackAnswer('ควรช่วยใครก่อน', ctx).split('\n')[1]).toContain('นุ่น')
    expect(fallbackAnswer('ฟ้าใสทำอะไรไปแล้ว', ctx)).toContain('ผ่าน 2/5')
    expect(fallbackAnswer('สรุปห้องนี้', ctx)).toContain('นักเรียน 3 คน')
  })
})

describe('teacherAssist AI client', () => {
  it('no key -> fallback without touching fetch', async () => {
    const fetchImpl = (() => { throw new Error('should not be called') }) as unknown as typeof fetch
    const r = await createAiClient({ env: {}, fetchImpl }).teacherAssist({ context: 'x', messages: [{ role: 'teacher', text: 'สรุป' }] })
    expect(r).toMatchObject({ source: 'fallback', fallbackReason: 'no-api-key' })
  })

  it('mocked Typhoon reply -> ai', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '{"text":"- ทุกคนปกติครับ"}' } }] }), { status: 200 })) as unknown as typeof fetch
    const r = await createAiClient({ env: { TYPHOON_API_KEY: 'k' }, fetchImpl }).teacherAssist({ context: 'x', messages: [{ role: 'teacher', text: 'สรุป' }] })
    expect(r).toMatchObject({ source: 'ai', provider: 'typhoon' })
    expect(r.text).toContain('ปกติ')
  })
})
