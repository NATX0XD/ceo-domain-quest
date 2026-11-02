'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertIcon, DomeAvatar, HomeIcon, LightbulbIcon, cn } from '@/components/ui'
import { AppScreen, GlassCard, type MenuItem } from '@/components/learn/app/app-screen'
import { ChatReader } from '@/components/learn/app/chat-reader'
import { GameButton, Stars } from '@/components/learn/game-ui'
import { ModePopup } from '@/components/learn/mode-popup'
import { postLearn, type LearnModeId } from '@/components/learn/learn-path-api'
import { themeFor } from '@/components/learn/app/theme'
import type { LearnPath, LearnState } from '@/components/server/learn-path'

type M2Step =
  | 'choose' | 'rules' | 'visual-clip' | 'visual-stop' | 'visual-review' | 'visual-explain' | 'visual-drag' | 'visual-post'
  | 'text-lesson' | 'text-answer' | 'text-summary'
  | 'sim-story' | 'sim-tutorial' | 'sim-stage' | 'sim-finale' | 'exit' | 'end'

type M2Result = {
  kind: 'stop' | 'drag' | 'text' | 'sim' | 'notebook' | 'exit'
  correct?: boolean
  passed?: boolean
  score?: number
  exitScore?: number
  grade?: 'A' | 'B' | 'C'
  stars?: number
  phase?: 'hint' | 'rewatch' | 'explain'
  hint?: string
  from?: number
  to?: number
  explanation?: string
  feedback?: string
  reveal?: string
  reason?: string
  source?: string
  wrong?: string[]
}

const STOP_CHOICES = [
  [{ id: 'tld', label: 'ส่วนขวาสุด TLD' }, { id: 'sld', label: 'ชื่อร้านตรงกลาง SLD' }, { id: 'subdomain', label: 'บริการย่อยซ้ายสุด' }],
  [{ id: 'ltr', label: 'ซ้ายไปขวา' }, { id: 'rtl', label: 'ขวาไปซ้าย' }, { id: 'middle', label: 'เริ่มตรงกลาง' }],
  [{ id: 'tld', label: 'เปลี่ยน TLD' }, { id: 'sld', label: 'เปลี่ยน SLD' }, { id: 'subdomain', label: 'เปลี่ยน Subdomain' }],
] as const

const EXIT_QUESTIONS = [
  { prompt: 'ส่วนที่อยู่ขวาสุดของชื่อเว็บเรียกว่าอะไร', choices: ['Subdomain', 'SLD', 'TLD', 'URL ทั้งชุด'] },
  { prompt: 'ชื่อโดเมนควรไล่ลำดับความสำคัญจากทางไหน', choices: ['ซ้ายไปขวา', 'ขวาไปซ้าย', 'ตรงกลางออกสองข้าง', 'อ่านทางไหนก็ได้'] },
  { prompt: 'ใน booking.kanombanyai.com ส่วนใดเป็นบริการย่อย', choices: ['.com', 'kanombanyai', 'booking', 'ทั้งชื่อ'] },
] as const

const VISUAL_SCHEDULE = [2, 4, 6]
const VISUAL_PIECES = [
  { id: 'booking', label: 'booking', color: 'bg-quest-500' },
  { id: 'kanombanyai', label: 'kanombanyai', color: 'bg-brand-500' },
  { id: '.com', label: '.com', color: 'bg-spark-500' },
]
const SIM_PIECES = ['parts', 'forcespeed', 'com']

