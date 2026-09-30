'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card } from '@/components/ui'

/**
 * E-04 / S-41 ช่องทาง "เรียนกับเพื่อน" ของจริง — ขอคู่หู · รับคำขอของเพื่อน · ปิดใบ
 *
 * วางได้ทั้งหน้าภารกิจและหน้าอื่นที่ผู้เรียนอาจติด เพราะแผ่นคำขอของเพื่อนต้องเด้งขึ้น
 * **บนเครื่องของผู้ช่วย** ไม่ใช่บนเครื่องผู้ขอ — คอมโพเนนต์เดียวทำทั้งสองบทบาท
 *
 * ⚠️ การตัดสินทั้งหมดอยู่ที่เซิร์ฟเวอร์ ที่นี่แสดงผลอย่างเดียว ห้ามคิดคะแนนหรือคัดเพื่อนเอง
 * ⚠️ ไม่มีใครว่าง = ต้องขึ้นการ์ดคู่คิดกับปุ่มเรียกครู **ห้ามปล่อยจอค้าง** (กติกา E-04 ข้อ 3)
 */
const POLL_MS = 4000

interface RequestView {
  id: string
  missionId: string
  kind: string
  status: string
  attempts: number
  helperNickname: string | null
  waitingFor: { nickname: string; secondsLeft: number } | null
}

interface IncomingOffer {
  offerId: string
  missionId: string
  kind: string
  requesterNickname: string
  secondsLeft: number
}

interface BuddyState {
  myRequest: RequestView | null
  incoming: IncomingOffer[]
  helping: { id: string; missionId: string; requesterNickname: string } | null
  helpedCount: number
}

const MISSION_LABEL: Record<string, string> = {
  m1: 'ภารกิจที่ 1',
  m2: 'ภารกิจที่ 2',
  m3: 'ภารกิจที่ 3',
  m4: 'ภารกิจที่ 4',
  boss: 'ด่านบอส',
}

export interface BuddyPanelProps {
  /** ภารกิจที่ผู้เรียนกำลังติดอยู่ — ใช้ตอนกดขอคู่หู */
  missionId: string
  className?: string
}

