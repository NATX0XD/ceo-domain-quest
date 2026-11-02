import Link from 'next/link'
import { AppFooter, AppHeader, AppShell } from '@/components/app-shell'
import { ChevronRightIcon } from '@/components/ui'
import { PageStateCard, PageStateTip } from '@/components/page-state-card'

/**
 * จอกั้นภารกิจ: ยังไม่ได้ทำแบบทดสอบก่อนเรียน (ตัดสินที่เซิร์ฟเวอร์ใน components/server/pretest-required.ts)
 * ครูยังไม่เปิด = บอกให้รอ · เปิดแล้ว = ปุ่มหลักพาไป /pretest
 */
export function PretestGateScreen({ open }: { open: boolean }) {
  return (
    <AppShell
      className="student-world student-display media-shell"
      mainClassName="flex flex-col"
      header={
        <AppHeader backHref="/map">
          <h1>แบบทดสอบก่อนเรียน</h1>
        </AppHeader>
      }
      footer={
        <AppFooter>
          <Link
            href="/pretest"
            className="btn-quest bg-brand-600 text-ink-onbrand hover:bg-brand-700"
            data-testid="pretest-gate-cta"
          >
            {open ? 'ทำแบบทดสอบก่อนเรียน' : 'ไปหน้าแบบทดสอบ รอครูเปิด'}
            <ChevronRightIcon width={22} height={22} aria-hidden />
          </Link>
        </AppFooter>
      }
    >
      <div className="flex h-full min-h-0 w-full flex-col px-4 py-4" data-testid="pretest-gate">
        <PageStateCard
          art={open ? '/icons/3d/clipboard.webp' : '/icons/3d/locked.webp'}
          tone={open ? 'warm' : 'wait'}
          title={open ? 'ทำแบบทดสอบก่อนเรียนก่อนนะ' : 'รอครูเปิดแบบทดสอบก่อนเรียน'}
          body={
            open
              ? 'ทำแบบทดสอบก่อนเรียนให้เสร็จก่อน แล้วภารกิจทุกเกาะจะเปิดให้เล่น'
              : 'ภารกิจจะเปิดหลังทำแบบทดสอบก่อนเรียน ตอนนี้ครูยังไม่ได้เปิดแบบทดสอบ'
          }
        >
          <PageStateTip icon="/icons/3d/locked.webp">ภารกิจยังล็อกอยู่จนกว่าจะส่งแบบทดสอบก่อนเรียน</PageStateTip>
        </PageStateCard>
      </div>
    </AppShell>
  )
}
