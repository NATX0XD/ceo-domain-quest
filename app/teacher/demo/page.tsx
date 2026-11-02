import type { Metadata } from 'next'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody, PageHead } from '../_ux/page-head'
import { DemoModeBanner } from '../demo-mode'
import { Icon3d } from '../_ux/v2'
import { Card, StatTile } from '../_ux/ui'

const OPTIONS = [
  { label: 'ซ้อมก่อนขึ้นเวที', value: 'ปลอดภัย', icon: 'rocket', hint: 'กดได้ทุกปุ่ม ไม่กระทบห้องจริง' },
  { label: 'สาธิตให้กรรมการ', value: 'ข้อมูลครบ', icon: 'trophy', hint: 'ทุกหน้ามีของให้ดู' },
  { label: 'เสร็จแล้วล้าง', value: 'กลับเดิม', icon: 'counterclockwise-arrows-button', hint: 'เหมือนตอนซ้อมเป๊ะ' },
] as const

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

      <div className="grid gap-6">
        <DemoModeBanner
          classroomId={data.selectedId}
          roomCode={data.selectedRoomCode}
          isDemo={data.selectedIsDemo}
          showReset
        />

        {!data.selectedIsDemo ? (
          <Card
            title={`ห้อง ${data.selectedRoomCode ?? '—'} ไม่ใช่ห้องสาธิต`}
            tip="ปุ่มล้างกลับค่าเริ่มต้นมีเฉพาะห้องที่ติดป้ายห้องสาธิตตั้งแต่สร้าง ห้องเรียนจริงกดล้างไม่ได้เพราะฐานข้อมูลปฏิเสธคำสั่งเอง ต้องการห้องสาธิต ให้ผู้ดูแลรัน npm run seed:demo หนึ่งครั้ง จะได้ห้อง QUEST9 พร้อมนักเรียนหุ่น 20 คน"
          >
            <p className="text-[15px] text-[var(--c-ink-2)]">ห้องจริงกดล้างไม่ได้ เลือกห้องสาธิตจากตัวสลับห้องด้านบน</p>
          </Card>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          {OPTIONS.map((o) => (
            <StatTile key={o.label} label={o.label} value={o.value} hint={o.hint} icon={<Icon3d name={o.icon} size={28} />} />
          ))}
        </div>
      </div>
    </PageBody>
  )
}