export function BuddyPanel({ missionId, className }: BuddyPanelProps) {
  const [state, setState] = useState<BuddyState | null>(null)
  const [headline, setHeadline] = useState<string | null>(null)
  const [showCard, setShowCard] = useState(false)
  const [busy, setBusy] = useState(false)
  const [teacherCalled, setTeacherCalled] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/buddy')
      if (!res.ok) return
      setState((await res.json()) as BuddyState)
    } catch {
      // เน็ตสะดุด รอบหน้าค่อยว่ากัน ไม่ต้องขึ้นข้อความให้ผู้เรียนตกใจ
    }
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [load])

  async function post(url: string, body: unknown) {
    setBusy(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => null)) as
        | { headline?: string; message?: string; showCard?: boolean }
        | null
      setHeadline(data?.headline ?? data?.message ?? null)
      setShowCard(data?.showCard === true)
      await load()
    } catch {
      setHeadline('ส่งไม่สำเร็จ ลองกดอีกครั้งนะ')
    } finally {
      setBusy(false)
    }
  }

  async function callTeacher() {
    setBusy(true)
    try {
      await fetch('/api/help', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ missionId }),
      })
      setTeacherCalled(true)
    } catch {
      setHeadline('เรียกครูไม่สำเร็จ ยกมือเรียกครูได้เลยนะ')
    } finally {
      setBusy(false)
    }
  }

  const incoming = state?.incoming?.[0] ?? null
  const mine = state?.myRequest ?? null

  return (
    <div className={className}>
      {/* บทบาทผู้ช่วย: แผ่นคำขอของเพื่อนขึ้นก่อนทุกอย่าง เพราะมีเวลาตอบแค่ 60 วินาที */}
      {incoming && (
        <Card tone="spark" padding="md" elevated>
          <p className="font-semibold">
            {incoming.requesterNickname} ขอให้ช่วยเรื่อง{' '}
            {MISSION_LABEL[incoming.missionId] ?? incoming.missionId}
          </p>
          <p className="text-sm opacity-80">
            ช่วยด้วยการตั้งคำถามให้เพื่อนคิดเองก็พอ ไม่ต้องบอกคำตอบตรง ๆ · เหลือเวลาตอบ{' '}
            {incoming.secondsLeft} วินาที
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="success"
              disabled={busy}
              onClick={() => void post('/api/buddy/respond', { offerId: incoming.offerId, accept: true })}
            >
              ช่วยได้
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void post('/api/buddy/respond', { offerId: incoming.offerId, accept: false })}
            >
              ตอนนี้ไม่สะดวก
            </Button>
          </div>
        </Card>
      )}

      {state?.helping && (
        <Card tone="brand" padding="md" className="mt-3">
          <p className="text-sm">
            กำลังช่วย {state.helping.requesterNickname} อยู่ ·{' '}
            {MISSION_LABEL[state.helping.missionId] ?? state.helping.missionId}
          </p>
        </Card>
      )}

      {/* บทบาทผู้ขอ */}
      {mine ? (
        <Card tone="quest" padding="md" className="mt-3">
          <p className="font-semibold">
            {mine.status === 'accepted' && mine.helperNickname
              ? `${mine.helperNickname} มาช่วยแล้ว`
              : mine.waitingFor
                ? `กำลังถาม ${mine.waitingFor.nickname} ให้ (เหลือ ${mine.waitingFor.secondsLeft} วินาที)`
                : 'กำลังหาเพื่อนให้'}
          </p>
          <p className="text-sm opacity-80">ระหว่างรอ ทำข้อต่อไปได้เลยนะ</p>
          <div className="mt-3 flex gap-2">
            {mine.status === 'accepted' && (
              <Button
                variant="success"
                disabled={busy}
                onClick={() =>
                  void post('/api/buddy/close', {
                    requestId: mine.id,
                    action: 'done',
                    feedback: 'helpful',
                  })
                }
              >
                เข้าใจแล้ว ขอบคุณเพื่อน
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void post('/api/buddy/close', { requestId: mine.id, action: 'cancel' })}
            >
              ยกเลิกคำขอ
            </Button>
          </div>
        </Card>
      ) : (
        <Button
          variant="secondary"
          fullWidth
          disabled={busy}
          className="mt-3"
          onClick={() => void post('/api/buddy', { missionId })}
        >
          ขอให้เพื่อนช่วย
        </Button>
      )}

      {headline && <p className="mt-2 text-sm opacity-80">{headline}</p>}

      {/* ไม่มีใครว่าง — การ์ดคู่คิดกับปุ่มเรียกครู ห้ามปล่อยให้จอค้างเฉย ๆ */}
      {showCard && !mine && (
        <Card tone="plain" padding="md" className="mt-3">
          <p className="font-semibold">ลองอธิบายให้ตัวเองฟังก่อน</p>
          <ol className="mt-1 list-decimal pl-5 text-sm opacity-80">
            <li>โจทย์ข้อนี้ถามอะไร ตอบด้วยคำของเราเอง</li>
            <li>เรารู้อะไรแล้วบ้าง</li>
            <li>ติดตรงไหนกันแน่</li>
          </ol>
          <Button
            variant="primary"
            fullWidth
            className="mt-3"
            disabled={busy || teacherCalled}
            onClick={() => void callTeacher()}
          >
            {teacherCalled ? 'เรียกครูแล้ว ครูกำลังมา' : 'ขอให้ครูช่วย'}
          </Button>
        </Card>
      )}

      {(state?.helpedCount ?? 0) > 0 && (
        <p className="mt-2 text-sm opacity-70">
          🤝 ช่วยเพื่อนไปแล้ว {state?.helpedCount} ครั้งในคาบนี้
        </p>
      )}
    </div>
  )
}
