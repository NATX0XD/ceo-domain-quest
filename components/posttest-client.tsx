'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GameQuiz } from '@/components/game-quiz'
import { GameScore, GameWaiting } from '@/components/game-result'
import { useExitConfirm } from '@/components/student-navigation'

/**
 * แบบทดสอบหลังเรียน 10 ข้อ — **หน้าจอไม่รู้เฉลย**
 *
 * ⚠️ ห้าม import core/quiz หรือ content/quiz-answers.json ที่นี่
 *    ส่งคำตอบไปตรวจที่ POST /api/posttest แล้วรับกลับแค่คะแนนรวม (ไม่มีรายข้อที่ผิด)
 * ⚠️ ครูเป็นคนกดเปิด เซิร์ฟเวอร์เป็นคนตัดสินว่าเปิดหรือยัง หน้านี้แค่แสดงผล
 * ลำดับคาบ: บอส -> หน้านี้ -> /reflect (ทบทวนได้หลังส่งหน้านี้แล้วเท่านั้น)
 */
export interface PosttestQuestion {
  id: string
  question: string
  choices: string[]
}

interface PosttestResult {
  score: number
  total: number
  preScore: number | null
  gain: number | null
}

/** ถามเซิร์ฟเวอร์ซ้ำทุกกี่มิลลิวินาทีระหว่างรอครูเปิด */
const POLL_MS = 4000

/** คำพูดหลังส่งแบบทดสอบ ต้องตรงกับคะแนนจริง คะแนนน้อยให้กำลังใจ ไม่ชมเกินจริง */
function praiseFor(score: number, total: number): string {
  const ratio = total > 0 ? score / total : 0
  if (ratio >= 0.8) return 'ส่งแล้ว เก่งมาก เหลือทบทวนอีกนิดเดียว'
  if (ratio >= 0.5) return 'ส่งแล้ว ทำได้ดีเลย ลองทบทวนข้อที่พลาดอีกนิดนะ'
  return 'ส่งแล้ว ไม่เป็นไรนะ ลองทบทวนบทเรียนอีกรอบ เดี๋ยวก็เข้าใจมากขึ้น'
}

export function PosttestClient({
  open,
  questions,
  total,
  initialResult,
}: {
  open: boolean
  reason?: string | null
  questions: PosttestQuestion[]
  total: number
  initialResult: PosttestResult | null
}) {
  const router = useRouter()
  const [result, setResult] = useState<PosttestResult | null>(initialResult)
  const exit = useExitConfirm({
    href: '/map',
    note: 'แบบทดสอบจะบันทึกคำตอบเมื่อกดส่งเท่านั้น คำตอบที่เลือกไว้แต่ยังไม่ส่งจะหายไปเมื่อออกจากด่าน',
  })

  // ครูยังไม่เปิด: รีเฟรชข้อมูลจากเซิร์ฟเวอร์เป็นระยะ พอเปิดแล้วโจทย์ขึ้นเอง ไม่ต้องกดอะไร
  useEffect(() => {
    if (open || result) return
    const t = window.setInterval(() => router.refresh(), POLL_MS)
    return () => window.clearInterval(t)
  }, [open, result, router])

  async function submit(answers: Record<string, number>): Promise<string | null> {
    try {
      const res = await fetch('/api/posttest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        score?: number
        total?: number
        preScore?: number | null
        gain?: number | null
        message?: string
      } | null
      if (!res.ok || data?.ok !== true) {
        return `${data?.message ?? 'ส่งไม่สำเร็จ'} · กดส่งอีกครั้งได้`
      }
      setResult({
        score: data.score ?? 0,
        total: data.total ?? total,
        preScore: data.preScore ?? null,
        gain: data.gain ?? null,
      })
      return null
    } catch {
      return 'ต่อเน็ตไม่ได้ คำตอบยังอยู่ ลองส่งอีกครั้ง'
    }
  }

  if (result) {
    return (
      <GameScore
        title="หลังเรียน"
        backHref="/home"
        say={praiseFor(result.score, result.total)}
        label="คะแนนหลังเรียน"
        score={result.score}
        total={result.total}
        compare={
          result.preScore !== null
            ? { before: result.preScore, after: result.score, gain: result.gain }
            : null
        }
        ctaHref="/reflect"
        ctaLabel="ไปทบทวนตัวเอง"
      />
    )
  }

  if (!open) {
    return (
      <GameWaiting
        title="หลังเรียน"
        backHref="/map"
        say="รอครูเปิดแบบทดสอบหลังเรียนนะ"
        hint="พอครูเปิด หน้านี้จะไปต่อเอง"
      />
    )
  }

  return (
    <>
      <GameQuiz
        title="หลังเรียน"
        backHref={null}
        questions={questions}
        say="ใกล้จบแล้ว ตอบเท่าที่รู้นะ"
        onSubmit={submit}
        onBack={exit.request}
      />
      {exit.dialog}
    </>
  )
}
