'use client'

import { useEffect, useState } from 'react'
import { computeKeyboard, isTextEntry } from '@/lib/keyboard-inset'

/**
 * จัดการคีย์บอร์ดมือถือทั้งระบบ (ติดครั้งเดียวที่ app/layout.tsx)
 *
 * - อ่าน window.visualViewport แล้วเขียน CSS var บน <html>: --kb-inset · --app-h · --app-top · --kb-pill-bottom
 *   และ data-keyboard="open" ให้ globals.css ย่อ AppShell เหลือเท่าพื้นที่เหนือคีย์บอร์ด (ปุ่มท้ายจออยู่ติดคีย์บอร์ด)
 *   พร้อมปิด padding safe-area ล่าง (home indicator ถูกคีย์บอร์ดบังอยู่แล้ว)
 * - เลื่อนช่องที่โฟกัสให้อยู่กลางพื้นที่ที่มองเห็น
 * - Enter ในช่องบรรทัดเดียว = ไปช่องถัดไป ถ้าเป็นช่องสุดท้ายของฟอร์มจึงส่งฟอร์มตามปกติ · นอกฟอร์มพับคีย์บอร์ด
 * - แตะพื้นที่ว่างนอกช่องพิมพ์ = พับคีย์บอร์ด · มีปุ่ม "พับคีย์บอร์ด" บนอุปกรณ์สัมผัส
 */
export function KeyboardInset() {
  const [open, setOpen] = useState(false)
  const [pillBottom, setPillBottom] = useState(8)

  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport
    let baseline = vv?.height ?? window.innerHeight
    let lastWidth = vv?.width ?? window.innerWidth
    let raf = 0
    let lastInset = 0
    let revealTimer = 0

    const reveal = (el: Element | null) => {
      if (!(el instanceof HTMLElement) || !isTextEntry(el)) return
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
    }

    const apply = () => {
      raf = 0
      const h = vv?.height ?? window.innerHeight
      const w = vv?.width ?? window.innerWidth
      if (Math.abs(w - lastWidth) > 40) {
        // หมุนจอ — เริ่มฐานใหม่
        baseline = h
        lastWidth = w
      }
      const editableFocused = isTextEntry(document.activeElement)
      const s = computeKeyboard({
        baseline,
        vvHeight: h,
        vvOffsetTop: vv?.offsetTop ?? 0,
        vvScale: vv?.scale ?? 1,
        editableFocused,
        layoutHeight: window.innerHeight,
      })
      if (!s.open && !editableFocused) baseline = Math.max(baseline, h)
      if (s.open) {
        root.dataset.keyboard = 'open'
        root.style.setProperty('--kb-inset', `${s.inset}px`)
        root.style.setProperty('--app-h', `${s.appHeight}px`)
        root.style.setProperty('--app-top', `${s.top}px`)
        root.style.setProperty('--full-h', `${Math.round(baseline)}px`)
        const footer = document.querySelector<HTMLElement>('.app-shell-footer')
        const fh = footer && footer.offsetHeight > 0 && getComputedStyle(footer).display !== 'none' ? footer.offsetHeight : 0
        setPillBottom(fh + 8)
        // คีย์บอร์ดของ iPhone เลื่อนขึ้นช้ากว่า focus — เลื่อนช่องที่พิมพ์อีกรอบหลังกรอบหดเสร็จจริง ไม่งั้นช่องจมใต้คีย์บอร์ด
        if (editableFocused && Math.abs(s.inset - lastInset) > 24) {
          window.clearTimeout(revealTimer)
          revealTimer = window.setTimeout(() => reveal(document.activeElement), 60)
        }
        lastInset = s.inset
      } else {
        lastInset = 0
        delete root.dataset.keyboard
        root.style.removeProperty('--kb-inset')
        root.style.removeProperty('--app-h')
        root.style.removeProperty('--app-top')
        root.style.removeProperty('--full-h')
      }
      setOpen(s.open)
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply)
    }

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as Element | null
      if (!isTextEntry(el)) return
      // บอกคีย์บอร์ดว่าปุ่ม Enter คือ "ถัดไป/ไป/เสร็จ"
      if (!el.enterKeyHint) {
        const next = nextField(el)
        el.enterKeyHint = el instanceof HTMLTextAreaElement ? 'enter' : next ? 'next' : el.form ? 'go' : 'done'
      }
      schedule()
      // คีย์บอร์ดเด้งขึ้นช้ากว่า focus — รอให้ viewport ปรับก่อนค่อยเลื่อน
      window.setTimeout(() => reveal(document.activeElement), 120)
      window.setTimeout(() => reveal(document.activeElement), 420)
    }
    const onFocusOut = () => window.setTimeout(schedule, 60)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing || e.shiftKey) return
      const el = e.target as Element
      if (!(el instanceof HTMLInputElement) || !isTextEntry(el)) return
      const next = nextField(el)
      if (next) {
        e.preventDefault()
        next.focus()
      } else if (!el.form) {
        e.preventDefault()
        el.blur()
      }
      // ช่องสุดท้ายของฟอร์ม: ปล่อยให้ฟอร์มส่งตามปกติ (เป็นการกระทำสุดท้ายของฟอร์ม)
    }

    const onClick = (e: MouseEvent) => {
      const active = document.activeElement
      if (!isTextEntry(active)) return
      const t = e.target as Element | null
      if (!t || t.closest('input, textarea, select, button, a, label, summary, [role="button"], [contenteditable="true"], [data-kb-keep]')) return
      ;(active as HTMLElement).blur()
    }

    vv?.addEventListener('resize', schedule)
    vv?.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('click', onClick)
    schedule()
    return () => {
      vv?.removeEventListener('resize', schedule)
      vv?.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('click', onClick)
      if (raf) cancelAnimationFrame(raf)
      window.clearTimeout(revealTimer)
      delete root.dataset.keyboard
    }
  }, [])

  if (!open) return null
  return (
    <button
      type="button"
      className="kb-fold-pill"
      style={{ bottom: pillBottom }}
      // pointerdown ไม่ blur เอง — กัน focus หลุดก่อน click แล้วปุ่มหายก่อนทำงาน
      onClick={() => {
        const a = document.activeElement
        if (a instanceof HTMLElement) a.blur()
      }}
    >
      <span aria-hidden="true">⌄</span> พับคีย์บอร์ด
    </button>
  )
}

const FIELD_SELECTOR = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=submit]):not([type=button]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled])'

function nextField(el: HTMLElement): HTMLElement | null {
  const scope = (el as HTMLInputElement).form ?? null
  if (!scope) return null
  const all = Array.from(scope.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter((n) => n.offsetParent !== null)
  const i = all.indexOf(el)
  return i >= 0 && i < all.length - 1 ? (all[i + 1] ?? null) : null
}
