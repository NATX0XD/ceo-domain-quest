import type { ReactNode } from 'react'
import Link from 'next/link'
import { listClassroomsByTeacher, type Classroom } from '@/lib/db/repo'
import { readTeacherSession } from '@/app/api/_lib/session-cookie'
import { AppShell } from '@/components/app-shell'
import { DemoModeBanner } from '../demo-mode'
import { PageBody, PageHead } from '../_ux/page-head'

/**
 * โครงร่วมของหน้าครูหน้าใหม่ ๆ (แผงห้องเรียนสด · รายงานรายห้อง · รายงานรายคน)
 *
 * ทุกหน้าใช้ `AppShell` ตัวเดียวกับทั้งระบบ — สูง 100dvh หัวกับแถบล่างอยู่กับที่
 * เลื่อนได้ชั้นเดียวคือเนื้อหา · หน้าพวกนี้ไม่เขียนโครงเอง
 *
 * ⚠️ `teacherId` มาจากคุกกี้เท่านั้น ไม่เคยรับจาก query
 *    ตัวข้อมูลจริงทุกหน้าโหลดผ่าน API ที่ตรวจเจ้าของห้องซ้ำอีกชั้นในคิวรีเดียวกับที่อ่าน
 */

export interface TeacherPageData {
  teacherId: string
  classrooms: Classroom[]
  selectedId: string | null
  selectedRoomCode: string | null
  /** E-16 ห้องที่เลือกอยู่เป็นห้องสาธิต — ทุกหน้าต้องติดป้ายว่าไม่ใช่ข้อมูลเด็กจริง */
  selectedIsDemo: boolean
}

export type SearchParams = Record<string, string | string[] | undefined>

export function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** null = ยังไม่ได้เข้าสู่ระบบ (หน้าเรียกใช้ต้องพาไปหน้า /teacher) */
export async function loadTeacherPage(params: SearchParams): Promise<TeacherPageData | null> {
  const session = await readTeacherSession()
  if (!session) return null

  const classrooms = await listClassroomsByTeacher(session.teacherId)
  const asked = one(params.classroomId)
  // ห้องที่ขอมาต้องอยู่ในรายการของครูคนนี้จริง ไม่งั้นตกไปใช้ห้องล่าสุดของตัวเอง
  const selected = classrooms.find((c) => c.id === asked) ?? classrooms[0] ?? null

  return {
    teacherId: session.teacherId,
    classrooms,
    selectedId: selected?.id ?? null,
    selectedRoomCode: selected?.room_code ?? null,
    selectedIsDemo: selected?.is_demo ?? false,
  }
}

/** หน้าที่เปิดโดยยังไม่ได้เข้าสู่ระบบ — ไม่บอกว่าห้องไหนมีจริง แค่พากลับไปหน้าเข้าสู่ระบบ */
export function TeacherSignedOut({ title }: { title: string }) {
  return (
    <AppShell width="wide">
      <div className="px-4 py-10 text-center">
        <h1 className="text-title font-extrabold text-ink">{title}</h1>
        <p className="mt-2 text-body text-ink-muted">ต้องเข้าสู่ระบบเป็นครูก่อนถึงจะเปิดหน้านี้ได้</p>
        <Link
          href="/teacher"
          className="btn-base mt-5 inline-flex bg-brand-600 px-5 text-ink-onbrand shadow-soft-1"
        >
          ไปหน้าเข้าสู่ระบบของครู
        </Link>
      </div>
    </AppShell>
  )
}

export interface TeacherSubPageProps {
  data: TeacherPageData
  /** ชื่อหน้าใหญ่บนหัวจอ */
  title: string
  /** คำอธิบายสั้นใต้ชื่อหน้า */
  subtitle: string
  /** ไม่ได้ใช้แล้วตั้งแต่ UX-6 (แท็บสลับห้องย้ายไปอยู่แถบบนของแดชบอร์ด) */
  basePath?: string
  /** ปุ่มมุมขวาบน เช่น ปุ่มพิมพ์ */
  action?: ReactNode
  children: ReactNode
}

/**
 * หัวของหน้าย่อยในแดชบอร์ดครู (แผงห้องเรียนสด · รายงานรายห้อง · รายงานรายคน)
 *
 * UX-6: โครงแดชบอร์ด (แถบบน + เมนูข้าง + สลับห้อง + ออกจากระบบ) ย้ายไปอยู่ที่ `app/teacher/layout.tsx`
 * แล้ว หน้าย่อยจึงเหลือแค่ชื่อหน้ากับเนื้อหา — ถ้ายังใส่ `AppShell` ของตัวเองจะกลายเป็นโครงซ้อนโครง
 */
export function TeacherSubPage({ data, title, subtitle, action, children }: TeacherSubPageProps) {
  return (
    <PageBody>
      <PageHead title={title} subtitle={subtitle} action={action} />

      {/* E-16 ป้ายโหมดสาธิต — ขึ้นก่อนเนื้อหาเสมอ กรรมการจะได้ไม่เข้าใจว่าเป็นข้อมูลเด็กจริง */}
      <DemoModeBanner
        classroomId={data.selectedId}
        roomCode={data.selectedRoomCode}
        isDemo={data.selectedIsDemo}
      />
      {children}
    </PageBody>
  )
}
