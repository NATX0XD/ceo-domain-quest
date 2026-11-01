import type { Metadata } from 'next'
import Link from 'next/link'
import { SignInGate } from '@/components/student-shell'
import { AppFooter, AppHeader, AppShell } from '@/components/app-shell'
import { BottomNav } from '@/components/bottom-nav'
import {
  BagIcon,
  BookmarkIcon,
  ChevronRightIcon,
  DomeAvatar,
  GlobeIcon,
  KnowledgeIcon,
  LightbulbIcon,
  PlayIcon,
  SceneDecor,
  Sheet,
  SpeechBubble,
  TargetIcon,
  UsersIcon,
} from '@/components/ui'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import { missions } from '@/components/missions'
import { lessonSummary } from '@/components/server/lesson-progress'
import { KnowledgeSearch } from '@/components/knowledge-search-client'
import { knowledgeEntries } from '@/components/server/knowledge-search'

export const metadata: Metadata = { title: 'คลังความรู้ — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * คลังความรู้ — เปิดทบทวนได้ตลอดคาบ ไม่จำกัดจำนวนครั้ง ไม่หักดาว
 *
 * ## ทำไมรื้อใหม่ (คำสั่งเจ้าของใน UX-1)
 *
 * ของเดิมเป็นเนื้อหายาวต่อกันลงมาทั้ง 4 ภารกิจในหน้าเดียว (สูงกว่าจอ 5 เท่า)
 * ผิดกฎห้ามเลื่อน และเด็กหาเรื่องที่อยากอ่านไม่เจอเพราะต้องไถผ่านของที่ไม่ได้หา
 *
 * รอบนี้เปลี่ยนเป็น **เลือกหัวข้อจากตาราง แล้วเปิดอ่านทีละเรื่องในแผ่นเลื่อน**
 * จอแรกเห็นครบทุกหัวข้อในหน้าจอเดียว เลือกแล้วค่อยเปิดอ่านเฉพาะเรื่องนั้น
 *
 * ## ของเดิมที่ต้องไม่พัง
 *
 * - `KnowledgeSearch` (ของ session frontend) ยังอยู่ครบ ย้ายไปอยู่ในแผ่น `sheet-search`
 *   ผลการค้นที่ยาวจึงเลื่อนอยู่ในแผ่น ไม่ดันให้ทั้งหน้าเลื่อน
 * - **ลิงก์ `#knowledge-m1..m4` ที่หน้าอื่นเรียกอยู่ยังใช้ได้เหมือนเดิม** และดีขึ้นด้วย
 *   เพราะ id เหล่านั้นตอนนี้คือ id ของแผ่นอ่าน เปิด `/knowledge#knowledge-m2`
 *   แล้วแผ่นภารกิจที่ 2 จะเลื่อนขึ้นมาให้ทันที ไม่ใช่แค่กระโดดไปกลางหน้า
 *
 * เนื้อหาทั้งหมดมาจาก `components/missions.ts` (อ่าน content/missions.json ที่ไม่มีเฉลย)
 * ⚠️ ห้ามพิมพ์หัวข้อหรือคำอธิบายเองในไฟล์นี้ และห้ามแสดง `check.choices` / `hints` ที่นี่
 */

/** ไอคอนประจำภารกิจ — ชุดเดียวกับหน้าแผนภารกิจ เด็กจะได้จำภาพเดิมข้ามหน้าได้ */
const MISSION_ICONS: Record<string, typeof TargetIcon> = {
  m1: GlobeIcon,
  m2: LightbulbIcon,
  m3: BagIcon,
  m4: UsersIcon,
}

export default async function KnowledgePage() {
  const session = await readStudentSession()
  if (!session) return <SignInGate message="ใส่รหัสห้องกับ PIN ที่ครูให้ก่อน แล้วคลังความรู้จะเปิดให้ทบทวนได้ไม่จำกัด" />

  const summary = await lessonSummary(session.studentId)
  const nextMission = summary.missions.find((m) => !m.passed) ?? null
  const primaryHref = nextMission ? `/mission/${nextMission.id}` : '/ceo'
  const primaryLabel = nextMission ? `กลับไปทำภารกิจ ${nextMission.title}` : 'ไปด่านบอส CEO ต่อ'
  const nowLine = nextMission
    ? 'ทบทวนจุดสำคัญแล้ว พร้อมนำความรู้ไปลองใช้ในภารกิจถัดไปได้เลยครับ'
    : 'ทบทวนได้ไม่จำกัด ไม่เสียดาว ลองสรุปสิ่งที่จำได้ก่อนออกจากหน้านี้นะครับ'

  return (
    <AppShell
      fit
      className="student-world student-display media-shell"
      header={
        <AppHeader className="pb-2">
          <div className="flex items-center gap-3">
            <h1 className="min-w-0 flex-1 truncate text-title-sm font-extrabold text-ink">คลังความรู้</h1>
            <span className="shrink-0 rounded-full bg-spark-100 px-3 py-1 text-note font-bold text-spark-700">
              ไม่เสียดาว
            </span>
          </div>
          {/* กฎบอกทางข้อ 1 — บอกวิธีใช้จอนี้ด้วยประโยคสั่งงาน ไม่ใช่คำโปรย */}
          <p className="mt-1 text-note text-ink-muted">
            แตะหัวข้อที่อยากทบทวน แล้วแผ่นอ่านจะเลื่อนขึ้นมา · เปิดกี่รอบก็ได้
          </p>
        </AppHeader>
      }
      footer={
        <>
          <AppFooter divider={false} className="pb-2">
            <div className="mb-2 flex items-center gap-2">
              <DomeAvatar mood="explain" size={44} decorative />
              <SpeechBubble speaker="dome" tail="left" className="min-w-0 flex-1 px-3 py-2">
                <span className="line-clamp-2 text-label font-bold text-ink">{nowLine}</span>
              </SpeechBubble>
            </div>
            <Link href={primaryHref} className="btn-go">
              {primaryLabel}
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
          </AppFooter>
          <BottomNav />
        </>
      }
    >
      <div className="relative isolate flex h-full min-h-0 flex-col gap-2 scene-sky scene-dots px-4 pt-2 pb-1">
        <SceneDecor density="full" />
        {missions.length === 0 ? (
          /* กฎบอกทางข้อ 4 — จอว่างต้องบอกเหตุผลและบอกว่าต้องทำอะไรถึงจะมีของ */
          <div className="my-auto rounded-2xl bg-surface-raised p-5 text-center shadow-soft-1">
            <p className="text-body font-bold text-ink">ยังไม่มีเนื้อหาในคลังความรู้</p>
            <p className="mt-1 text-label text-ink-muted">
              ครูยังไม่เปิดเนื้อหาของคาบนี้ ไม่ต้องทำอะไรเพิ่ม เปิดเมื่อไรหน้านี้จะขึ้นเอง
            </p>
          </div>
        ) : (
          <>
            {/* ตารางหัวข้อ — หนึ่งช่องต่อหนึ่งภารกิจ เห็นครบในจอเดียว ไม่ต้องไถหา
                แต่ละช่องคือปุ่มเปิดแผ่นอ่านที่มี id = knowledge-<รหัสภารกิจ> */}
            <ul className="grid min-h-0 flex-1 grid-cols-2 gap-2">
              {missions.map((mission, index) => {
                const Icon = MISSION_ICONS[mission.id] ?? TargetIcon
                const cardCount = mission.channels.card.cards.length
                const pointCount = mission.channels.clip.keyPoints.length
                return (
                  <li key={mission.id} className="min-h-0">
                    <Sheet
                      id={`knowledge-${mission.id}`}
                      triggerVariant="card"
                      triggerIcon={
                        <span
                          aria-hidden="true"
                          className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700"
                        >
                          <Icon width={24} height={24} />
                        </span>
                      }
                      trigger={
                        <span className="block">
                          <span className="block text-note font-bold text-brand-700">
                            ภารกิจที่ {index + 1}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-label font-extrabold text-ink">
                            {mission.title}
                          </span>
                          <span className="mt-0.5 block text-note text-ink-muted">
                            {cardCount} การ์ด · {pointCount} สรุปสั้น
                          </span>
                        </span>
                      }
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
                                  <ChevronRightIcon
                                    width={20}
                                    height={20}
                                    aria-hidden
                                    className="transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none"
                                  />
                                </span>
                              </summary>
                              <p className="border-t border-line pt-3 pb-3 text-body text-pretty text-ink">
                                {card.back}
                              </p>
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

                      <Link
                        href={`/mission/${mission.id}`}
                        className="btn-base mt-5 min-h-12 w-full rounded-xl bg-brand-600 text-body font-bold text-ink-onbrand"
                      >
                        ไปทำภารกิจนี้
                        <ChevronRightIcon width={20} height={20} aria-hidden />
                      </Link>
                    </Sheet>
                  </li>
                )
              })}
            </ul>

            {/* ช่องค้นหาอยู่ในแผ่นของตัวเอง ผลการค้นที่ยาวจึงเลื่อนอยู่ในแผ่น ไม่ดันทั้งหน้า
                ⚠️ ดัชนีต้องส่งเข้าไปทาง props เท่านั้น ห้ามให้ฝั่งเบราว์เซอร์ import ตัวประกอบดัชนีเอง
                   เพราะมันลาก content/missions.json (ซึ่งมีคำใบ้) เข้าบันเดิลไปด้วย */}
            <div className="shrink-0">
              <Sheet
                id="sheet-search"
                triggerIcon={<KnowledgeIcon width={20} height={20} aria-hidden className="shrink-0" />}
                trigger="ค้นหาคำที่อยากทบทวน"
                title="ค้นหาในคลังความรู้"
                triggerClassName="gap-2"
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
