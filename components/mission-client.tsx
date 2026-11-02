'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
// import แบบ type เท่านั้น — ตัวโหลดไฟล์เนื้อหาต้องไม่หลุดเข้าบันเดิลฝั่งเบราว์เซอร์
import type { ChannelId, Mission } from '@/components/missions'
import { MissionGame, type GameData } from '@/components/mission-game'
import { StudentShell } from '@/components/student-shell'
import { AppFooter } from '@/components/app-shell'
import { BuddyPanel } from '@/components/buddy/buddy-panel'
import { PlanRequestPanel } from '@/components/plan-request-client'
import { Sheet, SheetChip } from '@/components/sheet-client'
import { StageLine } from '@/components/flow-feedback-client'
import { assemblePlanOf } from '@/components/server/mission-check-mode'
import type { StudentNextStep } from '@/components/server/next-step'
import {
  BookmarkIcon,
  Button,
  CheckIcon,
  ChevronRightIcon,
  ChoiceCard,
  DomeSays,
  DomeAvatar,
  KnowledgeIcon,
  LightbulbIcon,
  PlayIcon,
  QuestIcon,
  RefreshIcon,
  SkipIcon,
  StatBadge,
  UsersIcon,
  type IconProps,
} from '@/components/ui'
import type { ReactNode } from 'react'
import { MissionPassCard } from '@/components/mission-pass-card'
import { useExitConfirm } from '@/components/student-navigation'

/**
 * หน้าจอภารกิจย่อย — **แสดงผลอย่างเดียว**
 *
 * ⚠️ คำใบ้ที่ยังไม่ปลดล็อกไม่ถูกส่งมาที่นี่เลย ขอผ่าน POST /api/hint ทีละใบ
 * ⚠️ ข้อ check ตรวจที่ POST /api/mission/[id]/check · มินิเกมตรวจที่ /api/mission/[id]/game
 * ⚠️ ตัวเลขทุกตัว (ครั้งที่ตอบ ดาว ความคืบหน้า) มาจากฐานข้อมูลผ่าน props ห้ามฝังค่าตัวอย่าง
 */
export type MissionWithoutHints = Omit<Mission, 'hints'>

const CHANNEL_ORDER: ChannelId[] = ['clip', 'card', 'game', 'buddy']

/** ไอคอนของแต่ละช่องทางเป็น SVG จากระบบดีไซน์ ไม่ใช้ emoji (เรนเดอร์ไม่เหมือนกันทุกเครื่อง) */
const CHANNEL_LABELS: Record<
  ChannelId,
  { label: string; Icon: (props: IconProps) => ReactNode }
> = {
  clip: { label: 'ดู', Icon: PlayIcon },
  card: { label: 'อ่าน', Icon: BookmarkIcon },
  game: { label: 'ลงมือทำ', Icon: QuestIcon },
  buddy: { label: 'คุยคู่หู', Icon: UsersIcon },
}

/** ตัวอักษรนำหน้าตัวเลือก ให้ครูอ้างถึงข้อได้ตอนพูดหน้าห้อง */
const CHOICE_MARKERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'correct'; explanation: string | null }
  | { kind: 'wrong' }
  | { kind: 'unavailable'; message: string }

/** ระดับความมั่นใจ ตรงกับ content/self-profile.json → confidenceScale.levels */
export interface ConfidenceLevel {
  value: 1 | 2 | 3
  label: string
  studentText: string
}

export interface MissionProgressRow {
  id: string
  title: string
  passed: boolean
  stars: number
}

