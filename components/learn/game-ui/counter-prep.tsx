'use client'

/**
 * ภารกิจที่ 3 ช่วงก่อนเข้ากะ (S01–S08) และลูกค้าคนสุดท้ายคือตัวเอง (S17)
 * ใช้โครงจอแบบสตอรีบอร์ดภารกิจที่ 2 จาก counter-shell.tsx
 * เนื้อหาความรู้ตึก 3 ชั้นเป็นความรู้ทั่วไปตามสเปก ไม่ใช่เฉลยของลูกค้าที่ตรวจคะแนน
 */

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/components/ui'
import { useGameMotion } from './index'
import type { CounterData } from '../counter-types'
import { Building, Cta, DomeSay, FLOORS, M3Stage, M3_ASSET, Panel, sfx, useDragDrop } from './counter-shell'
import { PxImg } from './pixel-counter'

type Screen = 'start' | 'tutorial' | 'choose' | 'video' | 'chat' | 'sort'
type PrepMode = 'video' | 'chat' | 'sort'

const SEEN_KEY = 'm3-tutorial-seen'

export function CounterOnboarding({
  data,
  onReady,
  onExit,
}: {
  data: CounterData
  onReady: () => void
  onExit?: () => void
}) {
  const [screen, setScreen] = useState<Screen>('start')
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    setSeen(window.localStorage.getItem(SEEN_KEY) === '1')
  }, [])

  function finishTutorial() {
    window.localStorage.setItem(SEEN_KEY, '1')
    setSeen(true)
    setScreen('choose')
  }

  const toChoose = () => setScreen('choose')

  if (screen === 'tutorial') return <Tutorial onDone={finishTutorial} onExit={onExit} />
  if (screen === 'choose') return <PrepChoose onPick={(m) => setScreen(m)} onBack={() => setScreen('start')} />
  if (screen === 'video') return <PrepVideo onBack={toChoose} onDone={onReady} />
  if (screen === 'chat') return <PrepChat onBack={toChoose} onDone={onReady} />
  if (screen === 'sort') return <PrepSort onBack={toChoose} onDone={onReady} />
  return (
    <MissionBrief
      cases={data.cases.length}
      maxQuestions={data.maxQuestions}
      seen={seen}
      onExit={onExit}
      onStart={() => setScreen(seen ? 'choose' : 'tutorial')}
      onTutorial={() => setScreen('tutorial')}
    />
  )
}

/* ---------- S01 กติกาแบบอินโฟกราฟิก ---------- */

function MissionBrief({
  cases,
  maxQuestions,
  seen,
  onStart,
  onTutorial,
  onExit,
}: {
  cases: number
  maxQuestions: number
  seen: boolean
  onStart: () => void
  onTutorial: () => void
  onExit?: () => void
}) {
  const steps = [
    { icon: 'memo', label: 'อ่านใบคำขอ', sub: 'ติดป้ายประเภท' },
    { icon: 'speech-balloon', label: 'ถามลูกค้า', sub: `ไม่เกิน ${maxQuestions} ข้อ` },
    { icon: 'check-mark-button', label: 'ประทับตรา', sub: 'พร้อมเหตุผล' },
  ]
  return (
    <M3Stage
      pill="เคาน์เตอร์รับจดโดเมน"
      onBack={onExit}
      label="เริ่มภารกิจที่ 3"
      dock={
        <Cta onClick={onStart}>
          {seen ? 'เริ่มภารกิจ' : 'เริ่มกะแรก'} <span aria-hidden>→</span>
        </Cta>
      }
    >
      <Panel className="m3s-brief" kicker="กติกา · เจ้าหน้าที่รับจดโดเมน" title="เลือกนามสกุลให้ถูกประเภท">
        <p className="m3s-lead">ลูกค้า {cases} คนมาขอจดชื่อเว็บ ถามให้รู้ว่าเขาเป็นใคร แล้วตัดสินว่าจดนามสกุลนั้นได้ไหม</p>
        <Building className="m3s-building--brief" showTags />
        <ol className="m3s-steps" aria-label="ขั้นตอนต่อลูกค้า 1 คน">
          {steps.map((s, i) => (
            <li key={s.label}>
              {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3 มิติ */}
              <img src={M3_ASSET.icon(s.icon)} alt="" draggable={false} />
              <b>
                {i + 1}. {s.label}
              </b>
              <span>{s.sub}</span>
            </li>
          ))}
        </ol>
        <div className="m3s-meta">
          <span>
            {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน */}
            <img src={M3_ASSET.icon('stopwatch')} alt="" /> ประมาณ 6 นาที
          </span>
          <span>
            {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน */}
            <img src={M3_ASSET.icon('star')} alt="" /> ถูกครั้งแรก 2 แต้ม
          </span>
          <span>
            {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน */}
            <img src={M3_ASSET.icon('books')} alt="" /> เปิดคู่มือได้
          </span>
        </div>
        <DomeSay>พร้อมรับลูกค้าคนแรกหรือยังครับ จำไว้ว่า ถามว่าเขาเป็นใคร ไม่ใช่ถามว่าชอบอันไหน</DomeSay>
        {seen ? (
          <button type="button" className="m3s-link" onClick={onTutorial}>
            ดูบทฝึกป้าส้มอีกครั้ง
          </button>
        ) : null}
      </Panel>
    </M3Stage>
  )
}

