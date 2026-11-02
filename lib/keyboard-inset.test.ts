import { describe, expect, it } from 'vitest'
import { computeKeyboard, KEYBOARD_MIN_PX } from './keyboard-inset'

const base = { baseline: 852, vvHeight: 852, vvOffsetTop: 0, vvScale: 1, editableFocused: true, layoutHeight: 852 }

describe('computeKeyboard', () => {
  it('closed when nothing shrinks', () => {
    expect(computeKeyboard(base).open).toBe(false)
  })
  it('iPhone 15: ~381px keyboard opens', () => {
    const s = computeKeyboard({ ...base, vvHeight: 471, vvOffsetTop: 120 })
    expect(s).toEqual({ open: true, inset: 381, appHeight: 471, top: 120 })
  })
  it('not open without a focused field (URL bar collapse etc.)', () => {
    expect(computeKeyboard({ ...base, vvHeight: 471, editableFocused: false }).open).toBe(false)
  })
  it('small shrink (browser chrome) is not a keyboard', () => {
    expect(computeKeyboard({ ...base, vvHeight: 852 - KEYBOARD_MIN_PX }).open).toBe(false)
  })
  it('pinch zoom is not a keyboard', () => {
    expect(computeKeyboard({ ...base, vvHeight: 400, vvScale: 2 }).open).toBe(false)
  })
})
