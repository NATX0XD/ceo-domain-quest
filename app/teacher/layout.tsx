import { Suspense, type ReactNode } from 'react'
import { listClassroomsByTeacher } from '@/lib/db/repo'
import { getServiceClient } from '@/lib/db/client'
import { readTeacherSession } from '@/app/api/_lib/session-cookie'
import { TeacherShell } from './_ux/shell'
import './teacher-v2.css'

/**
 * UX-6 โครงเดียวของทุกหน้าครู — แถบบน + เมนูข้าง อยู่กับที่ เนื้อหาเปลี่ยนตามหน้า
 *
 * มติเจ้าของ: ฝั่งครูเป็นแดชบอร์ดเต็มรูปแบบ ไม่ต้องยัดทุกอย่างลงจอเดียว
 * เข้าหน้าไหนก็ยังเห็นเมนู ห้องที่เปิดอยู่ ช่วงของคาบ และปุ่มออกจากระบบ
 *
 * ⚠️ ยังไม่ได้เข้าสู่ระบบ = ไม่ใส่โครงให้ ปล่อยให้หน้าข้างในพาไปเข้าสู่ระบบเอง
 *    (หน้า /teacher เรนเดอร์ฟอร์มเข้าสู่ระบบ ส่วนหน้าอื่นเรนเดอร์คำเตือน + ลิงก์กลับ)
 * ⚠️ `teacherId` มาจากคุกกี้เท่านั้น · รายชื่อห้องอ่านด้วย teacherId นั้น ครูคนอื่นจึงไม่เห็นห้องนี้
 */
export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const session = await readTeacherSession()
  if (!session) return <>{children}</>

  /**
   * อีเมลของครูไว้โชว์บนแถบบน — อ่านแถวของตัวเองด้วย `teacherId` จากคุกกี้เท่านั้น
   * (ไม่มีฟังก์ชันใน repo ที่อ่านแถวครูเดี่ยว ๆ และ lib/db อยู่นอกขอบเขตงานนี้)
   */
  const me = await getServiceClient()
    .from('teachers')
    .select('email, name')
    .eq('id', session.teacherId)
    .maybeSingle()

  const classrooms = await listClassroomsByTeacher(session.teacherId)
  // ห้องที่เปิดอยู่ขึ้นก่อน ครูจะได้ไม่ต้องไล่หาในกองห้องที่ปิดไปแล้ว
  const sorted = [...classrooms].sort((a, b) => {
    const rank = (status: string) => (status === 'open' ? 0 : status === 'locked' ? 1 : 2)
    return rank(a.status) - rank(b.status)
  })

  return (
    <Suspense fallback={<>{children}</>}>
      <TeacherShell
        teacherEmail={me.data?.name || me.data?.email || 'ครู'}
        classrooms={sorted.map((c) => ({
          id: c.id,
          roomCode: c.room_code,
          isDemo: c.is_demo,
          status: c.status,
        }))}
      >
        {children}
      </TeacherShell>
    </Suspense>
  )
}
