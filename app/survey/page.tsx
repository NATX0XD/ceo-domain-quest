import type { Metadata } from 'next'
import surveyJson from '@/content/survey.json'
import { SurveyClient, type SurveyItem } from '@/components/survey-client'
import { SignInGate } from '@/components/student-shell'
import { getActiveClassSession, getStudent, hasSubmittedSurvey } from '@/lib/db/repo'
import { readStudentSession } from '@/app/api/_lib/session-cookie'

export const metadata: Metadata = { title: 'แบบสอบถามความพึงพอใจ — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * S-40 แบบสอบถามความพึงพอใจ (หน้าจอ SC-16)
 *
 * ⚠️ คำตอบไม่ผูกกับชื่อผู้ตอบ — ฝั่ง DB เก็บใน survey_responses ที่ไม่มีคอลัมน์ student_id
 * ⚠️ ครูเป็นคนเปิด ค่าเริ่มต้นปิด (ตั้งค่าคาบ T-02 · คอลัมน์ class_sessions.survey_enabled)
 * ข้อคำถามทั้ง 10 ข้อมาจาก content/survey.json ห้ามพิมพ์คำถามซ้ำไว้ในหน้าจอ
 */
export default async function SurveyPage() {
  const session = await readStudentSession()
  if (!session) {
    return <SignInGate message="ใส่รหัสห้องกับรหัส 4 หลักก่อน แล้วค่อยกลับมาตอบแบบสอบถาม" />
  }

  const [student, done] = await Promise.all([
    getStudent(session.studentId),
    hasSubmittedSurvey(session.studentId),
  ])
  const classSession = student?.classroom_id
    ? await getActiveClassSession(student.classroom_id)
    : null
  const open = classSession?.survey_enabled === true

  return (
    <SurveyClient
      open={open}
      done={done}
      reason={
        open ? null : 'ครูยังไม่ได้เปิดแบบสอบถาม ถ้าอยากตอบให้บอกครูเปิดให้ หรือกลับมาตอบทีหลังก็ได้'
      }
      title={surveyJson.meta.title}
      note={surveyJson.meta.note}
      submitLabel={surveyJson.meta.submitButtonLabel}
      deferLabel={surveyJson.meta.deferButtonLabel}
      items={surveyJson.items as SurveyItem[]}
      scale={surveyJson.scale}
    />
  )
}
