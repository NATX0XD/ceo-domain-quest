'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRouter } from 'next/navigation'
import type { LearnPath, LearnState } from '@/components/server/learn-path'
import {
  type CounterData,
  type CounterDecision,
  type CounterStepResult,
} from '@/components/learn/counter-types'
import type { RegistrarCard, RegistrarData, RegistrarStepPayload } from '@/components/learn/registrar-types'
import { MissionGame, type GameData } from '@/components/mission-game'
import { CounterGame } from '@/components/learn/counter-game'
import { RegistrarGame } from '@/components/learn/registrar-game'
import {
  AlertIcon,
  ArrowLeftIcon,
  Button,
  Card,
  CheckIcon,
  ChevronRightIcon,
  DomeAvatar,
  DomeBoardFrame,
  HomeIcon,
  PauseIcon,
  PlayIcon,
  ProgressBar,
  RefreshIcon,
  cn,
} from '@/components/ui'
import {
  MODE_LABEL,
  postLearn,
  type AnswerResponse,
  type DoResponse,
  type LearnModeId,
} from './learn-path-api'
import { ModePopup } from './mode-popup'
import { LearnScenePanel } from './learn-path-scene'
import { LearnQuestions } from './learn-path-questions'
import { fetchDomeReply } from './learn-reply-api'
import { HelpPanel, ResultPanel, aiReply, weakest } from './learn-path-result'
import { CardSortGame } from './card-sort-game'
import { LearnDoneScreen } from './learn-done'
import { AppScreen, GlassCard, type MenuItem } from './app/app-screen'
import { useExitConfirm } from '@/components/student-navigation'
import { ChatReader, QuickChip } from './app/chat-reader'
import { Confetti, Float, Shake, buzz } from './app/fx'
import { themeFor } from './app/theme'
import { DomeSays, M1Button, M1Shell, useM1Sound, type M1Scene } from './m1/m1-shell'
import { M1Handoff, M1ModeChooser, M1ReadBrief, M1WatchBrief } from './m1/m1-screens'

/**
 * เส้นทางเรียนก่อนเข้าภารกิจ (ดู / อ่าน / ลงมือทำ) — สเปก docs/learn-path-spec.md
 *
 * ลำดับจอ: แนะนำเรื่อง > เลือกวิธีเรียน > เรียนตามวิธี > สรุป
 * ⚠️ ไม่มีเฉลยในไฟล์นี้ ทุกการตรวจส่งไป POST /api/mission/[id]/learn
 * ⚠️ วิธีเรียนเป็นข้อเสนอเท่านั้น ทุกวิธีกดได้เสมอ และเปลี่ยนวิธีได้ทุกเมื่อ
 * จบแล้ว router.refresh() ให้หน้าเซิร์ฟเวอร์เห็น learn-done แล้วแสดงจอภารกิจเดิม
 */

type Step = 'intro' | 'result' | 'watch' | 'read' | 'read-handoff' | 'questions' | 'do' | 'done'

const STAGES = ['เลือกวิธี', 'เรียน', 'สรุป'] as const

/** วินาทีเริ่มของฉาก 1–8 ในคลิปภารกิจ 1 (ตามคำบรรยาย public/captions/m1-watch.th.vtt) ใช้ย้อนดูเฉพาะช่วง */
const M1_SCENE_AT = [0, 2.9, 8.2, 13.6, 13.6, 19.7, 23.9, 27.5]

/** สรุปสั้น ๆ บนจอเรียนจบ (เฉพาะภารกิจที่มีข้อสรุปกลาง) */
const LEARN_RECAP: Record<string, string[]> = {
  m1: ['โดเมนเนม = ชื่อที่ใช้ระบุและเข้าเว็บไซต์ จำง่ายกว่าเลข IP', 'DNS = ระบบที่ค้นหาเลข IP จากชื่อโดเมน ให้เบราว์เซอร์ไปถูกที่'],
}

function stageOf(step: Step): number {
  if (step === 'intro' || step === 'result') return 0
  if (step === 'done') return 2
  return 1
}
export interface LearnPathClientProps {
  missionId: string
  /** ใช้แยกที่เก็บความคืบหน้าในแท็บ ไม่ให้นักเรียนคนถัดไปเห็นของคนก่อน */
  studentId: string
  missionTitle: string
  path: LearnPath
  state: LearnState
  passScore: number
  gameData?: GameData | null
  counterData?: CounterData | null
  registrarData?: RegistrarData | null
  registrarCard?: RegistrarCard | null
  recommendedMode?: LearnModeId | null
  /** รอบเล่นซ้ำหลังผ่านแล้ว (`?replay=1`) — จบแล้วต้องออกจาก URL เล่นซ้ำ ไม่ใช่ refresh วนเข้ารอบใหม่ */
  replay?: boolean
}

