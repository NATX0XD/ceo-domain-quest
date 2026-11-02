import { describe, expect, it } from 'vitest'
import { DEFAULTS, MISSION_SETTINGS_SCHEMAS, clampMissionSettings } from './mission-settings'

describe('mission settings defaults and clamps', () => {
  it('exports the five mission schemas with current defaults', () => {
    expect(Object.keys(MISSION_SETTINGS_SCHEMAS)).toEqual(['m1', 'm2', 'm3', 'm4', 'ceo'])
    expect(clampMissionSettings('m1', {})).toEqual(DEFAULTS.m1)
    expect(clampMissionSettings('m3', {})).toEqual(DEFAULTS.m3)
    expect(clampMissionSettings('ceo', {})).toEqual(DEFAULTS.ceo)
  })

  it('clamps numeric values and keeps at least one selectable mode', () => {
    expect(clampMissionSettings('m2', { textAttempts: 99, exitQuestions: -3, passScore: 1, simStages: 99 })).toMatchObject({
      textAttempts: 6, exitQuestions: 1, passScore: 50, simStages: 4,
    })
    expect(clampMissionSettings('m1', { modesEnabled: { watch: false, read: false, do: false } }).modesEnabled).toEqual({ watch: true, read: false, do: false })
  })

  it('supports unlimited Dome quota while clamping finite quota', () => {
    expect(clampMissionSettings('m3', { domeQuota: null }).domeQuota).toBeNull()
    expect(clampMissionSettings('m3', { domeQuota: 99 }).domeQuota).toBe(20)
  })
})
