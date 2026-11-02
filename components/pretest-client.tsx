'use client'

import { useRouter } from 'next/navigation'
import { GameQuiz } from '@/components/game-quiz'
import { GameScore, GameWaiting } from '@/components/game-result'
import { useEffect, useState } from 'react'

/**
 * แบบทดสอบก่อนเรียน — **หน้าจอไม่รู้เฉลย**
 *
 * ⚠️ ห้าม import core/quiz หรือ content/quiz-answers.json ที่นี่
 *    ส่งคำตอบไปตรวจที่ POST /api/pretest แล้วรับกลับแค่คะแนนรวมกับหัวข้อที่ควรเน้น
 */
export interface PretestQuestion {
  id: string
  question: string
  choices: string[]
}

interface PretestResult {
  score: number
  total: number
  suggestedLevel: 1 | 2 | 3
  levelReason: string
  weakTopics: string[]
}

export function PretestClient({
  questions,
  objectives,
  initialResult,
  open = true,
  nextHref = '/profile',
}: {
  questions: PretestQuestion[]
  /** รหัสวัตถุประสงค์ -> ชื่อสั้น ใช้แปลงผลที่เซิร์ฟเวอร์ส่งกลับให้เป็นภาษาคน */
  objectives: Record<string, string>
  initialResult: PretestResult | null
  /** ครูกดเปิดแล้วหรือยัง (T-12) — เซิร์ฟเวอร์ตัดสิน หน้านี้แค่แสดงผล */
  open?: boolean
  closedReason?: string | null
  /** ทำเสร็จแล้วไปไหนต่อ — ยังไม่รู้จักตัวเอง = /profile · รู้จักแล้ว = /map */
  nextHref?: string
}) {
  const router = useRouter()
  const [result, setResult] = useState<PretestResult | null>(initialResult)

  // ครูยังไม่เปิด: ถามเซิร์ฟเวอร์ซ้ำเป็นระยะ เปิดแล้วเดินต่อเอง
  useEffect(() => {
    if (open || result) return
    const t = window.setInterval(() => router.refresh(), 5000)
    return () => window.clearInterval(t)
  }, [open, result, router])

  async function submit(answers: Record<string, number>): Promise<string | null> {
    try {
      const res = await fetch('/api/pretest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = (await res.json().catch(() => null)) as {
        score?: number
        total?: number
        suggestedLevel?: 1 | 2 | 3
        levelReason?: string
        weakObjectives?: string[]
        message?: string
      } | null
      if (!res.ok || !data || typeof data.score !== 'number') {
        return `${data?.message ?? 'ส่งไม่สำเร็จ'} · กดส่งอีกครั้งได้`
      }
      setResult({
        score: data.score,
        total: data.total ?? questions.length,
        suggestedLevel: data.suggestedLevel ?? 1,
        levelReason: data.levelReason ?? '',
        weakTopics: (data.weakObjectives ?? []).map((id) => objectives[id] ?? id),
      })
      router.refresh()
      return null
    } catch {
      return 'ต่อเน็ตไม่ได้ คำตอบยังอยู่ ลองส่งอีกครั้ง'
    }
  }

  if (result) {
    return (
      <GameScore
        title="ก่อนเรียน"
        backHref="/home"
        mood="happy"
        say="เก่งมาก ไม่ต้องกังวล คะแนนนี้ไม่เก็บ"
        label="คะแนนก่อนเรียน"
        score={result.score}
        total={result.total}
        chips={[`ตัวช่วยระดับ ${result.suggestedLevel}`, ...result.weakTopics.slice(0, 2)]}
        ctaHref={nextHref}
        ctaLabel="ไปต่อ"
      />
    )
  }

  if (!open) {
    return (
      <GameWaiting
        title="ก่อนเรียน"
        backHref="/home"
        say="รอครูเปิดแบบทดสอบก่อนเรียนนะ"
        hint="ครูกำลังจะเปิดให้"
      />
    )
  }

  return (
    <GameQuiz
      title="ก่อนเรียน"
      backHref="/home"
      questions={questions}
      say="ตอบเท่าที่รู้ ไม่รู้ก็เดาได้"
      onSubmit={submit}
    />
  )
}
