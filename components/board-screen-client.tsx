'use client'

import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Icon3d, type Icon3dName } from '@/app/teacher/_ux/v2'
import {
  BoardBigNumber,
  BoardPhaseBanner,
  BoardRoomCode,
  BoardStage,
  BoardWorkCard,
} from '@/components/board-visuals'

/**
 * T-04 จอหน้าห้อง (โปรเจกเตอร์) — **ห้ามมีชื่อคนคู่กับคะแนนหรือดาว**
 *
 * ตัวอักษรใหญ่พิเศษเพราะต้องอ่านจากหลังห้องบนจอ 1280×720 ขึ้นไป
 * เปลี่ยนตามช่วงเองทุก 3 วินาที ครูไม่ต้องกดอะไรบนจอนี้
 *
 * หน้าตาทั้งหมดมาจาก `components/board-visuals.tsx` (ของ session design) ไฟล์นี้เหลือหน้าที่
 * เดียวคือ **ถามเซิร์ฟเวอร์แล้วเลือกว่าจะโชว์ชิ้นไหน** ไม่มีคลาสจัดหน้าตาปนอยู่ในตรรกะอีก
 * `BoardWorkCard` จงใจไม่มี prop รับคะแนน/ดาว กฎ "ห้ามชื่อคู่คะแนน" จึงถูกบังคับตั้งแต่ชั้น type
 */
const POLL_MS = 3000

interface ScreenState {
  phase: string
  phaseLabel: string
  remainingSeconds: number | null
  paused: boolean
  focusScreen: boolean
  joined: number
  missionsPassed: number
  submitted: number
  /** ผลงานที่ครูปักหมุด — nickname เป็น null เมื่อครูเลือกซ่อนชื่อ · ไม่มีดาว ไม่มีคะแนน */
  showcase: { domain: string; reason: string; nickname: string | null }[]
}

