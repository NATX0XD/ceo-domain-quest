import type { Metadata } from 'next'
import { DomeAvatar } from '@/components/ui'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody, PageHead } from '../_ux/page-head'
import { DemoModeBanner } from '../demo-mode'
import { InfoTip, Kpi, KpiGrid } from '../_ux/v2'

export const metadata: Metadata = { title: 'โหมดสาธิต — สำหรับครู' }
export const dynamic = 'force-dynamic'

/**
 * E-16 โหมดสาธิต — ห้องหุ่นสำหรับขึ้นเวที
 * ห้องเรียนจริงกดล้างไม่ได้ **บังคับที่ฐานข้อมูล** ไม่ใช่แค่ซ่อนปุ่ม (RPC `reset_demo_classroom`)
 */
export default async function TeacherDemoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const data = await loadTeacherPage(await searchParams)
  if (!data) return <TeacherSignedOut title="โหมดสาธิต" />

  return (
    <PageBody>
      <PageHead title="โหมดสาธิต" subtitle="ห้องหุ่นสำหรับซ้อมและขึ้นเวที" />

      <div className="t2-stack">
        <DemoModeBanner
          classroomId={data.selectedId}
          roomCode={data.selectedRoomCode}
          isDemo={data.selectedIsDemo}
          showReset
        />

        {!data.selectedIsDemo ? (
          <section className="t2-card flex flex-wrap items-center gap-4">
            <DomeAvatar mood="greet" size={64} decorative />
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-1 text-title-sm font-extrabold text-ink">
                ห้อง {data.selectedRoomCode ?? '—'} ไม่ใช่ห้องสาธิต
                <InfoTip
                  label="เรื่องห้องสาธิต"
                  text="ปุ่มล้างกลับค่าเริ่มต้นมีเฉพาะห้องที่ติดป้ายห้องสาธิตตั้งแต่สร้าง ห้องเรียนจริงกดล้างไม่ได้เพราะฐานข้อมูลปฏิเสธคำสั่งเอง ต้องการห้องสาธิต ให้ผู้ดูแลรัน npm run seed:demo หนึ่งครั้ง จะได้ห้อง QUEST9 พร้อมนักเรียนหุ่น 20 คน"
                />
              </h2>
              <p className="mt-1 text-label font-semibold text-ink-muted">ห้องจริงกดล้างไม่ได้</p>
            </div>
          </section>
        ) : null}

        <KpiGrid cols={3}>
          <Kpi label="ซ้อมก่อนขึ้นเวที" value="ปลอดภัย" tone="mint" icon="rocket" hint="กดได้ทุกปุ่ม ไม่กระทบห้องจริง" />
          <Kpi label="สาธิตให้กรรมการ" value="ข้อมูลครบ" tone="yellow" icon="trophy" hint="ทุกหน้ามีของให้ดู" />
          <Kpi label="เสร็จแล้วล้าง" value="กลับเดิม" tone="lilac" icon="counterclockwise-arrows-button" hint="เหมือนตอนซ้อมเป๊ะ" />
        </KpiGrid>
      </div>
    </PageBody>
  )
}
