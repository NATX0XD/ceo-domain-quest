import type { Metadata } from 'next'
import Link from 'next/link'
import { getStudent, listPeerFeedbackFor, listSubmissions } from '@/lib/db/repo'
import { SignInGate } from '@/components/student-shell'
import { AppFooter, AppHeader, AppShell } from '@/components/app-shell'
import { BottomNav } from '@/components/bottom-nav'
import { ShowcaseBoard, ShowcaseFeedbackForm } from '@/components/showcase-client'
import {
  Card,
  CheckIcon,
  ChevronRightIcon,
  DomeAvatar,
  LightbulbIcon,
  SendIcon,
  SceneDecor,
  Sheet,
  SpeechBubble,
  UsersIcon,
} from '@/components/ui'
import { readStudentSession } from '@/app/api/_lib/session-cookie'

export const metadata: Metadata = { title: 'ผลงานของเพื่อน — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * ขั้นที่ 5 ดูผลงานเพื่อน (นาทีที่ 50-55)
 *
 * ## จบในจอเดียว
 *
 * ของยาวของหน้านี้คือรายการที่ยาวเท่าไหร่ก็ได้ (ผลงานเพื่อนทั้งห้อง · ความเห็นที่เพื่อนเขียนถึงเรา)
 * จึงย้ายไปอยู่ในแผ่นเลื่อนขึ้นจากด้านล่าง ส่วนจอหลักเหลือ **ป้ายชื่อเว็บของเราเอง**
 * ซึ่งเป็นของที่เจ้าของภูมิใจที่สุดและเป็นของที่ถูกฉายบนเวที
 *
 * ⚠️ ห้ามแสดงคะแนนหรือดาวของเพื่อนเด็ดขาด แสดงแค่ผลงาน ไม่เอาผู้เรียนมาเทียบกัน
 * ⚠️ ผลงานของเพื่อนอ่านผ่าน GET /api/me/showcase เท่านั้น (SQL function classroom_showcase
 *    เลือกมาแค่ ชื่อเล่น · โดเมน · นามสกุล · เหตุผล) ห้ามเพิ่มดาวหรือคะแนนเข้าไปในหน้านี้
 */
export default async function ShowcasePage() {
  const session = await readStudentSession()
  if (!session) {
    return <SignInGate message="ใส่รหัสห้องกับ PIN ที่ครูให้ก่อน แล้วจะเห็นผลงานของเพื่อนทั้งห้อง" />
  }

  const [student, mine, allFeedback] = await Promise.all([
    getStudent(session.studentId),
    listSubmissions(session.studentId),
    listPeerFeedbackFor(session.studentId),
  ])

  /**
   * T-09 ครูซ่อนความเห็นที่ไม่เหมาะสมได้ — ที่ถูกซ่อนต้องไม่โผล่ให้ผู้เรียนเห็น
   * ข้อความต้นฉบับยังอยู่ในฐานข้อมูล ครูกดเลิกซ่อนได้ (ไม่ได้ลบทิ้ง)
   */
  const feedback = allFeedback.filter((row) => row.hidden_at === null)

  // ใบล่าสุดคือแถวแรก (listSubmissions เรียง created_at DESC) — สำคัญเมื่อมีการแก้งานหลายฉบับ
  const myWork = mine.find((row) => row.emphasis_criterion !== null) ?? mine[0] ?? null

  const nowLine = myWork
    ? 'เปิดดูงานเพื่อนแล้วเขียนชมเขาสักคนครับ ชมตรง ๆ ว่าชอบตรงไหน'
    : 'ยังไม่มีผลงานของเราขึ้นกระดาน ส่งใบเสนอที่ด่านบอสก่อนครับ แต่ดูงานเพื่อนได้เลย'

  return (
    <AppShell
      fit
      header={
        <AppHeader className="pb-2" backHref="/home">
          <div className="flex items-center gap-3">
            <h1 className="min-w-0 flex-1 truncate text-title-sm font-extrabold text-ink">
              ผลงานของห้องเรา
            </h1>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-note font-bold text-brand-700">
              <UsersIcon width={15} height={15} aria-hidden />
              ขั้นที่ 5 · นาทีที่ 50-55
            </span>
          </div>
          <p className="mt-1 text-note text-ink-muted">
            หน้านี้มีแต่ผลงาน ไม่มีการจัดอันดับ และไม่เอาใครมาเทียบกัน
          </p>
        </AppHeader>
      }
      footer={
        <>
          <AppFooter divider={false} className="pb-2">
            <div className="mb-2 flex items-center gap-2">
              <DomeAvatar mood="greet" size={44} decorative />
              <SpeechBubble speaker="dome" tail="left" className="min-w-0 flex-1 px-3 py-2">
                <span className="break-words text-label font-bold text-ink">{nowLine}</span>
              </SpeechBubble>
            </div>
            <Link href="/posttest" className="btn-go">
              แบบทดสอบหลังเรียน
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
          </AppFooter>
          <BottomNav />
        </>
      }
    >
      <div className="relative isolate flex h-full min-h-0 flex-col gap-2 scene-sky px-4 pt-2 pb-1">
        <SceneDecor density="full" />
        {/* ป้ายชื่อเว็บของเรา — พระเอกของจอ กินพื้นที่ที่เหลือทั้งหมด */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-surface-raised shadow-soft-2">
          <div className="flex shrink-0 items-center gap-2 border-b border-brand-100 px-4 py-2">
            <span aria-hidden className="size-2.5 rounded-full bg-danger-500" />
            <span aria-hidden className="size-2.5 rounded-full bg-reward-500" />
            <span aria-hidden className="size-2.5 rounded-full bg-quest-500" />
            <span className="ml-1 text-note font-semibold text-ink-subtle">ชื่อเว็บของฉัน</span>
          </div>

          {myWork ? (
            <div className="flex min-h-0 flex-1 flex-col justify-center px-5 py-3 text-center">
              {/**
               * ⚠️ ขนาดผูกกับความกว้างจอ ไม่ใช่ค่าคงที่ — ตั้ง 36px ตายตัวแล้ววัดจริงบนจอ 390
               *    พบว่า "faisaichicken.com" ตกบรรทัดกลางคำเป็น "faisaichicken.co / m" ซึ่งอ่านเหมือนพิมพ์ผิด
               * ตัดคำแบบ break-all เพราะโดเมนไม่มีช่องว่างให้เบราว์เซอร์ตัด ถ้าไม่บังคับจะดันการ์ดกว้างเกินจอ
               */}
              <p className="text-[clamp(1.375rem,6.4vw,2.25rem)] leading-tight font-black break-all text-brand-700">
                {myWork.domain_name}
                {myWork.tld}
              </p>
              <span aria-hidden="true" className="mx-auto mt-2 block h-1 w-16 rounded-full bg-reward-500" />
              {myWork.reason_text ? (
                <p className="mt-2 line-clamp-4 text-left text-label whitespace-pre-line text-pretty text-ink">
                  {myWork.reason_text}
                </p>
              ) : null}
            </div>
          ) : (
            /* จอว่างต้องบอกเหตุผลและทางไปต่อ ไม่ใช่ปล่อยว่าง */
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 text-center">
              <p className="text-body font-bold text-ink">ยังไม่มีผลงานที่ส่ง</p>
              <p className="mt-1 text-label text-ink-muted">
                ไปยื่นชื่อเว็บที่ภารกิจที่ 3 หรือส่งใบเสนอที่ด่านบอสก่อน แล้วผลงานจะมาโผล่ตรงนี้
              </p>
              <Link href="/ceo" className="btn-base mt-3 rounded-xl bg-brand-100 px-4 text-label font-bold text-brand-700">
                ไปด่านบอส CEO
              </Link>
            </div>
          )}
        </div>

        <nav aria-label="ดูและเขียนถึงเพื่อน" className="chip-row shrink-0 justify-center">
          <Sheet
            id="sheet-peers"
            triggerVariant="chip"
            triggerIcon={<UsersIcon width={18} height={18} aria-hidden />}
            trigger="ผลงานเพื่อน"
            title="ผลงานของเพื่อนในห้อง"
          >
            <p className="text-label text-ink-muted">
              อ่านไอเดียเพื่อนได้เลย แผ่นนี้แสดงเฉพาะชื่อเว็บกับเหตุผล ไม่มีการจัดอันดับ
            </p>
            <div className="mt-3">
              <ShowcaseBoard />
            </div>
          </Sheet>

          <Sheet
            id="sheet-praise"
            triggerVariant="chip"
            triggerIcon={<SendIcon width={18} height={18} aria-hidden />}
            trigger="เขียนชมเพื่อน"
            title="เขียนถึงเพื่อน"
            triggerClassName="bg-quest-100 text-quest-700 hover:bg-quest-200"
          >
            <ShowcaseFeedbackForm myNickname={student?.nickname ?? ''} />
          </Sheet>

          <Sheet
            id="sheet-inbox"
            triggerVariant="chip"
            triggerIcon={<CheckIcon width={18} height={18} aria-hidden />}
            trigger={`เพื่อนเขียนถึงเรา ${feedback.length}`}
            title="ความเห็นที่เพื่อนเขียนถึงเรา"
            triggerClassName="bg-reward-100 text-reward-700 hover:bg-reward-300"
          >
            {feedback.length === 0 ? (
              <div className="rounded-xl bg-surface-sunken p-4">
                <p className="text-body font-bold text-ink">ยังไม่มีใครเขียนถึงเรา</p>
                <p className="mt-1 text-label text-ink-muted">
                  ระหว่างรอ ลองไปอ่านงานเพื่อนแล้วเขียนชมเขาก่อนก็ได้
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {feedback.map((f) => (
                  /* แถบสีซ้ายของการ์ด บอกว่าเป็นคำชม (เขียว) หรือมีข้อเสนอแนะ (ส้ม) */
                  <Card
                    as="li"
                    key={f.id}
                    className={`border-l-4 ${f.praise_text ? 'border-quest-500' : 'border-spark-500'}`}
                  >
                    {f.praise_text ? (
                      <p className="flex items-start gap-2 text-body text-pretty text-quest-700">
                        <CheckIcon width={20} height={20} aria-hidden className="mt-1 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="font-bold">ชม:</span> {f.praise_text}
                        </span>
                      </p>
                    ) : null}
                    {f.suggest_text ? (
                      <p
                        className={`flex items-start gap-2 text-body text-pretty text-ink ${
                          f.praise_text ? 'mt-2' : ''
                        }`}
                      >
                        <LightbulbIcon width={20} height={20} aria-hidden className="mt-1 shrink-0 text-spark-600" />
                        <span className="min-w-0 flex-1">
                          <span className="font-bold">เสนอแนะ:</span> {f.suggest_text}
                        </span>
                      </p>
                    ) : null}
                  </Card>
                ))}
              </ul>
            )}
          </Sheet>
        </nav>
      </div>
    </AppShell>
  )
}
