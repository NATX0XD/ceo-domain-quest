'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertIcon,
  Button,
  Card,
  CheckIcon,
  ChevronRightIcon,
  InfoIcon,
  LightbulbIcon,
  SendIcon,
  StarIcon,
  TextField,
} from '@/components/ui'

/**
 * หน้าจอสถานี B — **แสดงผลอย่างเดียว ไม่ตัดสินอะไรเองเลย**
 *
 * ⚠️ ห้าม import core/tld-rules หรือ core/content เข้ามาในไฟล์นี้
 *    การตัดสินผ่าน/ไม่ผ่านอยู่ที่ POST /api/station-b/submit ฝั่งเซิร์ฟเวอร์
 *    ตัวช่วยที่เห็นถูกกรองมาจากเซิร์ฟเวอร์แล้ว บรรทัดที่ระดับนี้ไม่ควรเห็นจะไม่ถูกส่งมาเลย
 */
export interface StationBSlot {
  id: string
  suffix: string
  label: string
  hints: { label: string; text: string }[]
}

interface SubmitResult {
  tldId: string
  accepted: boolean
  reason: string | null
  domain: string | null
  attempt: number
  /** คะแนนเหตุผลที่ระบบเสนอ (ครูยืนยันเสมอ) */
  reasonScore: number | null
  reasonMaxScore: number | null
  reasonFeedback: string | null
  /** 'ai' = โมเดลช่วยอ่าน · 'fallback' = เกณฑ์ตายตัวของระบบ (ห้ามใช้คำว่า "กฎในโค้ด" บนจอเด็ก) */
  source: 'ai' | 'fallback' | null
}

/** ต้องเท่ากับ MIN_REASON_LENGTH ใน app/api/station-b/submit/route.ts */
const MIN_REASON_LENGTH = 10

/** ผลตรวจชื่อว่างจาก POST /api/domain/check — หน้าจอไม่ตัดสินเอง แค่เล่าตามที่เซิร์ฟเวอร์ตอบ */
interface DomainCheckResult {
  available: boolean
  name: string
  removed: string[]
  message: string
  takenByNickname: string | null
  suggestions: string[]
}

