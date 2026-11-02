'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * แท็บที่ซิงก์กับ ?tab= — ลิงก์ตรงได้ · ปุ่มย้อนกลับได้
 * ใช้ History API ตรง ๆ (Next ซิงก์กับ useSearchParams ให้เอง) ค่าเริ่มต้นไม่ใส่ใน URL
 */
export function useUrlTab<T extends string>(values: readonly T[], fallback: T, key = 'tab'): [T, (v: T) => void] {
  const [tab, setTab] = useState<T>(fallback)

  useEffect(() => {
    const read = () => {
      const v = new URLSearchParams(window.location.search).get(key) as T | null
      setTab(v && values.includes(v) ? v : fallback)
    }
    read()
    window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fallback])

  const change = useCallback(
    (v: T) => {
      setTab(v)
      const url = new URL(window.location.href)
      if (v === fallback) url.searchParams.delete(key)
      else url.searchParams.set(key, v)
      window.history.pushState(null, '', url)
    },
    [fallback, key],
  )
  return [tab, change]
}
