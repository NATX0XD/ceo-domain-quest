'use client'

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { PageHeading, SignInGate, StudentShell } from '@/components/student-shell'
import './ceo-done.css'
import { AppFooter } from '@/components/app-shell'
import { useExitConfirm } from '@/components/student-navigation'
import '@/components/mission-revisit.css'
import { Sheet, SheetChip } from '@/components/sheet-client'
import { GameHeader } from '@/components/learn/game-header'
import { useM1Sound } from '@/components/learn/m1/m1-shell'
import { buzz } from '@/components/learn/app/fx'
import './ceo-game.css'
import {
  AlertIcon,
  Button,
  ChevronRightIcon,
  ChoiceCard,
  ClockIcon,
  EmptyState,
  InfoIcon,
  MicIcon,
  QuestIcon,
  SendIcon,
  StopIcon,
  CreamCard,
  WoodSign,
  cn,
} from '@/components/ui'

/**
 * หน้าจอด่านบอส CEO — **แสดงผลอย่างเดียว ไม่ตัดสินอะไรเองเลย**
 *
 * ⚠️ ห้าม import `@/core/*`, `@/components/server/*` หรือ `content/*.json` เข้ามาในไฟล์นี้
 *    ไฟล์เนื้อหามีเฉลยและน้ำหนักคะแนนอยู่ เซิร์ฟเวอร์เป็นคนโหลดแล้วส่งมาเป็น props ธรรมดา
 * ⚠️ ความครบถ้วนของใบเสนอถูกตรวจซ้ำที่ POST /api/ceo การตรวจตรงนี้มีไว้บอกผู้เรียนเร็ว ๆ เท่านั้น
 */
export interface CeoField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'choice'
  placeholder: string
  options: { value: string; label: string }[]
  help: string
  required: boolean
}

export interface CeoRubricRow {
  id: string
  dimension: string
  levels: { score: number; label: string; descriptor: string }[]
}

export interface CeoSubmitMode {
  id: string
  label: string
  icon: string
  instruction: string
}

interface CeoSubmission {
  domainName: string
  tld: string
  format: string
  emphasisCriterion: string
  createdAt: string
}

/**
 * คำสั่ง "ให้แก้" จากครู — ทุกข้อความมาจากเซิร์ฟเวอร์
 * `whatGetsYouThere` คือ descriptor ระดับ 3 ของ content/rubric.json ห้ามแต่งข้อความเองในหน้าจอ
 */
/** S-27 ความเห็นรายด้านที่ระบบเสนอ — เจ้าของงานต้องเห็น ไม่ใช่เห็นแต่ครู */
interface CeoFeedback {
  dimensions: {
    id: string
    name: string
    score: number | null
    levelLabel: string
    evidence: string
    suggestion: string
    emphasized: boolean
  }[]
  weightedTotal: number | null
  weightedMax: number | null
  stars: number | null
  summary: string | null
  aiReady: boolean
  aiSummary: string | null
  teacherConfirmed: boolean
  aiStatus: 'pending' | 'ready' | 'unavailable'
}

interface CeoRevision {
  note: string
  dimensions: { id: string; name: string; shortName: string; whatGetsYouThere: string }[]
  round: number
  roundsLeft: number
}

/** อัดเสียงได้ไม่เกิน 2 นาทีตามเวลาที่ให้พูดหน้าห้อง */
const MAX_RECORD_SECONDS = 120

const NO_DATA = 'ยังไม่มีข้อมูล'

function DomainText({ value }: { value: string }) {
  const parts = value.split('.')
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          {index > 0 ? '.' : ''}
          {part}
          {index < parts.length - 1 ? <wbr /> : null}
        </Fragment>
      ))}
    </>
  )
}

/** id ของบับเบิลบอส — ช่องกรอกอ้างถึงเป็นคำอธิบาย (aria-describedby) */
const BOSS_LINE_ID = 'ceo-boss-line'