export function StationBClient({
  shopName,
  domainName,
  isRegisteredCompany,
  audience,
  slots,
  level,
  demoMode,
  attempts: attemptsFromServer,
  hintsUsed: hintsUsedFromServer,
  hintExhausted,
  acceptedTldId,
}: {
  shopName: string
  domainName: string
  isRegisteredCompany: boolean
  audience: 'thai' | 'international'
  slots: StationBSlot[]
  level: 1 | 2 | 3
  demoMode: boolean
  attempts: number
  hintsUsed: number
  hintExhausted: boolean
  acceptedTldId: string | null
}) {
  const router = useRouter()
  const [attempts, setAttempts] = useState(attemptsFromServer)
  const [hintsUsed, setHintsUsed] = useState(hintsUsedFromServer)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  // เหตุผลเป็นของบังคับ เซิร์ฟเวอร์ปฏิเสธถ้าสั้นเกินไป (มติ master จากรีวิว R7 ข้อ 8)
  const [reasonText, setReasonText] = useState('')
  // S-23 ตรวจว่าชื่อนี้ยังว่างไหม — คำตัดสินทั้งหมดอยู่ที่ POST /api/domain/check
  const [nameToCheck, setNameToCheck] = useState(domainName)
  const [checkingName, setCheckingName] = useState(false)
  const [nameResult, setNameResult] = useState<DomainCheckResult | null>(null)

  // ตัวเลขจริงมาจากเซิร์ฟเวอร์เสมอ รีเฟรชหน้าแล้วต้องไม่กลับเป็นศูนย์
  useEffect(() => setAttempts(attemptsFromServer), [attemptsFromServer])
  useEffect(() => setHintsUsed(hintsUsedFromServer), [hintsUsedFromServer])

  async function submit(tldId: string) {
    if (busy) return
    if (reasonText.trim().length < MIN_REASON_LENGTH) {
      setSystemMessage(
        `ก่อนยื่น ต้องเขียนเหตุผลว่าทำไมนามสกุลนี้เหมาะกับร้านของเรา อย่างน้อย ${MIN_REASON_LENGTH} ตัวอักษร`,
      )
      return
    }
    setBusy(true)
    setSystemMessage(null)
    try {
      const res = await fetch('/api/station-b/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // ส่งไปได้อย่างเดียวคือช่องที่เลือก โปรไฟล์ร้านอยู่ฝั่งเซิร์ฟเวอร์
        body: JSON.stringify({ tldId, reasonText: reasonText.trim() }),
      })
      const data = (await res.json().catch(() => null)) as
        | {
            accepted?: boolean
            reason?: string | null
            domain?: string | null
            attempts?: number
            message?: string
            reasonScore?: number
            reasonMaxScore?: number
            reasonFeedback?: string
            source?: 'ai' | 'fallback'
          }
        | null

      if (!res.ok) {
        setSystemMessage(data?.message ?? 'ยื่นไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }

      const nextAttempts = data?.attempts ?? attempts + 1
      setAttempts(nextAttempts)
      setResult({
        tldId,
        accepted: data?.accepted === true,
        reason: data?.reason ?? null,
        domain: data?.domain ?? null,
        attempt: nextAttempts,
        reasonScore: data?.reasonScore ?? null,
        reasonMaxScore: data?.reasonMaxScore ?? null,
        reasonFeedback: data?.reasonFeedback ?? null,
        source: data?.source ?? null,
      })
      router.refresh()
    } catch {
      setSystemMessage('ต่อเน็ตไม่ได้ ลองยื่นใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  async function askHint() {
    if (busy || hintExhausted) return
    setBusy(true)
    try {
      const res = await fetch('/api/hint', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ missionId: 'station-b' }),
      })
      const data = (await res.json().catch(() => null)) as
        | { hintsUsed?: number; message?: string }
        | null
      if (!res.ok) {
        setSystemMessage(data?.message ?? 'ขอตัวช่วยไม่สำเร็จ')
        return
      }
      if (typeof data?.hintsUsed === 'number') setHintsUsed(data.hintsUsed)
      // ข้อความตัวช่วยใบใหม่ถูกเรนเดอร์จากเซิร์ฟเวอร์ ไม่ได้ส่งมากับ response นี้
      router.refresh()
    } catch {
      setSystemMessage('ต่อเน็ตไม่ได้ ลองขอตัวช่วยใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  /**
   * S-23 + E-06 "ชื่อนี้ว่างไหม"
   *
   * ⚠️ หน้าจอไม่ตัดสินเอง ไม่มีรายชื่อที่ถูกจดอยู่ในบันเดิลฝั่งเบราว์เซอร์แม้แต่ชื่อเดียว
   *    ทะเบียนทั้งหมด (โลกของเกม + เพื่อนในห้อง) อยู่ฝั่งเซิร์ฟเวอร์
   * ⚠️ ปุ่มนี้ **ไม่จดชื่อให้** แค่บอกว่าว่างหรือไม่ว่าง การจดเกิดตอนบันทึกโปรไฟล์ร้าน
   */
  async function checkName() {
    if (checkingName) return
    setCheckingName(true)
    setNameResult(null)
    try {
      const res = await fetch('/api/domain/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: nameToCheck }),
      })
      const data = (await res.json().catch(() => null)) as
        | (Partial<DomainCheckResult> & { message?: string })
        | null

      if (!res.ok) {
        setNameResult({
          available: false,
          name: data?.name ?? nameToCheck,
          removed: [],
          message: data?.message ?? 'ตรวจชื่อไม่สำเร็จ ลองใหม่อีกครั้ง',
          takenByNickname: null,
          suggestions: data?.suggestions ?? [],
        })
        return
      }

      setNameResult({
        available: data?.available === true,
        name: data?.name ?? nameToCheck,
        removed: data?.removed ?? [],
        message: data?.message ?? '',
        takenByNickname: data?.takenByNickname ?? null,
        suggestions: data?.suggestions ?? [],
      })
    } catch {
      setNameResult({
        available: false,
        name: nameToCheck,
        removed: [],
        message: 'ต่อเน็ตไม่ได้ ลองตรวจใหม่อีกครั้ง',
        takenByNickname: null,
        suggestions: [],
      })
    } finally {
      setCheckingName(false)
    }
  }

  const reasonLength = reasonText.trim().length
  const reasonReady = reasonLength >= MIN_REASON_LENGTH

  return (
    <section className="mt-8">
      <header>
        <h2 className="text-title-sm font-bold text-balance text-ink">สำนักงานจดทะเบียน</h2>
        <p className="mt-1 text-label text-pretty text-ink-muted">
          ยื่นป้ายร้านเข้าช่องที่คิดว่าถูก ถ้าผิดเจ้าหน้าที่จะดีดกลับพร้อมบอกเหตุผล
        </p>
      </header>

      <Card className="mt-4">
        <p className="text-label font-bold text-brand-700">ป้ายร้านของเรา</p>
        <p className="mt-1 text-title font-extrabold break-all text-ink">{domainName}</p>
        <p className="mt-2 text-body text-pretty text-ink-muted">
          ร้าน{shopName} ·{' '}
          {isRegisteredCompany ? 'จดทะเบียนนิติบุคคลแล้ว' : 'ยังไม่ได้จดทะเบียนนิติบุคคล'} ·{' '}
          {audience === 'thai' ? 'ลูกค้าอยู่ในไทย' : 'ลูกค้าอยู่ต่างประเทศด้วย'}
        </p>
        <p className="mt-2 text-label text-pretty text-ink-muted">
          ยื่นไปแล้ว {attempts} ครั้ง · ใช้ตัวช่วย {hintsUsed} ครั้ง (นับที่เซิร์ฟเวอร์
          รีเฟรชแล้วไม่หาย)
        </p>
        {acceptedTldId ? (
          <p className="mt-2 flex items-center gap-1.5 text-label font-bold text-quest-700">
            <CheckIcon width={20} height={20} aria-hidden className="shrink-0" />
            เคยยื่นผ่านแล้วที่ช่อง {acceptedTldId}
          </p>
        ) : null}
      </Card>

      {/* S-23 + E-06 ใครจดก่อนได้ก่อน — ตรวจก่อนจดจริง */}
      <Card className="mt-4">
        <p className="text-label font-bold text-brand-700">ชื่อนี้ยังว่างไหม</p>
        <p className="mt-1 text-label text-pretty text-ink-muted">
          ชื่อเว็บใครจดก่อนได้ก่อน ลองตรวจดูว่าชื่อที่เราอยากได้ยังไม่มีใครจด
          วางลิงก์เต็ม ๆ มาก็ได้ ระบบจะตัดให้เหลือแต่ชื่อ
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <TextField
              id="domain-check-name"
              label="ชื่อที่อยากจด"
              value={nameToCheck}
              onChange={(e) => setNameToCheck(e.target.value)}
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder="เช่น mycake หรือ https://www.mycake.com"
              hint="ไม่ต้องใส่นามสกุล ตรวจเฉพาะชื่อหน้านามสกุล"
            />
          </div>
          <Button
            variant="secondary"
            onClick={checkName}
            disabled={checkingName || nameToCheck.trim().length === 0}
            loading={checkingName}
            loadingLabel="กำลังตรวจ"
          >
            ตรวจชื่อ
          </Button>
        </div>

        {nameResult ? (
          <div
            role="status"
            className={
              nameResult.available
                ? 'mt-3 rounded-2xl bg-quest-100 p-4 ring-1 ring-quest-300 ring-inset'
                : 'mt-3 rounded-2xl bg-spark-100 p-4 ring-1 ring-spark-300 ring-inset'
            }
          >
            <p className="flex items-start gap-2 text-body font-bold text-pretty text-ink">
              {nameResult.available ? (
                <CheckIcon width={22} height={22} aria-hidden className="mt-0.5 shrink-0" />
              ) : (
                <AlertIcon width={22} height={22} aria-hidden className="mt-0.5 shrink-0" />
              )}
              <span className="min-w-0">{nameResult.message}</span>
            </p>

            {nameResult.removed.length > 0 ? (
              <p className="mt-2 text-label text-pretty text-ink-muted">
                ตรวจจากชื่อ <span className="font-bold">{nameResult.name}</span> (ตัด
                {nameResult.removed.join(' ')} ออกให้แล้ว ชื่อที่พิมพ์ไว้ยังอยู่ครบ)
              </p>
            ) : null}

            {nameResult.suggestions.length > 0 ? (
              <div className="mt-3">
                <p className="text-label font-bold text-ink">ชื่อที่ยังว่าง กดเลือกได้เลย</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {nameResult.suggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setNameToCheck(name)
                        setNameResult(null)
                      }}
                      className="focus-ring min-h-11 rounded-xl bg-surface-raised px-3 text-label font-bold text-ink ring-1 ring-line ring-inset"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {systemMessage ? (
        <div
          role="status"
          className="mt-4 flex gap-2 rounded-2xl bg-surface-sunken p-4 ring-1 ring-line ring-inset"
        >
          <InfoIcon width={22} height={22} aria-hidden className="mt-0.5 shrink-0 text-ink-muted" />
          <p className="min-w-0 text-body text-pretty text-ink">
            {systemMessage}{' '}
            <Link href="/setup" className="font-bold text-brand-700 underline focus-ring">
              ไปตั้งค่าร้าน
            </Link>
          </p>
        </div>
      ) : null}

      <AnimatePresence>
        {result && !result.accepted ? (
          <motion.div
            key={result.attempt}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0, x: [0, -10, 10, -6, 6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            role="alert"
            className="mt-4 flex gap-2 rounded-2xl bg-danger-100 p-4 ring-2 ring-danger-600 ring-inset"
          >
            <AlertIcon
              width={22}
              height={22}
              aria-hidden
              className="mt-0.5 shrink-0 text-danger-700"
            />
            <div className="min-w-0">
              <p className="text-body font-bold text-danger-700">เจ้าหน้าที่ดีดกลับ</p>
              <p className="mt-1 text-body text-pretty text-danger-700">{result.reason}</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Card className="mt-5">
        <label htmlFor="station-b-reason" className="text-body font-bold text-ink">
          เขียนเหตุผลก่อนยื่น
        </label>
        <p className="mt-1 text-label text-pretty text-ink-muted">
          ทำไมนามสกุลที่เลือกถึงเหมาะกับร้านของเรา เขียนสั้น ๆ 1-2 ประโยคก็พอ
        </p>
        <textarea
          id="station-b-reason"
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          rows={3}
          maxLength={500}
          aria-describedby="station-b-reason-hint"
          placeholder="เช่น ร้านเรายังไม่ได้จดทะเบียนบริษัท และขายคนไทยเป็นหลัก จึงเลือก…"
          className="mt-3 w-full rounded-sm bg-surface-raised p-4 text-body text-ink ring-2 ring-line-contrast ring-inset outline-none transition-[box-shadow] duration-200 placeholder:text-ink-subtle focus-visible:ring-brand-600 motion-reduce:transition-none"
        />
        <p
          id="station-b-reason-hint"
          className={`mt-1 flex items-center gap-1.5 text-label font-semibold ${
            reasonReady ? 'text-quest-700' : 'text-ink-muted'
          }`}
        >
          {reasonReady ? (
            <CheckIcon width={18} height={18} aria-hidden className="shrink-0" />
          ) : (
            <InfoIcon width={18} height={18} aria-hidden className="shrink-0" />
          )}
          {reasonReady
            ? `เขียนแล้ว ${reasonLength} ตัวอักษร ยื่นได้เลย`
            : `ขออีก ${MIN_REASON_LENGTH - reasonLength} ตัวอักษรจึงจะยื่นได้`}
        </p>
      </Card>

      <Button
        variant="secondary"
        size="md"
        fullWidth
        className="mt-4"
        onClick={askHint}
        disabled={busy || hintExhausted}
        leadingIcon={<LightbulbIcon width={22} height={22} />}
      >
        {hintExhausted ? 'ตัวช่วยเปิดครบแล้ว' : 'ขอตัวช่วย (เปิดป้ายบอกเงื่อนไขเพิ่ม)'}
      </Button>

      <ul className="mt-5 flex flex-col gap-3">
        {slots.map((slot) => {
          const rejectedHere = result?.tldId === slot.id && !result.accepted
          const acceptedHere = acceptedTldId === slot.id
          return (
            <li key={slot.id}>
              <motion.div
                animate={rejectedHere ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
                className={`rounded-2xl bg-surface-raised p-5 shadow-soft-2 ring-2 ring-inset ${
                  rejectedHere
                    ? 'ring-danger-600'
                    : acceptedHere
                      ? 'ring-quest-500'
                      : 'ring-line'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-title font-extrabold break-all text-ink">{slot.suffix}</p>
                  <p className="text-label text-ink-muted">ช่อง {slot.label}</p>
                </div>

                {acceptedHere ? (
                  <p className="mt-1 flex items-center gap-1.5 text-label font-bold text-quest-700">
                    <CheckIcon width={18} height={18} aria-hidden className="shrink-0" />
                    ช่องนี้เคยยื่นผ่านแล้ว
                  </p>
                ) : null}

                {slot.hints.length > 0 ? (
                  <dl className="mt-3 flex flex-col gap-1.5 text-body text-ink">
                    {slot.hints.map((h) => (
                      <div key={h.label} className="flex flex-wrap gap-x-1.5">
                        <dt className="shrink-0 font-bold text-brand-700">{h.label}:</dt>
                        <dd className="min-w-0 text-pretty text-ink-muted">{h.text}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                <Button
                  variant="success"
                  size="md"
                  fullWidth
                  className="mt-4"
                  onClick={() => submit(slot.id)}
                  disabled={busy || !reasonReady}
                  loading={busy}
                  loadingLabel="กำลังยื่นป้ายร้าน"
                  leadingIcon={busy ? undefined : <SendIcon width={22} height={22} />}
                >
                  {busy
                    ? 'กำลังยื่น…'
                    : reasonReady
                      ? `ยื่นป้ายเข้าช่อง ${slot.suffix}`
                      : 'เขียนเหตุผลก่อนจึงจะยื่นได้'}
                </Button>
              </motion.div>
            </li>
          )
        })}
      </ul>

      <AnimatePresence>
        {result?.accepted ? (
          <motion.div
            key={`ok-${result.attempt}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-(--z-overlay) flex items-center justify-center bg-brand-700/70 px-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="w-full max-w-[26rem] rounded-3xl bg-surface-raised p-6 text-center shadow-lift"
            >
              <motion.div
                animate={{ rotate: [0, -12, 12, -8, 0] }}
                transition={{ duration: 0.7 }}
                className="mx-auto w-fit motion-reduce:animate-none"
              >
                <StarIcon width={56} height={56} aria-hidden />
              </motion.div>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-label font-bold text-quest-700">
                <CheckIcon width={20} height={20} aria-hidden />
                ยื่นผ่านแล้ว
              </p>
              <p className="mt-1 text-title font-extrabold break-all text-brand-700">
                {result.domain}
              </p>
              <p className="mt-3 text-label text-ink-muted">
                ยื่นทั้งหมด {attempts} ครั้ง · ใช้ตัวช่วย {hintsUsed} ครั้ง
              </p>
              {result.reasonScore !== null ? (
                <div className="mt-4 rounded-2xl bg-surface-sunken p-4 text-left ring-1 ring-line ring-inset">
                  <p className="text-body font-bold text-ink">
                    เหตุผลของเรา: ระบบเสนอ {result.reasonScore}/{result.reasonMaxScore} คะแนน
                  </p>
                  {result.reasonFeedback ? (
                    <p className="mt-1 text-body text-pretty text-ink-muted">
                      {result.reasonFeedback}
                    </p>
                  ) : null}
                  {/* "กฎในโค้ด" เป็นคำของโปรแกรมเมอร์ เด็ก ปวช.1 อ่านไม่ออก (FLOW-1 ข้อ 13) */}
                  <p className="mt-2 text-label text-pretty text-ink-muted">
                    {result.source === 'ai'
                      ? 'AI ช่วยอ่านเหตุผลนี้ให้ · ครูเป็นคนยืนยันคะแนนจริงเสมอ'
                      : 'คะแนนนี้มาจากเกณฑ์ตายตัวของระบบ ยังไม่ได้ให้ AI อ่าน · ครูเป็นคนยืนยันคะแนนจริงเสมอ'}
                  </p>
                </div>
              ) : null}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                className="mt-5"
                onClick={() => setResult(null)}
                trailingIcon={<ChevronRightIcon width={22} height={22} />}
              >
                ลองช่องอื่นต่อ
              </Button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* แถบเดโม — เซิร์ฟเวอร์เป็นคนอ่าน ?level= และเป็นคนกรองตัวช่วย ปิดทั้งแถบด้วย DEMO_MODE=0 */}
      {demoMode ? (
        <div className="safe-b fixed right-3 bottom-3 z-(--z-sticky) rounded-2xl bg-ink px-3 py-2 shadow-lift">
          <p className="text-note font-bold tracking-wide text-reward-300">โหมดเดโม</p>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-note text-ink-onbrand/80">ระดับ</span>
            {([1, 2, 3] as const).map((n) => (
              <Link
                key={n}
                href={`/station-b?level=${n}`}
                aria-current={level === n ? 'true' : undefined}
                aria-label={`สลับไประดับ ${n}`}
                className={`tap-target rounded-md text-label font-bold focus-ring ${
                  level === n ? 'bg-reward-300 text-ink' : 'bg-ink-muted text-ink-onbrand'
                }`}
              >
                {n}
              </Link>
            ))}
          </div>
          <p className="mt-1 text-note text-ink-onbrand/80">
            ยื่น {attempts} · ตัวช่วย {hintsUsed}
          </p>
        </div>
      ) : null}
    </section>
  )
}
