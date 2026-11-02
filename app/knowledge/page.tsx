import type { Metadata } from 'next'
import Link from 'next/link'
import './knowledge.css'
import { SignInGate } from '@/components/student-shell'
import { AppFooter, AppHeader, AppShell } from '@/components/app-shell'
import { BottomNav } from '@/components/bottom-nav'
import {
  BookmarkIcon,
  ChevronRightIcon,
  KnowledgeIcon,
  LightbulbIcon,
  PlayIcon,
  SceneDecor,
  Sheet,
} from '@/components/ui'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import { missions } from '@/components/missions'
import { lessonSummary } from '@/components/server/lesson-progress'
import { KnowledgeSearch } from '@/components/knowledge-search-client'
import { knowledgeEntries } from '@/components/server/knowledge-search'

export const metadata: Metadata = { title: 'คลังความรู้ — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

const MISSION_ART: Record<string, { src: string; tone: string; alt: string }> = {
  m1: {
    src: '/ui/knowledge/domain-dns.webp',
    tone: 'kr-book-dns',
    alt: 'หนังสือเวทมนตร์ที่มีโลกและเส้นทางเครือข่ายแทนเรื่องโดเมนกับ DNS',
  },
  m2: {
    src: '/ui/knowledge/domain-structure.webp',
    tone: 'kr-book-structure',
    alt: 'หนังสือเวทมนตร์ที่มีต้นไม้โฟลเดอร์แทนโครงสร้างชื่อโดเมน',
  },
  m3: {
    src: '/ui/knowledge/domain-types.webp',
    tone: 'kr-book-types',
    alt: 'หนังสือเวทมนตร์ที่มีประตูหลายแบบแทนชนิดของโดเมน',
  },
  m4: {
    src: '/ui/knowledge/domain-registration.webp',
    tone: 'kr-book-registration',
    alt: 'หนังสือเวทมนตร์ที่มีกุญแจและปากกาขนนกแทนการจดทะเบียนโดเมน',
  },
}

/** คลังความรู้ — เปิดอ่านเป็นแผ่นด้านใน โดยคงข้อมูลและลิงก์เดิมของทั้งสี่ภารกิจ */
export default async function KnowledgePage() {
  const session = await readStudentSession()
  if (!session) return <SignInGate message="ใส่รหัสห้องกับ PIN ที่ครูให้ก่อน แล้วคลังความรู้จะเปิดให้ทบทวนได้ไม่จำกัด" />

  const summary = await lessonSummary(session.studentId)
  const nextMission = summary.missions.find((m) => !m.passed) ?? null
  const primaryHref = nextMission ? `/mission/${nextMission.id}` : '/ceo'
  const primaryLabel = nextMission ? 'กลับไปภารกิจ' : 'ไปด่านบอส'

  return (
    <AppShell
      fit
      className="student-world student-display media-shell knowledge-world"
      header={
        <AppHeader className="kr-header" divider={false}>
          {/* หัวหน้าแท็บหลักมีแค่ป้ายไม้ชื่อหน้า — ไม่มีคำโปรย/คำอธิบาย/แถบพื้นครีม */}
          <h1>คลังความรู้</h1>
        </AppHeader>
      }
      footer={
        <>
          <AppFooter divider={false} className="kr-footer">
            <Link href={primaryHref} className="kr-primary-cta">
              {primaryLabel}
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
          </AppFooter>
          <BottomNav />
        </>
      }
    >
      <div className="kr-main">
        <SceneDecor density="full" />
        {missions.length === 0 ? (
          <div className="kr-empty-state">
            <p>ยังไม่มีเนื้อหาในคลังความรู้</p>
            <span>ครูยังไม่เปิดเนื้อหาของคาบนี้ เปิดเมื่อไรหนังสือจะมาโผล่ตรงนี้เอง</span>
          </div>
        ) : (
          <>
            <h2 className="sr-only">เลือกเล่มที่จะเปิด ({missions.length} เล่ม)</h2>
            <ul className="kr-book-grid">
              {missions.map((mission, index) => {
                const art = MISSION_ART[mission.id] ?? MISSION_ART.m1!
                const cardCount = mission.channels.card.cards.length
                const pointCount = mission.channels.clip.keyPoints.length
                return (
                  <li key={mission.id} className="kr-book-grid-item">
                    <Sheet
                      id={`knowledge-${mission.id}`}
                      triggerVariant="card"
                      triggerIcon={
                        <span className={`kr-book-art ${art.tone}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={art.src} alt={art.alt} width={168} height={152} draggable={false} />
                        </span>
                      }
                      trigger={
                        <span className="kr-book-copy">
                          <span className="kr-book-index">ภารกิจที่ {String(index + 1).padStart(2, '0')}</span>
                          <span className="kr-book-title">{mission.title}</span>
                          <span className="kr-book-meta">{cardCount} การ์ด · {pointCount} สรุปสั้น</span>
                        </span>
                      }
                      triggerClassName={`kr-book-trigger ${art.tone}`}
                      title={mission.title}
                    >
                      <p className="text-body text-pretty text-ink-muted">{mission.objective}</p>

                      <h3 className="mt-5 flex items-center gap-2 text-body font-bold text-ink">
                        <BookmarkIcon width={20} height={20} aria-hidden className="text-brand-700" />
                        {mission.channels.card.title}
                      </h3>
                      <ul className="mt-2 flex flex-col gap-2">
                        {mission.channels.card.cards.map((card) => (
                          <li key={card.front}>
                            <details className="group rounded-xl bg-surface-sunken px-4 py-1 ring-1 ring-line ring-inset">
                              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 py-2 text-body font-bold text-ink focus-ring">
                                <span className="min-w-0 flex-1">{card.front}</span>
                                <span className="inline-flex shrink-0 items-center gap-1 text-label font-semibold text-brand-700">
                                  <span className="group-open:hidden">แตะเพื่อพลิก</span>
                                  <span className="hidden group-open:inline">ปิด</span>
                                  <ChevronRightIcon width={20} height={20} aria-hidden className="transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none" />
                                </span>
                              </summary>
                              <p className="border-t border-line pt-3 pb-3 text-body text-pretty text-ink">{card.back}</p>
                            </details>
                          </li>
                        ))}
                      </ul>

                      <h3 className="mt-5 flex items-center gap-2 text-body font-bold text-ink">
                        <PlayIcon width={20} height={20} aria-hidden className="text-brand-700" />
                        {mission.channels.clip.title}
                      </h3>
                      <ul className="mt-2 flex flex-col gap-2">
                        {mission.channels.clip.keyPoints.map((point) => (
                          <li key={point} className="flex items-start gap-2 text-body text-pretty text-ink">
                            <LightbulbIcon width={20} height={20} aria-hidden className="mt-1 shrink-0 text-spark-600" />
                            <span className="min-w-0 flex-1">{point}</span>
                          </li>
                        ))}
                      </ul>

                      <Link href={`/mission/${mission.id}`} className="btn-base mt-5 min-h-12 w-full rounded-xl bg-brand-600 text-body font-bold text-ink-onbrand">
                        ไปทำภารกิจนี้
                        <ChevronRightIcon width={20} height={20} aria-hidden />
                      </Link>
                    </Sheet>
                  </li>
                )
              })}
            </ul>

            <div className="kr-search-wrap">
              <Sheet
                id="sheet-search"
                triggerIcon={<KnowledgeIcon width={20} height={20} aria-hidden className="shrink-0" />}
                trigger="ค้นหาคำที่อยากทบทวน"
                title="ค้นหาในคลังความรู้"
                triggerClassName="kr-search-trigger"
              >
                <KnowledgeSearch entries={knowledgeEntries()} />
              </Sheet>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
