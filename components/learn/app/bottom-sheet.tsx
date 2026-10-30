'use client'

import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CloseIcon } from '@/components/ui'

export function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button
            type="button"
            aria-label="ปิดเมนู"
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative w-full rounded-t-[28px] bg-surface-raised px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-soft-3"
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-contrast/60" aria-hidden />
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-title-sm font-bold text-ink">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="ปิด"
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted active:scale-95 focus-ring"
              >
                <CloseIcon width={22} height={22} aria-hidden />
              </button>
            </div>
            <div className="flex flex-col gap-2">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
