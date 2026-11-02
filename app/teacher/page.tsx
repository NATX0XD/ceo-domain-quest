import type { Metadata } from 'next'
import { getClassroomReportRaw, listPendingReview } from '@/lib/db/repo'
import { TeacherLoginClient } from '@/components/teacher-login-client'
import { readTeacherSession } from '@/app/api/_lib/session-cookie'
import { loadTeacherPage, type SearchParams } from './_lib/teacher-page'
import Link from 'next/link'

export const metadata: Metadata = { title: 'สำหรับครู — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/** Home is intentionally read-only: students set their own pace and the teacher reviews progress. */
/**
 * หน้าเข้าสู่ระบบของครู — ฟอร์มเดิม + ทางออกเมื่อเข้าไม่ได้ (flow-1 ข้อ 26)
 * ของเดิมมีแค่ช่องอีเมล/รหัสผ่าน ครูที่จำรหัสไม่ได้ในวันแข่งไปต่อไม่ได้เลย
 */
function TeacherSignInScreen() {
  return (
    <div className="teacher-auth-route">
      <TeacherLoginClient />
    </div>
  )
}

export default async function TeacherPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await readTeacherSession()
  if (!session) return <TeacherSignInScreen />

  const data = await loadTeacherPage(await searchParams)
  if (!data) return <TeacherSignInScreen />

  const [pending, raw] = data.selectedId
    ? await Promise.all([
        listPendingReview(data.teacherId, data.selectedId),
        getClassroomReportRaw(data.teacherId, data.selectedId).catch(() => null),
      ])
    : [null, null]

  return (
    <div className="teacher-page-body">
      <header className="t2-head">
        <div><p className="t2-kicker">ภาพรวมแบบเรียนด้วยตนเอง</p><h1 className="t2-title">ห้องเรียนของคุณ</h1><p className="t2-sub">ดูความคืบหน้าของแต่ละคนได้ทันที โดยไม่ต้องเปิดช่วงหรือจับเวลาให้ทั้งห้อง</p></div>
        <div className="flex flex-wrap gap-2"><Link href={`/teacher/missions${data.selectedId ? `?classroomId=${data.selectedId}` : ''}`} className="t2-btn" data-kind="primary">ตั้งค่าด่าน</Link><Link href={`/teacher/report${data.selectedId ? `?classroomId=${data.selectedId}` : ''}`} className="t2-btn">ดูรายงานห้อง</Link></div>
      </header>
      <div className="t2-grid t2-overview-kpis">
        <article className="t2-card"><p className="t2-kpi__label">ผู้เรียนในห้อง</p><p className="t2-kpi__value">{raw?.students.length ?? 0} <small>คน</small></p><p className="t2-sub">ห้อง {data.selectedRoomCode ?? 'ยังไม่มีรหัส'}</p></article>
        <article className="t2-card"><p className="t2-kpi__label">ส่งงาน CEO แล้ว</p><p className="t2-kpi__value">{raw?.students.filter((student) => student.submission !== null).length ?? 0} <small>คน</small></p><p className="t2-sub">พร้อมไปทำแบบทดสอบหลังเรียน</p></article>
        <article className="t2-card"><p className="t2-kpi__label">งานรอตรวจ</p><p className="t2-kpi__value">{pending?.length ?? 0} <small>รายการ</small></p><p className="t2-sub">ดูและยืนยันคะแนนได้ที่งานรอตรวจ</p></article>
      </div>
      <section className="t2-card t2-overview-roster" aria-label="ความคืบหน้ารายคน">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="t2-card-title">ความคืบหน้ารายคน</h2><p className="t2-sub">ข้อมูลนี้เป็นภาพรวมแบบอ่านอย่างเดียว · กดชื่อเพื่อเปิดรายงานรายคน</p></div><span className="t2-chip">อัปเดตจากข้อมูลล่าสุด</span></div>
        {!raw || raw.students.length === 0 ? <p className="t2-empty">ยังไม่มีผู้เรียนในห้องนี้</p> : <div className="t2-overview-table-wrap"><table className="t2-overview-table"><thead><tr><th>ผู้เรียน</th><th>ความคืบหน้า</th><th>ก่อนเรียน</th><th>สถานะงาน</th><th /></tr></thead><tbody>{raw.students.map((student) => { const cleared = student.missions.filter((mission) => mission.passed).length + (student.submission ? 1 : 0); const percent = Math.round((cleared / 5) * 100); return <tr key={student.studentId}><th scope="row"><span className="t2-avatar" data-level="green">{student.nickname.slice(0, 1)}</span><span>{student.nickname}</span></th><td><div className="t2-progress"><span style={{ width: `${percent}%` }} /></div><small>{cleared}/5 ด่าน · {percent}%</small></td><td>{student.profile?.preTestScore === null || student.profile?.preTestScore === undefined ? 'ยังไม่ทำ' : `${student.profile.preTestScore} คะแนน`}</td><td>{student.submission ? <span className="t2-chip" data-tone="mint">ส่ง CEO แล้ว</span> : <span className="t2-chip">กำลังเรียน</span>}</td><td><Link className="t2-text-link" href={`/teacher/student?classroomId=${data.selectedId}&studentId=${student.studentId}`}>เปิดรายงาน</Link></td></tr> })}</tbody></table></div>}
      </section>
      <section className="t2-note" data-tone="sky"><span><strong>โหมดเรียนด้วยตนเอง</strong> ผู้เรียนเริ่มด่านและทำแบบทดสอบได้ตามความพร้อมของตัวเอง ครูมีหน้าที่ติดตาม ตรวจยืนยัน และปรับค่าด่านรายห้อง</span></section>
    </div>
  )
}
