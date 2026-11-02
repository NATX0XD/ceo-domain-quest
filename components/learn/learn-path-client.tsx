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
import { HelpPanel, ResultPanel, weakest } from './learn-path-result'
import { CardSortGame } from './card-sort-game'
import { LearnDoneScreen } from './learn-done'
import { AppScreen, GlassCard, type MenuItem } from './app/app-screen'
import { useExitConfirm } from '@/components/student-navigation'
import { ChatReader, QuickChip } from './app/chat-reader'
import { Confetti, Float, Shake, buzz } from './app/fx'
import { themeFor } from './app/theme'

/**
 * เส้นทางเรียนก่อนเข้าภารกิจ (ดู / อ่าน / ลงมือทำ) — สเปก docs/learn-path-spec.md
 *
 * ลำดับจอ: แนะนำเรื่อง > เลือกวิธีเรียน > เรียนตามวิธี > สรุป
 * ⚠️ ไม่มีเฉลยในไฟล์นี้ ทุกการตรวจส่งไป POST /api/mission/[id]/learn
 * ⚠️ วิธีเรียนเป็นข้อเสนอเท่านั้น ทุกวิธีกดได้เสมอ และเปลี่ยนวิธีได้ทุกเมื่อ
 * จบแล้ว router.refresh() ให้หน้าเซิร์ฟเวอร์เห็น learn-done แล้วแสดงจอภารกิจเดิม
 */

type Step = 'intro' | 'result' | 'watch' | 'read' | 'questions' | 'do' | 'done'

