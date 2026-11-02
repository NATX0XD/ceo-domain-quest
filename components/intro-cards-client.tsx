'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppFooter, AppShell } from '@/components/app-shell'
import { Button, ChevronRightIcon, cn } from '@/components/ui'

/**
 * S-02 คำแนะนำการใช้งาน — การ์ด 3 ใบ ปัด/กดดูได้ กดข้ามได้ตลอด
 *
 * ⚠️ ข้อความทุกใบมาจากเซิร์ฟเวอร์ (content/messages.json) ห้ามพิมพ์เนื้อหาซ้ำไว้ในไฟล์นี้
 * ⚠️ ต้องมีประโยคที่บอกว่า "ไม่มีการจัดอันดับ" เพราะเป็นหลักของสื่อนี้ (สเปก S-02)
 * จำว่าเคยดูแล้วไว้ใน localStorage เท่านั้น — ไม่ใช่ข้อมูลการเรียน ไม่ต้องเปลืองตาราง
 */
const SEEN_KEY = 'dbq_intro_seen'

const CARD_ICONS: Record<string, { src: string; alt: string }> = {
  'intro-1': { src: '/icons/3d/school.webp', alt: 'อาคารบริษัท' },
  'intro-2': { src: '/icons/3d/gear.webp', alt: 'เครื่องมือช่วยเรียน' },
  'intro-3': { src: '/icons/3d/bullseye.webp', alt: 'เป้าหมาย' },
}

export interface IntroCard {
  id: string
  icon: string
  title: string
  lines: string[]
}

export function IntroCardsClient({
  cards,
  nextHref,
  skipLabel,
  nextLabel,
  startLabel,
}: {
  cards: IntroCard[]
  nextHref: string
  skipLabel: string
  nextLabel: string
  startLabel: string
}) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const card = cards[index]
  const last = index === cards.length - 1

  function finish() {
    try {
      window.localStorage.setItem(SEEN_KEY, '1')
    } catch {
      // เบราว์เซอร์ปิด storage ก็ไม่เป็นไร แค่การ์ดจะขึ้นอีกรอบ
    }
    router.push(nextHref)
  }

  if (!card) return null

  return (
    <AppShell
      className="student-world student-display media-shell intro-shell"
      mainClassName="flex flex-col"
      footer={
        <AppFooter className="flex flex-col gap-3">
          {/* จุดบอกตำแหน่ง อยู่ติดปุ่มเพื่อให้เห็นว่าเหลืออีกกี่ใบโดยไม่ต้องเลื่อน */}
          <ul className="flex justify-center gap-2">
            {cards.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  aria-label={`ไปการ์ดใบที่ ${i + 1}`}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'size-11 cursor-pointer rounded-full focus-ring',
                    'after:mx-auto after:block after:size-2.5 after:rounded-full after:content-[""]',
                    i === index ? 'after:bg-brand-600' : 'after:bg-line-contrast',
                  )}
                />
              </li>
            ))}
          </ul>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => (last ? finish() : setIndex((i) => i + 1))}
          >
            {last ? startLabel : nextLabel}
            <ChevronRightIcon width={22} height={22} aria-hidden />
          </Button>
          {/* ปุ่มรองเป็นแคปซูลครีม (.game-button--cream) — ghost เดิมมี active:bg-brand-100
              ไปโดนกฎ CSS กลางที่ใส่ภาพชิ้นปุ่มเก่า เลยมีลูกศร/ขอบภาพหลุดออกมา */}
          <Button variant="secondary" size="md" fullWidth onClick={finish} className="min-h-12 text-body">
            {skipLabel}
          </Button>
        </AppFooter>
      }
    >
      <div className="intro-world-scene flex min-h-full flex-col items-center justify-center gap-4 px-4 py-6 text-center">
        <div className="intro-world-layers" aria-hidden="true">
          <img src="/intro/sky.webp" alt="" className="intro-layer intro-layer-sky" />
          <img src="/intro/shop.webp" alt="" className="intro-layer intro-layer-shop" />
          <img src="/ui/welcome/official-dome.webp" alt="" className="intro-layer intro-layer-dome" />
        </div>
        <div className="intro-copy-panel">
        <p className="sr-only" aria-live="polite">
          การ์ดที่ {index + 1} จาก {cards.length}
        </p>
        <img
          src={CARD_ICONS[card.id]?.src ?? '/icons/3d/sparkles.webp'}
          alt={CARD_ICONS[card.id]?.alt ?? card.icon}
          className="mx-auto size-14 object-contain"
        />
        <h1 className="text-display font-extrabold text-balance text-ink">{card.title}</h1>
        <div className="flex max-w-[26rem] flex-col gap-2">
          {card.lines.map((line) => (
            <p key={line} className="text-body-lg text-pretty text-ink-muted">
              {line}
            </p>
          ))}
        </div>
        </div>
      </div>
    </AppShell>
  )
}
