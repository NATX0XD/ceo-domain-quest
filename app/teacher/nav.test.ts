import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const shell = readFileSync('app/teacher/_ux/shell.tsx', 'utf8')
const navSource = shell.slice(shell.indexOf('const groups'))

describe('self-paced teacher navigation', () => {
  it('does not render links to removed live-control surfaces', () => {
    for (const forbidden of ['/teacher/board', '/teacher/demo', 'คุมคาบสด', 'ห้องเรียนสด', 'เปิดจอฉาย']) {
      expect(navSource).not.toContain(forbidden)
    }
    expect(shell).toContain('/teacher/missions')
    expect(shell).toContain('ตั้งค่าด่าน')
  })
})