function mmss(total: number | null): string {
  if (total === null) return ''
  const safe = Math.max(0, total)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

/** เมืองของห้องเรา — ก่อสร้างเพิ่มทีละส่วนทุกครั้งที่มีคนในห้องผ่านภารกิจ (ไม่ผูกกับจำนวนคน) */
/** สีพาสเทลเข้มของตึกในเมือง — ตึกที่ยังไม่สร้างเป็นสีเทาอ่อน */
const CITY_COLORS = ['#f0b823', '#8f7be8', '#e5805b', '#4f9d66', '#4a98c9']

function stageIcon(name: Icon3dName) {
  return <Icon3d name={name} size={112} />
}

function ClassCity({ built }: { built: number }) {
  const blocks = Array.from({ length: 12 }, (_, i) => i < built)
  return (
    <div
      role="img"
      aria-label={`เมืองของห้องเรา สร้างแล้ว ${built} ส่วน`}
      className="flex items-end justify-center gap-2"
    >
      {blocks.map((on, i) => (
        <span
          key={i}
          className="w-8 rounded-t-2xl sm:w-14"
          style={{
            height: `${56 + (i % 4) * 36}px`,
            background: on ? CITY_COLORS[i % CITY_COLORS.length] : '#ece8dd',
            boxShadow: on ? 'inset 0 -6px 0 rgb(0 0 0 / 0.12)' : undefined,
          }}
        />
      ))}
    </div>
  )
}

export function BoardScreenClient({
  classroomId,
  roomCode,
  joinUrl,
  qrSvg,
}: {
  classroomId: string
  roomCode: string
  joinUrl: string
  qrSvg: string | null
}) {
  const [state, setState] = useState<ScreenState | null>(null)
  const [seconds, setSeconds] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/teacher/screen?classroomId=${classroomId}`)
      if (!res.ok) return
      const data = (await res.json()) as ScreenState
      setState(data)
      setSeconds(data.remainingSeconds)
    } catch {
      // จอหน้าห้องห้ามขึ้นข้อความ error กลางคาบ รอบถัดไปค่อยลองใหม่
    }
  }, [classroomId])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    if (seconds === null || state?.paused) return
    const id = setInterval(() => setSeconds((s) => (s === null ? null : Math.max(0, s - 1))), 1000)
    return () => clearInterval(id)
  }, [seconds === null, state?.paused])

  const phase = state?.phase ?? 'wait'

  return (
    <AppShell
      width="full"
      // จอฉายหน้าห้อง: ช่วงกิจกรรมกับนาฬิกาต้องอยู่มุมเดิมตลอดคาบ ห้ามเลื่อนหาย
      header={
        <BoardPhaseBanner
          className="bg-surface px-8 pt-6 pb-4"
          phaseLabel={state?.phaseLabel ?? 'รอเริ่ม'}
          // ช่วง "ทำต่อที่บ้าน" ไม่มีนาฬิกา (กฎ S-11)
          clock={seconds !== null && phase !== 'home' ? mmss(seconds) : null}
          paused={state?.paused === true}
        />
      }
      mainClassName="flex flex-col"
    >
      <div className="flex min-h-full flex-col gap-6 px-8 pt-2 pb-8 text-center">

      {/* รอเริ่ม / รู้จักตัวเอง — รหัสห้องกับ QR ตัวใหญ่ */}
      {phase === 'wait' || phase === 'onboard' ? (
        <BoardStage
          icon={stageIcon('rocket')}
          title="CEO Domain Quest"
          subtitle="สแกน QR หรือพิมพ์รหัสห้อง"
        >
          <BoardRoomCode
            roomCode={roomCode}
            qrSvg={qrSvg}
            joinUrl={joinUrl}
            joined={state?.joined ?? 0}
          />
        </BoardStage>
      ) : null}

      {/* ภารกิจย่อย — เมืองของห้องเรา ไม่มีชื่อใครเลย */}
      {phase === 'mission' ? (
        <BoardStage
          icon={stageIcon('school')}
          title="เมืองของห้องเรา"
          subtitle={`ผ่านภารกิจแล้ว ${state?.missionsPassed ?? 0} ครั้ง`}
        >
          <ClassCity built={Math.min(12, state?.missionsPassed ?? 0)} />
        </BoardStage>
      ) : null}

      {/* ด่านบอส — จำนวนผลงานที่ส่งแล้ว (ตัวเลขรวม ไม่มีรายคน) */}
      {phase === 'boss' ? (
        <BoardStage icon={stageIcon('trophy')} title="ด่านบอส CEO">
          <BoardBigNumber value={state?.submitted ?? 0} caption="ใบเสนอที่ส่งเข้ามาแล้ว" />
        </BoardStage>
      ) : null}

      {/**
        * ครูสรุป — ผลงาน 2-3 ชิ้น ไม่มีดาว ไม่มีคะแนน
        *
        * ⚠️ เงื่อนไขเดิมเป็น `phase === 'summary' || showcase.length > 0` ซึ่งแปลว่า
        *    **พอครูปักหมุดผลงานไว้ ผลงานจะค้างอยู่ทุกช่วง** ซ้อนใต้เนื้อหาของช่วงนั้น
        *    (วัดได้จริง: ช่วง boss ขึ้นทั้ง "ใบเสนอที่ส่งเข้ามาแล้ว 0" และการ์ดผลงานพร้อมกัน)
        *    จอนี้ต้องมีเรื่องเดียวต่อหนึ่งช่วง จึงผูกกับช่วงตรง ๆ
        */}
      {phase === 'summary' ? (
        <BoardStage
          icon={stageIcon('glowing-star')}
          title="ผลงานของห้องเรา"
          subtitle={
            (state?.showcase ?? []).length === 0
              ? 'ครูยังไม่ได้ปักหมุดผลงาน'
              : 'ไม่มีดาว ไม่มีคะแนน'
          }
        >
          <ul className="grid w-full gap-4 md:grid-cols-3">
            {(state?.showcase ?? []).map((row) => (
              <li key={row.domain} className="flex">
                <BoardWorkCard
                  nickname={row.nickname}
                  domain={row.domain}
                  reason={row.reason}
                  className="w-full"
                />
              </li>
            ))}
          </ul>
        </BoardStage>
      ) : null}

      {/* สะท้อนคิด / จบคาบ */}
      {phase === 'reflect' || phase === 'end' || phase === 'home' ? (
        <BoardStage
          icon={stageIcon(phase === 'reflect' ? 'brain' : 'sparkles')}
          title={phase === 'reflect' ? 'ทบทวนตัวเอง' : 'ทำต่อที่บ้านได้'}
          subtitle={
            phase === 'reflect'
              ? 'ทำอะไรได้แล้ว · ไม่แน่ใจตรงไหน · ครั้งหน้าอยากทำอะไร'
              : 'เข้าเว็บเดิมด้วยรหัสห้องกับรหัส 4 หลัก'
          }
        >
          {/* ช่วงนี้ไม่ต้องบอกจำนวนคน เหลือแค่ทางกลับเข้าห้อง */}
          <BoardRoomCode roomCode={roomCode} qrSvg={qrSvg} joinUrl={joinUrl} />
        </BoardStage>
      ) : null}
      </div>
    </AppShell>
  )
}
