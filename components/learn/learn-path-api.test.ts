import { afterEach, describe, expect, it, vi } from 'vitest'
import { LEARN_REQUEST_TIMEOUT_MS, postLearn } from './learn-path-api'

describe('postLearn', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('releases the grading UI when the request never resolves', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }) as Promise<Response>,
    )

    const resultPromise = postLearn('m1', { action: 'answer', mode: 'read', answers: { 'm1-rq1': 'คำตอบ' } })
    await vi.advanceTimersByTimeAsync(LEARN_REQUEST_TIMEOUT_MS)

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      message: 'ระบบตรวจนานเกินไป คำตอบยังอยู่ ลองอีกครั้งนะ',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