function elapsedClock(totalSeconds: number): string {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const ss = String(totalSeconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/** ช่องพิมพ์ที่สูงตามข้อความ เริ่มที่ 6 บรรทัด — ไม่มีกล่องว่างใหญ่ค้างจอ */
function GrowTextarea({
  id,
  value,
  placeholder,
  describedBy,
  onChange,
}: {
  id: string
  value: string
  placeholder?: string
  describedBy?: string
  onChange: (next: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 4}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      id={id}
      rows={6}
      value={value}
      placeholder={placeholder}
      aria-describedby={describedBy}
      onChange={(e) => onChange(e.target.value)}
      className="ceo-input ceo-textarea"
    />
  )
}

function clock(totalSeconds: number): string {
  const safe = Math.max(0, Math.min(totalSeconds, MAX_RECORD_SECONDS))
  const mm = String(Math.floor(safe / 60)).padStart(2, '0')
  const ss = String(safe % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/** ป้ายข้อมูลสั้น ๆ ใต้หัวหน้าจอ — เป็นข้อความล้วน กดไม่ได้ จึงไม่ใช้ปุ่ม */

/** กล่องข้อความแจ้งสถานะ — มีไอคอนคู่เสมอ ไม่ได้สื่อด้วยสีอย่างเดียว */

export function CeoClient({
  title,
  objective,
  scenario,
  guidingQuestions,
  submitModes,
  primaryModeId,
  rubric,
  fields,
  selfAssessment,
  nickname,
  shopName,
  alreadySubmitted,
  posttestDone = false,
  initialRevision = null,
}: {
  title: string
  startMinute: number
  endMinute: number
  /** ความยาวของด่านบอสเป็นนาที — แถบขั้นตอนใช้ startMinute/endMinute แทน แต่ยังรับไว้ให้หน้าเรียกใช้ได้เหมือนเดิม */
  minutes?: number
  objective: string
  scenario: string
  guidingQuestions: { id: string; text: string }[]
  submitModes: CeoSubmitMode[]
  primaryModeId: string
  rubric: CeoRubricRow[]
  fields: CeoField[]
  selfAssessment: { id: string; question: string }[]
  nickname: string
  shopName: string
  alreadySubmitted: boolean
  /** ทำแบบทดสอบหลังเรียนแล้ว — ปุ่มถัดไปพาไปดูเกียรติบัตรแทนการชวนทำซ้ำ */
  posttestDone?: boolean
  /** ครูสั่งให้แก้ไว้แล้วตั้งแต่ตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์ (null = ไม่ได้ถูกสั่งแก้) */
  initialRevision?: CeoRevision | null
}) {
  const exit = useExitConfirm({
    href: '/map',
    note: 'ไฟล์เสียงที่อัปโหลดและงานที่ส่งแล้วจะยังอยู่ ส่วนข้อความในฟอร์มที่ยังไม่กดส่งจะหายไปเมื่อออกจากด่าน',
  })
  const [submitted, setSubmitted] = useState(alreadySubmitted)
  const [submission, setSubmission] = useState<CeoSubmission | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [modeId, setModeId] = useState(primaryModeId)
  const [focusRubricId, setFocusRubricId] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [selfValues, setSelfValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [missing, setMissing] = useState<string[]>([])
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [needsJoin, setNeedsJoin] = useState(false)
  /** ครูส่งงานกลับมาให้แก้ (สเปกข้อ 3.3) — null = ไม่ได้ถูกสั่งแก้ */
  const [revision, setRevision] = useState<CeoRevision | null>(initialRevision)
  const [feedback, setFeedback] = useState<CeoFeedback | null>(null)
  const [editingAgain, setEditingAgain] = useState(false)
  const [teacherCommentOpen, setTeacherCommentOpen] = useState(false)

  // --- สถานะการอัดเสียง ---
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [micNote, setMicNote] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  /**
   * เริ่มที่ false เพราะเซิร์ฟเวอร์ส่งสถานะจริงมาเป็น props แล้ว (alreadySubmitted / initialRevision)
   * ถ้าเริ่มที่ true หน้าที่เรนเดอร์จากเซิร์ฟเวอร์จะเป็นโครงเปล่าเสมอ อ่านไม่ได้ตอน JS ยังไม่ทำงาน
   */
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [voiceSent, setVoiceSent] = useState(false)
  const [typingOnly, setTypingOnly] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const blobRef = useRef<Blob | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectedMode = useMemo(
    () => submitModes.find((m) => m.id === modeId) ?? submitModes[0] ?? null,
    [submitModes, modeId],
  )

  // เช็กกับเซิร์ฟเวอร์อีกรอบว่าส่งไปแล้วหรือยัง (เผื่อส่งจากอีกเครื่อง)
  const loadCeoStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ceo')
      if (res.status === 401) {
        setNeedsJoin(true)
        return
      }
      if (!res.ok) return
      const data = (await res.json()) as {
        submitted?: boolean
        submission?: CeoSubmission | null
        revision?: CeoRevision | null
        canResubmit?: boolean
        feedback?: CeoFeedback | null
      }
      if (data.submitted) setSubmitted(true)
      if (data.submission) setSubmission(data.submission)
      setRevision(data.revision ?? null)
      setFeedback(data.feedback ?? null)
    } catch {
      // เน็ตสะดุด — ค่าที่เซิร์ฟเวอร์ส่งมาเป็น props ยังอยู่ ไม่ต้องล้างหน้าจอทิ้ง
    }
  }, [])

  useEffect(() => {
    void loadCeoStatus().finally(() => setLoadingStatus(false))
  }, [loadCeoStatus])

  useEffect(() => {
    if (!submitted || feedback?.teacherConfirmed || feedback?.aiStatus === 'ready' || feedback?.aiStatus === 'unavailable') return
    const timer = window.setTimeout(() => void loadCeoStatus(), 5000)
    return () => window.clearTimeout(timer)
  }, [submitted, feedback?.aiStatus, feedback?.teacherConfirmed, loadCeoStatus])

  const stopTracks = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // เลิกใช้หน้าแล้วต้องปิดไมค์เสมอ ไม่งั้นไฟไมค์ค้างบนมือถือ
  useEffect(() => stopTracks, [stopTracks])

  useEffect(() => {
    if (!audioUrl) return
    return () => URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  /** อัดเสียงไม่ได้ด้วยเหตุผลใดก็ตาม = สลับไปโหมดพิมพ์ทันที ห้ามปล่อยให้ผู้เรียนติดค้าง */
  const fallbackToTyping = useCallback(
    (note: string) => {
      stopTracks()
      recorderRef.current = null
      setRecording(false)
      setTypingOnly(true)
      setMicNote(note)
      if (primaryModeId) setModeId(primaryModeId)
    },
    [primaryModeId, stopTracks],
  )

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else stopTracks()
    setRecording(false)
  }

  async function startRecording() {
    if (recording) {
      stopRecording()
      return
    }
    const media = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
    if (!media?.getUserMedia || typeof MediaRecorder === 'undefined') {
      fallbackToTyping('เครื่องนี้อัดเสียงในเว็บไม่ได้ ไม่เป็นไรเลย พิมพ์ใบเสนอในช่องข้างล่างแทนได้ทันที แล้วพูดให้ครูฟังสด ๆ หน้าห้อง')
      return
    }

    let stream: MediaStream
    try {
      stream = await media.getUserMedia({ audio: true })
    } catch {
      fallbackToTyping('ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน หรือเครื่องไม่มีไมค์ ใช้วิธีพิมพ์ในช่องข้างล่างแทนได้เลย แล้วพูดให้ครูฟังสด ๆ หน้าห้อง')
      return
    }

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream)
    } catch {
      stream.getTracks().forEach((t) => t.stop())
      fallbackToTyping('เบราว์เซอร์นี้บันทึกเสียงไม่ได้ พิมพ์ใบเสนอในช่องข้างล่างแทนได้เลย')
      return
    }

    streamRef.current = stream
    recorderRef.current = recorder
    chunksRef.current = []
    setAudioUrl(null)
    setMicNote(null)
    setSeconds(0)

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      stopTracks()
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      chunksRef.current = []
      blobRef.current = blob.size > 0 ? blob : null
      setAudioUrl(blob.size > 0 ? URL.createObjectURL(blob) : null)
      // ส่งไฟล์เสียงขึ้นเซิร์ฟเวอร์ทันทีที่หยุดอัด ถ้าพังก็ยังพิมพ์ต่อได้ ไม่ตัน
      if (blob.size > 0) void uploadVoice(blob)
    }
    recorder.onerror = () => {
      fallbackToTyping('บันทึกเสียงขัดข้องกลางทาง พิมพ์ใบเสนอในช่องข้างล่างแทนได้เลย')
    }

    recorder.start()
    setRecording(true)
    timerRef.current = setInterval(() => {
      setSeconds((current) => {
        const next = current + 1
        if (next >= MAX_RECORD_SECONDS) {
          stopRecording()
          return MAX_RECORD_SECONDS
        }
        return next
      })
    }, 1000)
  }

  /**
   * อัปโหลดไฟล์เสียงไป POST /api/ceo/voice (bucket ส่วนตัว จำกัด 2 MB)
   * ⚠️ อัปโหลดพังห้ามบล็อกผู้เรียน — แจ้งข้อความแล้วให้พิมพ์ต่อได้ทันที
   */
  async function uploadVoice(blob: Blob) {
    setUploading(true)
    try {
      const body = new FormData()
      body.append('audio', blob, 'ceo-voice.webm')
      body.append('durationSec', String(seconds))
      const res = await fetch('/api/ceo/voice', { method: 'POST', body })
      const data = (await res.json().catch(() => null)) as { message?: string } | null
      if (!res.ok) {
        setMicNote(data?.message ?? 'ส่งไฟล์เสียงไม่สำเร็จ พิมพ์ใบเสนอในช่องข้างล่างแทนได้เลย')
        return
      }
      setVoiceSent(true)
      setMicNote(data?.message ?? 'ส่งไฟล์เสียงให้ครูแล้ว')
    } catch {
      setMicNote('ส่งไฟล์เสียงไม่สำเร็จ (เน็ตมีปัญหา) พิมพ์ใบเสนอในช่องข้างล่างแทนได้เลย')
    } finally {
      setUploading(false)
    }
  }

  function setField(id: string, value: string) {
    setValues((current) => ({ ...current, [id]: value }))
  }

  function setSelf(id: string, value: string) {
    setSelfValues((current) => ({ ...current, [id]: value }))
  }

  const localMissing = useMemo(() => {
    const list: string[] = []
    for (const field of fields) {
      if (field.required && (values[field.id] ?? '').trim().length === 0) list.push(field.label)
    }
    for (const item of selfAssessment) {
      if ((selfValues[item.id] ?? '').trim().length === 0) list.push(item.question)
    }
    return list
  }, [fields, selfAssessment, values, selfValues])

  async function submit() {
    if (busy || (submitted && !editingAgain)) return
    setSystemMessage(null)
    setMissing([])

    if (!focusRubricId) {
      setSystemMessage('เลือกด้านที่อยากให้ครูดูเป็นพิเศษก่อน 1 ด้าน')
      return
    }
    if (localMissing.length > 0) {
      setMissing(localMissing)
      setSystemMessage('ยังกรอกไม่ครบ ดูรายการข้างล่างนี้')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/ceo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          modeId,
          focusRubricId,
          fields: values,
          selfAssessment: selfValues,
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean
            message?: string
            missingFields?: string[]
            missingSelfAssessment?: number
          }
        | null

      if (res.status === 401) {
        setNeedsJoin(true)
        setSystemMessage(data?.message ?? 'ยังไม่ได้เข้าห้องเรียน')
        return
      }
      if (res.status === 409) {
        // ส่งซ้ำไม่ได้ (ยังไม่ได้ถูกสั่งแก้ หรือใช้โควตารอบแก้ครบแล้ว) — ข้อความมาจากเซิร์ฟเวอร์
        setSubmitted(true)
        setEditingAgain(false)
        setSystemMessage(data?.message ?? 'ส่งไปแล้ว')
        return
      }
      if (res.status === 422) {
        const list = [...(data?.missingFields ?? [])]
        const selfCount = data?.missingSelfAssessment ?? 0
        if (selfCount > 0) list.push(`คำถามประเมินตนเองอีก ${selfCount} ข้อ`)
        setMissing(list)
        setSystemMessage(data?.message ?? 'ยังกรอกไม่ครบ')
        return
      }
      if (!res.ok || data?.ok !== true) {
        setSystemMessage(data?.message ?? 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }

      setSubmitted(true)
      setEditingAgain(false)
      setRevision(null)
    } catch {
      setSystemMessage('ต่อเน็ตไม่ได้ ลองส่งใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  const checkedCount = guidingQuestions.filter((q) => checked[q.id]).length

  /** ขั้นที่กำลังทำอยู่ของด่านบอส (UX-2 — หนึ่งเรื่องต่อหนึ่งจอ ไม่เลื่อน) */
  const [stepIndex, setStepIndex] = useState(0)
  /** แผ่นที่เปิดอยู่ — ที่เดียวในหน้าที่เลื่อนได้ */
  const [sheet, setSheet] = useState<'topics' | 'rubric' | 'revision' | null>(null)
  /** เสียงตอบรับของปุ่ม (จำค่าในเครื่องร่วมกับภารกิจ) */
  const sound = useM1Sound()
  /** เวลาที่อยู่ในด่าน — นับจาก 0 ทั้งฝั่งเซิร์ฟเวอร์และเครื่อง จึงไม่เกิด hydration mismatch */
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (submitted && !editingAgain) return
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(timer)
  }, [submitted, editingAgain])

  /**
   * ลำดับขั้นประกอบจากไฟล์เนื้อหาล้วน ๆ — เพิ่มช่องในไฟล์เนื้อหาแล้วขั้นตอนขึ้นเอง
   * ไม่ต้องมาแก้หน้าจอ และไม่มีข้อความของเนื้อหาถูกพิมพ์ซ้ำไว้ในนี้
   */
  const steps = useMemo(() => {
    type Step = {
      key: string
      kind: 'speak' | 'mode' | 'field' | 'focus' | 'self' | 'review'
      label: string
      field?: CeoField
      self?: { id: string; question: string }
      summary: () => string
    }
    const out: Step[] = [
      { key: 'speak', kind: 'speak', label: 'ซ้อมพูด', summary: () => '' },
      { key: 'mode', kind: 'mode', label: 'วิธีส่งงาน', summary: () => '' },
    ]
    for (const field of fields) {
      out.push({
        key: field.id,
        kind: 'field',
        label: field.label,
        field,
        summary: () => {
          const raw = values[field.id] ?? ''
          if (field.type !== 'choice') return raw.trim()
          return field.options.find((o) => o.value === raw)?.label ?? raw
        },
      })
    }
    out.push({
      key: 'focus',
      kind: 'focus',
      label: 'ด้านที่อยากให้ครูเน้น',
      summary: () => rubric.find((r) => r.id === focusRubricId)?.dimension ?? '',
    })
    for (const item of selfAssessment) {
      out.push({
        key: item.id,
        kind: 'self',
        label: item.question,
        self: item,
        summary: () => (selfValues[item.id] ?? '').trim(),
      })
    }
    out.push({ key: 'review', kind: 'review', label: 'ตรวจก่อนส่ง', summary: () => '' })
    return out
  }, [fields, selfAssessment, rubric, values, selfValues, focusRubricId])

  if (needsJoin) {
    return <SignInGate message="เข้าห้องด้วยรหัสห้อง 6 ตัวกับรหัส 4 หลักก่อน แล้วกลับมาส่งใบเสนอได้เลย" />
  }

  // ระหว่างถามเซิร์ฟเวอร์ว่าส่งไปแล้วหรือยัง แสดงโครงหน้าไว้ก่อน กันหน้ากระพริบจากฟอร์มเปล่าไปเป็นหน้า "ส่งแล้ว"
  if (loadingStatus) {
    return (
      <StudentShell backHref="/map">
        <PageHeading eyebrow="ขั้นที่ 4 · ด่านบอส CEO" title={title} />
        <div role="status" aria-live="polite" className="mt-6 flex flex-col gap-3">
          <span className="sr-only">กำลังเปิดใบเสนอ</span>
          <span aria-hidden className="h-24 w-full animate-pulse rounded-2xl bg-surface-sunken" />
          <span aria-hidden className="h-14 w-full animate-pulse rounded-2xl bg-surface-sunken" />
          <span aria-hidden className="h-14 w-2/3 animate-pulse rounded-2xl bg-surface-sunken" />
        </div>
      </StudentShell>
    )
  }

  if (submitted && !editingAgain) {
    const scoreLabel = feedback?.teacherConfirmed
      ? 'คะแนนที่ครูยืนยัน'
      : feedback?.aiStatus === 'ready'
        ? 'คะแนนจาก AI'
        : 'กำลังตรวจคะแนน'
    const score = feedback?.weightedTotal
    const scoreMax = feedback?.weightedMax
    const starCount = feedback?.stars ?? 0
    const aiSummary = feedback?.teacherConfirmed ? null : feedback?.aiSummary ?? feedback?.summary
    const teacherComment = feedback?.teacherConfirmed ? feedback.summary?.trim() || null : null
    const domainValue = `${submission?.domainName || 'กำลังโหลด'}${submission?.tld ?? ''}`

    return (
      <>
        <StudentShell
          className="ceo-world-shell ceo-submitted-world-shell ceo-submitted-shell"
          withBottomNav
          header={
            <WoodSign title="ด่านบอส CEO">
              <span className="ceo-sign-detail">ส่งใบเสนอชื่อเว็บแล้ว</span>
            </WoodSign>
          }
          footer={
            <AppFooter className="ceo-submitted-footer">
              {revision ? (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => {
                    setEditingAgain(true)
                  }}
                >
                  แก้แล้วส่งใหม่
                </Button>
              ) : (
                <Link
                  href={posttestDone ? '/result' : '/posttest'}
                  className="game-button game-button--green game-button--lg ceo-primary-cta"
                >
                  {posttestDone ? 'ไปดูเกียรติบัตร' : 'ไปทำแบบทดสอบหลังเรียน'}
                  <ChevronRightIcon width={22} height={22} aria-hidden />
                </Link>
              )}
            </AppFooter>
          }
        >
          <main className="ceo-submitted">
            <Link href="/map" className="ceo-map-link">
              <img src="/ui/kit2/back-button.webp" alt="" aria-hidden width={34} height={34} draggable={false} />
              <span>กลับแผนที่</span>
            </Link>

            <CreamCard className="ceo-success-panel" aria-labelledby="ceo-success-title">
              <div className="ceo-success-hero">
                <div className="ceo-success-art" aria-hidden="true">
                  <img src="/ui/kit2/replay-dome.webp" alt="" draggable={false} />
                  <img className="ceo-success-badge" src="/ui/kit2/badge-check.webp" alt="" draggable={false} />
                </div>
                <div className="ceo-success-copy">
                  <p className="ceo-success-kicker">ใบเสนอชื่อเว็บของเรา</p>
                  <h1 id="ceo-success-title">
                    ส่งงานสำเร็จ{nickname ? <span className="ceo-success-nickname"> · {nickname}</span> : null}
                  </h1>
                  <p className="ceo-success-shop">{shopName || 'ร้านของเรา'}</p>
                </div>
              </div>

              <div className={`ceo-domain-chip${domainValue.length > 18 ? ' is-long' : ''}`}>
                <span className="ceo-domain-label">ชื่อเว็บที่เสนอ</span>
                <strong>
                  <DomainText value={domainValue} />
                </strong>
              </div>

            <div className="ceo-score-grid" aria-label="สรุปคะแนนและดาว">
              <section className="ceo-score-tile">
                <span className="ceo-score-label">{scoreLabel}</span>
                <strong className="ceo-score-value">
                  {score ?? '—'}
                  <small>{scoreMax !== null && scoreMax !== undefined ? ` / ${scoreMax}` : ''}</small>
                </strong>
                <span className="ceo-score-note">
                  {feedback?.aiStatus === 'pending' ? 'โดมกำลังอ่านงาน' : feedback?.aiStatus === 'unavailable' ? 'รอครูตรวจด้วยตัวเอง' : 'คะแนนถ่วงน้ำหนัก'}
                </span>
              </section>
              <section className="ceo-score-tile">
                <span className="ceo-score-label">ดาวที่ได้</span>
                <span className="ceo-stars" aria-label={starCount ? `${starCount} ดาว` : 'กำลังรอผลดาว'}>
                  {[1, 2, 3].map((star) => (
                    <img
                      key={star}
                      src="/ui/kit2/badge-star.webp"
                      alt=""
                      aria-hidden="true"
                      className={star <= starCount ? undefined : 'is-off'}
                      draggable={false}
                    />
                  ))}
                </span>
                <span className="ceo-score-note">{starCount ? `${starCount} จาก 3 ดาว` : 'กำลังคำนวณ'}</span>
              </section>
            </div>

            {aiSummary ? (
              <div className="ceo-feedback ceo-feedback-ai">
                <span className="ceo-feedback-label">สรุปจาก AI</span>
                <p>{aiSummary}</p>
              </div>
            ) : null}
              {teacherComment ? (
                <div className="ceo-feedback ceo-feedback-teacher">
                  <span className="ceo-feedback-label">ครูเขียนถึงเรา</span>
                  <p className="ceo-teacher-comment">{teacherComment}</p>
                  <button type="button" className="ceo-read-more" onClick={() => setTeacherCommentOpen(true)}>
                    อ่านเพิ่มเติม
                  </button>
                </div>
              ) : null}
              {revision ? (
                <div className="ceo-revision-note">
                  <strong>ครูส่งงานกลับมาให้เติมอีกนิด</strong>
                  <p>{revision.note}</p>
                </div>
              ) : null}
            </CreamCard>
          </main>
        </StudentShell>

        {teacherCommentOpen && teacherComment ? (
          <div className="ceo-comment-modal" role="dialog" aria-modal="true" aria-labelledby="ceo-comment-title">
            <button
              type="button"
              className="ceo-comment-modal-backdrop"
              aria-label="ปิดความคิดเห็นจากครู"
              onClick={() => setTeacherCommentOpen(false)}
            />
            <section className="ceo-comment-modal-card">
              <div className="ceo-comment-modal-head">
                <h2 id="ceo-comment-title">ครูเขียนถึงเรา</h2>
                <button type="button" className="ceo-comment-modal-close" onClick={() => setTeacherCommentOpen(false)}>
                  ปิด
                </button>
              </div>
              <p>{teacherComment}</p>
            </section>
          </div>
        ) : null}
      </>
    )
  }
  /**
   * UX-2 ด่านบอส — จอเดียวต่อหนึ่งขั้น ไม่เลื่อนเลย
   *
   * ของเดิมเป็นฟอร์มยาว 6 ช่อง + เกณฑ์ 4 ด้าน + ประเมินตัวเอง 3 ข้อ เรียงลงมาในหน้าเดียว
   * วัดได้เกือบ 6000px ในกรอบ 800px ซึ่งขัดกับคำสั่งของเจ้าของที่ว่า "หน้าห้ามเลื่อนเลย"
   * จึงแบ่งเป็นขั้นตอนทีละเรื่อง ตามทางเลือกที่เจ้าของให้ไว้ ("แบ่งเป็นขั้นตอน ทีละคำถาม ทีละส่วน")
   *
   * ขั้นแรกคือจอ mockup ที่ 5 — ไมค์วงกลมใหญ่กลางจอ มีคลื่นเสียงสองข้าง ตัวนับ 00:00/02:00
   * หัวข้อที่ต้องพูดเป็นเช็กลิสต์ในแผ่นที่เปิดเอง และมีโน้ตกระดาษเหลืองเตือนเวลา
   *
   * ⚠️ ไม่ได้แตะตรรกะการอัดเสียง การส่ง หรือการตรวจใด ๆ ย้ายแต่การจัดวาง
   */
  const stepMeta = steps[stepIndex] ?? null
  const isLast = stepIndex >= steps.length - 1

  function renderField(field: CeoField) {
    const value = values[field.id] ?? ''
    const groupLabelId = `${field.id}-group-label`

    if (field.type === 'text') {
      return (
        <div className="ceo-field">
          <label htmlFor={field.id} className="ceo-panel-title">
            {field.label}
            <span className="ceo-req">{field.required ? 'ต้องกรอก' : 'ไม่บังคับ'}</span>
          </label>
          <input
            id={field.id}
            type="text"
            value={value}
            placeholder={field.placeholder}
            aria-describedby={BOSS_LINE_ID}
            autoComplete="off"
            onChange={(e) => setField(field.id, e.target.value)}
            className="ceo-input"
          />
        </div>
      )
    }

    if (field.type === 'textarea') {
      return (
        <div className="ceo-field">
          <label htmlFor={field.id} className="ceo-panel-title">
            {field.label}
            <span className="ceo-req">{field.required ? 'ต้องกรอก' : 'ไม่บังคับ'}</span>
          </label>
          <GrowTextarea
            id={field.id}
            value={value}
            placeholder={field.placeholder}
            describedBy={BOSS_LINE_ID}
            onChange={(next) => setField(field.id, next)}
          />
        </div>
      )
    }

    return (
      <div className="ceo-field">
        <p id={groupLabelId} className="ceo-panel-title">
          {field.label}
          <span className="ceo-req">{field.required ? 'ต้องเลือก' : 'ไม่บังคับ'}</span>
        </p>
        {field.options.length === 0 ? (
          <EmptyState
            as="h3"
            className="mt-2"
            title="ยังไม่มีตัวเลือกให้เลือก"
            description="รอครูเปิดเนื้อหาส่วนนี้ให้ก่อนนะ"
          />
        ) : (
          <ul role="group" aria-labelledby={groupLabelId} aria-describedby={BOSS_LINE_ID} className="ceo-choice-list">
            {field.options.map((option) => (
              <li key={option.value}>
                <ChoiceCard
                  label={option.label}
                  selected={value === option.value}
                  ariaLabel={`${option.label}${value === option.value ? ' — เลือกอยู่' : ''}`}
                  onSelect={() => setField(field.id, option.value)}
                  className="ceo-choice"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  /** คำสั่งของขั้นนี้ — บอสพูดในบับเบิลแทนข้อความบรรทัดเล็ก (ข้อความเนื้อหามาจาก props) */
  const stepDone = stepMeta ? stepMeta.summary().length > 0 : false
  /** ที่ยังขาด — นับจากฟอร์มตรงหน้า (และจากที่เซิร์ฟเวอร์ตอบกลับถ้ากดส่งแล้ว) */
  const reviewGap = Math.max(missing.length, localMissing.length + (focusRubricId ? 0 : 1))
  const bossLine = (() => {
    switch (stepMeta?.kind) {
      case 'speak':
        return `ซ้อมเสนอชื่อเว็บ${shopName ? `ของร้าน ${shopName}` : ''}ให้ผมฟังหน่อย พูด 1–2 นาที ช้า ๆ ชัด ๆ`
      case 'mode':
        return 'จะส่งงานแบบไหนดี เลือกได้ 1 แบบ เปลี่ยนใจได้จนกว่าจะกดส่ง'
      case 'field':
        return stepMeta.field?.help || stepMeta.label
      case 'focus':
        return 'อยากให้ครูดูด้านไหนเป็นพิเศษ เลือก 1 ด้าน ด้านนั้นครูให้น้ำหนัก 2 เท่า'
      case 'self':
        return 'ตอบตามจริงได้เลย ไม่มีถูกผิด ครูอยากรู้ว่าเราคิดยังไง'
      case 'review':
        return reviewGap > 0
          ? `ยังขาดอีก ${reviewGap} อย่าง แตะรายการที่ยังว่างเพื่อกลับไปเติมได้เลย`
          : 'ตรวจอีกรอบ ส่งได้ครั้งเดียว พร้อมแล้วกดส่งเลย'
      default:
        return ''
    }
  })()
  const bossSmile = stepMeta?.kind === 'mode' || stepDone || (stepMeta?.kind === 'review' && reviewGap === 0)
  const progressPercent = steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 0

  function goStep(next: number) {
    if (sound.on) buzz()
    setStepIndex(Math.max(0, Math.min(steps.length - 1, next)))
  }

  return (
    <>
      <StudentShell className="ceo-world-shell">
        <div className="ceo-game" data-step={stepMeta?.kind}>
          <img className="ceo-game-bg" src="/learn/pixel/bg-boss-office.webp" alt="" aria-hidden draggable={false} />
          <div className="ceo-game-veil" aria-hidden />
          <GameHeader
            className="ceo-game-head"
            title="ด่านบอส CEO"
            subtitle={stepMeta?.kind === 'self' ? 'ประเมินตัวเอง' : stepMeta?.kind === 'field' ? 'ใบเสนอชื่อเว็บ' : (stepMeta?.label ?? '')}
            onBack={exit.request}
            backLabel="ออกจากด่านบอส"
            soundOn={sound.on}
            onSound={sound.toggle}
          />

          {/* HUD — ขั้น x/13 · มาตรความคืบหน้า · เวลาที่ใช้ในด่าน */}
          <div className="ceo-hud">
            <span className="ceo-hud-chip">
              ขั้น <b>{stepIndex + 1}</b>/{steps.length}
            </span>
            <div
              className="ceo-gauge"
              role="progressbar"
              aria-label={`ขั้นที่ ${stepIndex + 1} จาก ${steps.length}`}
              aria-valuemin={1}
              aria-valuemax={steps.length}
              aria-valuenow={stepIndex + 1}
            >
              <span className="ceo-gauge-fill" style={{ width: `${progressPercent}%` }} />
              <img className="ceo-gauge-goal" src="/learn/pixel/badge-ceo.webp" alt="" aria-hidden draggable={false} />
            </div>
            <span className="ceo-hud-chip ceo-hud-time" aria-label={`ใช้เวลาไป ${elapsedClock(elapsed)}`}>
              <ClockIcon width={16} height={16} aria-hidden />
              {elapsedClock(elapsed)}
            </span>
          </div>

          <main className="ceo-game-content">
            {/* ครูส่งกลับมาให้แก้ — ย้ำไว้บรรทัดเดียว รายละเอียดอยู่ในแผ่น */}
            {editingAgain && revision ? (
              <button type="button" onClick={() => setSheet('revision')} className="ceo-revision-strip">
                <AlertIcon width={18} height={18} aria-hidden className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">ครูขอให้แก้รอบที่ {revision.round} — แตะเพื่ออ่าน</span>
                <ChevronRightIcon width={18} height={18} aria-hidden className="shrink-0" />
              </button>
            ) : null}

            <div className="ceo-boss-says">
              <img
                className="ceo-boss-img"
                src={bossSmile ? '/learn/pixel/boss-smile.webp' : '/learn/pixel/boss-neutral.webp'}
                alt=""
                aria-hidden
                draggable={false}
              />
              <p id={BOSS_LINE_ID} className="ceo-speech" aria-live="polite">
                <span className="ceo-speech-name">บอส CEO</span>
                {bossLine}
              </p>
            </div>

            {stepMeta?.kind === 'speak' ? (
              <section className="ceo-panel">
                <h2 className="ceo-panel-title">{objective}</h2>
                <p className="ceo-note">พูดให้ได้ 1–2 นาที พูดช้า ๆ ชัด ๆ แล้วจะจำได้เองว่าจะพูดอะไรต่อ</p>
                <SheetChip
                  tone="brand"
                  icon={<QuestIcon width={18} height={18} />}
                  onClick={() => setSheet('topics')}
                  badge={`${checkedCount}/${guidingQuestions.length}`}
                  className="mt-3"
                >
                  หัวข้อที่ต้องพูด
                </SheetChip>

                <div className="ceo-mic">
                  <div className="flex items-center justify-center gap-3">
                    <SoundWave active={recording} side="left" />
                    <div className="relative grid place-items-center">
                      {recording ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 animate-ping rounded-full bg-danger-500/40 motion-reduce:animate-none"
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={startRecording}
                        aria-pressed={recording}
                        aria-label={
                          recording ? `หยุดบันทึกเสียง กำลังบันทึกมาแล้ว ${seconds} วินาที` : 'เริ่มบันทึกเสียงซ้อมพูด'
                        }
                        className={cn('ceo-mic-btn', recording && 'is-on')}
                      >
                        {recording ? <StopIcon width={40} height={40} /> : <MicIcon width={40} height={40} />}
                      </button>
                    </div>
                    <SoundWave active={recording} side="right" />
                  </div>
                  <p className="ceo-mic-clock">
                    <span aria-live="off">{clock(seconds)}</span>
                    <small>/ {clock(MAX_RECORD_SECONDS)}</small>
                  </p>
                  <p className="ceo-mic-hint">
                    {recording ? 'กำลังบันทึก — กดปุ่มอีกครั้งเพื่อหยุด' : 'กดปุ่มเพื่อเริ่มบันทึกเสียง (ไม่บังคับ)'}
                  </p>
                  {micNote ? <p className="ceo-mic-hint is-warn">{micNote}</p> : null}
                  {audioUrl ? (
                    <p className="ceo-mic-hint">
                      {uploading
                        ? 'กำลังส่งไฟล์เสียงให้ครู…'
                        : voiceSent
                          ? 'ส่งไฟล์เสียงให้ครูแล้ว ครูเปิดฟังย้อนหลังได้'
                          : 'ไฟล์เสียงอยู่ในเครื่องแล้ว กรอกใบเสนอต่อได้เลย'}
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}

            {stepMeta?.kind === 'mode' ? (
              <section className="ceo-panel">
                <h2 className="ceo-panel-title">วิธีส่งงาน</h2>
                <div className="ceo-mode-grid" role="group" aria-label="วิธีส่งงาน">
                  {submitModes.map((mode) => {
                    const on = mode.id === modeId
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setModeId(mode.id)}
                        className={cn('ceo-mode', on && 'is-on')}
                      >
                        <span className="ceo-mode-icon" aria-hidden>
                          {mode.icon}
                        </span>
                        <span className="ceo-mode-label">{mode.label}</span>
                        {on ? <span className="kit-check ceo-mode-check" aria-hidden /> : null}
                      </button>
                    )
                  })}
                </div>
                <p className="ceo-instruction">{selectedMode?.instruction ?? NO_DATA}</p>
                {typingOnly ? (
                  <p className="ceo-warn">ตอนนี้สลับมาโหมดพิมพ์ให้แล้ว เลือกวิธีอื่นใหม่ได้ตลอดถ้าอยากลองอีกครั้ง</p>
                ) : null}
                {selectedMode && selectedMode.id !== primaryModeId ? (
                  <p className="ceo-warn">
                    แบบ{selectedMode.label}ยังต้องเอางานจริงไปส่งครูที่หน้าห้อง ในหน้านี้ระบบเก็บได้แค่ตัวเลือกกับข้อความ
                  </p>
                ) : null}
              </section>
            ) : null}

            {stepMeta?.kind === 'field' && stepMeta.field ? (
              <section className="ceo-panel">{renderField(stepMeta.field)}</section>
            ) : null}

            {stepMeta?.kind === 'focus' ? (
              <section className="ceo-panel">
                <h2 className="ceo-panel-title">ด้านที่อยากให้ครูเน้น</h2>
                <ul className="ceo-choice-list" aria-describedby={BOSS_LINE_ID}>
                  {rubric.map((row, index) => (
                    <li key={row.id}>
                      <ChoiceCard
                        marker={String(index + 1)}
                        label={row.dimension}
                        selected={row.id === focusRubricId}
                        ariaLabel={`ด้านที่ ${index + 1} ${row.dimension}`}
                        onSelect={() => setFocusRubricId(row.id)}
                        className="ceo-choice"
                      />
                    </li>
                  ))}
                </ul>
                <SheetChip
                  tone="brand"
                  icon={<InfoIcon width={18} height={18} />}
                  onClick={() => setSheet('rubric')}
                  className="mt-3"
                >
                  ดูเกณฑ์ให้คะแนน 4 ด้าน
                </SheetChip>
              </section>
            ) : null}

            {stepMeta?.kind === 'self' && stepMeta.self ? (
              <section className="ceo-panel">
                <div className="ceo-field">
                  <label htmlFor={stepMeta.self.id} className="ceo-panel-title">
                    {stepMeta.self.question}
                    <span className="ceo-req">ต้องตอบ</span>
                  </label>
                  <GrowTextarea
                    id={stepMeta.self.id}
                    value={selfValues[stepMeta.self.id] ?? ''}
                    describedBy={BOSS_LINE_ID}
                    onChange={(next) => setSelf(stepMeta.self!.id, next)}
                  />
                </div>
              </section>
            ) : null}

            {stepMeta?.kind === 'review' ? (
              <section className="ceo-panel">
                <h2 className="ceo-panel-title">ตรวจก่อนส่ง</h2>
                <ul className="ceo-review-list">
                  {steps.map((s, i) =>
                    s.kind === 'field' || s.kind === 'self' || s.kind === 'focus' ? (
                      <li key={s.key}>
                        <button
                          type="button"
                          onClick={() => goStep(i)}
                          className={cn(
                            'ceo-review-row',
                            s.summary() ? 'is-filled' : s.kind === 'field' && !s.field?.required ? 'is-optional' : 'is-empty',
                          )}
                        >
                          <span className={s.summary() ? 'kit-check ceo-review-mark' : 'kit-radio ceo-review-mark'} aria-hidden />
                          <span className="ceo-review-text">
                            <span className="ceo-review-label">{s.label}</span>
                            <span className="ceo-review-value">
                              {s.summary() || (s.kind === 'field' && !s.field?.required ? 'ไม่บังคับ' : 'ยังว่าง')}
                            </span>
                          </span>
                          <ChevronRightIcon width={16} height={16} aria-hidden className="shrink-0" />
                        </button>
                      </li>
                    ) : null,
                  )}
                </ul>
                {systemMessage ? (
                  <p role="alert" className="ceo-warn">
                    {systemMessage}
                  </p>
                ) : null}
              </section>
            ) : null}
          </main>

          <div className="ceo-dock">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => goStep(stepIndex - 1)}
              disabled={stepIndex === 0 || busy}
              className="ceo-dock-back"
            >
              ย้อน
            </Button>
            {isLast ? (
              <Button
                variant="success"
                size="lg"
                fullWidth
                onClick={submit}
                disabled={busy}
                loading={busy}
                loadingLabel="กำลังส่งใบเสนอ"
                trailingIcon={<SendIcon width={22} height={22} />}
              >
                {busy ? 'กำลังส่ง…' : 'ส่งใบเสนอ'}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => goStep(stepIndex + 1)}
                trailingIcon={<ChevronRightIcon width={22} height={22} />}
              >
                ถัดไป
              </Button>
            )}
          </div>

      {/* ───────── แผ่นเลื่อนขึ้น ───────── */}

      <Sheet
        open={sheet === 'topics'}
        onClose={() => setSheet(null)}
        title="หัวข้อการนำเสนอ"
        description="ติ๊กไปทีละข้อตอนซ้อมพูด ครูไม่ได้เอาเครื่องหมายติ๊กไปให้คะแนน"
      >
        <p className="mb-3 rounded-xl bg-brand-50 p-3 text-body text-pretty text-ink">{scenario}</p>
        <ul className="flex flex-col gap-2">
          {guidingQuestions.map((question, index) => (
            <li key={question.id}>
              <ChoiceCard
                marker={String(index + 1)}
                label={question.text}
                selected={checked[question.id] === true}
                ariaLabel={`ข้อ ${index + 1} ${question.text}${checked[question.id] ? ' — ติ๊กแล้ว' : ''}`}
                onSelect={() =>
                  setChecked((current) => ({ ...current, [question.id]: !current[question.id] }))
                }
              />
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet
        open={sheet === 'rubric'}
        onClose={() => setSheet(null)}
        title="เกณฑ์ให้คะแนน 4 ด้าน"
        description="อ่านได้ตลอด ไม่มีผลกับคะแนน"
      >
        <ul className="flex flex-col gap-4">
          {rubric.map((row, index) => (
            <li key={row.id}>
              <p className="text-body font-bold text-ink">
                {index + 1}. {row.dimension}
              </p>
              <ul className="mt-1.5 flex flex-col gap-2">
                {row.levels.map((level) => (
                  <li key={`${row.id}-${level.score}`}>
                    <p className="text-label font-bold text-ink">
                      {level.score} ดาว · {level.label}
                    </p>
                    <p className="text-label text-pretty text-ink-muted">{level.descriptor}</p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet
        open={sheet === 'revision'}
        onClose={() => setSheet(null)}
        title="ครูขอให้แก้"
        description={revision ? `รอบที่ ${revision.round} · แก้ได้อีก ${revision.roundsLeft} รอบ` : undefined}
      >
        {revision ? (
          <>
            <p className="text-body font-bold text-ink">ครูบอกว่า: {revision.note}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {revision.dimensions.map((d) => (
                <li key={d.id} className="rounded-xl bg-surface-raised p-3">
                  <p className="text-body font-bold text-ink">{d.name}</p>
                  <p className="mt-1 text-label text-pretty text-ink-muted">
                    ทำแบบนี้แล้วได้ 3 เต็ม: {d.whatGetsYouThere}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Sheet>
        </div>
      </StudentShell>
      {exit.dialog}
    </>
  )
}

/** คลื่นเสียงสองข้างปุ่มไมค์ (mockup) — ตกแต่งล้วน ไม่ได้อ่านค่าจากไมค์จริง */
function SoundWave({ active, side }: { active: boolean; side: 'left' | 'right' }) {
  const bars = [14, 26, 38, 26, 14]
  return (
    <span
      aria-hidden="true"
      className={cn('flex items-center gap-1', side === 'left' ? 'flex-row-reverse' : 'flex-row')}
    >
      {bars.map((h, i) => (
        <span
          key={i}
          className={cn(
            'w-1.5 rounded-full',
            active ? 'bg-brand-500 animate-pulse-soft motion-reduce:animate-none' : 'bg-brand-200',
          )}
          style={{ height: `${h}px`, animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  )
}
