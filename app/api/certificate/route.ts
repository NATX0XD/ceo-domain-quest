import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { certificateData, studentReport, type MissionInput } from '@/core/report'
import { certificateFileName } from '@/lib/certificate/render'
import { renderGameCertificatePdf } from '@/lib/certificate/game'
import { loadCertArt, resolveCertTheme } from '@/lib/certificate/art'
import { certificateProgressOf } from '@/lib/certificate/progress'
import { lessonSummary } from '@/components/server/lesson-progress'
import { loadThaiFonts, type ThaiFontSet } from '@/lib/certificate/font'
import { getProfile, getStudent, listMissionProgress, listSubmissions } from '@/lib/db/repo'
import { certificateEligibility } from '@/components/server/certificate-eligibility'
import { certificateDomain } from '@/components/server/showcase-safety'
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

export async function GET(request: Request) {
  // ค่าเริ่มต้น = ธีมลายโดเมน · ?theme=classic = แบบเดิม — ไม่ใช่ตัวระบุตัวตน studentId ยังมาจากคุกกี้เท่านั้น
  const theme = resolveCertTheme(new URL(request.url).searchParams.get('theme'))
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

  const [profile, missionRows, submissions, summary] = await Promise.all([
    getProfile(session.studentId),
    listMissionProgress(session.studentId),
    listSubmissions(session.studentId),
    lessonSummary(session.studentId),
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

  /**
   * ดาวรวม/ภารกิจที่ผ่าน = lessonSummary() ตัวเดียวกับ /home /rewards และพรีวิว /result
   * ห้ามกลับไปใช้ profiles.earned_stars (ตามหลังหนึ่งรอบ ทำให้ PDF กับหน้าเว็บคนละเลข)
   */
  const progress = certificateProgressOf(summary)
  const data = certificateData({ ...report, starsTotal: progress.starsTotal, starsMax: progress.starsMax }, Date.now())

  // เกียรติบัตรแบบเกม — ภาพจาก public/ui/cert/ (ไม่มีรูปไหนก็วาดรูปทรงแทน)
  const [fonts, art] = await Promise.all([serverFonts(), loadCertArt(theme)])
  const pdf = renderGameCertificatePdf(
    {
      nickname: data.nickname,
      shopName: data.shopName,
      // ชื่อเว็บติดตัวกรองคำ = แสดงแค่ชื่อร้าน (ตรงกับพรีวิวหน้า /result)
      domainFull: certificateDomain(data.domainFull),
      ...progress,
      ceoScore: standing.score
        ? { total: standing.score.weightedTotal, max: standing.score.weightedMax, source: standing.score.source }
        : null,
      issuedAt: Date.now(),
    },
    fonts,
    art,
    theme,
  )

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