/* ---------- S02–S04 Tutorial ป้าส้ม (ไฮไลต์ทีละจุด) ---------- */

function Tutorial({ onDone, onExit }: { onDone: () => void; onExit?: () => void }) {
  const { reduce, spring } = useGameMotion()
  const [step, setStep] = useState(0)
  const [asked, setAsked] = useState(false)
  const [book, setBook] = useState<'closed' | 'open' | 'read'>('closed')
  const [stamp, setStamp] = useState<string | null>(null)
  const [ext, setExt] = useState<string | null>(null)
  const [inked, setInked] = useState(false)

  const coach = [
    'ยินดีต้อนรับเจ้าหน้าที่ใหม่ ลูกค้าคนแรกมาแล้ว แตะใบคำขอเพื่ออ่านก่อนนะ',
    asked ? 'ฟังคำตอบดี ๆ นี่คือข้อมูลที่ใช้ตัดสิน ป้าส้มยังไม่มีบริษัท' : 'อย่าเพิ่งตัดสิน ลองแตะคำถามเพื่อถามว่าเขาเป็นใคร',
    book === 'closed'
      ? 'ลืมเงื่อนไข เปิดคู่มือได้เสมอ แตะปุ่มคู่มือดูสิ'
      : '.co.th อยู่ชั้น 2 ต้องเป็นบริษัท มีเครื่องหมายการค้า หรือจด VAT',
    inked
      ? 'เยี่ยม ป้าส้มได้ชื่อเว็บแล้ว จำไว้ 3 ขั้น ฟัง ถาม ตัดสิน'
      : stamp !== 'suggest'
        ? 'เงื่อนไขไม่ตรง แต่ป้ายังจดอย่างอื่นได้ เลือกตรา เสนอนามสกุลใหม่'
        : 'บัตรประชาชนจด .in.th ได้ เลือก .in.th แล้วกดประทับ',
  ]
  // ขั้นใหม่ = เลื่อนจุดที่ไฮไลต์ (หรือคำพูดโดม) เข้ามาในจอเสมอ
  useEffect(() => {
    const id = window.setTimeout(() => {
      const el = document.querySelector('.m3s-tut .m3s-spot') ?? document.querySelector('.m3s-tut .m3s-dome')
      el?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
    }, 120)
    return () => window.clearTimeout(id)
  }, [step, asked, book, stamp, ext, inked, reduce])
  const ctaReady = step === 0 ? false : step === 1 ? asked : step === 2 ? book === 'read' : inked

  return (
    <M3Stage
      pill={`บทฝึก ${step + 1}/4 · ป้าส้มร้านส้มตำ`}
      onBack={onExit}
      label="บทฝึกเจ้าหน้าที่ใหม่"
      dock={
        <div className="m3s-row">
          <Cta tone="cream" className="m3s-cta--narrow" onClick={onDone}>
            ข้าม
          </Cta>
          <Cta
            disabled={!ctaReady}
            onClick={() => (step === 3 ? onDone() : setStep((s) => s + 1))}
          >
            {step === 3 ? 'เตรียมตัวเข้ากะ →' : ctaReady ? 'ทำต่อ →' : 'ทำตามที่โดมบอก'}
          </Cta>
        </div>
      }
    >
      <div className="m3s-tut" data-step={step}>
        <div className="m3s-dots" aria-label={`ขั้นที่ ${step + 1} จาก 4`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn(i < step && 'is-done', i === step && 'is-on')} />
          ))}
        </div>
        <Panel className="m3s-tut-card">
          <div className="m3s-who">
            <span className="m3s-avatar" aria-hidden>
              <PxImg srcs={['/learn/pixel/c6-neutral.webp']} />
              <b>ส</b>
            </span>
            <div>
              <b>ป้าส้ม · ร้านส้มตำ</b>
              <small>ลูกค้าตัวอย่าง ไม่นับคะแนน</small>
            </div>
          </div>

          <button
            type="button"
            className={cn('m3s-slip', step === 0 && 'm3s-spot')}
            onClick={() => {
              if (step !== 0) return
              sfx('ok')
              setStep(1)
            }}
            aria-label="ใบคำขอ somtam.co.th"
          >
            <small>ใบคำขอจดโดเมน</small>
            <strong>somtam.co.th</strong>
            <span>ขายส้มตำหน้าบ้าน อยากมีเว็บให้ลูกค้าสั่ง</span>
            <AnimatePresence>
              {inked ? (
                <motion.em
                  className="m3s-ink m3s-ink--suggest"
                  initial={reduce ? false : { scale: 2.4, opacity: 0, rotate: -24 }}
                  animate={{ scale: 1, opacity: 0.94, rotate: -8 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                >
                  เสนอ .in.th
                </motion.em>
              ) : null}
            </AnimatePresence>
          </button>

          {step >= 1 ? (
            <div className="m3s-chat m3s-chat--mini">
              <button
                type="button"
                className={cn('m3s-qchip', step === 1 && !asked && 'm3s-spot')}
                disabled={asked || step !== 1}
                onClick={() => {
                  sfx('tap')
                  setAsked(true)
                }}
              >
                จดทะเบียนบริษัทหรือยังคะ
              </button>
              {asked ? (
                <motion.p className="m3s-say m3s-say--them" initial={reduce ? false : { x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={spring}>
                  ยังจ้า ขายหน้าบ้าน มีแค่บัตรประชาชน
                </motion.p>
              ) : null}
            </div>
          ) : null}

          {step >= 2 ? (
            <div className="m3s-tut-book">
              <button
                type="button"
                className={cn('m3s-tool', step === 2 && book === 'closed' && 'm3s-spot')}
                onClick={() => {
                  sfx('tap')
                  setBook('open')
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน */}
                <img src={M3_ASSET.icon('books')} alt="" /> คู่มือเจ้าหน้าที่
              </button>
              {book !== 'closed' ? (
                <div className="m3s-mini-book tone-teal">
                  <b>ชั้น 2 · นามสกุลไทย</b>
                  <p>.co.th ต้องมีหนังสือรับรองบริษัท เครื่องหมายการค้า หรือ VAT</p>
                  <p>.in.th ใช้บัตรประชาชนจดได้</p>
                  {book === 'open' ? (
                    <button type="button" className={cn('m3s-chip-btn', 'm3s-spot')} onClick={() => setBook('read')}>
                      ปิดคู่มือ
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {step >= 3 ? (
            <div className="m3s-tut-stamps">
              <div className="m3s-stamp-row">
                {[
                  { id: 'approve', label: 'อนุมัติ' },
                  { id: 'suggest', label: 'เสนอนามสกุลใหม่' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={cn('m3s-stamp', `m3s-stamp--${s.id}`, stamp === s.id && 'is-on', s.id === 'suggest' && !stamp && 'm3s-spot')}
                    disabled={inked}
                    onClick={() => {
                      if (s.id === 'approve') {
                        sfx('bad')
                        setStamp('approve')
                        return
                      }
                      sfx('tap')
                      setStamp('suggest')
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {stamp === 'approve' ? <p className="m3s-note m3s-note--warn">ป้าส้มยังไม่มีบริษัท อนุมัติ .co.th ไม่ได้นะ ลองตราอีกอัน</p> : null}
              {stamp === 'suggest' ? (
                <div className="m3s-ext-row">
                  {['.in.th', '.go.th'].map((x) => (
                    <button
                      key={x}
                      type="button"
                      className={cn('m3s-ext', ext === x && 'is-on', x === '.in.th' && !ext && 'm3s-spot')}
                      disabled={inked}
                      onClick={() => {
                        setExt(x)
                        if (x === '.in.th') {
                          sfx('stamp')
                          window.setTimeout(() => {
                            sfx('win')
                            setInked(true)
                          }, reduce ? 0 : 260)
                        } else sfx('bad')
                      }}
                    >
                      {x}
                    </button>
                  ))}
                </div>
              ) : null}
              {ext === '.go.th' && !inked ? <p className="m3s-note m3s-note--warn">.go.th สงวนไว้ให้ราชการ ร้านค้าจดไม่ได้</p> : null}
            </div>
          ) : null}
        </Panel>
        <DomeSay live>{coach[step]}</DomeSay>
      </div>
    </M3Stage>
  )
}

/* ---------- S05 เลือกช่องทางเตรียมตัว ---------- */

function PrepChoose({ onPick, onBack }: { onPick: (m: PrepMode) => void; onBack: () => void }) {
  const [pick, setPick] = useState<PrepMode>('chat')
  const options: { id: PrepMode; icon: string; title: string; meta: string; copy: string }[] = [
    { id: 'video', icon: 'television', title: 'ดูคลิป', meta: 'Visual · 1 นาที', copy: 'โดมพาทัวร์ตึกโดเมน 3 ชั้น แล้วตอบ 3 ข้อ' },
    { id: 'chat', icon: 'speech-balloon', title: 'แชตกับโดม', meta: 'Text · 4 ข้อ', copy: 'ถามตอบทีละข้อ ตอบผิดโดมช่วยถามนำ' },
    { id: 'sort', icon: 'package', title: 'ลากวางจัดตึก', meta: 'Sim · 10 ป้าย', copy: 'ลากป้ายนามสกุลเข้าชั้นที่ถูกด้วยตัวเอง' },
  ]
  return (
    <M3Stage
      pill="เตรียมตัวก่อนเข้ากะ"
      onBack={onBack}
      label="เลือกวิธีเตรียมตัว"
      dock={<Cta onClick={() => onPick(pick)}>เริ่มเตรียมตัวแบบ{options.find((o) => o.id === pick)?.title} →</Cta>}
    >
      <Panel kicker="ก่อนเข้ากะ · เลือก 1 วิธี" title="ทบทวนตึกโดเมน 3 ชั้น">
        <p className="m3s-lead">ทุกวิธีพาไปรู้เรื่องเดียวกัน เลือกวิธีที่ถนัด</p>
        <div className="m3s-choices" role="radiogroup" aria-label="วิธีเตรียมตัว">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={pick === o.id}
              className={cn('m3s-choice', pick === o.id && 'is-on')}
              onClick={() => {
                sfx('tap')
                setPick(o.id)
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3 มิติ */}
              <img src={M3_ASSET.icon(o.icon)} alt="" draggable={false} />
              <span className="m3s-choice-text">
                <b>{o.title}</b>
                <small>{o.copy}</small>
              </span>
              <span className={cn('m3s-tagpill', o.id === 'chat' && 'is-rec')}>{o.id === 'chat' ? 'แนะนำสำหรับคุณ' : o.meta}</span>
            </button>
          ))}
        </div>
      </Panel>
      <DomeSay>เลือกได้ตามสไตล์เลยครับ จบแล้วเข้าเคาน์เตอร์เหมือนกัน</DomeSay>
    </M3Stage>
  )
}

/* ---------- S06 คลิปโดมพาทัวร์ + ถาม 3 ข้อ ---------- */

const SCENES = [
  { focus: null, line: 'วันนี้เราจะเป็นเจ้าหน้าที่รับจดโดเมน ก่อนเข้ากะ มาทัวร์ตึกกัน' },
  { focus: 1, line: 'ชั้นหนึ่ง นามสกุลสากล ใครก็จดได้ ไม่ต้องมีเอกสาร .org ก็เหมือนกันนะ' },
  { focus: 2, line: 'ชั้นสอง นามสกุลไทย .co.th ต้องเป็นบริษัท .in.th ใช้บัตรประชาชน ส่วน .ไทย ต้องมีชื่อ .th ก่อน' },
  { focus: 3, line: 'ชั้นสามสงวนไว้ให้โรงเรียน ราชการ มูลนิธิ ร้านค้าเข้าไม่ได้นะ' },
  { focus: null, line: 'จำไว้ ถามว่าเขาเป็นใคร ไม่ใช่ถามว่าชอบอันไหน' },
] as const

const VIDEO_QS = [
  { q: 'ร้านขายของที่บ้าน ยังไม่จดบริษัท จด .co.th ได้ไหม', choices: ['ได้ ใครก็จดได้', 'ไม่ได้ ต้องมีบริษัท เครื่องหมายการค้า หรือ VAT', 'ได้ถ้าจ่ายเพิ่ม'], ok: 1, scene: 2 },
  { q: '.go.th อยู่ชั้นไหน', choices: ['ชั้น 1 นามสกุลสากล', 'ชั้น 2 นามสกุลไทย', 'ชั้น 3 หมวดสงวน ของราชการ'], ok: 2, scene: 3 },
  { q: 'อยากได้ .ไทย ต้องมีอะไรก่อน', choices: ['ชื่อโดเมน .th อยู่แล้ว', 'บัตรนักเรียน', 'ไม่ต้องมีอะไร'], ok: 0, scene: 2 },
] as const

function PrepVideo({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { reduce } = useGameMotion()
  const [scene, setScene] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [phase, setPhase] = useState<'clip' | 'quiz'>('clip')
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [replay, setReplay] = useState<number | null>(null)

  useEffect(() => {
    if (phase !== 'clip' || !playing) return
    const id = window.setTimeout(() => {
      if (replay != null) {
        setReplay(null)
        setPhase('quiz')
        return
      }
      if (scene >= SCENES.length - 1) {
        setPlaying(false)
        return
      }
      setScene((s) => s + 1)
    }, reduce ? 2600 : 4200)
    return () => window.clearTimeout(id)
  }, [scene, playing, phase, replay, reduce])

  const q = VIDEO_QS[qi]
  const right = picked != null && picked === q?.ok
  const clipDone = !playing && scene === SCENES.length - 1

  if (phase === 'clip') {
    const s = SCENES[scene]!
    return (
      <M3Stage
        pill={replay != null ? 'ดูฉากซ้ำ' : `คลิปโดม · ฉาก ${scene + 1}/${SCENES.length}`}
        onBack={onBack}
        label="คลิปโดมพาทัวร์ตึกโดเมน"
        dock={
          <div className="m3s-row">
            <Cta tone="cream" className="m3s-cta--narrow" onClick={() => setPlaying((p) => !p)} ariaLabel={playing ? 'หยุดคลิป' : 'เล่นคลิป'}>
              {playing ? 'หยุด' : 'เล่น'}
            </Cta>
            <Cta
              onClick={() => {
                if (replay != null) {
                  setReplay(null)
                  setPhase('quiz')
                } else if (scene < SCENES.length - 1) setScene((n) => n + 1)
                else setPhase('quiz')
              }}
            >
              {replay != null ? 'กลับไปตอบ →' : clipDone ? 'ตอบคำถามโดม →' : 'ฉากถัดไป →'}
            </Cta>
          </div>
        }
      >
        <Panel className="m3s-video" kicker="ดูคลิป · โดมพาทัวร์ตึกโดเมน">
          <div className="m3s-screen">
            <Building focus={s.focus as 1 | 2 | 3 | null} showTags lit={scene === SCENES.length - 1} />
            {/* eslint-disable-next-line @next/next/no-img-element -- โดมในคลิป */}
            <img className="m3s-screen-dome" src={M3_ASSET.dome} alt="" draggable={false} />
            <div className="m3s-progress" aria-hidden>
              {SCENES.map((_, i) => (
                <span key={i} className={cn(i < scene && 'is-done', i === scene && (playing ? 'is-play' : 'is-on'))} />
              ))}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={scene} initial={reduce ? false : { y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }}>
              <DomeSay live>{s.line}</DomeSay>
            </motion.div>
          </AnimatePresence>
        </Panel>
      </M3Stage>
    )
  }

  return (
    <M3Stage
      pill={`โดมถามหลังคลิป ${qi + 1}/${VIDEO_QS.length}`}
      onBack={onBack}
      label="คำถามหลังคลิป"
      dock={
        right ? (
          <Cta
            onClick={() => {
              if (qi >= VIDEO_QS.length - 1) onDone()
              else {
                setQi((i) => i + 1)
                setPicked(null)
              }
            }}
          >
            {qi >= VIDEO_QS.length - 1 ? 'เข้ากะเลย →' : 'ข้อต่อไป →'}
          </Cta>
        ) : picked != null ? (
          <Cta
            tone="orange"
            onClick={() => {
              setReplay(q!.scene)
              setScene(q!.scene)
              setPlaying(true)
              setPicked(null)
              setPhase('clip')
            }}
          >
            ดูฉากนั้นซ้ำ
          </Cta>
        ) : (
          <Cta disabled>เลือกคำตอบ 1 ข้อ</Cta>
        )
      }
    >
      <Panel kicker={`ข้อ ${qi + 1} จาก ${VIDEO_QS.length}`} title={q!.q}>
        <div className="m3s-options">
          {q!.choices.map((c, i) => (
            <button
              key={c}
              type="button"
              className={cn('m3s-option', picked === i && (i === q!.ok ? 'is-right' : 'is-wrong'))}
              disabled={right}
              onClick={() => {
                setPicked(i)
                sfx(i === q!.ok ? 'ok' : 'bad')
              }}
            >
              <span className="m3s-option-letter">{'กขค'[i]}</span>
              {c}
            </button>
          ))}
        </div>
      </Panel>
      <DomeSay live>
        {picked == null
          ? 'ตอบจากที่เห็นในคลิปนะครับ'
          : right
            ? 'ถูกต้อง เก่งมาก'
            : 'ยังไม่ใช่ ลองกลับไปดูฉากนั้นอีกทีนะ'}
      </DomeSay>
    </M3Stage>
  )
}

/* ---------- S07 แชตกับโดม ---------- */

const CHAT = [
  { ask: 'ก่อนเข้ากะ ขอทดสอบหน่อย ลูกค้าบอกว่าอยากได้ .com ต้องขอเอกสารอะไรไหม', choices: ['ไม่ต้อง', 'ต้องมีบริษัท', 'ต้องเป็นราชการ'], ok: 0, nudge: 'ลองนึกถึงชั้น 1 ดูนะ ใครก็จดได้หรือเปล่า', praise: 'ถูก .com อยู่ชั้น 1 นามสกุลสากล ใครก็จดได้' },
  { ask: 'ร้านเล็ก ๆ ขายที่บ้าน อยากได้นามสกุลไทย ควรแนะนำอะไร', choices: ['.co.th', '.in.th', '.ac.th'], ok: 1, nudge: 'ร้านนี้มีแค่บัตรประชาชน ชั้น 2 ตัวไหนใช้บัตรประชาชนได้', praise: 'ใช่เลย .in.th ใช้บัตรประชาชนก็จดได้' },
  { ask: 'แล้ว .co.th ต้องมีอะไร', choices: ['บัตรนักเรียน', 'เป็นบริษัท เครื่องหมายการค้า หรือจด VAT', 'ไม่ต้องมีอะไร'], ok: 1, nudge: 'ชั้น 2 ต้องแสดงตัวนะ .co คือ company', praise: 'ถูกต้อง บริษัท เจ้าของเครื่องหมายการค้า หรือผู้จด VAT ใช้ได้' },
  { ask: 'ข้อสุดท้าย ร้านค้าอยากได้ .go.th เพราะดูน่าเชื่อถือ ให้ได้ไหม', choices: ['ได้ ถ้าร้านใหญ่', 'ไม่ได้ เพราะเป็นของราชการ'], ok: 1, nudge: 'ชั้น 3 มี รปภ. เฝ้านะ ร้านค้าเข้าได้ไหม', praise: 'เยี่ยม ชั้น 3 สงวนไว้เฉพาะหน่วยงาน' },
] as const

type ChatMsg = { who: 'dome' | 'me'; text: string; tone?: 'ok' | 'warn' }

function PrepChat({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { reduce, spring } = useGameMotion()
  const [idx, setIdx] = useState(0)
  const [log, setLog] = useState<ChatMsg[]>([{ who: 'dome', text: CHAT[0].ask }])
  const [typing, setTyping] = useState(false)
  const done = idx >= CHAT.length
  const cur = CHAT[idx]

  useEffect(() => {
    const el = document.querySelector('.m3s-chat-log')
    el?.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
  }, [log, typing, reduce])

  function answer(i: number) {
    if (!cur || typing) return
    const ok = i === cur.ok
    sfx(ok ? 'ok' : 'bad')
    setLog((l) => [...l, { who: 'me', text: cur.choices[i]! }])
    setTyping(true)
    window.setTimeout(() => {
      setTyping(false)
      if (!ok) {
        setLog((l) => [...l, { who: 'dome', text: cur.nudge, tone: 'warn' }])
        return
      }
      const next = CHAT[idx + 1]
      setLog((l) => [
        ...l,
        { who: 'dome', text: cur.praise, tone: 'ok' },
        ...(next ? [{ who: 'dome' as const, text: next.ask }] : [{ who: 'dome' as const, text: 'จำประโยคนี้ไว้ ถามว่าเขาเป็นใคร ไปเข้ากะกัน' }]),
      ])
      setIdx((n) => n + 1)
    }, reduce ? 50 : 650)
  }

  return (
    <M3Stage
      pill={`แชตกับโดม ${Math.min(idx + 1, CHAT.length)}/${CHAT.length}`}
      onBack={onBack}
      label="แชตกับโดม ติวก่อนเข้ากะ"
      dock={done ? <Cta onClick={onDone}>เข้ากะเลย →</Cta> : <Cta disabled>เลือกคำตอบด้านล่าง</Cta>}
    >
      <Panel className="m3s-chat-panel" kicker="ติวก่อนเข้ากะ · คุยกับโดม">
        <ul className="m3s-chat-log" aria-live="polite">
          {log.map((m, i) => (
            <motion.li
              key={i}
              className={cn('m3s-msg', `m3s-msg--${m.who}`, m.tone && `is-${m.tone}`)}
              initial={reduce ? false : { y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={spring}
            >
              {m.who === 'dome' ? (
                // eslint-disable-next-line @next/next/no-img-element -- ภาพโดม
                <img src={M3_ASSET.dome} alt="" />
              ) : null}
              <p>{m.text}</p>
            </motion.li>
          ))}
          {typing ? (
            <li className="m3s-msg m3s-msg--dome">
              {/* eslint-disable-next-line @next/next/no-img-element -- ภาพโดม */}
              <img src={M3_ASSET.dome} alt="" />
              <p className="m3s-typing" role="status" aria-label="โดมกำลังพิมพ์">
                <i />
                <i />
                <i />
              </p>
            </li>
          ) : null}
        </ul>
        {cur && !typing ? (
          <div className="m3s-replies">
            {cur.choices.map((c, i) => (
              <button key={c} type="button" className="m3s-reply" onClick={() => answer(i)}>
                {c}
              </button>
            ))}
          </div>
        ) : null}
      </Panel>
    </M3Stage>
  )
}

/* ---------- S08 ลากป้ายเข้าตึก ---------- */

const SORT_TAGS = FLOORS.flatMap((f) => f.tags.map((t) => ({ id: t, floor: f.no })))
const SORT_HINT: Record<string, string> = {
  '.org': '.org คนมักเข้าใจผิด จริง ๆ ใครก็จดได้นะ',
  '.or.th': '.or.th เป็นของมูลนิธิ อยู่ชั้นที่สงวนไว้',
  '.ไทย': '.ไทย เป็นนามสกุลไทย ต้องมีชื่อ .th ก่อน',
  '.in.th': '.in.th ใช้บัตรประชาชนจด เป็นนามสกุลไทย',
  '.shop': '.shop ใครก็จดได้ ไม่ต้องมีเอกสาร',
}

function PrepSort({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { reduce } = useGameMotion()
  const order = useMemo(() => [...SORT_TAGS].sort(() => Math.random() - 0.5), [])
  const [placed, setPlaced] = useState<Record<string, number>>({})
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [shake, setShake] = useState<string | null>(null)
  const left = order.filter((t) => placed[t.id] === undefined)
  const done = left.length === 0

  const dd = useDragDrop({
    onDrop: (item, zone) => {
      const tag = SORT_TAGS.find((t) => t.id === item)
      if (!tag) return
      const floor = Number(zone.replace('floor-', ''))
      if (tag.floor === floor) {
        sfx('ok')
        setPlaced((p) => ({ ...p, [item]: floor }))
        const f = FLOORS[floor - 1]!
        setMsg({ text: `${item} อยู่ชั้น ${floor} · ${f.rule}`, ok: true })
      } else {
        sfx('bad')
        setShake(item)
        window.setTimeout(() => setShake(null), 450)
        setMsg({ text: SORT_HINT[item] ?? `${item} ยังไม่ใช่ชั้นนี้ ดูว่าใครจดได้`, ok: false })
      }
    },
  })

  return (
    <M3Stage
      pill={`ลากวางจัดตึก ${SORT_TAGS.length - left.length}/${SORT_TAGS.length}`}
      onBack={onBack}
      label="ลากป้ายนามสกุลเข้าตึก"
      dock={done ? <Cta onClick={onDone}>ตึกสว่างแล้ว เข้ากะเลย →</Cta> : <Cta disabled>ลากป้ายเข้าชั้นให้ครบ {left.length} ป้าย</Cta>}
    >
      <Panel className="m3s-sort" kicker="ลากป้ายไปชั้นที่ใช่ · หรือแตะป้ายแล้วแตะชั้น">
        <DomeSay live className={cn('m3s-dome--top', msg && (msg.ok ? 'is-ok' : 'is-warn'))}>
          {msg ? msg.text : 'ลากป้ายนามสกุลขึ้นตึก ชั้นไหนใครก็จดได้ ชั้นไหนต้องมีเอกสาร'}
        </DomeSay>
        <Building
          lit={done}
          showTags={false}
          renderFloor={(f) => (
            <div {...dd.zoneProps(`floor-${f.no}`)} role="button" aria-label={`วางที่ชั้น ${f.no} ${f.name}`}>
              <div className="m3s-floor-tags">
                {Object.entries(placed)
                  .filter(([, v]) => v === f.no)
                  .map(([t]) => (
                    <motion.span key={t} className="m3s-tag is-placed" initial={reduce ? false : { scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      {t}
                    </motion.span>
                  ))}
              </div>
            </div>
          )}
        />
        <div className="m3s-tray" aria-label="ป้ายที่ยังไม่ได้วาง">
          {left.map((t) => {
            const p = dd.itemProps(t.id)
            return (
              <button key={t.id} type="button" {...p} className={cn('m3s-tag', p.className, shake === t.id && 'is-shake')}>
                {t.id}
              </button>
            )
          })}
          {done ? <p className="m3s-note m3s-note--ok">ครบทุกป้ายแล้ว</p> : null}
        </div>
      </Panel>
    </M3Stage>
  )
}

/* ---------- S17 ลูกค้าคนสุดท้ายคือตัวเอง (ไม่คิดคะแนน) ---------- */

const BUSINESS_LABEL: Record<string, string> = {
  bakery: 'ร้านเบเกอรี่ / ขนมเค้ก',
  clothes: 'ร้านเสื้อผ้า / แฟชั่น',
  coffee: 'ร้านกาแฟ / เครื่องดื่ม',
  flower: 'ร้านดอกไม้',
  food: 'ร้านอาหาร',
  game: 'ร้านเกม',
  'phone-repair': 'ร้านซ่อมมือถือ',
  secondhand: 'ร้านของมือสอง',
}

const SELF_RULES: Record<string, { ok: boolean; why: string }> = {
  '.in.th': { ok: true, why: 'ใช้บัตรประชาชนจดได้ เหมาะกับร้านที่ยังไม่จดบริษัท' },
  '.shop': { ok: true, why: 'ชั้น 1 ใครก็จดได้ บอกชัดว่าเป็นร้านค้า' },
  '.com': { ok: true, why: 'ชั้น 1 ใครก็จดได้ จำง่าย' },
  '.co.th': { ok: true, why: 'ได้ถ้าจดบริษัท มีเครื่องหมายการค้า หรือจด VAT แล้ว' },
  '.go.th': { ok: false, why: 'สงวนไว้ให้หน่วยงานราชการ ร้านค้าจดไม่ได้' },
}

export function CounterFinalSelf({
  shopName,
  business,
  onDone,
  onExit,
}: {
  shopName?: string
  business?: string
  onDone: (card: { extension: string; reason: string }) => void
  onExit?: () => void
}) {
  const [extension, setExtension] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [me, setMe] = useState<{ name?: string; type?: string; company?: boolean; domain?: string } | null>(null)

  // ไม่มีข้อมูลจากหน้าแม่ = ดึงโปรไฟล์ร้านที่ตั้งไว้ตอนต้นเกม (S17 ใช้ชื่อธุรกิจของผู้เรียน)
  useEffect(() => {
    if (shopName) return
    let alive = true
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { profile?: { business_name?: string; business_type?: string; is_registered_company?: boolean | null; domain_name?: string } } | null) => {
        const p = j?.profile
        if (!alive || !p) return
        setMe({
          name: p.business_name ?? undefined,
          type: p.business_type ? BUSINESS_LABEL[p.business_type] : undefined,
          company: p.is_registered_company ?? undefined,
          domain: p.domain_name ?? undefined,
        })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [shopName])

  const name = shopName?.trim() || me?.name || 'ธุรกิจในฝันของฉัน'
  const rule = extension ? SELF_RULES[extension] : null
  return (
    <M3Stage
      pill="ลูกค้าคนสุดท้าย · ไม่คิดคะแนน"
      onBack={onExit}
      bg="counter"
      label="ลูกค้าคนสุดท้ายคือตัวคุณเอง"
      dock={
        <Cta disabled={!extension || !rule?.ok || reason.trim().length < 4} onClick={() => onDone({ extension: extension!, reason: reason.trim() })}>
          รับบัตรนามสกุลของฉัน →
        </Cta>
      }
    >
      <DomeSay name="โดม · เจ้าหน้าที่">
        สลับบทกันนะ ตอนนี้คุณเป็นลูกค้า {name} เป็นใครครับ จดบริษัทแล้วหรือยัง อยากได้นามสกุลไหน เพราะอะไร
      </DomeSay>
      <Panel kicker="การ์ดธุรกิจของคุณ" title={name}>
        <ul className="m3s-bizcard">
          <li>
            <span>ประเภท</span>
            <b>{business?.trim() || me?.type || 'ธุรกิจของคุณ'}</b>
          </li>
          {me?.company != null ? (
            <li>
              <span>จดบริษัทแล้วหรือยัง</span>
              <b>{me.company ? 'จดแล้ว' : 'ยังไม่จด'}</b>
            </li>
          ) : null}
          {me?.domain ? (
            <li>
              <span>ชื่อเว็บที่คิดไว้</span>
              <b>{me.domain}</b>
            </li>
          ) : null}
        </ul>
        <p className="m3s-sub-title">อยากได้นามสกุลไหน</p>
        <div className="m3s-ext-row" role="radiogroup" aria-label="นามสกุลที่อยากได้">
          {Object.keys(SELF_RULES).map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={extension === x}
              className={cn('m3s-ext', extension === x && (SELF_RULES[x]!.ok ? 'is-on' : 'is-bad'))}
              onClick={() => {
                sfx(SELF_RULES[x]!.ok ? 'tap' : 'bad')
                setExtension(x)
              }}
            >
              {x}
            </button>
          ))}
        </div>
        {rule ? <p className={cn('m3s-note', rule.ok ? 'm3s-note--ok' : 'm3s-note--warn')}>{rule.ok ? rule.why : `${rule.why} ลองเลือกใหม่นะ`}</p> : null}
        <label className="m3s-field">
          <span>เหตุผลของฉัน</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น ยังไม่ได้จดบริษัท จึงใช้บัตรประชาชนจด .in.th"
            rows={3}
          />
        </label>
      </Panel>
    </M3Stage>
  )
}