function ChoiceList({ choices, picked, onPick, disabled = false }: { choices: readonly { id?: string; label?: string; text?: string }[]; picked: string | null; onPick: (value: string) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-2">
      {choices.map((choice, index) => {
        const value = choice.id ?? String(index)
        const label = choice.label ?? choice.text ?? value
        return (
          <button key={value} type="button" disabled={disabled} onClick={() => onPick(value)} className={cn('min-h-12 rounded-2xl border-2 px-4 text-left text-body font-extrabold transition-transform active:scale-[.98]', picked === value ? 'border-brand-600 bg-brand-100 text-brand-900' : 'border-[#caa66a] bg-[#fffaf0] text-[#3a2a18]', 'disabled:opacity-60')}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function M2Flow({ missionTitle, path, state, recommendedMode = null }: { missionTitle: string; path: LearnPath; state: LearnState; recommendedMode?: LearnModeId | null }) {
  const router = useRouter()
  const theme = themeFor('m2')
  const [mode, setMode] = useState<LearnModeId | null>(state.chosen)
  const [picked, setPicked] = useState<LearnModeId>(state.chosen ?? recommendedMode ?? 'do')
  const [step, setStep] = useState<M2Step>(state.chosen ? 'rules' : 'choose')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [stageScore, setStageScore] = useState(0)
  const [final, setFinal] = useState<M2Result | null>(null)

  const [visualScene, setVisualScene] = useState(0)
  const [visualStop, setVisualStop] = useState(0)
  const [visualAttempts, setVisualAttempts] = useState<Record<number, number>>({})
  const [visualChoice, setVisualChoice] = useState<string | null>(null)
  const [visualFeedback, setVisualFeedback] = useState<M2Result | null>(null)
  const [visualPlacements, setVisualPlacements] = useState<Record<string, string>>({})
  const [visualSelected, setVisualSelected] = useState<string | null>(null)
  const [visualPost, setVisualPost] = useState('')

  const [textLesson, setTextLesson] = useState(0)
  const [textShown, setTextShown] = useState(5)
  const [textAnswer, setTextAnswer] = useState('')
  const [textAttempts, setTextAttempts] = useState<Record<string, number>>({})
  const [textFeedback, setTextFeedback] = useState<M2Result | null>(null)
  const [textScores, setTextScores] = useState<number[]>([])
  const [notebookSaved, setNotebookSaved] = useState(false)
  const [domeOpen, setDomeOpen] = useState(false)

  const [simStage, setSimStage] = useState(0)
  const [simPicked, setSimPicked] = useState<Record<string, string>>({})
  const [simOrder, setSimOrder] = useState<string[]>([])
  const [simFeedback, setSimFeedback] = useState<string | null>(null)

  const [exitAnswers, setExitAnswers] = useState<(number | null)[]>([null, null, null])
  const [repair, setRepair] = useState(false)

  const currentTextQuestion = path.read.questions[textLesson] ?? path.read.questions[0]
  const textTarget = textLesson === 0 ? 5 : textLesson === 1 ? 10 : path.read.chat.length
  const currentScene = path.watch.scenes[Math.min(visualScene, path.watch.scenes.length - 1)]
  const textPath = useMemo(() => path.read.chat.slice(0, Math.min(textShown, textTarget)), [path.read.chat, textShown, textTarget])

  async function send(payload: unknown): Promise<M2Result | null> {
    setBusy(true)
    setError(null)
    const response = await postLearn<M2Result>('m2', { action: 'm2', payload })
    setBusy(false)
    if (!response.ok) {
      setError(response.message)
      return null
    }
    return response.data
  }

  async function chooseMode() {
    const response = await postLearn<{ ok: true }>('m2', { action: 'choose', mode: picked })
    if (!response.ok) return setError(response.message)
    setMode(picked)
    setStep('rules')
  }

  function beginMode() {
    if (mode === 'watch') setStep('visual-clip')
    else if (mode === 'read') setStep('text-lesson')
    else setStep('sim-story')
  }

  async function answerStop() {
    if (!visualChoice) return
    const attempt = (visualAttempts[visualStop] ?? 0) + 1
    const result = await send({ kind: 'stop', stop: visualStop, answer: visualChoice, attempt })
    if (!result) return
    setVisualAttempts((all) => ({ ...all, [visualStop]: attempt }))
    setVisualFeedback(result)
    if (result.correct) setStep('visual-explain')
    else if (result.phase === 'rewatch') setStep('visual-review')
    else if (result.phase === 'explain') setStep('visual-explain')
  }

  function continueVisualExplanation() {
    setVisualChoice(null)
    setVisualFeedback(null)
    if (visualStop < 2) {
      setVisualStop((n) => n + 1)
      setVisualScene(VISUAL_SCHEDULE[visualStop]! + 1)
      setStep('visual-clip')
    } else {
      setVisualScene(path.watch.scenes.length - 1)
      setStep('visual-clip')
    }
  }

  function nextVisualScene() {
    if (VISUAL_SCHEDULE.includes(visualScene)) {
      setStep('visual-stop')
      return
    }
    if (visualScene >= path.watch.scenes.length - 1) {
      setStep('visual-drag')
      return
    }
    setVisualScene((n) => n + 1)
  }

  async function checkVisualDrag() {
    const result = await send({ kind: 'visual-drag', placements: visualPlacements })
    if (!result) return
    setVisualFeedback(result)
    if (result.passed) {
      setStageScore(result.score ?? 0)
      setStep('visual-post')
    }
  }

  async function submitVisualPost() {
    const question = path.watch.questions[0]
    if (!question || !visualPost.trim()) return
    const result = await send({ kind: 'text', mode: 'watch', questionId: question.id, answer: visualPost, attempt: 1 })
    if (!result) return
    setVisualFeedback(result)
    setStageScore(Math.max(stageScore, result.correct ? 70 : 50))
    setStep('exit')
  }

  async function submitTextAnswer() {
    if (!currentTextQuestion || !textAnswer.trim()) return
    const attempt = (textAttempts[currentTextQuestion.id] ?? 0) + 1
    const result = await send({ kind: 'text', mode: 'read', questionId: currentTextQuestion.id, answer: textAnswer, attempt })
    if (!result) return
    setTextAttempts((all) => ({ ...all, [currentTextQuestion.id]: attempt }))
    setTextFeedback(result)
    if (result.correct || result.reveal) {
      setTextScores((scores) => [...scores, result.score ?? 0])
      setTextAnswer('')
      setTextFeedback(null)
      if (textLesson < 2) {
        setTextLesson((n) => n + 1)
        setTextShown(5)
        setStep('text-lesson')
      } else {
        const total = [...textScores, result.score ?? 0].reduce((sum, value) => sum + value, 0)
        setStageScore(Math.round((total / 3) * 0.7))
        setStep('text-summary')
      }
    }
  }

  async function saveNotebook() {
    const result = await send({ kind: 'notebook', text: 'TLD อยู่ขวาสุด · SLD อยู่ตรงกลาง · Subdomain อยู่ซ้ายสุด · อ่านจากขวาไปซ้าย' })
    if (result) setNotebookSaved(true)
  }

  async function checkSim() {
    const result = await send({ kind: 'sim', stage: simStage, placements: simPicked, order: simOrder })
    if (!result) return
    setSimFeedback(result.reason ?? (result.correct ? 'ถูกต้อง' : 'ลองใหม่อีกครั้ง'))
    if (result.correct) {
      if (simStage < 4) {
        setSimStage((n) => n + 1)
        setSimPicked({})
        setSimOrder([])
      } else {
        setStageScore(70)
        setStep('sim-finale')
      }
    } else {
      // A decoy or misplaced piece must be removable before the learner retries.
      setSimPicked({})
    }
  }

  async function submitExit() {
    if (exitAnswers.some((answer) => answer === null)) return
    const result = await send({ kind: 'exit', answers: exitAnswers as number[], stageScore, repair })
    if (!result) return
    setFinal(result)
    setScore(result.score ?? 0)
    setStep('end')
  }

  const menu: MenuItem[] = [
    { key: 'home', label: 'กลับหน้าหลัก', hint: 'ความคืบหน้าจะถูกบันทึกไว้', icon: <HomeIcon width={22} height={22} />, onSelect: () => router.push('/home') },
  ]
  const back = () => {
    if (step === 'choose') router.push('/map')
    else if (step === 'rules') setStep('choose')
    else if (step === 'text-answer') setStep('text-lesson')
    else if (step === 'exit') setStep(mode === 'watch' ? 'visual-post' : mode === 'read' ? 'text-summary' : 'sim-finale')
    else router.push('/map')
  }
  const footer = (() => {
    if (step === 'rules') return <GameButton onClick={beginMode}>เริ่มภารกิจ {mode === 'watch' ? 'Visual' : mode === 'read' ? 'Text' : 'Sim'} →</GameButton>
    if (step === 'visual-clip') return <GameButton onClick={nextVisualScene}>{visualScene >= path.watch.scenes.length - 1 ? 'ไปลากวางชิ้นส่วน' : VISUAL_SCHEDULE.includes(visualScene) ? 'หยุดตอบคำถาม' : 'ฉากถัดไป →'}</GameButton>
    if (step === 'visual-stop') return <GameButton disabled={busy || !visualChoice} onClick={() => void answerStop()}>{busy ? 'กำลังตรวจ' : 'ตอบคำถาม'}</GameButton>
    if (step === 'visual-review') return <GameButton onClick={() => setStep('visual-stop')}>กลับมาตอบข้อเดิม</GameButton>
    if (step === 'visual-explain') return <GameButton onClick={continueVisualExplanation}>เข้าใจแล้ว ไปต่อ →</GameButton>
    if (step === 'visual-drag') return <GameButton disabled={busy || Object.keys(visualPlacements).length < 3} onClick={() => void checkVisualDrag()}>{busy ? 'กำลังตรวจ' : 'ตรวจชิ้นส่วน'}</GameButton>
    if (step === 'visual-post') return <GameButton disabled={busy || !visualPost.trim()} onClick={() => void submitVisualPost()}>{busy ? 'กำลังตรวจ' : 'ส่งคำตอบหลังคลิป'}</GameButton>
    if (step === 'text-lesson') return textShown < textTarget ? <GameButton onClick={() => setTextShown((n) => Math.min(textTarget, n + 1))}>อ่านต่อ</GameButton> : <GameButton onClick={() => setStep('text-answer')}>ตอบคำถามบทที่ {textLesson + 1}</GameButton>
    if (step === 'text-answer') return <GameButton disabled={busy || !textAnswer.trim()} onClick={() => void submitTextAnswer()}>{busy ? 'โดมกำลังอ่าน' : 'ส่งคำตอบ'}</GameButton>
    if (step === 'text-summary') return <GameButton disabled={!notebookSaved} onClick={() => setStep('exit')}>{notebookSaved ? 'ไป Exit Check' : 'บันทึกสรุปก่อน'}</GameButton>
    if (step === 'sim-story') return <GameButton onClick={() => setStep('sim-tutorial')}>ฝ่าพายุไปต่อ</GameButton>
    if (step === 'sim-tutorial') return <GameButton onClick={() => setStep('sim-stage')}>เริ่ม Tutorial ลากชิ้นแรก</GameButton>
    if (step === 'sim-stage') return <GameButton disabled={busy} onClick={() => void checkSim()}>{busy ? 'กำลังตรวจ' : 'วางแล้ว ตรวจคำตอบ'}</GameButton>
    if (step === 'sim-finale') return <GameButton onClick={() => setStep('exit')}>ไป Exit Check →</GameButton>
    if (step === 'exit') return <GameButton disabled={busy || exitAnswers.some((answer) => answer === null)} onClick={() => void submitExit()}>{busy ? 'กำลังสรุปผล' : 'ส่ง Exit Check ครั้งเดียว'}</GameButton>
    if (step === 'end') return <GameButton onClick={() => (final?.passed ? router.push('/map') : (setRepair(true), setStageScore(0), setStep('rules'), setFinal(null), setExitAnswers([null, null, null]), setScore(0)))}>{final?.passed ? 'กลับแผนที่' : 'ซ่อมภารกิจ แล้วลองใหม่'}</GameButton>
    return null
  })()

  return (
    <AppScreen theme={theme} title={missionTitle} onBack={step === 'end' ? undefined : back} score={score} stage={step === 'end' ? 2 : step === 'exit' ? 1 : 0} stageCount={3} menu={menu} dock={footer}>
      {step === 'choose' ? (
        <ModePopup missionNo="2" title={missionTitle} recommended={recommendedMode ?? 'do'} reason={recommendedMode ? undefined : 'เลือกวิธีที่ถนัดได้เลย'} picked={picked} busy={busy} error={error} onPick={setPicked} onStart={() => void chooseMode()} onClose={() => router.push('/map')} presentation="drawer" />
      ) : null}
      {error ? <GlassCard className="mb-3 border-2 border-red-400"><p role="alert" className="flex items-center gap-2 text-body font-bold text-red-800"><AlertIcon width={20} height={20} />{error}</p></GlassCard> : null}

      {step === 'rules' ? <GlassCard><p className="text-label font-extrabold text-brand-700">กติกาภารกิจที่ 2 · {mode === 'watch' ? 'Visual ดูคลิป' : mode === 'read' ? 'Text แชท' : 'Sim ลากวาง'}</p><h2 className="mt-2 text-title font-extrabold text-[#3a2a18]">รู้จัก 3 ส่วนของชื่อเว็บ</h2><p className="mt-3 text-body-lg text-[#3a2a18]">TLD อยู่ขวาสุด · SLD อยู่ตรงกลาง · Subdomain อยู่ซ้ายสุด และระบบไล่ลำดับจากขวาไปซ้าย</p><div className="mt-4 rounded-2xl bg-[#fff3cf] p-4 text-body font-bold text-[#5c3c1b]">Exit Check มี 3 ข้อ ใช้ครั้งเดียว ไม่มีคำใบ้ และคิดเป็น 30% ของคะแนน</div></GlassCard> : null}

      {step === 'visual-clip' && currentScene ? <GlassCard><div className="flex items-center justify-between"><p className="text-label font-bold text-brand-700">Visual · คลิปสถานการณ์</p><span className="rounded-full bg-brand-100 px-3 py-1 text-label font-extrabold text-brand-700">{visualScene + 1}/{path.watch.scenes.length}</span></div><img src={currentScene.image ?? '/learn/m2/watch-s1.webp'} alt={currentScene.caption ?? currentScene.line} className="mt-3 aspect-video w-full rounded-2xl object-cover" /><p className="mt-3 text-body-lg font-bold text-[#3a2a18]">{currentScene.line}</p><div className="mt-4 flex gap-1" aria-label="timeline">{path.watch.scenes.map((_, i) => <span key={i} className={cn('h-2 flex-1 rounded-full', i <= visualScene ? 'bg-brand-600' : 'bg-[#e3c78e]', VISUAL_SCHEDULE.includes(i) && 'ring-2 ring-spark-400')} />)}</div></GlassCard> : null}

      {step === 'visual-stop' ? <GlassCard><p className="text-label font-extrabold text-spark-700">หยุดถาม {visualStop + 1}/3</p><h2 className="mt-2 text-title-sm font-extrabold text-[#3a2a18]">จากที่ดูมา คำตอบไหนถูก</h2><p className="mt-2 text-body text-[#3a2a18]">booking.kanombanyai.com</p><div className="mt-4"><ChoiceList choices={STOP_CHOICES[visualStop]!} picked={visualChoice} onPick={setVisualChoice} disabled={busy} /></div>{visualFeedback && !visualFeedback.correct ? <div className="mt-4 rounded-2xl bg-[#fff3cf] p-3 text-body text-[#5c3c1b]"><LightbulbIcon width={20} height={20} className="mr-1 inline text-reward-700" />{visualFeedback.hint ?? 'ลองอีกครั้งนะ'}</div> : null}</GlassCard> : null}

      {step === 'visual-review' ? <GlassCard><p className="text-label font-extrabold text-brand-700">โดมพาย้อนดูช่วงสำคัญ</p><div className="mt-3 grid gap-3">{path.watch.scenes.slice(Math.max(0, (visualFeedback?.from ?? 1) - 1), visualFeedback?.to ?? 1).map((scene) => <div key={scene.id} className="rounded-2xl bg-[#fff8e6] p-3"><img src={scene.image ?? '/learn/m2/watch-s1.webp'} alt="" className="aspect-video w-full rounded-xl object-cover" /><p className="mt-2 text-label font-bold text-[#3a2a18]">{scene.line}</p></div>)}</div><p className="mt-3 text-body font-bold text-[#3a2a18]">ดูซ้ำแล้วกลับมาตอบคำถามเดิมได้เลย</p></GlassCard> : null}

      {step === 'visual-explain' ? <GlassCard><div className="flex items-center gap-3"><DomeAvatar mood="explain" size={72} decorative /><div><p className="text-label font-extrabold text-brand-700">โดมอธิบาย</p><p className="mt-1 text-body-lg font-bold text-[#3a2a18]">{visualFeedback?.explanation}</p></div></div></GlassCard> : null}

      {step === 'visual-drag' ? <GlassCard><p className="text-label font-extrabold text-brand-700">หลังคำอธิบาย · ต่อ 3 ชิ้น</p><h2 className="mt-2 text-title-sm font-extrabold text-[#3a2a18]">ลากหรือแตะชิ้นส่วนลงช่องให้ถูก</h2><div className="mt-4 grid gap-2">{(['Subdomain', 'SLD', 'TLD'] as const).map((slot, i) => <button key={slot} type="button" onClick={() => visualSelected && (setVisualPlacements((all) => ({ ...all, [`slot${i + 1}`]: visualSelected })), setVisualSelected(null))} className="min-h-16 rounded-2xl border-2 border-dashed border-[#b48a48] bg-[#fff8e6] p-3 text-left"><span className="block text-label font-extrabold text-brand-700">{slot}</span><span className="text-body font-extrabold text-[#3a2a18]">{visualPlacements[`slot${i + 1}`] ?? 'แตะชิ้นส่วน แล้วแตะที่นี่'}</span></button>)}</div><div className="mt-4 flex flex-wrap gap-2">{VISUAL_PIECES.map((piece) => <button key={piece.id} type="button" draggable onDragStart={() => setVisualSelected(piece.id)} onClick={() => setVisualSelected(piece.id)} className={cn('min-h-12 rounded-xl px-3 text-body font-extrabold text-white shadow-[0_3px_0_rgba(0,0,0,.2)]', piece.color, visualSelected === piece.id && 'ring-4 ring-reward-300')}>{piece.label}</button>)}</div>{visualFeedback && !visualFeedback.passed ? <p className="mt-3 rounded-2xl bg-red-100 p-3 text-body font-bold text-red-800">{visualFeedback.feedback}</p> : null}</GlassCard> : null}

      {step === 'visual-post' ? <GlassCard><p className="text-label font-extrabold text-brand-700">คำถามท้ายคลิป</p><h2 className="mt-2 text-title-sm font-extrabold text-[#3a2a18]">{path.watch.questions[0]?.prompt}</h2><textarea value={visualPost} onChange={(e) => setVisualPost(e.target.value)} placeholder={path.watch.questions[0]?.placeholder} className="mt-4 min-h-28 w-full rounded-2xl border-2 border-[#caa66a] bg-[#fffaf0] p-3 text-body text-[#3a2a18]" />{visualFeedback?.feedback ? <p className="mt-3 rounded-2xl bg-[#fff3cf] p-3 text-body font-bold text-[#5c3c1b]">{visualFeedback.feedback}</p> : null}</GlassCard> : null}

      {step === 'text-lesson' ? <GlassCard><p className="text-label font-extrabold text-brand-700">Text · บทเรียน {textLesson + 1}/3</p><ChatReader chat={textPath} shown={textPath.length} onNext={() => setTextShown((n) => Math.min(textTarget, n + 1))} onAll={() => setTextShown(textTarget)} title="CEO Domain Quest" /><div className="mt-3 rounded-2xl bg-[#fff3cf] p-3 text-body font-bold text-[#5c3c1b]">อ่านให้จบ แล้วพิมพ์คำตอบด้วยภาษาของตัวเองได้เลย</div></GlassCard> : null}

      {step === 'text-answer' && currentTextQuestion ? <GlassCard><p className="text-label font-extrabold text-brand-700">ตอบแบบพิมพ์อิสระ · บทเรียน {textLesson + 1}/3</p><h2 className="mt-2 text-title-sm font-extrabold text-[#3a2a18]">{currentTextQuestion.prompt}</h2><textarea value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} placeholder={currentTextQuestion.placeholder} className="mt-4 min-h-32 w-full rounded-2xl border-2 border-[#caa66a] bg-[#fffaf0] p-3 text-body text-[#3a2a18]" />{textFeedback ? <div className={cn('mt-3 rounded-2xl p-3 text-body font-bold', textFeedback.correct ? 'bg-quest-100 text-quest-800' : 'bg-[#fff3cf] text-[#5c3c1b]')}><p>{textFeedback.feedback}</p>{textFeedback.hint ? <p className="mt-2">คำใบ้ระดับ {(textAttempts[currentTextQuestion.id] ?? 1)}/2: {textFeedback.hint}</p> : null}{textFeedback.reveal ? <p className="mt-2">เฉลยพร้อมเหตุผล: {textFeedback.reveal}</p> : null}{!textFeedback.correct && !textFeedback.reveal ? <button type="button" className="mt-2 font-extrabold underline" onClick={() => setDomeOpen(true)}>ถามโดม แล้วกลับมาตอบข้อนี้</button> : null}</div> : null}</GlassCard> : null}

      {step === 'text-summary' ? <GlassCard><div className="flex items-center gap-3"><DomeAvatar mood="celebrate" size={72} decorative /><div><p className="text-label font-extrabold text-brand-700">สรุปความรู้ · สมุดโน้ต</p><p className="mt-1 text-body-lg font-bold text-[#3a2a18]">TLD อยู่ขวาสุด · SLD อยู่ตรงกลาง · Subdomain อยู่ซ้ายสุด · อ่านจากขวาไปซ้าย</p></div></div><button type="button" disabled={notebookSaved} onClick={() => void saveNotebook()} className="mt-4 min-h-12 w-full rounded-2xl bg-brand-600 px-4 text-body font-extrabold text-white disabled:bg-quest-600">{notebookSaved ? 'บันทึกลงสมุดโน้ตแล้ว ✓' : 'บันทึกลงสมุดโน้ต'}</button></GlassCard> : null}

      {step === 'sim-story' ? <GlassCard><p className="text-label font-extrabold text-spark-700">Sim · พายุพัดป้ายกระจาย</p><h2 className="mt-2 text-title font-extrabold text-[#3a2a18]">ช่วยร้านขนมต่อชื่อเว็บกลับคืน</h2><img src="/learn/m2/bg-bakery-front.webp" alt="ร้านขนมในพายุ" className="mt-4 aspect-video w-full rounded-2xl object-cover" /><p className="mt-3 text-body-lg text-[#3a2a18]">ป้ายหลุดออกจากกัน เราจะค่อย ๆ ลากกลับให้ถูกช่อง</p></GlassCard> : null}

      {step === 'sim-tutorial' ? <GlassCard><p className="text-label font-extrabold text-brand-700">Tutorial · บังคับลากครั้งแรก</p><DomeAvatar mood="encourage" size={90} decorative /><p className="mt-2 text-body-lg font-bold text-[#3a2a18]">ลากป้าย parts ไปช่องแรก เพื่อเริ่มประกอบชื่อโดเมน</p><button type="button" onClick={() => { setSimStage(0); setStep('sim-stage') }} className="mt-4 min-h-12 w-full rounded-2xl border-2 border-dashed border-[#b48a48] bg-[#fff8e6] p-3 text-left text-body font-extrabold text-[#3a2a18]">ช่องแรก: {simPicked.slot1 ?? 'วาง parts ที่นี่'}</button><div className="mt-3 flex gap-2"><button type="button" onClick={() => setSimPicked({ slot1: 'parts' })} className="min-h-12 rounded-xl bg-quest-500 px-4 text-body font-extrabold text-white">ลาก parts</button></div></GlassCard> : null}

      {step === 'sim-stage' ? <GlassCard><p className="text-label font-extrabold text-brand-700">Sim · ด่าน {Math.min(simStage + 1, 5)}/5</p><h2 className="mt-2 text-title-sm font-extrabold text-[#3a2a18]">{simStage === 0 ? 'ตรวจป้ายแรก' : simStage === 1 ? 'ประกอบ 3 ชิ้นตามลำดับ' : simStage === 2 ? 'ติดชื่อ Subdomain / SLD / TLD' : simStage === 3 ? 'อ่านจากขวาไปซ้าย' : 'ต่อ .co.th และแยกชิ้นหลอก'}</h2>{simStage <= 2 ? <div className="mt-4 grid gap-2">{(simStage === 0 ? ['slot1'] : ['slot1', 'slot2', 'slot3']).map((slot, i) => <button key={slot} type="button" onClick={() => { const values = simStage === 2 ? ['Subdomain', 'SLD', 'TLD'] : SIM_PIECES; const value = values[i]; if (value) setSimPicked((all) => ({ ...all, [slot]: value })) }} className="min-h-14 rounded-2xl border-2 border-dashed border-[#b48a48] bg-[#fff8e6] p-3 text-left text-body font-extrabold text-[#3a2a18]">{slot}: {simPicked[slot] ?? 'แตะเพื่อวางชิ้นส่วน'}</button>)}</div> : simStage === 3 ? <div className="mt-4 grid gap-2"><p className="rounded-2xl bg-spark-100 p-3 text-center text-body-lg font-extrabold text-[#5c3c1b]">← อ่านจากขวาไปซ้าย</p><div className="flex flex-wrap gap-2">{SIM_PIECES.map((piece) => <button key={piece} type="button" onClick={() => setSimOrder((all) => all.includes(piece) ? all : [...all, piece])} className="min-h-12 rounded-xl bg-brand-500 px-3 text-body font-extrabold text-white">{piece}</button>)}</div><p className="rounded-xl bg-[#fff8e6] p-3 text-body font-bold text-[#3a2a18]">ลำดับ: {simOrder.join(' → ') || 'ยังไม่ได้เลือก'}</p></div> : <div className="mt-4 grid grid-cols-2 gap-2">{['kanombanyai', 'co', 'th', 'booking', 'www', '.com'].map((piece) => <button key={piece} type="button" onClick={() => setSimPicked((all) => ({ ...all, [`slot${Math.min(4, Object.keys(all).length + 1)}`]: piece }))} className="min-h-12 rounded-xl bg-brand-500 px-3 text-body font-extrabold text-white">{piece}</button>)}</div>}{simFeedback ? <p className={cn('mt-3 rounded-2xl p-3 text-body font-bold', simFeedback.includes('ถูก') ? 'bg-quest-100 text-quest-800' : 'bg-[#fff3cf] text-[#5c3c1b]')}>{simFeedback}</p> : null}</GlassCard> : null}

      {step === 'sim-finale' ? <GlassCard><p className="text-label font-extrabold text-brand-700">จบ Sim · ลูกศรความสำคัญ</p><p className="mt-2 text-title-sm font-extrabold text-[#3a2a18]">.com → kanombanyai → booking</p><p className="mt-3 rounded-2xl bg-spark-100 p-4 text-center text-title font-extrabold text-[#5c3c1b]">← อ่านจากขวาไปซ้าย</p><p className="mt-3 text-body text-[#3a2a18]">ผ่านครบทั้ง 4 ด่านแล้ว ไปทำ Exit Check ชุดเดียวกับทุกโหมด</p></GlassCard> : null}

      {step === 'exit' ? <GlassCard><p className="text-label font-extrabold text-brand-700">Exit Check · 3 ข้อ · ครั้งเดียว · ไม่มีคำใบ้</p><p className="mt-2 text-body font-bold text-[#3a2a18]">ส่วนนี้คิด 30% ของคะแนนทั้งหมด</p><div className="mt-4 grid gap-4">{EXIT_QUESTIONS.map((question, qi) => <div key={question.prompt}><p className="mb-2 text-body font-extrabold text-[#3a2a18]">{qi + 1}. {question.prompt}</p><ChoiceList choices={question.choices.map((text) => ({ text }))} picked={exitAnswers[qi] === null ? null : String(exitAnswers[qi])} onPick={(value) => setExitAnswers((all) => all.map((old, i) => i === qi ? Number(value) : old))} /></div>)}</div></GlassCard> : null}

      {step === 'end' && final ? <GlassCard><div className="text-center"><DomeAvatar mood={final.grade === 'C' ? 'encourage' : 'celebrate'} size={110} decorative /><p className="text-label font-extrabold text-brand-700">สรุปผลภารกิจที่ 2</p><h2 className="mt-2 text-title font-extrabold text-[#3a2a18]">ได้เกรด {final.grade} · {final.score ?? 0}/100</h2><p className="mt-2 text-body text-[#3a2a18]">Exit Check {final.exitScore ?? 0}/30 · คะแนนระหว่างเรียน {Math.max(0, (final.score ?? 0) - (final.exitScore ?? 0))}/70</p><div className="mt-4"><Stars count={final.stars ?? 0} /></div>{final.grade === 'C' ? <p className="mt-4 rounded-2xl bg-[#fff3cf] p-4 text-body font-bold text-[#5c3c1b]">ยังไม่ปลดล็อกเกาะ 3 ลองซ่อมบทเรียน แล้วทำ Exit Check ใหม่อีกครั้งนะ</p> : <p className="mt-4 rounded-2xl bg-quest-100 p-4 text-body font-bold text-quest-800">ผ่านแล้ว ปลดล็อกเกาะ 3 ให้ไปต่อได้เลย</p>}</div></GlassCard> : null}

      {domeOpen ? <div className="fixed inset-0 z-[80] grid place-items-center bg-[#21150f]/40 p-4"><GlassCard className="max-w-md"><div className="flex items-start gap-3"><DomeAvatar mood="explain" size={64} decorative /><p className="text-body font-bold text-[#3a2a18]">ลองย้อนดูว่าชื่อเว็บแบ่งเป็น 3 ส่วนอย่างไร แล้วตอบด้วยคำของตัวเองได้เลยครับ</p></div><button type="button" onClick={() => setDomeOpen(false)} className="mt-4 min-h-12 w-full rounded-2xl bg-brand-600 text-body font-extrabold text-white">กลับไปตอบข้อเดิม</button></GlassCard></div> : null}
    </AppScreen>
  )
}
