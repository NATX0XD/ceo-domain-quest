import { describe, expect, it } from 'vitest'
import { certificateProgressOf } from './progress'

describe('certificateProgressOf', () => {
  it('mirrors the lessonSummary star total and passed missions', () => {
    expect(
      certificateProgressOf({ totalStars: 9, maxStars: 15, missions: [{ passed: true }, { passed: false }] }),
    ).toEqual({ starsTotal: 9, starsMax: 15, missionsPassed: 1, missionsTotal: 2 })
  })
})
