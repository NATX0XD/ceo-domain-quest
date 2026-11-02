import { describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))

import { DELETE, GET, PATCH, POST } from './route'
import { GET as projectorGet } from '../projector/route'

describe('teacher classroom + projector routes without session', () => {
  it('rejects create-room without a teacher session', async () => {
    expect((await POST()).status).toBe(401)
  })
  it('rejects list/patch/delete without a session', async () => {
    expect((await GET()).status).toBe(401)
    const req = (m: string) => new Request('http://localhost/api/teacher/classroom', { method: m, body: '{}' })
    expect((await PATCH(req('PATCH'))).status).toBe(401)
    expect((await DELETE(req('DELETE'))).status).toBe(401)
  })
  it('rejects projector data without a session', async () => {
    expect((await projectorGet(new Request('http://localhost/api/teacher/projector?classroomId=x'))).status).toBe(401)
  })
})