export function LearnPathClient({
  missionId,
  studentId,
  missionTitle,
  path,
  state,
  passScore,
  gameData,
  counterData,
  registrarData,
  registrarCard,
  recommendedMode = null,
  replay = false,
}: LearnPathClientProps) {
  const router = useRouter()
  /** เรียนจบแล้วให้เซิร์ฟเวอร์วาดจอภารกิจใหม่ — รอบเล่นซ้ำต้องทิ้ง ?replay=1 ไปด้วย */
  const reloadMission = () => (replay ? router.replace(`/mission/${encodeURIComponent(missionId)}`) : router.refresh())
  const isM1 = missionId === 'm1'
  const sound = useM1Sound()
  const singleMode = path.modes.length === 1 && path.modes[0] === 'do'
  /** ด่าน 3 (เคาน์เตอร์) กับด่าน 4 (จดโดเมน) มีจอกติกาในเกมเองแล้ว — ข้ามจอ "เป้าหมายด่านนี้" เข้าเกมเลย */
  const directGame = singleMode && (path.do.kind === 'counter' || path.do.kind === 'registrar')

  // กลับมาเปิดหน้าใหม่ = ทำต่อจากจุดเดิมที่บันทึกไว้
  const [step, setStep] = useState<Step>(() =>
    singleMode ? (state.chosen === 'do' || directGame ? 'do' : 'intro') : (state.chosen ?? 'result'),
  )
  const [mode, setMode] = useState<LearnModeId | null>(state.chosen ?? (directGame ? 'do' : null))
  const [picked, setPicked] = useState<LearnModeId | null>(state.chosen ?? recommendedMode ?? 'do')

  const [sceneIdx, setSceneIdx] = useState(0)
  const [autoPlay, setAutoPlay] = useState(true)
  const [chatShown, setChatShown] = useState(() => {
    const firstBreak = isM1 ? (path.read.parts ?? []).map((p) => p.start).find((n) => n > 1) : undefined
    return firstBreak ? firstBreak - 1 : 1
  })
  // คลิปจริง (watch.video) — กดดูภาพนิ่งแทนได้ เล่นไม่ได้ = สลับไปภาพนิ่งเอง
  const [videoEnded, setVideoEnded] = useState(false)
  const [preferStills, setPreferStills] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoProgress, setVideoProgress] = useState(0)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [videoDuration, setVideoDuration] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [answerResult, setAnswerResult] = useState<AnswerResponse | null>(null)
  const [doResult, setDoResult] = useState<DoResponse | null>(null)
  // มินิเกมเดิม (kind game) ตอบถูกครบแล้วแต่ส่งผลไม่สำเร็จ = มีปุ่มส่งซ้ำ ไม่ต้องเล่นใหม่
  const [gameResend, setGameResend] = useState(false)
  const [done, setDone] = useState<{ mode: LearnModeId; score: number } | null>(null)

  const [brief, setBrief] = useState(true)
  const [qIdx, setQIdx] = useState(0)
  const [qPhase, setQPhase] = useState<'ask' | 'result' | 'help' | 'supp'>('ask')
  // โดมตอบกลับรายข้อ (AI) — replyPending = ข้อที่โดมกำลังพิมพ์ตอบ
  const [domeReplies, setDomeReplies] = useState<Record<string, string>>({})
  const [replyPending, setReplyPending] = useState<string | null>(null)
  const [suppTried, setSuppTried] = useState(0)
  const [hintShown, setHintShown] = useState(false)
  const [reviewing, setReviewing] = useState<{ from: number; to: number } | null>(null)
  const [retryTick, setRetryTick] = useState(0)
  const [confettiTick, setConfettiTick] = useState(0)
  const reduce = useReducedMotion()
  const prevIdx = useRef(0)
  const theme = themeFor(missionId)
  const exit = useExitConfirm({
    href: '/map',
    note: 'ที่ส่งให้ระบบแล้วจะอยู่ต่อ ส่วนคำตอบที่ยังไม่ส่งจะเก็บไว้เฉพาะเครื่องนี้และยังไม่คิดคะแนน',
  })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scenes = path.watch.scenes
  const lastScene = scenes.length - 1
  const scene = scenes[Math.min(sceneIdx, lastScene)]!
  const video = path.watch.video
  const showVideo = Boolean(video) && !preferStills && !videoFailed
  const chat = path.read.chat
  const askMode: 'watch' | 'read' = mode === 'read' ? 'read' : 'watch'
  const questions = path[askMode].questions

  // โหมดดู: เล่นต่อเองตามความยาวบทพูด หยุดที่ฉากสุดท้าย
  /* กลับมาหลังรีโหลด = ทำต่อจากจุดเดิมในแท็บนี้ (sessionStorage แยกตามภารกิจ) เก็บเฉพาะตำแหน่งกับร่างคำตอบ */
  const storeKey = `learn-flow:${studentId}:${missionId}`
  const [ready, setReady] = useState(false)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storeKey)
      const saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : null
      if (saved && !state.done && !replay) {
        const savedMode = saved.mode === 'watch' || saved.mode === 'read' || saved.mode === 'do' ? saved.mode : null
        const steps: Step[] = ['intro', 'result', 'watch', 'read', 'read-handoff', 'questions', 'do']
        const savedStep = steps.find((x) => x === saved.step)
        const needsMode =
          savedStep === 'watch' || savedStep === 'read' || savedStep === 'read-handoff' || savedStep === 'questions' || savedStep === 'do'
        const usableSavedStep = singleMode
          ? savedStep === 'intro' || savedStep === 'do'
            ? directGame
              ? 'do'
              : savedStep
            : null
          : savedStep
        if (usableSavedStep && (!needsMode || savedMode)) {
          setStep(usableSavedStep)
          setMode(savedMode ?? (directGame ? 'do' : null))
          if (typeof saved.brief === 'boolean') setBrief(saved.brief)
          if (typeof saved.qIdx === 'number') setQIdx(Math.max(0, Math.min(questions.length - 1, saved.qIdx)))
          if (typeof saved.sceneIdx === 'number') setSceneIdx(Math.max(0, Math.min(lastScene, saved.sceneIdx)))
          if (typeof saved.chatShown === 'number') setChatShown(Math.max(1, Math.min(chat.length, saved.chatShown)))
          if (saved.answers && typeof saved.answers === 'object') setAnswers(saved.answers as Record<string, string>)
          if (saved.domeReplies && typeof saved.domeReplies === 'object') setDomeReplies(saved.domeReplies as Record<string, string>)
          if (usableSavedStep === 'watch') setAutoPlay(false)
        }
      }
    } catch {
      /* ไม่มี sessionStorage = เริ่มจากจุดที่เซิร์ฟเวอร์บอก */
    }
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- อ่านครั้งเดียวตอนเปิดหน้า
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      if (step === 'done' || done) sessionStorage.removeItem(storeKey)
      else {
        sessionStorage.setItem(
          storeKey,
          JSON.stringify({ step, mode, brief, qIdx, sceneIdx, chatShown, answers, domeReplies }),
        )
      }
    } catch {
      /* เก็บไม่ได้ก็ข้าม */
    }
  }, [ready, storeKey, step, mode, brief, qIdx, sceneIdx, chatShown, answers, domeReplies, done])

  useEffect(() => {
    if (step !== 'watch' || showVideo || !autoPlay || sceneIdx >= lastScene) return
    const ms = Math.max(4000, (scenes[sceneIdx]?.line.length ?? 0) * 110)
    const t = setTimeout(() => setSceneIdx((i) => Math.min(lastScene, i + 1)), ms)
    return () => clearTimeout(t)
  }, [step, showVideo, autoPlay, sceneIdx, lastScene, scenes])

  // ภารกิจ 1: เปลี่ยนจอ = เริ่มอ่านจากบนสุด (จอถาม-ตอบเลื่อนไปที่ช่องตอบเอง)
  useEffect(() => {
    if (!isM1) return
    if (step === 'questions' && (qPhase === 'ask' || qPhase === 'supp')) return
    if (step === 'read' && !brief && !reviewing) return
    document.querySelector('.m1-content')?.scrollTo({ top: 0 })
  }, [isM1, step, qPhase, brief, reviewing])

  function go(next: Step) {
    setError(null)
    if (next === 'questions') setReviewing(null)
    setStep(next)
  }

  function openMode(m: LearnModeId) {
    setMode(m)
    setAnswerResult(null)
    setDoResult(null)
    setBrief(!singleMode)
    setQIdx(0)
    setDomeReplies({})
    setQPhase('ask')
    setSuppTried(0)
    setHintShown(false)
    setReviewing(null)
    if (m === 'watch') {
      setSceneIdx(0)
      setAutoPlay(true)
      go('watch')
    } else if (m === 'read') {
      // ภารกิจ 1: แสดงทีละช่วงของเรื่องทันที ไม่หน่วงเวลา (R02)
      const firstBreak = isM1 ? (path.read.parts ?? []).map((p) => p.start).find((n) => n > 1) : undefined
      setChatShown(firstBreak ? firstBreak - 1 : 1)
      go('read')
    } else {
      go('do')
    }
  }

  async function submitChoose() {
    if (!picked) return
    setBusy(true)
    setError(null)
    const res = await postLearn<{ ok: true }>(missionId, {
      action: 'choose',
      mode: picked,
    })
    setBusy(false)
    if (!res.ok) return setError(res.message)
    openMode(picked)
  }

  /** ตอบข้อนี้แล้ว (ไม่ใช่ข้อสุดท้าย) — โดมพิมพ์ตอบกลับด้วย AI ก่อน แล้วค่อยขึ้นข้อถัดไป (รอไม่เกินงบเวลา) */
  async function answerAndNext() {
    const q = questions[qIdx]
    if (!q || replyPending) return
    setReplyPending(q.id)
    const { reply } = await fetchDomeReply(missionId, { mode: askMode, questionId: q.id, answer: answers[q.id] ?? '' })
    setDomeReplies((prev) => ({ ...prev, [q.id]: reply }))
    setReplyPending(null)
    setQIdx((i) => Math.min(questions.length - 1, i + 1))
  }

  async function submitAnswers() {
    setBusy(true)
    setError(null)
    const res = await postLearn<AnswerResponse>(missionId, {
      action: 'answer',
      mode: askMode,
      answers: Object.fromEntries(questions.map((q) => [q.id, answers[q.id] ?? ''])),
    })
    setBusy(false)
    if (!res.ok) return setError(res.message)
    setAnswerResult(res.data)
    if (qPhase === 'supp') setSuppTried((n) => n + 1)
    setQPhase('result')
    setHintShown(false)
    if (res.data.passed) {
      setDone({ mode: askMode, score: res.data.score })
      setConfettiTick((t) => t + 1)
    } else {
      setRetryTick((t) => t + 1)
    }
  }

  async function submitGameSolved() {
    setGameResend(false)
    try {
      const result = await submitDo({ game: 'solved' })
      if (!result.passed) setGameResend(true)
    } catch {
      setGameResend(true)
    }
  }

  async function submitDo(payload: unknown): Promise<DoResponse> {
    setError(null)
    const res = await postLearn<DoResponse>(missionId, {
      action: 'do',
      payload,
    })
    if (!res.ok) {
      // โยนต่อให้เกมแสดงปุ่ม "ส่งอีกครั้ง" เอง ไม่ใช่นับเป็นคะแนน 0
      setError(res.message)
      throw new Error(res.message)
    }
    setDoResult(res.data)
    if (res.data.passed) {
      // D&D keeps its own D05 result screen visible so the learner can inspect
      // evidence before choosing the next-objective action.
      const isCardSort = typeof payload === 'object' && payload !== null && 'placements' in payload
      if (!isCardSort) {
        setDone({ mode: 'do', score: res.data.score })
        setConfettiTick((t) => t + 1)
      }
    } else {
      setRetryTick((t) => t + 1)
    }
    return res.data
  }

  /** ตรวจลูกค้าทีละคนของด่าน 3 (ไม่เก็บคะแนน) */
  async function checkCounter(decision: CounterDecision): Promise<CounterStepResult> {
    const res = await postLearn<CounterStepResult>(missionId, {
      action: 'step',
      payload: decision,
    })
    if (!res.ok) throw new Error(res.message)
    return res.data
  }

  /** ด่าน 3 เริ่มกะใหม่: เซิร์ฟเวอร์จับลูกค้าชุดใหม่แล้วส่งข้อมูลสาธารณะกลับมา */
  async function newCounterShift(): Promise<CounterData['cases']> {
    const res = await postLearn<{ cases: CounterData['cases'] }>(missionId, { action: 'shift' })
    if (!res.ok) throw new Error(res.message)
    return res.data.cases
  }

  /** ตรวจทีละจังหวะของด่าน 4 (action 'step') ผลมาจากเซิร์ฟเวอร์ ไม่เก็บคะแนน */
  async function checkRegistrar(payload: RegistrarStepPayload): Promise<unknown> {
    const res = await postLearn<unknown>(missionId, { action: 'step', payload })
    if (!res.ok) throw new Error(res.message)
    return res.data
  }

  /** ย้อนดูฉาก/ข้อความที่โดมชี้ — กลับมาตอบต่อได้โดยร่างคำตอบยังอยู่ */
  function startReview(range?: { from: number; to: number }) {
    const r = range ?? { from: 1, to: askMode === 'watch' ? scenes.length : chat.length }
    setReviewing(r)
    setBrief(false)
    if (askMode === 'watch') {
      setSceneIdx(Math.max(0, r.from - 1))
      setAutoPlay(false)
      go('watch')
    } else {
      setChatShown(chat.length)
      go('read')
    }
  }

  /** ภารกิจ 1 ผ่านแล้ว = กลับหน้าภารกิจ (เซิร์ฟเวอร์เห็นว่าเรียนจบ แล้วแสดงคำถามท้ายภารกิจ) */
  function finishM1() {
    try {
      sessionStorage.removeItem(storeKey)
    } catch {
      /* ข้าม */
    }
    reloadMission()
  }

  /* ------------------------------------------------------------ ปุ่มล่าง */

  let footer: ReactNode = null
  if (step === 'intro') {
    footer = (
      <Button
        size="lg"
        fullWidth
        onClick={() => (singleMode ? openMode('do') : go('result'))}
        trailingIcon={<ChevronRightIcon width={22} height={22} />}
      >
        {singleMode ? 'เข้าเกมภารกิจ' : 'เลือกวิธีเรียน'}
      </Button>
    )
  } else if (step === 'result') {
    footer = null // ปุ่มเริ่มอยู่ในป๊อปอัป
  } else if (step === 'watch') {
    footer = brief ? (
      <Button
        size="lg"
        fullWidth
        onClick={() => setBrief(false)}
        trailingIcon={<ChevronRightIcon width={22} height={22} />}
      >
        {path.watch.video ? 'เริ่มดูวิดีโอ' : 'เริ่มดูเรื่องราว'}
      </Button>
    ) : reviewing ? (
      <div className="flex gap-2">
        {sceneIdx < Math.min(lastScene, reviewing.to - 1) ? (
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setSceneIdx((i) => Math.min(lastScene, i + 1))}
            trailingIcon={<ChevronRightIcon width={22} height={22} />}
          >
            ฉากต่อไป
          </Button>
        ) : null}
        <Button size="lg" className="flex-1" onClick={() => go('questions')}>
          กลับไปตอบโดม
        </Button>
      </div>
    ) : showVideo ? (
      <Button
        size="lg"
        fullWidth
        disabled={!videoEnded}
        onClick={() => go('questions')}
        trailingIcon={<ChevronRightIcon width={22} height={22} />}
      >
        {videoEnded ? 'คุยกับโดม' : 'ดูคลิปให้จบก่อน แล้วคุยกับโดม'}
      </Button>
    ) : sceneIdx < lastScene ? (
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => setAutoPlay((a) => !a)}
          leadingIcon={autoPlay ? <PauseIcon width={22} height={22} /> : <PlayIcon width={22} height={22} />}
        >
          {autoPlay ? 'หยุด' : 'เล่นต่อ'}
        </Button>
        <Button
          size="lg"
          className="flex-1"
          onClick={() => setSceneIdx((i) => Math.min(lastScene, i + 1))}
          trailingIcon={<ChevronRightIcon width={22} height={22} />}
        >
          ฉากต่อไป
        </Button>
      </div>
    ) : (
      <Button
        size="lg"
        fullWidth
        onClick={() => go('questions')}
        trailingIcon={<ChevronRightIcon width={22} height={22} />}
      >
        คุยกับโดม
      </Button>
    )
  } else if (step === 'read') {
    footer = brief ? (
      <Button
        size="lg"
        fullWidth
        onClick={() => setBrief(false)}
        trailingIcon={<ChevronRightIcon width={22} height={22} />}
      >
        เริ่มอ่านแชต
      </Button>
    ) : reviewing ? (
      <Button size="lg" fullWidth onClick={() => go('questions')}>
        กลับไปตอบโดม
      </Button>
    ) : chatShown < chat.length ? (
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={() => setChatShown(chat.length)}>
          แสดงทั้งหมด
        </Button>
        <Button
          size="lg"
          className="flex-1"
          onClick={() => setChatShown((n) => Math.min(chat.length, n + 1))}
          trailingIcon={<ChevronRightIcon width={22} height={22} />}
        >
          ข้อความถัดไป
        </Button>
      </div>
    ) : (
      <Button
        size="lg"
        fullWidth
        onClick={() => go('read-handoff')}
        trailingIcon={<ChevronRightIcon width={22} height={22} />}
      >
        อ่านจบแล้ว
      </Button>
    )
  } else if (step === 'read-handoff') {
    footer = (
      <Button
        size="lg"
        fullWidth
        onClick={() => go('questions')}
        trailingIcon={<ChevronRightIcon width={22} height={22} />}
      >
        เริ่มตอบคำถาม
      </Button>
    )
  } else if (step === 'do' && brief && path.do.kind === 'game') {
    footer = (
      <Button
        size="lg"
        fullWidth
        onClick={() => setBrief(false)}
        trailingIcon={<ChevronRightIcon width={22} height={22} />}
      >
        เริ่มลงมือทำ
      </Button>
    )
  } else if (step === 'questions' || step === 'do') {
    const lastQ = qIdx >= questions.length - 1
    const cur = questions[qIdx]
    const weakId = answerResult ? weakest(answerResult)?.id : undefined
    const suppQ = questions.find((q) => q.id === weakId)
    footer = done ? (
      <Button
        variant="success"
        size="lg"
        fullWidth
        onClick={() => go('done')}
        trailingIcon={<ChevronRightIcon width={22} height={22} />}
      >
        ไปต่อ
      </Button>
    ) : step === 'questions' ? (
      qPhase === 'ask' ? (
        <Button
          variant="success"
          size="lg"
          fullWidth
          disabled={busy || replyPending !== null || !(cur && (answers[cur.id] ?? '').trim())}
          loading={busy || replyPending !== null}
          loadingLabel={replyPending ? 'โดมกำลังพิมพ์' : 'กำลังตรวจคำตอบ'}
          onClick={() => (lastQ ? submitAnswers() : answerAndNext())}
          leadingIcon={busy ? undefined : lastQ ? <CheckIcon width={22} height={22} /> : undefined}
          trailingIcon={busy || lastQ ? undefined : <ChevronRightIcon width={22} height={22} />}
        >
          {lastQ ? 'ส่งคำตอบ' : 'ส่งคำตอบ ไปข้อต่อไป'}
        </Button>
      ) : qPhase === 'result' ? (
        suppTried >= 1 ? (
          <Button
            size="lg"
            fullWidth
            onClick={() => openMode(askMode)}
            leadingIcon={<RefreshIcon width={22} height={22} />}
          >
            {askMode === 'watch' ? 'ย้อนดูเรื่องอีกรอบ' : 'อ่านแชตอีกรอบ'}
          </Button>
        ) : (
          <Button
            size="lg"
            fullWidth
            onClick={() => setQPhase('help')}
            trailingIcon={<ChevronRightIcon width={22} height={22} />}
          >
            ทบทวนเฉพาะจุด
          </Button>
        )
      ) : qPhase === 'help' ? (
        <Button
          size="lg"
          fullWidth
          onClick={() => setQPhase('supp')}
          trailingIcon={<ChevronRightIcon width={22} height={22} />}
        >
          ตอบเสริม
        </Button>
      ) : (
        <Button
          variant="success"
          size="lg"
          fullWidth
          disabled={busy || !(suppQ && (answers[suppQ.id] ?? '').trim())}
          loading={busy}
          loadingLabel="กำลังตรวจคำตอบ"
          onClick={submitAnswers}
          leadingIcon={busy ? undefined : <CheckIcon width={22} height={22} />}
        >
          ส่งคำตอบเสริม
        </Button>
      )
    ) : null
  } else if (step === 'done') {
    footer = (
      <Button
        variant="success"
        size="lg"
        fullWidth
        onClick={reloadMission}
        trailingIcon={<ChevronRightIcon width={22} height={22} />}
      >
        ไปต่อ
      </Button>
    )
  }
  /* ---------------------------------------------- ปุ่มล่างภารกิจ 1 (สตอรี่บอร์ดทีม) */
  if (isM1) {
    const chev = <ChevronRightIcon width={22} height={22} />
    const toMap = (
      <M1Button variant="secondary" size="md" fullWidth onClick={() => router.push('/map')}>
        กลับแผนภารกิจ
      </M1Button>
    )
    const nextPart = (() => {
      const starts = (path.read.parts ?? []).map((p) => p.start).filter((n) => n - 1 > chatShown)
      return starts.length > 0 ? Math.min(chat.length, starts[0]! - 1) : chat.length
    })()
    const cur = questions[qIdx]
    const weakId = answerResult ? weakest(answerResult)?.id : undefined
    const suppQ = questions.find((q) => q.id === weakId)
    if (step === 'result') {
      footer = (
        <M1Button fullWidth disabled={!picked || busy} loading={busy} loadingLabel="กำลังเริ่ม" onClick={submitChoose} trailingIcon={chev}>
          เริ่มภารกิจที่ 1
        </M1Button>
      )
    } else if (step === 'watch') {
      footer = brief ? (
        <>
          <M1Button fullWidth onClick={() => setBrief(false)} trailingIcon={chev}>
            เริ่มดูวิดีโอ
          </M1Button>
          {toMap}
        </>
      ) : reviewing ? (
        <M1Button fullWidth onClick={() => go('questions')} trailingIcon={chev}>
          กลับไปตอบโดม
        </M1Button>
      ) : showVideo ? (
        <M1Button variant={videoEnded ? 'success' : 'primary'} fullWidth disabled={!videoEnded} onClick={() => go('questions')} trailingIcon={chev}>
          {videoEnded ? 'คุยกับโดม' : 'ดูให้จบก่อน แล้วคุยกับโดม'}
        </M1Button>
      ) : sceneIdx < lastScene ? (
        <M1Button fullWidth onClick={() => setSceneIdx((i) => Math.min(lastScene, i + 1))} trailingIcon={chev}>
          ฉากต่อไป
        </M1Button>
      ) : (
        <M1Button variant="success" fullWidth onClick={() => go('questions')} trailingIcon={chev}>
          คุยกับโดม
        </M1Button>
      )
    } else if (step === 'read') {
      footer = brief ? (
        <>
          <M1Button fullWidth onClick={() => setBrief(false)} trailingIcon={chev}>
            เริ่มอ่านแชต
          </M1Button>
          {toMap}
        </>
      ) : reviewing ? (
        <M1Button fullWidth onClick={() => go('questions')} trailingIcon={chev}>
          กลับไปตอบโดม
        </M1Button>
      ) : chatShown < chat.length ? (
        <div className="m1-dock-row">
          <M1Button variant="secondary" size="md" onClick={() => setChatShown(chat.length)}>
            แสดงทั้งหมด
          </M1Button>
          <M1Button size="md" onClick={() => setChatShown(nextPart)} trailingIcon={chev}>
            อ่านต่อ
          </M1Button>
        </div>
      ) : (
        <M1Button variant="success" fullWidth onClick={() => go('read-handoff')} trailingIcon={chev}>
          อ่านจบแล้ว
        </M1Button>
      )
    } else if (step === 'read-handoff') {
      footer = (
        <M1Button fullWidth onClick={() => go('questions')} trailingIcon={chev}>
          เริ่มตอบคำถาม
        </M1Button>
      )
    } else if (step === 'questions') {
      footer = done ? (
        <>
          <M1Button variant="success" fullWidth onClick={finishM1} trailingIcon={chev}>
            ไปต่อ: คำถามท้ายภารกิจ
          </M1Button>
          <M1Button variant="secondary" size="md" fullWidth onClick={() => startReview()}>
            {askMode === 'watch' ? 'ทบทวนด้วยตนเอง' : 'อ่านแชตอีกครั้ง'}
          </M1Button>
        </>
      ) : qPhase === 'ask' ? (
        <M1Button
          variant="success"
          fullWidth
          disabled={busy || replyPending !== null || !(cur && (answers[cur.id] ?? '').trim())}
          loading={busy || replyPending !== null}
          loadingLabel={replyPending ? 'โดมกำลังพิมพ์' : 'โดมกำลังอ่านคำตอบ'}
          onClick={() => (qIdx >= questions.length - 1 ? submitAnswers() : answerAndNext())}
          trailingIcon={chev}
        >
          ส่งคำตอบ
        </M1Button>
      ) : qPhase === 'result' ? (
        suppTried >= 1 ? (
          <>
            <M1Button fullWidth onClick={() => openMode(askMode)}>
              {askMode === 'watch' ? 'ย้อนดูคลิป' : 'อ่านแชตอีกครั้ง'}
            </M1Button>
            <div className="m1-dock-row">
              <M1Button variant="secondary" size="md" onClick={() => go('result')}>
                ลองวิธีอื่น
              </M1Button>
              <M1Button variant="secondary" size="md" onClick={() => router.push('/home')}>
                ลองใหม่ภายหลัง
              </M1Button>
            </div>
          </>
        ) : (
          <>
            <M1Button fullWidth onClick={() => setQPhase('help')} trailingIcon={chev}>
              ทบทวนเฉพาะจุด
            </M1Button>
            <div className="m1-dock-row">
              <M1Button variant="secondary" size="md" onClick={() => setQPhase('supp')}>
                ลองตอบเสริม
              </M1Button>
              <M1Button variant="secondary" size="md" onClick={() => router.push('/map')}>
                กลับแผนภารกิจ
              </M1Button>
            </div>
          </>
        )
      ) : qPhase === 'help' ? (
        <M1Button fullWidth onClick={() => setQPhase('supp')} trailingIcon={chev}>
          ลองตอบเสริม
        </M1Button>
      ) : (
        <M1Button
          variant="success"
          fullWidth
          disabled={busy || !(suppQ && (answers[suppQ.id] ?? '').trim())}
          loading={busy}
          loadingLabel="โดมกำลังอ่านคำตอบ"
          onClick={submitAnswers}
        >
          ส่งคำตอบเสริม
        </M1Button>
      )
    } else if (step === 'do' || step === 'intro' || step === 'done') {
      footer = step === 'done' ? (
        <M1Button variant="success" fullWidth onClick={finishM1} trailingIcon={chev}>
          ไปต่อ: คำถามท้ายภารกิจ
        </M1Button>
      ) : null
    }
  }
  /* --------------------------------------------------------------- เนื้อหา */

  const stage = singleMode ? 0 : isM1 && step === 'questions' && answerResult ? 2 : stageOf(step)
  const stageLabels = singleMode ? (['เกม'] as const) : STAGES
  const canSwitch = !singleMode && (step === 'watch' || step === 'read' || step === 'read-handoff' || step === 'questions' || step === 'do') && !done
  const dark = theme.dark
  const doBrief = step === 'do' && brief && path.do.kind === 'game'
  /** ด่าน 2: ใช้ชื่อส่วนให้ตรงกับแชต (TLD / SLD / Subdomain) */
  const viewGame: GameData | null | undefined =
    gameData && theme.id === 'm2'
      ? {
          ...gameData,
          instruction: 'วางชิ้นส่วนลงทั้ง 3 ช่อง ระวังชิ้นหลอก',
          targets: gameData.targets.map((t) => ({
            ...t,
            label: t.label
              .replace('ชื่อโฮสต์ (Host)', 'Subdomain (ชื่อโฮสต์)')
              .replace('ชื่อโดเมน (Domain)', 'SLD (ชื่อโดเมน)')
              .replace('นามสกุลโดเมน', 'TLD (นามสกุลโดเมน)'),
          })),
        }
      : gameData
  const fullBleed = step === 'do' && (path.do.kind === 'counter' || path.do.kind === 'registrar')
  const ink = dark ? 'text-white' : 'text-ink'
  const inkMuted = dark ? 'text-white/70' : 'text-ink-muted'
  const score = done?.score ?? answerResult?.score ?? doResult?.score ?? 0

  const order: Record<Step, number> = {
    intro: 0,
    result: 0,
    watch: 1,
    read: 1,
    'read-handoff': 1,
    do: 1,
    questions: 2,
    done: 2,
  }
  const idx = order[step]
  const dir = idx >= prevIdx.current ? 1 : -1
  useEffect(() => {
    prevIdx.current = idx
  }, [idx])
  const viewKey = step

  const menu: MenuItem[] = [
    ...(canSwitch
      ? [
          {
            key: 'switch',
            label: 'เปลี่ยนวิธีเรียน',
            hint: mode ? `ตอนนี้: ${MODE_LABEL[mode]}` : undefined,
            icon: <RefreshIcon width={22} height={22} aria-hidden />,
            onSelect: () => go('result'),
          },
        ]
      : []),
    {
      key: 'home',
      label: 'กลับหน้าหลัก',
      hint: 'กลับมาเปิดภารกิจนี้ แล้วทำต่อจากจุดเดิมได้',
      icon: <HomeIcon width={22} height={22} aria-hidden />,
      onSelect: () => router.push('/home'),
    },
  ]

  const slide = {
    enter: (d: number) => ({ x: reduce ? 0 : d * 44, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: reduce ? 0 : d * -44, opacity: 0 }),
  }

  const m1Pill: Record<Step, string> = {
    intro: 'ภารกิจที่ 1',
    result: 'เลือกวิธีเรียนที่ชอบ',
    watch: brief ? 'รับภารกิจ · ดูวิดีโอ' : reviewing ? 'ย้อนดูช่วงที่โดมชี้' : 'ดูคลิปสถานการณ์',
    read: brief ? 'รับภารกิจ · อ่านแชต' : 'แชตเพื่อน: มีน × ฟ้า',
    'read-handoff': 'คุยกับโดม',
    questions: answerResult && qPhase !== 'supp' ? (qPhase === 'help' ? 'โดมช่วยเฉพาะจุด' : 'สรุปผลความเข้าใจ') : 'คุยกับโดม',
    do: 'ลงมือทำ · จับคู่ความหมาย',
    done: 'สรุปผล',
  }
  const m1Scene: M1Scene =
    step === 'read-handoff' ? 'room' : step === 'result' || ((step === 'watch' || step === 'read') && brief) ? 'sky' : 'bakery'
  const m1Back =
    step === 'done' || done
      ? undefined
      : (step === 'watch' || step === 'read') && brief
        ? () => go('result')
        : step === 'result' || step === 'intro'
          ? exit.request
          : step === 'questions' && qPhase === 'ask' && qIdx > 0 && !replyPending
            ? () => setQIdx((i) => i - 1)
            : exit.request

  const body = (
    <>
      <Confetti fire={confettiTick} />
      {step === 'result' && !isM1 ? (
        <ModePopup
          missionNo={missionId.replace(/\D/g, '') || missionId}
          title={missionTitle}
          recommended={recommendedMode ?? 'do'}
          reason={recommendedMode ? undefined : 'ยังไม่รู้สไตล์ของคุณ ลองแบบนี้ก่อน'}
          picked={picked}
          busy={busy}
          error={error}
          onPick={(m) => {
            buzz()
            setPicked(m)
          }}
          onStart={submitChoose}
          onClose={() => (mode ? go(mode) : router.push('/map'))}
          presentation="drawer"
        />
      ) : null}
      {step === 'result' && isM1 ? (
        <M1ModeChooser
          recommended={recommendedMode ?? 'do'}
          picked={picked}
          error={error}
          onPick={(m) => {
            buzz()
            setPicked(m)
          }}
        />
      ) : null}
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={viewKey}
          custom={dir}
          variants={slide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            duration: reduce ? 0.01 : 0.24,
            ease: [0.22, 0.8, 0.3, 1],
          }}
          className={cn('mx-auto flex w-full flex-col gap-4', fullBleed ? 'min-h-full' : 'max-w-md')}
        >
          <span className="sr-only" role="list" aria-label="ขั้นตอนการเรียน">
            {stageLabels.map((label, i) => (
              <span key={label} role="listitem" aria-current={i === stage ? 'step' : undefined}>
                {label}
              </span>
            ))}
          </span>

          {error && !(isM1 && step === 'result') ? (
            <Card tone="danger" padding="sm" role="alert">
              <p className="flex items-center gap-2 text-label font-bold text-danger-700">
                <AlertIcon width={20} height={20} aria-hidden />
                {error}
              </p>
            </Card>
          ) : null}

          {step === 'intro' ? (
            <>
              {missionId === 'm1' ? <div className="m1-map-art" aria-hidden="true" /> : null}
              <div className="relative z-10 flex flex-col items-center pt-2">
                <Float>
                  <DomeAvatar mood="greet" size={132} decorative />
                </Float>
              </div>
              <GlassCard dark={dark} className={missionId === 'm1' ? 'm1-intro-copy media-panel' : undefined}>
                <p className={cn('text-label font-bold', dark ? 'text-brand-200' : 'text-brand-700')}>
                  เตรียมตัวก่อนภารกิจ
                </p>
                <h2 className={cn('mt-1 text-title font-extrabold', ink)}>เป้าหมายด่านนี้</h2>
                <p className={cn('mt-3 line-clamp-3 text-body-lg', ink)}>{path.story}</p>
                <details className="mt-2 rounded-xl bg-white/45 px-3 py-2 text-label">
                  <summary className="cursor-pointer font-bold text-brand-700">อ่านเรื่องเต็ม</summary>
                  <p className={cn('mt-2 text-body', inkMuted)}>{path.story}</p>
                </details>
                {!singleMode ? (
                  <p className={cn('mt-3 text-label font-semibold', inkMuted)}>เลือกวิธีเรียนจากการ์ดด้านล่างได้เลย เปลี่ยนภายหลังได้</p>
                ) : null}
              </GlassCard>
            </>
          ) : null}

          {isM1 && step === 'watch' && brief ? (
            <M1WatchBrief
              title={path.watch.brief?.title ?? path.watch.title}
              situation={path.watch.brief?.situation ?? path.story}
              tip={path.watch.brief?.tip ?? 'ดูเรื่องราวให้จบ แล้วตอบคำถามโดม 2 ข้อด้วยคำของตนเอง'}
            />
          ) : null}
          {isM1 && step === 'read' && brief ? (
            <M1ReadBrief
              title={path.read.brief?.title ?? path.read.title}
              tip={path.read.brief?.tip ?? 'อ่านจบแล้วโดมจะถามคำถาม 2 ข้อ ตอบด้วยคำของตัวเองได้เลย'}
            />
          ) : null}
          {!isM1 && (step === 'watch' || step === 'read') && brief ? (
            <>
              <div className="flex flex-col items-center pt-2">
                <Float>
                  <DomeAvatar mood="explain" size={112} decorative />
                </Float>
              </div>
              <GlassCard dark={dark}>
                <h2 className={cn('text-title-sm font-extrabold', ink)}>
                  {(step === 'watch' ? path.watch.brief?.title : path.read.brief?.title) ??
                    (step === 'watch' ? path.watch.title : path.read.title)}
                </h2>
                <p className={cn('mt-2 text-body-lg', ink)}>
                  {(step === 'watch' ? path.watch.brief?.situation : path.read.brief?.situation) ?? path.story}
                </p>
                <p className={cn('mt-3 rounded-2xl bg-brand-50 px-4 py-3 text-body text-brand-700')}>
                  {(step === 'watch' ? path.watch.brief?.tip : path.read.brief?.tip) ??
                    'ดูให้จบ แล้วตอบคำถามโดม 2 ข้อด้วยคำของตนเอง'}
                </p>
                {step === 'watch' ? (
                  <img className="m1-brief-art mt-3" src="/learn/m1/watch-s1.webp" alt="มีนกำลังช่วยลูกค้าที่ร้านขนม" />
                ) : (
                  <div className="m1-character-pair mt-3" aria-label="ตัวละครในแชต">
                    <figure className="m1-character-card">
                      <img src="/learn/m1/watch-s1.webp" alt="มีน" />
                      <figcaption>มีน</figcaption>
                    </figure>
                    <figure className="m1-character-card m1-character-card--fah">
                      <img src="/learn/m1/watch-s2.webp" alt="ฟ้า" />
                      <figcaption>ฟ้า</figcaption>
                    </figure>
                  </div>
                )}
              </GlassCard>
            </>
          ) : null}

          {step === 'read-handoff' && isM1 ? <M1Handoff mode="read" /> : null}
          {step === 'read-handoff' && !isM1 ? (
            <section className="m1-handoff" aria-labelledby="m1-handoff-title">
              <img src="/learn/m1/dome-room.webp" alt="โดมพร้อมช่วยตอบคำถาม" className="m1-handoff-art" />
              <GlassCard>
                <p className="m1-eyebrow">อ่านครบแล้ว</p>
                <h2 id="m1-handoff-title" className="mt-1 text-title-sm font-extrabold text-ink">ส่งต่อให้โดมช่วยสรุป</h2>
                <p className="mt-3 text-body-lg text-ink">อ่านเรื่องของมีนกับฟ้าจบแล้วนะครับ ลองตอบตามความเข้าใจของตัวเอง 2 ข้อ ไม่ต้องตอบเหมือนข้อความในแชตก็ได้ครับ</p>
              </GlassCard>
            </section>
          ) : null}

          {isM1 && step === 'watch' && !brief && showVideo ? (
            <section className="m1-stack" aria-label={path.watch.title}>
              {reviewing ? (
                <p className="m1-review-note" role="status">
                  โดมพาย้อนมาที่ช่วงฉากที่ {reviewing.from}
                  {reviewing.to > reviewing.from ? `–${reviewing.to}` : ''} แล้ว กดเล่นดูอีกครั้ง แล้วกลับไปตอบต่อได้เลย
                </p>
              ) : null}
              <div className="m1-video-frame">
                <video
                  ref={videoRef}
                  key={video}
                  src={video}
                  poster={path.watch.poster}
                  controls
                  playsInline
                  muted={!sound.on}
                  preload="metadata"
                  title={path.watch.title}
                  aria-label={path.watch.title}
                  onEnded={() => { setVideoEnded(true); setVideoPlaying(false) }}
                  onPlay={() => setVideoPlaying(true)}
                  onPause={() => setVideoPlaying(false)}
                  onError={() => setVideoFailed(true)}
                  onLoadedMetadata={(event) => {
                    setVideoDuration(event.currentTarget.duration)
                    if (reviewing) event.currentTarget.currentTime = M1_SCENE_AT[Math.max(0, reviewing.from - 1)] ?? 0
                  }}
                  onTimeUpdate={(event) => {
                    const t = event.currentTarget.currentTime
                    setVideoProgress(t)
                    if (videoDuration && t >= videoDuration - 0.4) setVideoEnded(true)
                  }}
                >
                  {path.watch.captions ? <track kind="captions" srcLang="th" label="คำบรรยายภาษาไทย" src={path.watch.captions} /> : null}
                </video>
              </div>
              <div className="m1-video-bar">
                <button
                  type="button"
                  className="m1-vbtn m1-vbtn--main"
                  aria-label={videoPlaying ? 'หยุดคลิปชั่วคราว' : 'เล่นคลิป'}
                  onClick={() => {
                    const v = videoRef.current
                    if (!v) return
                    if (v.paused) void v.play()
                    else v.pause()
                  }}
                >
                  {videoPlaying ? (
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" /></svg>
                  )}
                </button>
                <button
                  type="button"
                  className="m1-vbtn"
                  aria-label="เล่นซ้ำตั้งแต่ต้น"
                  onClick={() => {
                    const v = videoRef.current
                    if (!v) return
                    v.currentTime = 0
                    setVideoProgress(0)
                    void v.play()
                  }}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.6 4.7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /><path d="M4.2 4.5v5h5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <div
                  className="m1-video-track"
                  role="progressbar"
                  aria-label="ความคืบหน้าการดูคลิป"
                  aria-valuemin={0}
                  aria-valuemax={Math.ceil(videoDuration || 0)}
                  aria-valuenow={Math.floor(videoProgress)}
                >
                  <span className="m1-video-fill" style={{ width: `${videoDuration ? Math.min(100, (videoProgress / videoDuration) * 100) : 0}%` }} />
                </div>
                <span className="m1-video-time">
                  {fmtTime(videoProgress)} / {fmtTime(videoDuration)}
                </span>
              </div>
              <p className={cn('m1-video-lock', videoEnded && 'is-open')} role="status">
                {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D */}
                <img src={videoEnded ? '/icons/3d/check-mark-button.webp' : '/icons/3d/locked.webp'} alt="" aria-hidden />
                {videoEnded ? 'ดูครบแล้ว! ปุ่มคุยกับโดมพร้อมแล้ว' : 'ดูคลิปให้จบ ปุ่มคุยกับโดมจะปลดล็อก'}
              </p>
              <DomeSays mood={videoEnded ? 'cheer' : 'think'} size={84}>
                {videoEnded
                  ? 'เก่งมากครับ! มาเล่าให้ผมฟังหน่อยว่าเข้าใจอะไรบ้าง'
                  : 'ลองสังเกตว่าลูกค้าพิมพ์ชื่อเว็บแล้ว ระบบช่วยหาอะไรให้ จากนั้นมาคุยกับผมนะครับ'}
              </DomeSays>
              <button type="button" className="m1-link-chip self-start" onClick={() => setPreferStills(true)}>
                เน็ตช้า? ดูแบบภาพนิ่งแทน
              </button>
            </section>
          ) : null}

          {step === 'watch' && !brief && !(isM1 && showVideo) ? (
            <section className="flex flex-col gap-3" aria-label={path.watch.title}>
              <GlassCard dark={dark} className="px-4 py-3">
                <h2 className={cn('text-title-sm font-extrabold text-pretty', ink)}>{path.watch.title}</h2>
              </GlassCard>
              {reviewing ? (
                <p className="rounded-2xl bg-reward-100 px-4 py-2 text-label font-bold text-ink" role="status">
                  โดมชี้ให้ย้อนดูฉากที่ {reviewing.from}
                  {reviewing.to > reviewing.from ? ` ถึง ${reviewing.to}` : ''} แล้วกลับไปตอบต่อได้เลย
                </p>
              ) : null}
              {videoFailed ? (
                <Card tone="spark" padding="sm" role="status">
                  <p className="flex items-center gap-2 text-label font-bold text-ink">
                    <AlertIcon width={20} height={20} aria-hidden className="text-spark-700" />
                    เปิดคลิปไม่ได้ตอนนี้ เปลี่ยนเป็นภาพนิ่งให้แล้ว เรียนต่อได้เลย
                  </p>
                </Card>
              ) : null}
              {video && !videoFailed ? (
                <button
                  type="button"
                  onClick={() => setPreferStills((v) => !v)}
                  className="flex min-h-11 items-center self-start rounded-full bg-white px-4 text-label font-bold whitespace-nowrap text-brand-700 shadow-soft-1 transition-transform active:scale-95 focus-ring"
                >
                  {preferStills ? 'กลับไปดูคลิป' : 'ดูแบบภาพนิ่งแทน (เน็ตช้า)'}
                </button>
              ) : null}
              {showVideo ? (
                <video
                  ref={videoRef}
                  key={video}
                  src={video}
                  poster={path.watch.poster}
                  controls
                  playsInline
                  preload="metadata"
                  title={path.watch.title}
                  aria-label={path.watch.title}
                  onEnded={() => setVideoEnded(true)}
                  onError={() => setVideoFailed(true)}
                  onLoadedMetadata={(event) => setVideoDuration(event.currentTarget.duration)}
                  onTimeUpdate={(event) => setVideoProgress(event.currentTarget.currentTime)}
                  className="media-video aspect-video w-full rounded-[24px]"
                >
                </video>
              ) : (
                <>
                  <div className="flex items-center gap-3 rounded-[20px] bg-white px-4 py-3 shadow-soft-1">
                    <div className="min-w-0 flex-1">
                      <ProgressBar
                        value={sceneIdx + 1}
                        max={scenes.length}
                        label={`ฉากที่ ${sceneIdx + 1} จาก ${scenes.length}`}
                        showValue
                        tone="brand"
                        size="sm"
                      />
                    </div>
                    {sceneIdx > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSceneIdx((i) => Math.max(0, i - 1))}
                        aria-label="ย้อนฉากก่อนหน้า"
                        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200 transition-transform active:scale-90 focus-ring"
                      >
                        <ArrowLeftIcon width={22} height={22} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={scene.id}
                      initial={reduce ? false : { opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reduce ? undefined : { opacity: 0, x: -40 }}
                      transition={{ duration: 0.22 }}
                      className="flex flex-col gap-3"
                    >
                      <LearnScenePanel
                        visual={scene.visual}
                        image={scene.image}
                        caption={scene.caption}
                        domeSpeaking={scene.speaker === 'โดม'}
                        m2={theme.id === 'm2'}
                      />
                      <GlassCard dark={dark} className="p-4">
                        <div aria-live="polite">
                          <p className={cn('text-label font-bold', dark ? 'text-brand-200' : 'text-brand-700')}>
                            {scene.speaker}
                          </p>
                          <p className={cn('mt-1 text-body-lg leading-relaxed', ink)}>{scene.line}</p>
                        </div>
                      </GlassCard>
                    </motion.div>
                  </AnimatePresence>
                </>
              )}
              {showVideo ? (
                <div className="m1-video-meta">
                  <ProgressBar
                    value={videoProgress}
                    max={videoDuration || 1}
                    label={`ดูแล้ว ${Math.floor(videoProgress)} จาก ${Math.ceil(videoDuration || 0)} วินาที`}
                    showValue={false}
                    tone="brand"
                    size="sm"
                  />
                  <button
                    type="button"
                    className="m1-replay-button"
                    onClick={() => {
                      if (!videoRef.current) return
                      videoRef.current.currentTime = 0
                      setVideoProgress(0)
                      setVideoEnded(false)
                      void videoRef.current.play()
                    }}
                  >
                    เล่นซ้ำ
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {step === 'read' && !brief ? (
            <section className="flex flex-col gap-3" aria-label={path.read.title}>
              <h2 className="sr-only">{path.read.title}</h2>
              {reviewing ? (
                <p className="rounded-2xl bg-reward-100 px-4 py-2 text-label font-bold text-ink" role="status">
                  โดมไฮไลต์ข้อความที่ {reviewing.from}
                  {reviewing.to > reviewing.from ? ` ถึง ${reviewing.to}` : ''} ให้ย้อนอ่าน แล้วกลับไปตอบต่อได้เลย
                </p>
              ) : null}
              <ChatReader
                chat={chat}
                shown={chatShown}
                summary={theme.id === 'm2'}
                parts={path.read.parts}
                quick={path.read.quick}
                highlight={reviewing}
                title={theme.id === 'm2' ? 'CEO Domain Quest' : 'แชตเพื่อน: มีน × ฟ้า'}
                primaryRight={isM1}
                avatars={isM1 ? { มีน: '/learn/m1/avatar-meen.webp', ฟ้า: '/learn/m1/avatar-fah.webp' } : undefined}
                instant={isM1}
                hideControls={isM1}
                onNext={() => setChatShown((n) => Math.min(chat.length, n + 1))}
                onAll={() => setChatShown(chat.length)}
              />
              {chatShown < chat.length ? (
                <p className="self-center rounded-full bg-white px-4 py-1 text-label font-bold text-ink shadow-soft-1">
                  ข้อความ {chatShown} จาก {chat.length}
                </p>
              ) : null}
            </section>
          ) : null}

          {step === 'questions' ? (
            qPhase === 'ask' || qPhase === 'supp' ? (
              <LearnQuestions
                mode={askMode}
                questions={questions}
                answers={answers}
                onChange={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))}
                qIdx={qIdx}
                onlyId={qPhase === 'supp' && answerResult ? (weakest(answerResult)?.id ?? null) : null}
                domeNote={qPhase === 'supp' && answerResult ? aiReply(weakest(answerResult)) : null}
                replies={domeReplies}
                pendingId={qPhase === 'ask' ? replyPending : null}
                onReview={qPhase === 'ask' ? () => startReview(questions[qIdx]?.review) : undefined}
                disabled={busy || done !== null}
                grading={busy}
                shakeKey={retryTick}
              />
            ) : qPhase === 'help' && answerResult ? (
              <HelpPanel
                result={answerResult}
                questions={questions}
                hintShown={hintShown}
                onHint={() => setHintShown(true)}
                onReview={() => startReview(questions.find((q) => q.id === weakest(answerResult)?.id)?.review)}
                reviewLabel={askMode === 'watch' ? 'ย้อนดูช่วงที่เกี่ยวข้อง' : 'ทบทวนช่วงที่เกี่ยวข้อง'}
              />
            ) : answerResult ? (
              <Shake trigger={answerResult.passed ? 0 : retryTick}>
                <ResultPanel
                  result={answerResult}
                  passScore={passScore}
                  questions={questions}
                  extra={
                    !isM1 && !answerResult.passed && suppTried >= 1 ? (
                      <Card tone="spark" padding="sm">
                        <p className="text-body font-bold text-ink">ยังมีบางจุดที่ควรทบทวนครับ</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <QuickChip onClick={() => go('result')}>ลองเรียนวิธีอื่นดูไหม</QuickChip>
                          <QuickChip onClick={() => router.push('/home')}>ลองอีกครั้งภายหลัง</QuickChip>
                        </div>
                      </Card>
                    ) : null
                  }
                />
              </Shake>
            ) : null
          ) : null}

          {step === 'do' && doBrief ? (
            <>
              <div className="flex flex-col items-center pt-2">
                <Float>
                  <DomeAvatar mood="cheer" size={112} decorative />
                </Float>
              </div>
              <DomeBoardFrame className="learn-result-board">
                <h2 className={cn('text-title-sm font-extrabold', ink)}>{path.do.title}</h2>
                <p className={cn('mt-2 text-body-lg', ink)}>{path.do.instruction}</p>
              </DomeBoardFrame>
            </>
          ) : null}

          {step === 'do' && !doBrief ? (
            <section
              className={cn('flex flex-col gap-3', fullBleed && 'min-h-full flex-1 px-3 py-3')}
              aria-label={path.do.title}
            >
              {path.do.kind === 'game' && theme.id === 'm2' ? (
                <div
                  className="m2-game-badge self-center rounded-xl px-4 py-1.5 text-body font-extrabold tracking-wide"
                  style={{
                    textShadow: 'none',
                  }}
                >
                  อ่านจากขวาไปซ้าย
                </div>
              ) : null}
              {path.do.kind === 'game' && viewGame ? (
                <GlassCard
                  dark={dark}
                  className="m2-game-panel p-2.5 [&_.mt-3]:mt-1 [&_.mt-4]:mt-2 [&_.min-h-12]:min-h-10 [&_.min-h-14]:min-h-10 [&_li>div]:!p-2.5 [&_ul]:gap-2 [&_ul]:!mt-2 [&_p+p]:hidden"
                >
                  <MissionGame missionId={missionId} data={viewGame} onSolved={() => void submitGameSolved()} />
                </GlassCard>
              ) : path.do.kind === 'cards' && path.do.cards ? (
                <CardSortGame
                  data={path.do.cards}
                  mission={missionId}
                  storageKey={`${storeKey}:cards`}
                  onSubmit={submitDo}
                  onChangeMode={() => go('result')}
                  onLater={() => router.push('/home')}
                  onPassed={(res) => {
                    setDone({ mode: 'do', score: res.score })
                    if (isM1) finishM1()
                    else {
                      setConfettiTick((t) => t + 1)
                      go('done')
                    }
                  }}
                />
              ) : path.do.kind === 'counter' && counterData ? (
                <CounterGame
                  data={counterData}
                  onSubmit={submitDo}
                  onCheck={checkCounter}
                  onNewShift={newCounterShift}
                  studentId={studentId}
                  level={undefined}
                  onExit={exit.request}
                  onFinish={() => go('done')}
                />
              ) : path.do.kind === 'registrar' && registrarData ? (
                <RegistrarGame data={registrarData} card={registrarCard} onSubmit={submitDo} onStep={checkRegistrar} onFinish={() => go('done')} />
              ) : (
                <Card tone="spark" padding="sm">
                  <p className="flex items-center gap-2 text-label font-bold text-ink">
                    <AlertIcon width={20} height={20} aria-hidden className="text-spark-700" />
                    เกมนี้ยังไม่พร้อม ลองเรียนแบบดูหรืออ่านก่อนนะ
                  </p>
                </Card>
              )}
              {path.do.kind === 'game' && gameResend && !done ? (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => void submitGameSolved()}
                  leadingIcon={<RefreshIcon width={20} height={20} />}
                >
                  ส่งผลเกมอีกครั้ง
                </Button>
              ) : null}
              {!fullBleed && path.do.kind !== 'cards' && doResult && !doResult.passed ? (
                <Shake trigger={retryTick}>
                  <Card tone="spark" padding="sm" role="status">
                    <p className="flex items-center gap-2 text-label font-bold text-ink">
                      <AlertIcon width={20} height={20} aria-hidden className="text-spark-700" />
                      ยังไม่ครบ ลองอีกนิด ได้ {doResult.score} คะแนน ต้องเกิน {passScore}
                    </p>
                    <Button variant="ghost" size="sm" className="mt-1" onClick={() => go('result')}>
                      ลองเรียนวิธีอื่นดูไหม
                    </Button>
                  </Card>
                </Shake>
              ) : null}
              {!fullBleed && done ? (
                <Card tone="quest" padding="sm" role="status">
                  <p className="flex items-center gap-2 text-label font-bold text-ink">
                    <CheckIcon width={20} height={20} aria-hidden className="text-quest-700" />
                    ทำครบแล้ว ได้ {done.score} คะแนน
                  </p>
                </Card>
              ) : null}
            </section>
          ) : null}

          {step === 'done' && done ? (
            <LearnDoneScreen
              missionNo={missionId.replace(/\D/g, '') || missionId}
              modeLabel={MODE_LABEL[done.mode]}
              score={done.score}
              recap={LEARN_RECAP[missionId]}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </>
  )

  return (
    <>
      {isM1 ? (
        <M1Shell
          sign="ภารกิจที่ 1"
          pill={m1Pill[step]}
          onBack={m1Back}
          sound={sound.on}
          onSound={sound.toggle}
          stage={stage}
          stages={STAGES}
          scene={m1Scene}
          dock={footer}
        >
          {body}
        </M1Shell>
      ) : (
        <AppScreen
          theme={theme}
          title={missionTitle}
          // m3/m4 เต็มจอมีป้ายหัวเกม + ปุ่มย้อนกลับของตัวเองแล้ว ห้ามมีปุ่มซ้อนสองอัน
          onBack={step === 'done' || fullBleed ? undefined : exit.request}
          score={score}
          stage={stage}
          stageCount={stageLabels.length}
          menu={menu}
          dock={footer}
          flush={fullBleed}
        >
          {body}
        </AppScreen>
      )}
      {exit.dialog}
    </>
  )
}

function fmtTime(sec: number): string {
  const t = Math.max(0, Math.floor(sec || 0))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}
