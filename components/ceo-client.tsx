'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { PageHeading, SignInGate, StudentShell } from '@/components/student-shell'
import { AppFooter } from '@/components/app-shell'
import { GradeStatusCard } from '@/components/grade-status-client'
import { Sheet, SheetChip } from '@/components/sheet-client'
import {
  AlertIcon,
  Button,
  Card,
  CardHeader,
  CheckIcon,
  ChevronRightIcon,
  ChoiceCard,
  ClockIcon,
  DomeAvatar,
  DomeSays,
  EmptyState,
  InfoIcon,
  LightbulbIcon,
  MicIcon,
  ProgressBar,
  QuestIcon,
  SendIcon,
  StopIcon,
  TextField,
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
    score: number
    levelLabel: string
    evidence: string
    suggestion: string
    emphasized: boolean
  }[]
  weightedTotal: number | null
  weightedMax: number | null
  summary: string | null
  aiReady: boolean
  aiSummary: string | null
  teacherConfirmed: boolean
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

function clock(totalSeconds: number): string {
  const safe = Math.max(0, Math.min(totalSeconds, MAX_RECORD_SECONDS))
  const mm = String(Math.floor(safe / 60)).padStart(2, '0')
  const ss = String(safe % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/** ป้ายข้อมูลสั้น ๆ ใต้หัวหน้าจอ — เป็นข้อความล้วน กดไม่ได้ จึงไม่ใช้ปุ่ม */

function SectionCard({
  heading,
  description,
  icon,
  trailing,
  tone = 'plain',
  elevated = false,
  children,
}: {
  heading: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  trailing?: React.ReactNode
  tone?: 'plain' | 'brand'
  elevated?: boolean
  children: React.ReactNode
}) {
  return (
    <Card as="section" tone={tone} elevated={elevated} className="mt-4">
      <CardHeader as="h2" title={heading} description={description} icon={icon} trailing={trailing} />
      <div className="mt-4">{children}</div>
    </Card>
  )
}

/** กล่องข้อความแจ้งสถานะ — มีไอคอนคู่เสมอ ไม่ได้สื่อด้วยสีอย่างเดียว */

export function CeoClient({
  title,
  startMinute,
  endMinute,
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
  /** ครูสั่งให้แก้ไว้แล้วตั้งแต่ตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์ (null = ไม่ได้ถูกสั่งแก้) */
  initialRevision?: CeoRevision | null
}) {
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
  const [justSubmitted, setJustSubmitted] = useState(false)
  /** ครูส่งงานกลับมาให้แก้ (สเปกข้อ 3.3) — null = ไม่ได้ถูกสั่งแก้ */
  const [revision, setRevision] = useState<CeoRevision | null>(initialRevision)
  const [feedback, setFeedback] = useState<CeoFeedback | null>(null)
  const [editingAgain, setEditingAgain] = useState(false)

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
      setJustSubmitted(true)
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
      <StudentShell>
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
    return (
      <StudentShell
        className="ceo-world-shell"
        /**
         * หลังส่งแล้ว "สิ่งที่ต้องทำต่อ" มีได้สองอย่าง ปุ่มในแถบท้ายจึงเปลี่ยนตามสถานะ
         * ครูส่งกลับมาให้แก้ = แก้แล้วส่งใหม่ · ไม่ได้ส่งกลับ = ไปขั้นต่อไป (ทบทวนตัวเอง)
         * หน้านี้ยาว (ความเห็นรายด้าน + สิ่งที่ส่งไป) ปุ่มจึงต้องไม่หนีไปอยู่ท้ายสุด
         */
        footer={
          <AppFooter>
            {revision ? (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => {
                  setEditingAgain(true)
                  setJustSubmitted(false)
                }}
              >
                แก้แล้วส่งใหม่
              </Button>
            ) : (
              <Link
                href="/posttest"
                className="btn-quest bg-brand-600 text-ink-onbrand hover:bg-brand-700"
              >
                ไปทำแบบทดสอบหลังเรียน
                <ChevronRightIcon width={22} height={22} aria-hidden />
              </Link>
            )}
          </AppFooter>
        }
      >
        <header className="flex flex-col items-center gap-2 pt-2 text-center">
          <DomeAvatar mood={revision ? 'cheer' : 'celebrate'} size={112} decorative />
          <h1 className="text-display font-extrabold text-balance text-ink">
            {revision ? 'ครูส่งงานกลับมาให้แก้' : 'ส่งใบเสนอแล้ว'}
          </h1>
          <p className="text-body text-pretty text-ink-muted">
            {revision
              ? 'ไม่ได้แปลว่าผิดนะ ครูอยากให้เติมอีกนิดเดียว แก้แล้วส่งใหม่ได้เลย ฉบับเดิมยังอยู่'
              : justSubmitted
                ? `ใบเสนอชื่อเว็บส่งถึงที่ประชุมเรียบร้อย${nickname ? ` ${nickname}` : ''}`
                : 'ใบเสนอชื่อเว็บของเราส่งไปแล้ว แก้ไม่ได้ ถ้าอยากแก้ให้บอกครู'}
          </p>
        </header>

        {/* ส่งแล้วต้องรู้ว่าอยู่ขั้นไหน ไม่ใช่นั่งเดา — poll ตามจังหวะที่เซิร์ฟเวอร์บอก
            สถานะเปลี่ยนเมื่อไหร่ (ครูยืนยัน / ครูสั่งแก้) โหลดคะแนนกับคำสั่งแก้ใหม่ให้เอง
            ไม่ต้องรีเฟรชหน้า */}
        <GradeStatusCard className="mt-5" onSettled={() => void loadCeoStatus()} />

        {/* ครูสั่งแก้ด้านไหน + ทำอะไรถึงจะได้ 3 (ข้อความจากรูบริกตรง ๆ) */}
        {revision ? (
          <div className="mt-5 rounded-2xl bg-spark-50 p-4 ring-1 ring-spark-100 ring-inset">
            <p className="text-body font-bold text-ink">ครูบอกว่า: {revision.note}</p>
            <ul className="mt-3 flex flex-col gap-3">
              {revision.dimensions.map((d) => (
                <li key={d.id} className="rounded-xl bg-surface-raised p-3">
                  <p className="text-body font-bold text-ink">{d.name}</p>
                  <p className="mt-1 text-label text-pretty text-ink-muted">
                    ทำแบบนี้แล้วได้ 3 เต็ม: {d.whatGetsYouThere}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-label text-ink-muted">
              รอบที่ {revision.round} · แก้ได้อีก {revision.roundsLeft} รอบ
              ถ้าไม่พอบอกครูได้ ครูเปิดให้เพิ่มได้
            </p>
            {/* ปุ่ม "แก้แล้วส่งใหม่" อยู่ในแถบท้ายที่ไม่เลื่อน ไม่ซ้ำอีกตัวในการ์ดนี้ */}
          </div>
        ) : null}

        <DomeSays mood="celebrate" speakerName="โดม" avatarSize={72} className="mt-5">
          {revision
            ? 'แก้ตามที่ครูบอกแล้วกดส่งใหม่ได้เลย ฉบับเดิมยังอยู่ ไม่หาย'
            : feedback?.teacherConfirmed
              ? 'ครูตรวจและยืนยันคะแนนแล้ว เก่งมาก ไปทำแบบทดสอบหลังเรียนต่อได้เลย'
              : 'ส่งใบเสนอเรียบร้อยแล้ว ตอนนี้รอครูอ่านและยืนยันคะแนน ระหว่างนี้ไปทำแบบทดสอบหลังเรียนต่อได้เลย'}
        </DomeSays>

        {/**
          * S-27 ความเห็นรายด้าน — เจ้าของงานเห็นเอง ไม่ใช่เห็นแต่ครู
          *
          * ⚠️ หัวข้อกับป้ายกำกับตัวเลข **ต้องเปลี่ยนตาม `feedback.teacherConfirmed`**
          *    ตัวเลขที่เซิร์ฟเวอร์ส่งมาเป็นของครูแล้วตั้งแต่ครูกดยืนยัน (ดู teacherFacingScores)
          *    ถ้ายังพาดหัวว่า "ข้อเสนอ ไม่ใช่คะแนนสุดท้าย" อยู่ เด็กจะเข้าใจผิดว่า
          *    คะแนนที่ครูตัดสินแล้วยังเปลี่ยนได้ — เป็นการโกหกที่ตัวเลขถูกแต่คำผิด
          * ⚠️ ไม่มีคะแนนของเพื่อนอยู่ตรงนี้เลย และไม่มีคะแนนที่ AI เสนอด้วย
          */}
        {feedback ? (
          <SectionCard
            heading={feedback.teacherConfirmed ? 'คะแนนที่ครูยืนยันแล้ว' : 'ความเห็นที่ระบบเสนอ'}
            description={
              feedback.teacherConfirmed
                ? 'ครูตรวจและยืนยันคะแนนของงานชิ้นนี้แล้ว นี่คือผลจริงของเรา'
                : 'เป็นข้อเสนอ ไม่ใช่คะแนนสุดท้าย ครูเป็นคนยืนยันเสมอ'
            }
            icon={
              feedback.teacherConfirmed ? (
                <CheckIcon width={24} height={24} />
              ) : (
                <LightbulbIcon width={24} height={24} />
              )
            }
            tone="brand"
          >
            {feedback.weightedTotal !== null ? (
              <p className="text-body-lg font-bold text-ink">
                {feedback.teacherConfirmed ? 'คะแนนที่ครูให้' : 'คะแนนที่เสนอ'}{' '}
                {feedback.weightedTotal}
                {feedback.weightedMax !== null ? ` / ${feedback.weightedMax}` : ''}
              </p>
            ) : null}
            {feedback.summary ? (
              <p className="mt-1 text-body text-pretty text-ink-muted">{feedback.summary}</p>
            ) : null}

            <ul className="mt-3 flex flex-col gap-2">
              {feedback.dimensions.map((d) => (
                <li key={d.id} className="rounded-xl bg-surface-raised p-3">
                  <p className="flex flex-wrap items-center justify-between gap-2 text-body font-bold text-ink">
                    <span className="min-w-0">
                      {d.name}
                      {d.emphasized ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-spark-100 px-2 py-0.5 text-note font-bold text-spark-700">
                          ด้านที่เราขอให้เน้น
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-brand-700">
                      {d.score}/3 · {d.levelLabel}
                    </span>
                  </p>
                  <p className="mt-1 text-label text-pretty text-ink-muted">{d.evidence}</p>
                  <p className="mt-1 text-label text-pretty text-brand-700">
                    ลองเพิ่ม: {d.suggestion}
                  </p>
                </li>
              ))}
            </ul>

            {/* ครูตัดสินจบแล้วก็ไม่ต้องชวนให้ "รีบบอกครูก่อนครูตรวจ" อีก — คนละสถานการณ์กัน */}
            <p className="mt-3 text-label text-pretty text-ink-muted">
              {feedback.teacherConfirmed
                ? 'คะแนนนี้ครูยืนยันแล้ว ข้อเสนอแนะรายด้านข้างบนเก็บไว้ใช้ตอนทำงานชิ้นต่อไปได้'
                : `${
                    feedback.aiReady
                      ? 'AI ช่วยอ่านงานนี้อีกรอบแล้ว ครูจะเห็นทั้งสองความเห็นก่อนตัดสิน'
                      : 'AI กำลังช่วยอ่านงานนี้อีกรอบ ครูจะเห็นทั้งสองความเห็นก่อนตัดสิน'
                  } อยากแก้ก่อนครูตรวจให้ยกมือบอกครู ครูกดส่งงานกลับมาให้แก้ได้`}
            </p>
          </SectionCard>
        ) : null}

        <SectionCard
          heading="สิ่งที่ส่งไป"
          icon={<SendIcon width={24} height={24} />}
          tone="plain"
        >
          {submission ? (
            <dl className="flex flex-col gap-3">
              <div className="rounded-xl bg-surface-sunken p-3">
                <dt className="text-label font-semibold text-ink-muted">ชื่อเว็บ</dt>
                <dd className="mt-0.5 text-body-lg font-extrabold break-all text-ink">
                  {submission.domainName || NO_DATA}
                  {submission.tld}
                </dd>
              </div>
              <div className="rounded-xl bg-surface-sunken p-3">
                <dt className="text-label font-semibold text-ink-muted">
                  ด้านที่ขอให้ครูดูเป็นพิเศษ (คูณ 2)
                </dt>
                <dd className="mt-0.5 text-body font-bold text-pretty text-ink">
                  {rubric.find((r) => r.id === submission.emphasisCriterion)?.dimension ?? NO_DATA}
                </dd>
              </div>
            </dl>
          ) : (
            <EmptyState
              as="h3"
              title="ยังอ่านรายละเอียดใบเสนอไม่ได้"
              description="ครูได้รับใบเสนอแล้ว แต่หน้านี้ยังโหลดรายละเอียดไม่ขึ้น ลองรีเฟรชหน้าอีกครั้ง"
            />
          )}
        </SectionCard>

        <div className="mt-6 flex flex-col gap-2">
          {/* ตอนครูส่งกลับมาให้แก้ แถบท้ายถูกปุ่ม "แก้แล้วส่งใหม่" จองไว้
              ทางไปขั้นต่อไปจึงยังต้องมีให้กดตรงนี้ */}
          {revision ? (
            <Link
              href="/posttest"
              className="btn-base min-h-12 w-full bg-surface-raised text-brand-700 shadow-soft-1 ring-2 ring-brand-100 ring-inset hover:bg-brand-50"
            >
              ไปทำแบบทดสอบหลังเรียน
            </Link>
          ) : null}
          <Link
            href="/showcase"
            className="btn-base min-h-12 w-full bg-surface-raised text-brand-700 shadow-soft-1 ring-2 ring-brand-100 ring-inset hover:bg-brand-50"
          >
            ไปดูผลงานของเพื่อน
          </Link>
        </div>
      </StudentShell>
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
    const labelText = field.required ? `${field.label} (ต้องกรอก)` : field.label
    const helpId = `${field.id}-help`
    const groupLabelId = `${field.id}-group-label`

    if (field.type === 'text') {
      return (
        <TextField
          id={field.id}
          label={labelText}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => setField(field.id, e.target.value)}
          hint={field.help}
          autoComplete="off"
        />
      )
    }

    if (field.type === 'textarea') {
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <label htmlFor={field.id} className="text-body font-bold text-pretty text-ink">
            {labelText}
          </label>
          <p id={helpId} className="mt-1 text-label text-pretty text-ink-muted">
            {field.help}
          </p>
          <textarea
            id={field.id}
            value={value}
            placeholder={field.placeholder}
            aria-describedby={helpId}
            onChange={(e) => setField(field.id, e.target.value)}
            className={cn(
              'mt-2 min-h-0 w-full flex-1 resize-none rounded-sm bg-surface-raised px-4 py-3 text-body text-ink',
              'ring-2 ring-line-contrast ring-inset outline-none',
              'placeholder:text-ink-subtle focus:ring-brand-500',
              'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus',
            )}
          />
        </div>
      )
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <p id={groupLabelId} className="text-body font-bold text-ink">
          {labelText}
        </p>
        <p id={helpId} className="mt-1 text-label text-pretty text-ink-muted">
          {field.help}
        </p>
        {field.options.length === 0 ? (
          <EmptyState
            as="h3"
            className="mt-2"
            title="ยังไม่มีตัวเลือกให้เลือก"
            description="รอครูเปิดเนื้อหาส่วนนี้ให้ก่อนนะ"
          />
        ) : (
          <ul
            role="group"
            aria-labelledby={groupLabelId}
            aria-describedby={helpId}
            className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5"
          >
            {field.options.map((option) => (
              <li key={option.value}>
                <ChoiceCard
                  label={option.label}
                  selected={value === option.value}
                  ariaLabel={`${option.label}${value === option.value ? ' — เลือกอยู่' : ''}`}
                  onSelect={() => setField(field.id, option.value)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <StudentShell
      className="ceo-world-shell flex h-full min-h-0 flex-col gap-2.5"
      footer={
        <AppFooter>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={stepIndex === 0 || busy}
              className="shrink-0 px-4"
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
                {busy ? 'กำลังส่ง…' : 'ส่งใบเสนอให้ที่ประชุม'}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                trailingIcon={<ChevronRightIcon width={22} height={22} />}
              >
                ถัดไป
              </Button>
            )}
          </div>
        </AppFooter>
      }
    >
      {/* แถบบอกว่าอยู่ขั้นไหนของด่านบอส — แทนการเลื่อนหาว่าเหลืออะไรอีกบ้าง */}
      <div className="flex shrink-0 items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-label font-bold text-brand-700">
          ด่านบอส CEO · {stepMeta?.label ?? ''}
        </p>
        <span className="shrink-0 text-label font-bold tabular-nums text-ink-muted">
          นาทีที่ {startMinute}–{endMinute} · {stepIndex + 1}/{steps.length}
        </span>
      </div>
      <ProgressBar
        className="shrink-0"
        value={stepIndex + 1}
        max={steps.length}
        tone="brand"
        label={`ขั้นที่ ${stepIndex + 1} จาก ${steps.length}`}
        hideLabel
        showValue={false}
      />

      {/* ครูส่งกลับมาให้แก้ — ย้ำไว้บรรทัดเดียว รายละเอียดอยู่ในแผ่น */}
      {editingAgain && revision ? (
        <button
          type="button"
          onClick={() => setSheet('revision')}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-spark-50 px-3 py-2 text-left ring-1 ring-spark-100 ring-inset focus-ring"
        >
          <AlertIcon width={18} height={18} aria-hidden className="shrink-0 text-spark-700" />
          <span className="min-w-0 flex-1 truncate text-label font-bold text-ink">
            ครูขอให้แก้รอบที่ {revision.round} — แตะเพื่ออ่าน
          </span>
          <ChevronRightIcon width={18} height={18} aria-hidden className="shrink-0 text-spark-700" />
        </button>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        {stepMeta?.kind === 'speak' ? (
          <>
            <h1 className="shrink-0 line-clamp-3 text-title-sm font-extrabold text-balance text-ink">
              {objective}
            </h1>

            <p className="shrink-0 truncate text-label font-bold text-brand-700">
              ร้านของเรา: {shopName}
            </p>

            {/* โน้ตกระดาษเหลืองเตือนเวลา (mockup) */}
            <p className="shrink-0 -rotate-1 rounded-xl bg-reward-100 px-3 py-2 text-label text-pretty text-ink shadow-soft-1 ring-1 ring-reward-300 ring-inset">
              พูดให้ได้ 1–2 นาที พูดช้า ๆ ชัด ๆ แล้วจะจำได้เองว่าจะพูดอะไรต่อ
            </p>

            <SheetChip
              tone="brand"
              icon={<QuestIcon width={18} height={18} />}
              onClick={() => setSheet('topics')}
              badge={`${checkedCount}/${guidingQuestions.length}`}
              className="shrink-0"
            >
              หัวข้อที่ต้องพูด
            </SheetChip>

            {/* พระเอกของจอนี้ — ไมค์วงกลมใหญ่ มีคลื่นเสียงสองข้างตาม mockup */}
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
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
                      recording
                        ? `หยุดบันทึกเสียง กำลังบันทึกมาแล้ว ${seconds} วินาที`
                        : 'เริ่มบันทึกเสียงซ้อมพูด'
                    }
                    className={cn(
                      'relative grid size-28 cursor-pointer place-items-center rounded-full text-ink-onbrand',
                      'shadow-soft-3 transition-[background-color,box-shadow] duration-200 ease-[var(--ease-soft)]',
                      'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus',
                      'active:translate-y-px motion-reduce:transition-none',
                      recording ? 'bg-danger-600 hover:bg-danger-700' : 'bg-brand-600 hover:bg-brand-700',
                    )}
                  >
                    {recording ? <StopIcon width={48} height={48} /> : <MicIcon width={48} height={48} />}
                  </button>
                </div>
                <SoundWave active={recording} side="right" />
              </div>

              <p className="flex items-center gap-2">
                <ClockIcon width={22} height={22} aria-hidden className="shrink-0 text-brand-700" />
                <span aria-live="off" className="text-title font-extrabold tabular-nums text-ink">
                  {clock(seconds)}
                </span>
                <span className="text-body font-bold tabular-nums text-ink-muted">
                  / {clock(MAX_RECORD_SECONDS)}
                </span>
              </p>
              <p className="text-center text-label text-ink-muted">
                {recording ? 'กำลังบันทึก — กดปุ่มอีกครั้งเพื่อหยุด' : 'กดปุ่มเพื่อเริ่มบันทึกเสียง'}
              </p>
              {micNote ? (
                <p className="text-center text-label text-pretty text-spark-700">{micNote}</p>
              ) : null}
              {audioUrl ? (
                <p className="text-center text-label text-ink-muted">
                  {uploading
                    ? 'กำลังส่งไฟล์เสียงให้ครู…'
                    : voiceSent
                      ? 'ส่งไฟล์เสียงให้ครูแล้ว ครูเปิดฟังย้อนหลังได้'
                      : 'ไฟล์เสียงอยู่ในเครื่องแล้ว กรอกใบเสนอต่อได้เลย'}
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        {stepMeta?.kind === 'mode' ? (
          <>
            <h1 className="shrink-0 text-title-sm font-extrabold text-balance text-ink">
              จะส่งงานแบบไหนดี
            </h1>
            <p className="shrink-0 text-label text-pretty text-ink-muted">
              เลือกได้ 1 แบบ เปลี่ยนใจได้จนกว่าจะกดส่ง
            </p>
            <div className="grid shrink-0 grid-cols-3 gap-2">
              {submitModes.map((mode) => {
                const on = mode.id === modeId
                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setModeId(mode.id)}
                    className={cn(
                      'flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3',
                      'text-label font-bold ring-2 ring-inset focus-ring',
                      on
                        ? 'bg-brand-600 text-ink-onbrand shadow-soft-2 ring-brand-700'
                        : 'bg-surface-sunken text-ink ring-line-contrast',
                    )}
                  >
                    <span className="text-center break-words">{mode.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="min-h-0 flex-1 rounded-xl bg-brand-50 p-3 text-body text-pretty text-ink">
              {selectedMode?.instruction ?? NO_DATA}
            </p>
            {typingOnly ? (
              <p className="shrink-0 text-label text-pretty text-spark-700">
                ตอนนี้สลับมาโหมดพิมพ์ให้แล้ว เลือกวิธีอื่นใหม่ได้ตลอดถ้าอยากลองอีกครั้ง
              </p>
            ) : null}
            {selectedMode && selectedMode.id !== primaryModeId ? (
              <p className="shrink-0 text-label text-pretty text-spark-700">
                แบบ{selectedMode.label}ยังต้องเอางานจริงไปส่งครูที่หน้าห้อง ในหน้านี้ระบบเก็บได้แค่ตัวเลือกกับข้อความ
              </p>
            ) : null}
          </>
        ) : null}

        {stepMeta?.kind === 'field' && stepMeta.field ? renderField(stepMeta.field) : null}

        {stepMeta?.kind === 'focus' ? (
          <>
            <h1 className="shrink-0 text-title-sm font-extrabold text-balance text-ink">
              อยากให้ครูดูด้านไหนเป็นพิเศษ
            </h1>
            <p className="shrink-0 text-label text-pretty text-ink-muted">
              ด้านที่เลือกครูจะให้น้ำหนัก 2 เท่า · เกณฑ์เต็ม ๆ อยู่ในแผ่น &ldquo;ดูเกณฑ์ให้คะแนน&rdquo;
            </p>
            <ul className="flex min-h-0 flex-1 flex-col gap-1.5">
              {rubric.map((row, index) => (
                <li key={row.id}>
                  <ChoiceCard
                    marker={String(index + 1)}
                    label={row.dimension}
                    selected={row.id === focusRubricId}
                    ariaLabel={`ด้านที่ ${index + 1} ${row.dimension}`}
                    onSelect={() => setFocusRubricId(row.id)}
                  />
                </li>
              ))}
            </ul>
            <SheetChip
              tone="brand"
              icon={<InfoIcon width={18} height={18} />}
              onClick={() => setSheet('rubric')}
              className="shrink-0"
            >
              ดูเกณฑ์ให้คะแนน 4 ด้าน
            </SheetChip>
          </>
        ) : null}

        {stepMeta?.kind === 'self' && stepMeta.self ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <label htmlFor={stepMeta.self.id} className="shrink-0 text-body font-bold text-pretty text-ink">
              {stepMeta.self.question} (ต้องตอบ)
            </label>
            <textarea
              id={stepMeta.self.id}
              value={selfValues[stepMeta.self.id] ?? ''}
              onChange={(e) => setSelf(stepMeta.self!.id, e.target.value)}
              className={cn(
                'mt-2 min-h-0 w-full flex-1 resize-none rounded-sm bg-surface-raised px-4 py-3 text-body text-ink',
                'ring-2 ring-line-contrast ring-inset outline-none',
                'placeholder:text-ink-subtle focus:ring-brand-500',
                'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus',
              )}
            />
          </div>
        ) : null}

        {stepMeta?.kind === 'review' ? (
          <>
            <h1 className="shrink-0 text-title-sm font-extrabold text-balance text-ink">
              ตรวจก่อนส่ง
            </h1>
            {missing.length > 0 ? (
              <p className="shrink-0 rounded-xl bg-spark-50 p-3 text-label text-pretty text-spark-700 ring-1 ring-spark-100 ring-inset">
                ยังต้องกรอกอีก {missing.length} อย่าง กด &ldquo;ย้อน&rdquo; กลับไปเติมได้
              </p>
            ) : (
              <p className="shrink-0 rounded-xl bg-quest-50 p-3 text-label text-pretty text-quest-700 ring-1 ring-quest-100 ring-inset">
                กรอกครบแล้ว ส่งได้ครั้งเดียว ตรวจอีกรอบแล้วกดส่งได้เลย
              </p>
            )}
            <ul className="flex min-h-0 flex-1 flex-col gap-1.5">
              {steps.map((s, i) =>
                s.kind === 'field' || s.kind === 'self' || s.kind === 'focus' ? (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => setStepIndex(i)}
                      className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-surface-raised px-3 text-left shadow-soft-1 ring-1 ring-line ring-inset focus-ring"
                    >
                      <span className="min-w-0 flex-1 truncate text-label font-bold text-ink">
                        {s.label}
                      </span>
                      <span className="min-w-0 max-w-[45%] truncate text-label text-ink-muted">
                        {s.summary() || 'ยังว่าง'}
                      </span>
                      <ChevronRightIcon width={16} height={16} aria-hidden className="shrink-0 text-ink-subtle" />
                    </button>
                  </li>
                ) : null,
              )}
            </ul>
            {systemMessage ? (
              <p role="alert" className="shrink-0 text-label text-pretty text-spark-700">
                {systemMessage}
              </p>
            ) : null}
          </>
        ) : null}
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
    </StudentShell>
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
