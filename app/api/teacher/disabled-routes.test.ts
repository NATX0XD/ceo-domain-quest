import { describe, expect, it } from 'vitest'
import { GET as boardGet } from './board/route'
import { GET as screenGet } from './screen/route'
import { GET as broadcastGet, POST as broadcastPost } from './broadcast/route'
import { GET as sessionGet, POST as sessionPost } from './session/route'

describe('disabled live teacher APIs', () => {
  it.each([
    ['board', () => boardGet(new Request('http://localhost/api/teacher/board'))],
    ['screen', () => screenGet(new Request('http://localhost/api/teacher/screen'))],
    ['broadcast GET', () => broadcastGet(new Request('http://localhost/api/teacher/broadcast'))],
    ['broadcast POST', () => broadcastPost(new Request('http://localhost/api/teacher/broadcast', { method: 'POST' }))],
    ['session GET', () => sessionGet(new Request('http://localhost/api/teacher/session'))],
    ['session POST', () => sessionPost(new Request('http://localhost/api/teacher/session', { method: 'POST' }))],
  ])('%s returns 404', async (_name, call) => {
    expect((await call()).status).toBe(404)
  })
})
