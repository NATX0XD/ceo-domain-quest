import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { certificateData, studentReport, type MissionInput } from '@/core/report'
import { certificateFileName, renderCertificate } from '@/lib/certificate/render'
import { DEFAULT_COURSE_NAME } from '@/lib/certificate/data'
import { PRODUCT_NAME_EN, PRODUCT_NAME_TH } from '@/components/product'
import { loadThaiFonts, type ThaiFontSet } from '@/lib/certificate/font'
import { getProfile, getStudent, listMissionProgress, listSubmissions } from '@/lib/db/repo'
import { certificateEligibility } from '@/components/server/certificate-eligibility'
import { errorResponse, readStudentSession, unauthorized } from '../_lib/session-cookie'

/**
 * ใบประกาศ PDF ของนักเรียนคนที่ถือ cookie ใบนี้
 *
 * ⚠️ studentId อ่านจาก session cookie เท่านั้น **ห้ามรับจาก query หรือ body เด็ดขาด**
 *    ถ้ารับจาก query เด็กจะโหลดใบประกาศของเพื่อนได้ทั้งห้อง (docs/auth-and-roles.md หัวข้อ 6)
 *    พารามิเตอร์ที่ส่งมาทาง URL ถูกเมินทั้งหมดโดยตั้งใจ
 *
 * **มติเจ้าของโปรเจกต์ (T40): ออกใบให้เฉพาะคนที่ครูยืนยันแล้วว่าได้ระดับ 3 ขึ้นไปครบทั้ง 4 ด้าน**
 * (สเปกข้อ 2.3 Competency-Based Progression + ข้อ 1.6 จุดประสงค์ข้อ 5)
 * ยังไม่ครบ = 403 พร้อมบอกว่าเหลือด้านไหนและทำอะไรต่อ **ห้ามสื่อว่าตก — สเปกเขียนว่าไม่มีการตก ทำต่อได้**
 * เงื่อนไขตัดสินที่นี่ฝั่งเดียว หน้าเว็บแค่แสดงผล เดา URL ตรง ๆ ก็ไม่ได้ใบ
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** โหลดฟอนต์จากดิสก์ฝั่งเซิร์ฟเวอร์ครั้งเดียวต่อ process ไฟล์รวมกันราว 76 KB */
let fontCache: Promise<ThaiFontSet> | null = null

function serverFonts(): Promise<ThaiFontSet> {
  if (!fontCache) {
    fontCache = loadThaiFonts((fileName) =>
      readFile(path.join(process.cwd(), 'public', 'fonts', fileName)),
    )
  }
  return fontCache
}

/** ตั้งชื่อไฟล์ให้เบราว์เซอร์ — ชื่อไทยต้องส่งผ่าน filename* แบบ RFC 5987 ไม่งั้นได้ชื่อเพี้ยน */
function contentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, '_')
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

export async function GET() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')

  const student = await getStudent(session.studentId)
  if (!student) return unauthorized('ไม่พบข้อมูลนักเรียนคนนี้แล้ว ให้เข้าห้องใหม่')

  /**
   * ด่านเดียวที่ตัดสินว่าได้ใบหรือยัง — อยู่ก่อนการเรนเดอร์ PDF ทั้งหมด
   * ข้อความที่คืนกลับไปต้องบอกทางไปต่อเสมอ ไม่ใช่แค่บอกว่าไม่ได้
   */
  const standing = await certificateEligibility(session.studentId)
  if (!standing.eligible) {
    return errorResponse('not-yet', standing.message, 403, {
      status: standing.status,
      passedCount: standing.passedCount,
      totalCount: standing.totalCount,
      missing: standing.missing.map((d) => ({
        id: d.id,
        name: d.name,
        shortName: d.shortName,
        score: d.score,
        whatGetsYouThere: d.whatGetsYouThere,
      })),
      nextHref: standing.nextHref,
      nextLabel: standing.nextLabel,
    })
  }

  const [profile, missionRows, submissions] = await Promise.all([
    getProfile(session.studentId),
    listMissionProgress(session.studentId),
    listSubmissions(session.studentId),
  ])

  /**
   * ใบประกาศต้องอ้างชื่อเว็บจาก "ใบเสนอของภารกิจใหญ่" ก่อนเสมอ
   * listSubmissions เรียงใหม่สุดก่อน และในนั้นมีใบของสถานี B ปนอยู่ (ไม่มี emphasis_criterion)
   * ถ้าหยิบ [0] ดื้อ ๆ นักเรียนที่ยื่นจดทะเบียนทีหลังจะได้ใบประกาศที่อ้างชื่อผิดใบ
   */
  const submission =
    submissions.find((row) => row.emphasis_criterion !== null) ?? submissions[0] ?? null
  const missions: MissionInput[] = missionRows.map((row) => ({
    missionId: row.mission_id,
    objectiveId: row.mission_id,
    passed: row.passed_at !== null,
    stars: row.stars,
    route: (row.channel_used ?? profile?.learning_route ?? 'card') as MissionInput['route'],
  }))

  const report = studentReport(
    {
      studentId: student.id,
      nickname: student.nickname,
      shopName: profile?.business_name ?? '',
      // ใบเสนอ CEO ก่อนเสมอ ว่าง = ใช้ชื่อจากหน้าตั้งค่าร้าน (ไม่เอานามสกุลของใบเสนอไปต่อท้ายชื่อเดิม)
      domainName: submission?.domain_name?.trim() || profile?.domain_name || '',
      tldSuffix: submission?.domain_name?.trim() ? (submission.tld ?? '') : '',
      goal: profile?.goal_stars ?? 0,
      missions,
      preScore: profile?.pre_test_score ?? 0,
      postScore: profile?.post_test_score ?? 0,
      goalRaisedCount: profile?.goal_raised_count ?? 0,
      // ดาวที่บันทึกไว้ในโปรไฟล์คือค่าจริงของทั้งคาบ รวมภารกิจใหญ่ที่ไม่ได้อยู่ในตาราง mission_progress
      starsMax: 15,
    },
    Date.now(),
  )

  // ดาวรวมยึดตามที่ระบบบันทึกไว้ ถ้ามี เพราะภารกิจใหญ่ให้ดาวคนละทางกับภารกิจย่อย
  const starsTotal = profile?.earned_stars ?? report.starsTotal
  const data = certificateData({ ...report, starsTotal }, Date.now())

  // ชื่อผลงานบนใบประกาศ: อังกฤษเป็นหลัก ไทยเป็นชื่อรอง แล้วต่อท้ายด้วยชื่อวิชา (มติ T40)
  const pdf = renderCertificate(data, await serverFonts(), {
    courseName: `${PRODUCT_NAME_EN} · ${PRODUCT_NAME_TH} · ${DEFAULT_COURSE_NAME}`,
  })

  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(pdf.byteLength),
      'content-disposition': contentDisposition(certificateFileName(data)),
      // ใบประกาศเป็นข้อมูลรายบุคคล ห้ามให้ proxy หรือ CDN เก็บไว้แจกซ้ำ
      'cache-control': 'private, no-store',
    },
  })
}
