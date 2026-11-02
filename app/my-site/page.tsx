import type { Metadata } from 'next'
import Link from 'next/link'
import { getStudent, listSubmissions } from '@/lib/db/repo'
import { SignInGate } from '@/components/student-shell'
import { AppFooter, AppHeader, AppShell } from '@/components/app-shell'
import { DomeAvatar, EmptyState, StarIcon } from '@/components/ui'
import { loadShopProfile } from '@/components/server/game-state'
import { readStudentSession } from '@/app/api/_lib/session-cookie'

export const metadata: Metadata = { title: 'เว็บไซต์ของฉัน — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * "เว็บไซต์ของฉัน" — รางวัลปลายทางของนักเรียน
 *
 * โดเมนที่เด็กเสนอยังไม่ได้จดจริง หน้านี้จึงเป็น **หน้าร้านจำลอง** ที่แปะชื่อโดเมนของเขาไว้บนแถบที่อยู่
 * เพื่อให้เห็นภาพว่า "ถ้าจดจริง เว็บของฉันจะหน้าตาแบบนี้" ไม่ใช่ลิงก์ออกไปข้างนอกที่กดแล้วไม่มีอะไร
 * ⚠️ ข้อมูลทุกตัวมาจากฐานข้อมูลของนักเรียนคนที่ถือคุกกี้ ห้ามฝังค่าตัวอย่าง
 */
export default async function MySitePage() {
  const session = await readStudentSession()
  if (!session) return <SignInGate message="เข้าห้องเรียนก่อน แล้วค่อยมาดูเว็บไซต์ของตัวเอง" />

  const [student, profile, submissions] = await Promise.all([
    getStudent(session.studentId),
    loadShopProfile(session.studentId),
    listSubmissions(session.studentId),
  ])

  // ใบเสนอของภารกิจใหญ่ก่อนเสมอ ถ้ายังไม่ส่งค่อยใช้ใบที่ยื่นจดทะเบียนไว้
  const submission =
    submissions.find((row) => row.emphasis_criterion !== null) ?? submissions[0] ?? null
  const domain = submission ? `${submission.domain_name}${submission.tld}` : null
  const shopName = profile?.shopName ?? null
  const reasons = (submission?.reason_text ?? '')
    .split('\n')
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line.length > 0)

  return (
    <AppShell
      // ยังไม่มีชื่อเว็บ = เนื้อหาสั้นมาก ถ้าไม่จัดกลางแนวตั้งจะเหลือพื้นที่ว่างครึ่งจอ
      className="student-world student-display media-shell my-site-world"
      mainClassName={domain === null ? 'grid place-items-center' : undefined}
      header={
        <AppHeader backHref="/home">
          <p className="eyebrow-chip">
            <StarIcon width={14} height={14} aria-hidden />
            รางวัลของฉัน
          </p>
          <h1 className="mt-1 text-title font-extrabold text-balance text-ink">เว็บไซต์ของฉัน</h1>
        </AppHeader>
      }
      footer={
        <AppFooter className="flex flex-col gap-2">
          {/* ปุ่มหลักหนึ่งเดียวของหน้า ขึ้นกับว่ามีชื่อเว็บแล้วหรือยัง */}
          {domain === null ? (
            <Link
              href="/map"
              className="btn-quest bg-brand-600 text-ink-onbrand hover:bg-brand-700"
            >
              ไปดูแผนภารกิจ
            </Link>
          ) : (
            <Link
              href="/result"
              className="btn-quest bg-brand-600 text-ink-onbrand hover:bg-brand-700"
            >
              กลับไปหน้าเกียรติบัตร
            </Link>
          )}
          <Link
            href="/rewards"
            className="btn-base w-full rounded-xl bg-surface-raised px-5 text-body font-bold text-brand-700 ring-2 ring-brand-100 ring-inset"
          >
            ดูรางวัลและดาวของฉัน
          </Link>
        </AppFooter>
      }
    >
      <div className="w-full px-4 pt-4 pb-6">
      {domain === null ? (
        <div className="flex flex-col items-center gap-4">
          <DomeAvatar mood="greet" size={112} decorative />
          <EmptyState
            as="h2"
            title="ยังไม่มีชื่อเว็บที่ส่ง"
            description="ไปยื่นจดชื่อเว็บที่ภารกิจที่ 3 หรือส่งใบเสนอที่ด่านบอสก่อน แล้วกลับมาดูหน้านี้ได้เลย"
            className="w-full"
          />
        </div>
      ) : (
        <>
          {/* หน้าจอเบราว์เซอร์จำลอง — แถบที่อยู่โชว์โดเมนที่เด็กคิดเอง */}
          <div className="my-site-browser game-card overflow-hidden rounded-2xl bg-surface-raised shadow-soft-2 ring-1 ring-line ring-inset">
            <div className="flex items-center gap-2 bg-surface-sunken px-3 py-2">
              <span aria-hidden className="size-2.5 rounded-full bg-danger-500" />
              {/* bg-warn-500 เดิมไม่ใช่โทเคนที่มีอยู่จริงในระบบ จุดนี้จึงไม่มีสีเลย */}
              <span aria-hidden className="size-2.5 rounded-full bg-reward-500" />
              <span aria-hidden className="size-2.5 rounded-full bg-quest-500" />
              <span className="ml-2 min-w-0 flex-1 truncate rounded-md bg-surface-raised px-3 py-1 text-label font-bold text-ink">
                {domain}
              </span>
            </div>

            {/* แบนเนอร์หัวเว็บจำลอง — ให้เห็นภาพว่า "เว็บของเราจะมีหน้าตาแบบนี้"
                ไม่ใช่กล่องข้อความบนพื้นขาวธรรมดา */}
            <div className="panel-hero rounded-none px-5 py-7 text-center">
              <span aria-hidden="true" className="panel-hero-glow" />
              <p className="relative text-title font-black text-balance">
                {shopName ?? 'ร้านของฉัน'}
              </p>
              <p className="relative mt-1 text-label opacity-90">ยินดีต้อนรับสู่เว็บไซต์ของร้านเรา</p>
            </div>

            <div className="px-5 py-5">
              {reasons.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {reasons.map((reason, i) => (
                    <li
                      key={reason}
                      className="flex items-start gap-3 rounded-xl bg-surface-sunken p-3 text-label text-pretty text-ink"
                    >
                      {/* เลขกำกับ ทำให้ "เหตุผล 3 ข้อ" อ่านออกว่าเป็นชุดเหตุผล ไม่ใช่ย่อหน้าซ้อนกัน */}
                      <span
                        aria-hidden="true"
                        className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-100 text-note font-black text-brand-700"
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">{reason}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <p className="mt-4 text-center text-note text-ink-muted">
                หน้านี้เป็นตัวอย่างว่าเว็บของเราจะหน้าตาแบบไหน ถ้าจดชื่อนี้จริงกับผู้ให้บริการ
              </p>
            </div>
          </div>

          <p className="mt-4 text-label text-pretty text-ink-muted">
            ชื่อนี้ {student?.nickname ? `${student.nickname} ` : ''}คิดเองและอธิบายเหตุผลเองทั้งหมด
          </p>
        </>
      )}
      </div>
    </AppShell>
  )
}
