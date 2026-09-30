import { NextResponse } from 'next/server'
import { ShopProfileSchema } from '@/components/shop-profile'
import { checkDomainAvailability } from '@/components/server/domain-registry'
import { isShopProfileLocked, loadShopProfile, saveShopProfile } from '@/components/server/game-state'
import { moderateStudentText } from '@/components/server/moderation'
import { buildStoryInput } from '@/app/api/story/_lib/input'
import { drainStoriesInBackground, enqueueStory } from '@/app/api/story/_lib/runner'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../_lib/session-cookie'

/**
 * บันทึกโปรไฟล์ร้านลงฐานข้อมูล
 *
 * ⚠️ studentId มาจากคุกกี้ dbq_student (ผ่าน /api/join) เท่านั้น ห้ามรับจาก body
 * ⚠️ ล็อกทันทีที่เริ่มเล่น (มี attempt ของภารกิจใดก็ตาม หรือยื่นที่สถานี B แล้ว)
 *    เพราะสถานี B ตัดสินผ่าน/ไม่ผ่านจาก isRegisteredCompany และ audience
 *    ถ้าแก้ได้เรื่อย ๆ นักเรียนจะยื่นไม่ผ่านแล้วย้อนกลับมาแก้โปรไฟล์ให้ผ่าน (รีวิว R5 หัวข้อ H4)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  if (await isShopProfileLocked(session.studentId)) {
    return errorResponse(
      'profile-locked',
      'เริ่มทำภารกิจไปแล้ว ข้อมูลร้านจึงถูกล็อก แก้ไม่ได้ ถ้าจำเป็นต้องแก้ให้ยกมือบอกครู',
      409,
    )
  }

  const parsed = ShopProfileSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ข้อมูลร้านไม่ครบหรือรูปแบบไม่ถูกต้อง', 400)
  }

  /**
   * ชื่อร้านเป็นข้อความที่นักเรียนพิมพ์เอง ต้องผ่านตัวกรอง E-11 ก่อนบันทึก
   * ไม่ผ่าน = **คืนข้อความเดิมกลับไปพร้อมเหตุผล** ไม่ลบทิ้งเงียบ ๆ
   */
  const verdict = await moderateStudentText(
    session.studentId,
    'brand-name',
    parsed.data.shopName ?? '',
  )
  if (!verdict.ok) {
    return errorResponse('content-flagged', verdict.message ?? 'ลองใช้คำอื่นดูนะ', 422, {
      field: 'shopName',
      original: verdict.original,
      famousBrands: verdict.famousBrands,
    })
  }

  /**
   * จังหวะที่ชื่อถูก "จด" จริง (S-23 + E-06 ใครจดก่อนได้ก่อน)
   *
   * กันเฉพาะเรื่องที่เป็นสิทธิ์ของคนอื่น: ชื่อต้องห้าม · ชื่อที่ถูกจดในโลกของเกม ·
   * ชื่อที่เพื่อนในห้องจดไปก่อน — **ไม่กันด้วยกฎการตั้งชื่อ 4 ข้อ** ตรงนี้
   * เพราะสถานีตั้งชื่อยังไม่เสร็จ หน้าตั้งค่าร้านจึงยังใช้ชื่อร้านภาษาไทยเป็นชื่อโดเมนชั่วคราว
   * ถ้ากันด้วยกฎอักขระตอนนี้ เด็กที่ตั้งชื่อร้านเป็นภาษาไทยจะเข้าเกมไม่ได้เลย
   *
   * ชนแล้วคืนชื่อที่ยังว่างไปด้วยเสมอ เด็กจะได้ไปต่อได้ทันทีโดยไม่ต้องนั่งเดา
   */
  const domain = await checkDomainAvailability(
    session.studentId,
    session.classroomId,
    parsed.data.domainName,
    [parsed.data.shopName, parsed.data.businessTypeId],
  )
  if (!domain.available && domain.status !== 'empty') {
    return errorResponse('domain-taken', domain.message, 409, {
      field: 'domainName',
      original: domain.input,
      name: domain.name,
      status: domain.status,
      takenByNickname: domain.takenByNickname,
      suggestions: domain.suggestions,
    })
  }

  await saveShopProfile(session.studentId, parsed.data)

  /**
   * E-07 + S-16 ตั้งค่าร้านเสร็จ = จังหวะที่สเปกให้เริ่มแต่งเรื่องเฉพาะคน (หัวข้อ 3.1 นาทีที่ 15-20)
   *
   * ⚠️ **ห้ามรอ AI ตรงนี้** ผู้เรียนต้องได้คำตอบกลับทันทีแล้วเดินไปทำเช็กความเข้าใจต่อ
   *    ระหว่างนั้น (ราว 1-2 นาที) คิวจะแต่งเรื่องให้เสร็จเอง
   * ⚠️ ฝากงานไม่สำเร็จไม่ใช่เรื่องที่ผู้เรียนต้องรับรู้ — เส้นทางประโยคสำรองยังเดินได้ครบทุกภารกิจ
   *    จึงกลืน error ทิ้งโดยตั้งใจ ไม่ให้หน้าตั้งค่าร้านพังเพราะงานเบื้องหลัง
   */
  let storyQueued = false
  try {
    const storyInput = await buildStoryInput(session.studentId)
    if (storyInput) {
      const { reused } = await enqueueStory(session.studentId, storyInput)
      if (!reused) drainStoriesInBackground()
      storyQueued = true
    }
  } catch {
    storyQueued = false
  }

  return NextResponse.json({
    storyQueued,
    ok: true,
    locked: false,
    domainName: domain.name,
    domainRemoved: domain.removed,
    // เจอชื่อแบรนด์ของคนอื่นไม่ใช่การทำผิด แต่บอกไว้ให้รู้เรื่องเครื่องหมายการค้า
    famousBrands: verdict.famousBrands,
  })
}

/** ให้หน้าเว็บถามได้ว่าเซิร์ฟเวอร์จำร้านอะไรไว้ */
export async function GET() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')
  const [profile, locked] = await Promise.all([
    loadShopProfile(session.studentId),
    isShopProfileLocked(session.studentId),
  ])
  return NextResponse.json({ profile, locked })
}
