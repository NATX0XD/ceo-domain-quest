import { describe, expect, it } from 'vitest'
import { countStudentRowsByClassroom } from './classroom-stats'

describe('countStudentRowsByClassroom', () => {
  it('counts students per classroom and keeps empty rooms absent', () => {
    expect(
      countStudentRowsByClassroom([
        { classroom_id: 'room-a' },
        { classroom_id: 'room-b' },
        { classroom_id: 'room-a' },
      ]),
    ).toEqual({ 'room-a': 2, 'room-b': 1 })
  })

  it('returns an empty map for no students', () => {
    expect(countStudentRowsByClassroom([])).toEqual({})
  })
})
