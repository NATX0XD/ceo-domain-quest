import type { Metadata } from 'next'
import { Card, DomeAvatar } from '@/components/ui'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody, PageHead } from '../_ux/page-head'
import { DemoModeBanner } from '../demo-mode'

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
      <PageHead
        title="โหมดสาธิต"
        subtitle="ห้องหุ่นสำหรับซ้อมและขึ้นเวที · ล้างกลับค่าเริ่มต้นได้ในไม่กี่วินาที"
      />

      <div className="flex flex-col gap-4">
        <DemoModeBanner
          classroomId={data.selectedId}
          roomCode={data.selectedRoomCode}
          isDemo={data.selectedIsDemo}
          showReset
        />

        {!data.selectedIsDemo ? (
          <Card as="section">
            <div className="flex items-start gap-3">
              <DomeAvatar mood="greet" size={56} decorative />
              <div className="min-w-0">
                <h2 className="text-title-sm font-bold text-ink">
                  ห้อง {data.selectedRoomCode ?? '—'} ไม่ใช่ห้องสาธิต
                </h2>
                <p className="mt-1 text-body text-ink-muted">
                  หน้านี้จะมีปุ่ม “ล้างกลับค่าเริ่มต้น” ให้เฉพาะห้องที่ติดป้ายว่าเป็นห้องสาธิตตั้งแต่ตอนสร้าง
                  <strong> ห้องเรียนจริงกดล้างไม่ได้เลย</strong> เพราะฐานข้อมูลปฏิเสธคำสั่งนั้นเอง
                  ไม่ใช่แค่ซ่อนปุ่มบนจอ
                </p>
                <p className="mt-2 text-label text-ink-muted">
                  ต้องการห้องสาธิต: ให้ผู้ดูแลระบบรัน <code>npm run seed:demo</code> หนึ่งครั้ง
                  จะได้ห้อง QUEST9 พร้อมนักเรียนหุ่น 20 คนที่มีสถานะครบทุกแบบ
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        <Card as="section">
          <h2 className="text-title-sm font-bold text-ink">ใช้ตอนไหน</h2>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-body text-ink">
            <li>ซ้อมก่อนขึ้นเวที — กดทุกปุ่มได้โดยไม่กระทบห้องเรียนจริง</li>
            <li>สาธิตให้กรรมการดู — ทุกหน้ามีข้อมูลให้ดูครบ ไม่มีจอว่าง</li>
            <li>กดล้างกลับค่าเริ่มต้นเมื่อสาธิตเสร็จ ห้องจะกลับไปเหมือนตอนซ้อมเป๊ะ</li>
          </ul>
          <p className="mt-3 text-label font-bold text-danger-700">
            ตัวเลขจากห้องสาธิตเป็นข้อมูลหุ่น ห้ามนำไปอ้างเป็นผลการทดลอง
          </p>
        </Card>
      </div>
    </PageBody>
  )
}