export function MissionClient({
  studentId,
  mission,
  hintsTotal,
  revealedHints,
  attempts: attemptsFromServer,
  wrong: wrongFromServer,
  passed: passedFromServer,
  route,
  suggestedRoute,
  suggestionReason = null,
  storyText = null,
  storyPersonalized = false,
  progressRows,
  totalStars,
  gameData,
  confidence,
  helpRequested,
  nextStep: _nextStep,
  passedAnswer = null,
  stationSection = null,
}: {
  studentId: string
  mission: MissionWithoutHints
  hintsTotal: number
  revealedHints: string[]
  attempts: number
  wrong: number
  passed: boolean
  route: ChannelId | null
  suggestedRoute: ChannelId | null
  /**
   * เหตุผลที่ระบบเสนอช่องทางนี้ (E-03) — คิดจากผลจริงในคาบ ไม่ใช่ความชอบตอนต้นคาบ
   * null = ยังไม่มีประวัติพอจะบอกอะไรได้ · **เป็นข้อเสนอเท่านั้น ทุกช่องทางยังกดได้ครบ**
   */
  suggestionReason?: string | null
  /**
   * E-07 + S-16 บทเปิดเฉพาะร้านของผู้เรียนคนนี้ (เซิร์ฟเวอร์เรนเดอร์มาให้แล้ว)
   * ⚠️ **ห้ามไป fetch ใหม่ระหว่างที่ผู้เรียนกำลังอ่าน** ข้อความต้องนิ่งจนกว่าจะเปลี่ยนภารกิจ
   *    ยังแต่งไม่เสร็จก็ได้ประโยคสำรองมาแล้ว ไม่มีจังหวะไหนที่จอว่างหรือมีตัวหมุนรอ
   */
  storyText?: string | null
  /** true = เรื่องที่แต่งให้ร้านนี้โดยเฉพาะ · false = ประโยคสำรอง (หน้าจอแสดงเหมือนกัน) */
  storyPersonalized?: boolean
  progressRows: MissionProgressRow[]
  totalStars: number
  /** เป้าดาวของคาบ — หน้านี้ไม่ได้ใช้แล้ว (ย้ายไปแสดงที่หน้าหลัก) แต่ยังรับไว้ให้หน้าเรียกใช้ได้เหมือนเดิม */
  goalStars?: number | null
  gameData: GameData | null
  /** คำถาม+ตัวเลือกความมั่นใจจากไฟล์เนื้อหา (ไม่ hardcode ในหน้าจอ) */
  confidence: { question: string; helper: string; levels: ConfidenceLevel[] }
  /** ผู้เรียนกดขอครูค้างอยู่หรือไม่ (อ่านจาก DB) */
  helpRequested: boolean
  /**
   * ทำจบข้อนี้แล้วไปไหนต่อ — มาจาก `studentNextStep()` ฝั่งเซิร์ฟเวอร์
   * **ห้ามคิดเองในหน้าจอ** ไม่งั้นจอนี้จะบอกคนละทางกับ /home และ /map (flow-1.md ข้อ 1)
   */
  nextStep: StudentNextStep
  /** ผ่านแล้วเราตอบอะไรไป เช่น "ข้อ ก" — null = อ่านไม่ได้ จอจะไม่พูดถึงเรื่องนี้ */
  passedAnswer?: string | null
  /** ส่วนเสริมของภารกิจนั้น เช่น สำนักงานจดทะเบียนของ m3 (เรนเดอร์จากฝั่งเซิร์ฟเวอร์) */
  stationSection?: ReactNode
}) {
  const router = useRouter()
  const exit = useExitConfirm({
    href: '/map',
    note: 'คำใบ้หรือคำขอความช่วยเหลือที่ส่งไปแล้วจะยังอยู่ ส่วนคำตอบที่ยังไม่ได้กดตรวจจะหายไปเมื่อออกจากภารกิจ',
  })
  const [channel, setChannel] = useState<ChannelId | null>(route)
  const [openCard, setOpenCard] = useState<number | null>(null)
  const [hints, setHints] = useState<string[]>(revealedHints)
  const [choiceIndex, setChoiceIndex] = useState<number | null>(null)
  const [wrongCount, setWrongCount] = useState(wrongFromServer)
  const [attempts, setAttempts] = useState(attemptsFromServer)
  const [check, setCheck] = useState<CheckState>(
    passedFromServer ? { kind: 'correct', explanation: null } : { kind: 'idle' },
  )
  const [busy, setBusy] = useState(false)
  const [confidenceValue, setConfidenceValue] = useState<1 | 2 | 3 | null>(null)
  const [helpOn, setHelpOn] = useState(helpRequested)
  const [helpNote, setHelpNote] = useState<string | null>(null)
  /** แผ่นที่เปิดอยู่ — ที่เดียวในหน้าที่เลื่อนได้ (กติกา "หน้าห้ามเลื่อน" ของเจ้าของ) */
  const [sheet, setSheet] = useState<'story' | 'hints' | 'learn' | 'teacher' | null>(null)
  /** โหมดประกอบ: ช่องไหนใส่ชิ้นส่วนอะไรไว้ */
  const [placed, setPlaced] = useState<Record<string, string>>({})
  /** ผลรายช่องจากเซิร์ฟเวอร์ — ผิดตรงไหนบอกตรงจุด ไม่ได้บอกว่าช่องนั้นต้องใส่อะไร */
  const [slotResults, setSlotResults] = useState<Record<string, boolean> | null>(null)
  const checking = check.kind === 'checking'

  const passed = check.kind === 'correct'
  const showStuck = wrongCount > 2 && !passed
  const hintsExhausted = hints.length >= hintsTotal

  /**
   * ข้อนี้เล่นแบบประกอบชิ้นส่วนหรือแบบตัวเลือก — ตัดสินจากรูปร่างของเนื้อหาสาธารณะเท่านั้น
   * (`components/server/mission-check-mode.ts` import แบบ type-only จึงไม่ลากไฟล์เฉลยเข้าบันเดิล)
   */
  const assemble = useMemo(() => assemblePlanOf(mission as Mission, studentId), [mission, studentId])
  const usedPieceIds = useMemo(() => new Set(Object.values(placed)), [placed])
  const allSlotsFilled = assemble ? assemble.slots.every((s) => placed[s.id] !== undefined) : false
  const answerReady = assemble ? allSlotsFilled : choiceIndex !== null

  /** บรรทัดเดียวของโดม — เรื่องเต็มอยู่ในแผ่น ไม่ให้กินความสูงของจอ */
  const domeLine = (storyText ?? mission.intro).replace(/\s+/g, ' ').trim()

  /** ป้ายบอกว่าแต่ละช่องคืออะไร — ประกอบจากไฟล์เนื้อหา ไม่ได้พิมพ์เอง */
  const slotLabelLine = assemble ? assemble.slots.map((s) => s.label).join(' · ') : ''

  /** ตำแหน่งของภารกิจนี้ในลำดับ + ดาวที่ได้จริง (อ่านจากแถวที่เซิร์ฟเวอร์ส่งมา) */
  const myIndex = Math.max(0, progressRows.findIndex((r) => r.id === mission.id))
  const myStars = progressRows.find((r) => r.id === mission.id)?.stars ?? 0
  const hasNextMission = progressRows.some((r) => r.id !== mission.id && !r.passed)

  /**
   * ผ่านแล้วต้องบอกด้วยว่า "เราตอบอะไรไป" — เด็กเปิดย้อนมาดูจะได้ไม่ต้องเดา (flow-1.md ข้อ 3)
   *
   * ⚠️ เพิ่งตอบถูกในจอนี้ = อ่านจากสิ่งที่เพิ่งกดได้เลย
   *    **เปิดย้อนกลับมาดูทีหลัง = ค่าที่กดไม่อยู่ในเครื่องแล้ว** ต้องใช้ `passedAnswer` ที่เซิร์ฟเวอร์ส่งมา
   *    (ของเดิมใช้แต่ค่าในเครื่อง พอรีเฟรชบรรทัดนี้ก็หายไปเงียบ ๆ ซึ่งคือเคสที่ reviewer เจอ)
   */
  const myAnswerLabel = !passed
    ? null
    : (assemble
        ? assemble.slots
            .map((sl) => assemble.pieces.find((pc) => pc.id === placed[sl.id])?.text)
            .filter(Boolean)
            .join(' ') || null
        : choiceIndex !== null
          ? `ข้อ ${CHOICE_MARKERS[choiceIndex] ?? choiceIndex + 1}`
          : null) ?? passedAnswer

  const resultLine = passed
    ? 'ผ่านภารกิจแล้ว'
    : check.kind === 'wrong'
      ? assemble
        ? 'ช่องที่เป็นสีแดงยังไม่ใช่ ลองสลับชิ้นส่วนดูอีกที'
        : `ยังไม่ใช่ ลองใหม่อีกครั้ง (ตอบยังไม่ถูกไปแล้ว ${wrongCount} ครั้ง)`
      : check.kind === 'unavailable'
        ? check.message
        : `ส่งไปแล้ว ${attempts} ครั้ง · คำใบ้ไม่หักดาว`

  function closeSheet() {
    setSheet(null)
  }

  /**
   * แตะชิ้นส่วน = ใส่ลงช่องว่างช่องถัดไป (mockup ใช้การแตะ ไม่ใช่การลาก นิ้วเด็กทำง่ายกว่า)
   *
   * ⚠️ ต้องหาช่องว่าง **ข้างในตัวอัปเดตสถานะ** ไม่ใช่จากค่าที่คำนวณไว้ตอนวาด
   *    เด็กแตะรัว ๆ 3 ชิ้นติดกันเร็วกว่าที่ React จะวาดใหม่ทัน ถ้าอ่านค่าเก่าทุกชิ้นจะไปลงช่องเดียวกัน
   *    (เจอจริงตอนทดสอบ: แตะ 3 ชิ้นรวดเดียวแล้วได้ "/product .html ____")
   */
  function putPiece(pieceId: string) {
    if (passed || !assemble) return
    setPlaced((cur) => {
      if (Object.values(cur).includes(pieceId)) return cur
      const slot = assemble.slots.find((s) => cur[s.id] === undefined)
      if (!slot) return cur
      return { ...cur, [slot.id]: pieceId }
    })
    setSlotResults(null)
    if (check.kind === 'wrong') setCheck({ kind: 'idle' })
  }

  /** แตะช่องที่มีของ = เอาชิ้นส่วนออก */
  function clearSlot(slotId: string) {
    if (passed) return
    setPlaced((cur) => {
      const next = { ...cur }
      delete next[slotId]
      return next
    })
    setSlotResults(null)
    if (check.kind === 'wrong') setCheck({ kind: 'idle' })
  }

  async function pickChannel(next: ChannelId) {
    setChannel(next)
    setOpenCard(null)
    // บันทึกการสลับช่องทางฝั่งเซิร์ฟเวอร์ (from_route → to_route) สลับกี่ครั้งก็ได้ ไม่หักดาว
    await fetch(`/api/mission/${mission.id}/switch-route`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ toRoute: next }),
    }).catch(() => undefined)
    router.refresh()
  }

  async function askHint() {
    if (busy || hintsExhausted) return
    setBusy(true)
    try {
      const res = await fetch('/api/hint', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ missionId: mission.id }),
      })
      const data = (await res.json().catch(() => null)) as
        | { hint?: string | null; message?: string }
        | null
      if (!res.ok) {
        setCheck({ kind: 'unavailable', message: data?.message ?? 'ขอคำใบ้ไม่สำเร็จ' })
        return
      }
      if (typeof data?.hint === 'string') setHints((h) => [...h, data.hint as string])
      router.refresh()
    } catch {
      setCheck({ kind: 'unavailable', message: 'ต่อเน็ตไม่ได้ ลองขอคำใบ้ใหม่อีกครั้ง' })
    } finally {
      setBusy(false)
    }
  }

  /**
   * กดข้ามภารกิจนี้
   *
   * ⚠️ **เซิร์ฟเวอร์เป็นคนตัดสิน หน้าจอแค่เล่าผลตามที่เซิร์ฟเวอร์ตอบ**
   *    ห้ามเดาว่าข้ามสำเร็จ ห้ามเด้งหน้าถัดไปเมื่อถูกปฏิเสธ
   *    (บั๊กเดิม: โยนสถานะทิ้งแล้วขึ้น "ข้ามแล้ว" + push ทุกกรณี ทั้งที่เซิร์ฟเวอร์ตอบ 403
   *     ตัวเลขในระบบถูก แต่เด็กเข้าใจว่าข้ามได้ แล้วไม่กลับมาทำ)
   * ข้อความทุกบรรทัดมาจาก `reason` / `message` ที่เซิร์ฟเวอร์ส่งมา ซึ่งอ่านจาก content/rubric.json
   * หน้าจอไม่แต่งเหตุผลเอง เพราะเหตุผลคือกติกา ไม่ใช่ถ้อยคำ
   */
  async function skipMission() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/mission/${mission.id}/skip`, { method: 'POST' })
      const data = (await res.json().catch(() => null)) as {
        nextHref?: string
        by?: 'student' | 'teacher'
        stars?: number
        reason?: string
        message?: string
      } | null

      if (!res.ok) {
        // ยังไม่เข้าเงื่อนไข — อยู่หน้าเดิม และบอกเหตุผลตรง ๆ แบบไม่ตำหนิ
        setCheck({
          kind: 'unavailable',
          message:
            data?.message ?? 'ตอนนี้ยังข้ามภารกิจนี้ไม่ได้ ลองทำดูก่อนนะ เร็วกว่าที่คิด',
        })
        return
      }

      const earned = typeof data?.stars === 'number' && data.stars > 0
      setCheck({
        kind: 'unavailable',
        message: `${data?.reason ?? 'ข้ามภารกิจนี้แล้ว'} ${
          earned
            ? `ได้ ${data?.stars} ดาวเท่ากับทำผ่านเอง`
            : 'กลับมาทำเมื่อไหร่ก็ได้ ดาวไม่ถูกหัก'
        }`,
      })
      router.push(data?.nextHref ?? '/map')
    } catch {
      setCheck({ kind: 'unavailable', message: 'ข้ามไม่สำเร็จ ลองใหม่อีกครั้ง' })
    } finally {
      setBusy(false)
    }
  }

  /**
   * ขอให้ครูช่วย — ขึ้นธงแดงบนแผงครูทันที
   * ⚠️ ไม่ใช่ช่องทางการเรียนที่ 5 ค่า channel ใน DB ยังเป็น clip|card|game|buddy เท่านั้น
   */
  async function toggleHelp() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/help', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ missionId: mission.id, cancel: helpOn }),
      })
      const data = (await res.json().catch(() => null)) as
        | { askedForHelp?: boolean; message?: string }
        | null
      if (!res.ok) {
        setHelpNote(data?.message ?? 'เรียกครูไม่สำเร็จ ยกมือเรียกครูได้เลย')
        return
      }
      setHelpOn(data?.askedForHelp === true)
      setHelpNote(data?.message ?? null)
      router.refresh()
    } catch {
      setHelpNote('ต่อเน็ตไม่ได้ ยกมือเรียกครูได้เลย')
    } finally {
      setBusy(false)
    }
  }

  function restart() {
    setChoiceIndex(null)
    setPlaced({})
    setSlotResults(null)
    setCheck({ kind: 'idle' })
    setOpenCard(null)
  }

  async function submitCheck() {
    if (!answerReady || check.kind === 'checking' || busy) return
    setCheck({ kind: 'checking' })
    try {
      const res = await fetch(`/api/mission/${mission.id}/check`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          checkId: mission.check.id,
          // โหมดประกอบส่งชิ้นส่วนที่วางไว้ · โหมดตัวเลือกส่งหมายเลขข้อเหมือนเดิม
          ...(assemble ? { placements: placed } : { choiceIndex }),
          ...(channel ? { channel } : {}),
          ...(confidenceValue ? { confidence: confidenceValue } : {}),
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | {
            correct?: boolean
            explanation?: string
            attempts?: number
            wrong?: number
            message?: string
            slotResults?: Record<string, boolean>
          }
        | null

      if (res.status === 503) {
        setCheck({ kind: 'unavailable', message: data?.message ?? 'ระบบตรวจคำตอบยังไม่พร้อม' })
        return
      }
      if (!res.ok) {
        setCheck({
          kind: 'unavailable',
          message: data?.message ?? 'ส่งคำตอบไม่สำเร็จ ลองใหม่อีกครั้ง',
        })
        return
      }

      if (typeof data?.attempts === 'number') setAttempts(data.attempts)
      if (typeof data?.wrong === 'number') setWrongCount(data.wrong)
      setSlotResults(data?.slotResults ?? null)
      setCheck(
        data?.correct === true
          ? { kind: 'correct', explanation: data.explanation ?? null }
          : { kind: 'wrong' },
      )
      router.refresh()
    } catch {
      setCheck({ kind: 'unavailable', message: 'ต่อเน็ตไม่ได้ ลองส่งใหม่อีกครั้ง' })
    }
  }

  /**
   * UX-2 — หน้าจอภารกิจ "จบในหน้าเดียว ไม่เลื่อนเลย"
   *
   * เจ้าของโปรเจกต์สั่งว่าแม้แต่ส่วนเนื้อหาก็ห้ามเลื่อน ทุกจอต้องจบในหน้าเดียวเหมือน mockup
   * ของที่ยาว (บทเปิดเต็ม · คำใบ้ · ความรู้เพิ่มเติม · ช่องทางการเรียน · เรื่องที่ต้องคุยกับครู)
   * จึงย้ายไปอยู่ในแผ่นเลื่อนขึ้นจากด้านล่าง ซึ่งผู้เรียนเป็นคนเปิดเอง
   *
   * ⚠️ ห้ามเพิ่มบล็อกที่ความสูงไม่จำกัดลงในกรอบนี้อีก ถ้าจะเพิ่มของให้เอาเข้า <Sheet>
   */
  return (
    <>
      <StudentShell
      className="mission-world-shell flex h-full min-h-0 flex-col gap-2 pt-3! pb-2!"
      onBack={exit.request}
      footer={
        <AppFooter>
          {passed ? (
            <>
              {/* จบภารกิจแล้วกลับแผนที่เสมอ แผนที่จะฉลองเกาะนี้และชี้เกาะถัดไปให้แตะเอง */}
              <Link
                href={`/map?done=${encodeURIComponent(mission.id)}`}
                className="btn-quest bg-quest-600 text-ink-onbrand hover:bg-quest-700"
              >
                <span className="min-w-0 truncate">{hasNextMission ? 'กลับแผนที่ ไปเกาะถัดไป' : 'กลับแผนที่'}</span>
                <ChevronRightIcon width={22} height={22} aria-hidden className="shrink-0" />
              </Link>
            </>
          ) : (
            /* ปุ่มลงมือหลักตาม mockup — แถบเขียวเต็มความกว้าง มีไอคอนติ๊ก */
            <Button
              variant="success"
              size="lg"
              fullWidth
              onClick={submitCheck}
              disabled={!answerReady || busy}
              loading={checking}
              loadingLabel="กำลังตรวจคำตอบ"
              leadingIcon={checking ? undefined : <CheckIcon width={22} height={22} />}
            >
              {checking ? 'กำลังตรวจ…' : 'ตรวจคำตอบ'}
            </Button>
          )}
        </AppFooter>
      }
    >
      {/* แถวบน: ความคืบหน้า 4 ภารกิจ + ดาวสะสม — ค่าทั้งหมดมาจากฐานข้อมูล */}
      <div className="flex shrink-0 items-center gap-2">
        <ol className="flex min-w-0 flex-1 gap-1.5">
          {progressRows.map((row, i) => (
            <li key={row.id} className="flex-1">
              <Link
                href={`/mission/${row.id}`}
                aria-current={row.id === mission.id ? 'page' : undefined}
                aria-label={`ภารกิจที่ ${i + 1} ${row.title}${row.passed ? ' — ผ่านแล้ว' : ''}`}
                className={`flex min-h-11 items-center justify-center rounded-lg text-label font-bold focus-ring ${
                  row.passed
                    ? 'bg-quest-600 text-ink-onbrand'
                    : row.id === mission.id
                      ? 'bg-brand-600 text-ink-onbrand'
                      : 'bg-surface-sunken text-ink-muted'
                }`}
              >
                {/* ผ่านแล้วก็ยังต้องเห็นเลขข้อ ไม่งั้นเด็กไม่รู้ว่าวงกลมพวกนี้คือภารกิจ (FLOW-1 ข้อ 27) */}
                <span aria-hidden="true" className="flex items-center gap-0.5">
                  {row.passed ? <CheckIcon width={14} height={14} /> : null}
                  {i + 1}
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <StatBadge kind="star" value={totalStars} label="ดาวสะสม" hideLabel size="sm" />
      </div>
      {/* อยู่ตรงไหนของคาบ + อยู่ภารกิจที่เท่าไร — จอที่เด็กอยู่นานที่สุดต้องบอกเองทั้งคู่ (flow-1.md ข้อ 21)
          ใช้ชิปเดียวกับจออื่น จะได้เป็นภาษาเดียวกันทั้งระบบ ไม่ใช่ตัวหนังสือเทาลอย ๆ */}
      <StageLine
        stage="ขั้นที่ 3 · ลุยภารกิจ"
        remain={`ภารกิจที่ ${myIndex + 1} จาก ${progressRows.length}`}
        icon={<QuestIcon width={14} height={14} />}
      />

      {/**
        * ผ่านแล้ว — แถบเขียวเต็มความกว้าง **เหนือคำถาม** (FLOW-1 ข้อ 3)
        * ของเดิมขึ้นคำว่า "ผ่านภารกิจแล้ว" เป็นตัวหนังสือเล็กใต้ตัวเลือก เด็กกดตัวเลือกแล้วไม่ขยับ
        * นึกว่าจอค้าง เพราะไม่มีอะไรบอกว่าจบไปแล้วและไม่บอกว่าตอบข้อไหน
        */}

      {/**
        * โจทย์สั้นตาม mockup — รายละเอียดยาว ๆ อยู่ในแผ่น "ความรู้เพิ่มเติม"
        *
        * ⚠️ โหมดประกอบใช้ **ชื่อ**ของมินิเกม ไม่ใช่ `instruction`
        *    เพราะ instruction ของไฟล์เนื้อหาเขียนคำตอบไว้ตรง ๆ ("ให้ได้เป็น www.…")
        *    เอามาขึ้นหัวจอเมื่อไหร่คือเฉลยข้อตรวจทันที
        */}
      <h1 className="mission-question-card shrink-0 rounded-2xl bg-surface-raised px-3 py-2 text-title-sm font-extrabold text-balance text-ink shadow-soft-1 ring-1 ring-line ring-inset">
        {assemble ? mission.channels.game.title : mission.check.question}
      </h1>

      {/**
        * พื้นที่เล่น — โหมดประกอบชิ้นส่วน หรือตัวเลือก แล้วแต่รูปร่างของเนื้อหาภารกิจนั้น
        *
        * ⚠️ ผ่านแล้ว **ไม่แสดงตัวเลือกให้กดอีก** (FLOW-1 ข้อ 3)
        *    ของเดิมยังโชว์ ก-ง พร้อมวงกลมเหมือนยังไม่ได้ตอบ เด็กกดแล้วไม่มีอะไรเกิดขึ้น นึกว่าจอค้าง
        *    และการ์ดยังเบียดกันจนตัวหนังสือทับกัน เพราะแถบเขียวกินความสูงไป
        */}
      <div className="flex min-h-0 flex-1 flex-col">
        {passed ? (
          <MissionPassCard
            missionNo={myIndex + 1}
            stars={myStars}
            answerLabel={myAnswerLabel}
            explanation={check.kind === 'correct' ? check.explanation : null}
            hasNext={hasNextMission}
            passedCount={progressRows.filter((r) => r.passed || r.id === mission.id).length}
            totalMissions={progressRows.length}
          />
        ) : assemble ? (
          <div className="flex h-full flex-col gap-2">
            {/* ช่องว่างรูปแบบ www.____.com — แตะชิ้นส่วนแล้วเข้าช่อง แตะช่องเพื่อเอาออก */}
            <div className="flex flex-wrap items-stretch justify-center gap-1.5 rounded-2xl bg-surface-raised p-2.5 shadow-soft-1">
              {assemble.slots.map((slot) => {
                const pieceId = placed[slot.id]
                const piece = assemble.pieces.find((p) => p.id === pieceId) ?? null
                const verdict = slotResults?.[slot.id]
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => clearSlot(slot.id)}
                    disabled={passed || piece === null}
                    aria-label={
                      piece ? `${slot.label} ใส่ ${piece.text} แล้ว แตะเพื่อเอาออก` : `${slot.label} ยังว่าง`
                    }
                    className={`flex min-h-12 min-w-20 flex-1 items-center justify-center rounded-xl px-2 text-body font-bold ring-2 ring-inset focus-ring ${
                      verdict === false
                        ? 'bg-danger-100 text-danger-700 ring-danger-600'
                        : verdict === true
                          ? 'bg-quest-50 text-quest-700 ring-quest-600'
                          : piece
                            ? 'bg-brand-50 text-brand-700 ring-brand-500'
                            : 'border-dashed bg-surface-sunken text-ink-subtle ring-line-contrast'
                    }`}
                  >
                    <span className="min-w-0 truncate">{piece ? piece.text : '____'}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-center text-label text-ink-muted">
              {slotLabelLine}
            </p>

            {/* ชิ้นส่วนให้แตะเลือก — ชิ้นที่ใส่ไปแล้วจางลงแต่ยังอยู่ที่เดิม ตำแหน่งไม่กระโดด */}
            <div className="flex flex-wrap content-start justify-center gap-1.5">
              {assemble.pieces.map((piece) => {
                const used = usedPieceIds.has(piece.id)
                return (
                  <button
                    key={piece.id}
                    type="button"
                    onClick={() => putPiece(piece.id)}
                    disabled={passed || used || allSlotsFilled}
                    aria-pressed={used}
                    className={`btn-base min-h-11 rounded-full px-3.5 text-label font-bold ring-2 ring-inset focus-ring ${
                      used
                        ? 'bg-surface-sunken text-ink-subtle ring-line'
                        : 'bg-surface-raised text-ink ring-line-contrast hover:bg-brand-50'
                    }`}
                  >
                    {piece.text}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
            {mission.check.choices.map((c, i) => (
              <li key={c} className="shrink-0">
                <ChoiceCard
                  className="min-h-12 gap-2.5 px-3 py-2 [&>span:first-child]:size-9! [&>span:nth-child(2)>span]:text-label!"
                  label={c}
                  marker={CHOICE_MARKERS[i] ?? String(i + 1)}
                  selected={choiceIndex === i}
                  state={
                    passed && choiceIndex === i
                      ? 'correct'
                      : check.kind === 'wrong' && choiceIndex === i
                        ? 'wrong'
                        : 'idle'
                  }
                  disabled={passed}
                  onSelect={() => setChoiceIndex(i)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ผลการตรวจ — บรรทัดเดียว ไม่ดันจอ
          ผ่านแล้วไม่ต้องพูดซ้ำ แถบเขียวเหนือคำถามบอกไปแล้วว่าผ่านและได้กี่ดาว */}
      {passed ? null : (
        <p
          role="status"
          className={`shrink-0 truncate text-center text-label font-bold ${
            check.kind === 'wrong' ? 'text-danger-700' : 'text-ink-muted'
          }`}
        >
          {resultLine}
        </p>
      )}

      {/* ความมั่นใจก่อนรู้ผล — วัตถุดิบของธง "ควรคุย" บนแผงครู เก็บไว้แต่ย่อเป็นชิปแถวเดียว */}
      {passed ? null : (
        <div className="shrink-0">
          <div role="radiogroup" aria-label={confidence.question} className="flex gap-1.5">
            {confidence.levels.map((level) => (
              <button
                key={level.value}
                type="button"
                role="radio"
                aria-checked={confidenceValue === level.value}
                onClick={() => setConfidenceValue(level.value)}
                className={`btn-base min-h-11 flex-1 rounded-xl px-1 text-note font-bold ring-1 ring-inset focus-ring ${
                  confidenceValue === level.value
                    ? 'bg-brand-600 text-ink-onbrand ring-brand-700'
                    : 'bg-surface-raised text-ink-muted ring-line'
                }`}
              >
                <span className="min-w-0 truncate">{level.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ตัวช่วยกับเรื่องของภารกิจอยู่แถวเดียวกัน — ให้ตัวเลือกได้พื้นที่ครบทั้ง 4 ข้อบนจอ 360x740 */}
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <SheetChip
          tone="brand"
          icon={<DomeAvatar mood={passed ? 'celebrate' : 'cheer'} size={24} decorative />}
          onClick={() => setSheet('story')}
          ariaLabel={`ฟังโดมเล่าเรื่องของภารกิจ ${domeLine}`}
        >
          โดมเล่าเรื่อง
        </SheetChip>
        <SheetChip
          tone="spark"
          icon={<LightbulbIcon width={18} height={18} />}
          onClick={() => setSheet('hints')}
          ariaLabel={`ตัวช่วย เปิดเมนูคำใบ้และการช่วยเหลือ เปิดไปแล้ว ${hints.length} จาก ${hintsTotal} ใบ`}
        >
          ตัวช่วย
        </SheetChip>
      </div>

      {/* ───────── แผ่นเลื่อนขึ้น: ที่เก็บของที่ยาวเกินจอ ───────── */}

      <Sheet
        open={sheet === 'story'}
        onClose={closeSheet}
        title={mission.title}
        description={mission.objective}
      >
        <DomeSays mood="cheer" speakerName="โดม" avatarSize={64}>
          {storyText ?? mission.intro}
        </DomeSays>
        {storyPersonalized ? (
          <p className="mt-2 text-label text-pretty text-ink-muted">
            เรื่องนี้แต่งจากร้านของเราโดยเฉพาะ
          </p>
        ) : null}
      </Sheet>

      <Sheet
        open={sheet === 'hints'}
        onClose={closeSheet}
        title="คำใบ้"
        description="เปิดคำใบ้กี่อันก็ได้ ไม่หักดาว ดาวขึ้นกับจำนวนครั้งที่ตอบยังไม่ถูกเท่านั้น"
      >
        {hints.length === 0 ? (
          <p className="text-body text-pretty text-ink-muted">
            ยังไม่ได้เปิดคำใบ้เลย กดปุ่มข้างล่างเพื่อเปิดใบแรก
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {hints.map((h, i) => (
              <li
                key={h}
                className="flex gap-2 rounded-2xl bg-spark-50 px-4 py-3 ring-1 ring-spark-100 ring-inset"
              >
                <LightbulbIcon width={20} height={20} aria-hidden className="mt-0.5 shrink-0 text-spark-600" />
                <p className="min-w-0 text-body text-pretty text-ink">
                  <span className="font-bold text-spark-700">คำใบ้ {i + 1}: </span>
                  {h}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Button
          className="mt-4"
          variant="secondary"
          size="lg"
          fullWidth
          onClick={askHint}
          disabled={hintsExhausted || busy}
          leadingIcon={<LightbulbIcon width={22} height={22} />}
        >
          {hintsExhausted ? `เปิดครบแล้ว ${hints.length} จาก ${hintsTotal} อัน` : 'ขอคำใบ้อีกหนึ่งอัน'}
        </Button>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <SheetChip tone="brand" icon={<KnowledgeIcon width={18} height={18} />} onClick={() => setSheet('learn')}>
            เลือกวิธีเรียน
          </SheetChip>
          <SheetChip tone={helpOn ? 'danger' : 'plain'} icon={<UsersIcon width={18} height={18} />} onClick={() => setSheet('teacher')}>
            คุยกับครู
          </SheetChip>
          {!passed ? <SheetChip tone="quest" icon={<RefreshIcon width={18} height={18} />} onClick={restart}>เริ่มใหม่</SheetChip> : null}
          {!passed ? <SheetChip tone="danger" icon={<SkipIcon width={18} height={18} />} onClick={skipMission} disabled={busy}>ข้ามภารกิจ</SheetChip> : null}
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'learn'}
        onClose={closeSheet}
        title="ความรู้เพิ่มเติม"
        description="เปิดดูกี่รอบก็ได้ ไม่เสียดาว · เลือกวิธีเรียนที่ถนัดได้ตลอดเวลา"
      >
        {/* E-03 เลือกช่องทางการเรียน — ยังกดได้ครบทุกทาง ระบบแค่เสนอ */}
        <p className="text-label font-bold text-ink">วิธีเรียนของฉัน</p>
        {suggestionReason ? (
          <p className="mt-0.5 text-note text-pretty text-ink-muted">{suggestionReason}</p>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-2">
          {CHANNEL_ORDER.map((c) => {
            const meta = CHANNEL_LABELS[c]
            const on = channel === c
            const Icon = meta.Icon
            return (
              <button
                key={c}
                type="button"
                onClick={() => void pickChannel(c)}
                aria-pressed={on}
                className={`btn-base min-h-12 w-full justify-start rounded-xl px-3 text-label font-bold ring-2 ring-inset ${
                  on
                    ? 'bg-brand-600 text-ink-onbrand ring-brand-700'
                    : 'bg-surface-raised text-ink ring-line'
                }`}
              >
                <Icon width={20} height={20} aria-hidden className="shrink-0" />
                <span className="min-w-0 truncate text-left">{meta.label}</span>
                {suggestedRoute === c ? <span className="shrink-0 text-note">แนะนำ</span> : null}
              </button>
            )
          })}
        </div>

        <div className="mt-4">
          {channel === 'clip' ? (
            <>
              <h3 className="text-body font-bold text-ink">{mission.channels.clip.title}</h3>
              <p className="mt-2 text-body text-pretty text-ink">{mission.channels.clip.script}</p>
            </>
          ) : null}

          {channel === 'card' ? (
            <ul className="flex flex-col gap-2">
              {mission.channels.card.cards.map((card, i) => (
                <li key={card.front}>
                  <button
                    type="button"
                    onClick={() => setOpenCard(openCard === i ? null : i)}
                    aria-expanded={openCard === i}
                    className="w-full rounded-xl bg-surface-raised px-4 py-3 text-left text-body font-bold text-ink shadow-soft-1 ring-1 ring-line ring-inset focus-ring"
                  >
                    {card.front}
                  </button>
                  {openCard === i ? (
                    <p className="mt-1 rounded-xl bg-brand-50 px-4 py-3 text-body text-pretty text-ink">
                      {card.back}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {channel === 'game' ? (
            gameData ? (
              <MissionGame missionId={mission.id} data={gameData} />
            ) : (
              <p className="text-body text-pretty text-ink-muted">
                มินิเกมของภารกิจนี้ยังไม่พร้อม ลองช่องทางอื่นก่อนได้
              </p>
            )
          ) : null}

          {channel === 'buddy' ? (
            <>
              <dl className="flex flex-col gap-2 text-body text-ink">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-bold text-brand-700">คนที่ 1:</dt>
                  <dd className="min-w-0 text-pretty">{mission.channels.buddy.roleA}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-bold text-brand-700">คนที่ 2:</dt>
                  <dd className="min-w-0 text-pretty">{mission.channels.buddy.roleB}</dd>
                </div>
              </dl>
              <BuddyPanel missionId={mission.id} className="mt-3" />
            </>
          ) : null}

          {channel === null ? (
            <p className="text-body text-pretty text-ink-muted">
              เลือกวิธีเรียนสักอันข้างบน แล้วเนื้อหาจะขึ้นตรงนี้
            </p>
          ) : null}
        </div>

        <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
          {mission.channels.clip.keyPoints.map((k) => (
            <li key={k} className="flex gap-2 text-body text-ink">
              <CheckIcon width={20} height={20} aria-hidden className="mt-1 shrink-0 text-quest-600" />
              <span className="min-w-0 text-pretty">{k}</span>
            </li>
          ))}
        </ul>

        {stationSection ? <div className="mt-4">{stationSection}</div> : null}

        <Link
          href="/knowledge"
          className="btn-base mt-4 min-h-12 w-full bg-surface-raised text-brand-700 shadow-soft-1 ring-2 ring-brand-100 ring-inset hover:bg-brand-50"
        >
          ไปคลังความรู้ทั้งหมด
          <ChevronRightIcon width={20} height={20} aria-hidden />
        </Link>
      </Sheet>

      <Sheet
        open={sheet === 'teacher'}
        onClose={closeSheet}
        title="คุยกับครู"
        description="ใช้ตอนที่ติดจริง ๆ ครูเห็นทันทีบนแผงของครู"
      >
        <button
          type="button"
          onClick={toggleHelp}
          disabled={busy}
          aria-pressed={helpOn}
          className={`btn-base min-h-14 w-full rounded-xl text-body font-bold ${
            helpOn
              ? 'bg-spark-600 text-ink-onbrand shadow-soft-2'
              : 'bg-surface-raised text-spark-700 shadow-soft-1 ring-2 ring-spark-200 ring-inset'
          }`}
        >
          <UsersIcon width={22} height={22} aria-hidden className="shrink-0" />
          <span className="min-w-0 text-pretty">
            {helpOn ? 'เรียกครูแล้ว (กดอีกครั้งเพื่อยกเลิก)' : 'ขอให้ครูช่วย'}
          </span>
        </button>
        {helpNote ? (
          <p className="mt-2 text-center text-label text-pretty text-ink-muted">{helpNote}</p>
        ) : null}

        <PlanRequestPanel missionId={mission.id} className="mt-3" />

        {showStuck ? (
          <div className="mt-3">
            <DomeSays mood="cheer" speakerName="โดม" avatarSize={56}>
              {mission.stuckMessage}
            </DomeSays>
          </div>
        ) : null}
      </Sheet>
      </StudentShell>
      {exit.dialog}
    </>
  )
}