const STAGES = ['เลือกวิธี', 'เรียน', 'สรุป'] as const

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
}: LearnPathClientProps) {
  const router = useRouter()
  const singleMode = path.modes.length === 1 && path.modes[0] === 'do'

  // กลับมาเปิดหน้าใหม่ = ทำต่อจากจุดเดิมที่บันทึกไว้
  const [step, setStep] = useState<Step>(() =>
    singleMode ? (state.chosen === 'do' ? 'do' : 'intro') : (state.chosen ?? 'result'),
  )
  const [mode, setMode] = useState<LearnModeId | null>(state.chosen)
  const [picked, setPicked] = useState<LearnModeId | null>(state.chosen ?? recommendedMode ?? 'do')

  const [sceneIdx, setSceneIdx] = useState(0)
  const [autoPlay, setAutoPlay] = useState(true)
  const [chatShown, setChatShown] = useState(1)
  // คลิปจริง (watch.video) — กดดูภาพนิ่งแทนได้ เล่นไม่ได้ = สลับไปภาพนิ่งเอง
  const [videoEnded, setVideoEnded] = useState(false)
  const [preferStills, setPreferStills] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [answerResult, setAnswerResult] = useState<AnswerResponse | null>(null)
  const [doResult, setDoResult] = useState<DoResponse | null>(null)
  // มินิเกมเดิม (kind game) ตอบถูกครบแล้วแต่ส่งผลไม่สำเร็จ = มีปุ่มส่งซ้ำ ไม่ต้องเล่นใหม่
  const [gameResend, setGameResend] = useState(false)
  const [done, setDone] = useState<{ mode: LearnModeId; score: number } | null>(null)

  const [brief, setBrief] = useState(true)
  const [qIdx, setQIdx] = useState(0)
  const [qPhase, setQPhase] = useState<'ask' | 'result' | 'help' | 'supp'>('ask')
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
      if (saved && !state.done) {
        const savedMode = saved.mode === 'watch' || saved.mode === 'read' || saved.mode === 'do' ? saved.mode : null
        const steps: Step[] = ['intro', 'result', 'watch', 'read', 'questions', 'do']
        const savedStep = steps.find((x) => x === saved.step)
        const needsMode =
          savedStep === 'watch' || savedStep === 'read' || savedStep === 'questions' || savedStep === 'do'
        const usableSavedStep = singleMode
          ? savedStep === 'intro' || savedStep === 'do'
            ? savedStep
            : null
          : savedStep
        if (usableSavedStep && (!needsMode || savedMode)) {
          setStep(usableSavedStep)
          setMode(savedMode)
          if (typeof saved.brief === 'boolean') setBrief(saved.brief)
          if (typeof saved.qIdx === 'number') setQIdx(Math.max(0, Math.min(questions.length - 1, saved.qIdx)))
          if (typeof saved.sceneIdx === 'number') setSceneIdx(Math.max(0, Math.min(lastScene, saved.sceneIdx)))
          if (typeof saved.chatShown === 'number') setChatShown(Math.max(1, Math.min(chat.length, saved.chatShown)))
          if (saved.answers && typeof saved.answers === 'object') setAnswers(saved.answers as Record<string, string>)
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
          JSON.stringify({ step, mode, brief, qIdx, sceneIdx, chatShown, answers }),
        )
      }
    } catch {
      /* เก็บไม่ได้ก็ข้าม */
    }
  }, [ready, storeKey, step, mode, brief, qIdx, sceneIdx, chatShown, answers, done])

  useEffect(() => {
    if (step !== 'watch' || showVideo || !autoPlay || sceneIdx >= lastScene) return
    const ms = Math.max(4000, (scenes[sceneIdx]?.line.length ?? 0) * 110)
    const t = setTimeout(() => setSceneIdx((i) => Math.min(lastScene, i + 1)), ms)
    return () => clearTimeout(t)
  }, [step, showVideo, autoPlay, sceneIdx, lastScene, scenes])

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
    setQPhase('ask')
    setSuppTried(0)
    setHintShown(false)
    setReviewing(null)
    if (m === 'watch') {
      setSceneIdx(0)
      setAutoPlay(true)
      go('watch')
    } else if (m === 'read') {
      setChatShown(1)
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
      setDone({ mode: 'do', score: res.data.score })
      setConfettiTick((t) => t + 1)
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
        onClick={() => go('questions')}
        trailingIcon={<ChevronRightIcon width={22} height={22} />}
      >
        อ่านจบแล้ว ไปคุยกับโดม
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
          disabled={busy || !(cur && (answers[cur.id] ?? '').trim())}
          loading={busy}
          loadingLabel="กำลังตรวจคำตอบ"
          onClick={() => (lastQ ? submitAnswers() : setQIdx((i) => i + 1))}
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
        onClick={() => router.refresh()}
        trailingIcon={<ChevronRightIcon width={22} height={22} />}
      >
        ไปด่านหลัก
      </Button>
    )
  }
  /* --------------------------------------------------------------- เนื้อหา */

  const stage = singleMode ? 0 : stageOf(step)
  const stageLabels = singleMode ? (['เกม'] as const) : STAGES
  const canSwitch = !singleMode && (step === 'watch' || step === 'read' || step === 'questions' || step === 'do') && !done
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

  return (
    <>
      <AppScreen
      theme={theme}
      title={missionTitle}
      onBack={step === 'done' ? undefined : exit.request}
      score={score}
      stage={stage}
      stageCount={stageLabels.length}
      menu={menu}
      dock={footer}
      flush={fullBleed}
    >
      <Confetti fire={confettiTick} />
      {step === 'result' ? (
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

          {error ? (
            <Card tone="danger" padding="sm" role="alert">
              <p className="flex items-center gap-2 text-label font-bold text-danger-700">
                <AlertIcon width={20} height={20} aria-hidden />
                {error}
              </p>
            </Card>
          ) : null}

          {step === 'intro' || step === 'result' ? (
            <>
              {missionId === 'm1' ? <div className="m1-map-art" aria-hidden="true" /> : null}
              <div className={cn('relative z-10 flex flex-col items-center pt-2', step === 'result' && 'invisible')}>
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

          {(step === 'watch' || step === 'read') && brief ? (
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
              </GlassCard>
            </>
          ) : null}

          {step === 'watch' && !brief ? (
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
                  className="media-video aspect-video w-full rounded-[24px]"
                >
                  {path.watch.captions ? <track kind="captions" srcLang="th" label="คำบรรยายภาษาไทย (ฉบับร่าง)" src={path.watch.captions} default /> : null}
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
                reviewLabel={askMode === 'watch' ? 'ย้อนดูช่วงนี้' : 'ย้อนอ่านช่วงนี้'}
              />
            ) : answerResult ? (
              <Shake trigger={answerResult.passed ? 0 : retryTick}>
                <ResultPanel
                  result={answerResult}
                  passScore={passScore}
                  questions={questions}
                  extra={
                    !answerResult.passed && suppTried >= 1 ? (
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
                  onPassed={() => go('done')}
                />
              ) : path.do.kind === 'counter' && counterData ? (
                <CounterGame
                  data={counterData}
                  onSubmit={submitDo}
                  onCheck={checkCounter}
                  level={undefined}
                />
              ) : path.do.kind === 'registrar' && registrarData ? (
                <RegistrarGame data={registrarData} card={registrarCard} onSubmit={submitDo} onStep={checkRegistrar} />
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
      </AppScreen>
      {exit.dialog}
    </>
  )
}
