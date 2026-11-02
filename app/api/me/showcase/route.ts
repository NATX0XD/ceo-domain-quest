import { NextResponse } from 'next/server'
import { getStudent, listClassroomShowcase, listShowcaseExtras } from '@/lib/db/repo'
import { shopArtSrc } from '@/components/shop-art'
import { showcaseVisibleToPeers } from '@/components/server/showcase-safety'
import { readStudentSession, unauthorized } from '../../_lib/session-cookie'

/**
 * กระดานโชว์ผลงาน **ของเพื่อน** ในห้องเดียวกัน
 *
 * ⚠️ ไม่มีพารามิเตอร์ให้ส่งเข้ามา — classroomId และ studentId อ่านจาก session cookie เท่านั้น
 * ⚠️ ห้ามมีดาว คะแนน หรือสถานะผ่าน/ไม่ผ่านของใครในนี้เด็ดขาด
 *    SQL function `classroom_showcase` เลือกมาแค่ 4 คอลัมน์ (ชื่อเล่น โดเมน นามสกุล เหตุผล)
 *    ตำราห้ามเปรียบเทียบผู้เรียนกันเอง กระดานนี้มีไว้ให้เห็นไอเดียเพื่อน ไม่ใช่ตารางอันดับ
 *
 * ⚠️ **ตัดงานของตัวเองออกที่นี่** (API-5 ข้อ 1)
 *    SQL function ใช้ `p_student_id` แค่ยืนยันว่า "อยู่ห้องนี้จริงไหม" (คนนอกห้องได้ `[]` เสมอ)
 *    ไม่ได้ใช้กรองเจ้าของออก งานตัวเองจึงเคยโผล่ปนมาด้วย
 *    กรองด้วย **ชื่อเล่น** ได้แม่นยำ เพราะตาราง `students` มี `unique (classroom_id, nickname)`
 *    ในห้องหนึ่งจึงมีชื่อเล่นนี้ได้คนเดียวเสมอ (`POST /api/join` เติมเลขท้ายให้ตอนชื่อชน)
 *    ที่ไม่ไปแก้ SQL เพราะ `supabase/` เป็นของอีก session — ถ้าวันหนึ่งแก้ที่ SQL แล้ว
 *    ตัวกรองนี้จะไม่มีอะไรให้ตัดออก และไม่พังอะไร
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')

  const [items, me, extras] = await Promise.all([
    listClassroomShowcase(session.classroomId, session.studentId),
    getStudent(session.studentId),
    listShowcaseExtras(session.classroomId, session.studentId),
  ])

  const myNickname = me?.nickname ?? null
  const others = myNickname === null ? items : items.filter((row) => row.nickname !== myNickname)
  /**
   * ผลงานที่ชื่อเว็บหรือเหตุผลติดตัวกรองคำ (เช่นคำหยาบซ่อนในชื่อเว็บ) ไม่ขึ้นให้เพื่อนเห็น
   * ครูยังเห็นที่ /teacher/showcase พร้อมป้าย "ไม่ขึ้นให้เพื่อนเห็น" · ไม่แตะคะแนนของใคร
   * ครูตั้งเองได้ (submissions.peer_visible): อนุมัติชิ้นที่ติดตัวกรอง หรือซ่อนชิ้นไหนก็ได้ — บังคับที่นี่ฝั่งเดียว
   */
  const safe = others.filter(showcaseVisibleToPeers)
  /**
   * แกลเลอรี: คนละ 1 การ์ด (ใบล่าสุด — SQL เรียง created_at จากเก่าไปใหม่) + ภาพร้านขั้นสุดท้าย
   * ใจ/จำนวนคำชมเป็นแค่ตัวนับบนการ์ด ไม่ใช้เรียงหรือจัดอันดับ ลำดับยังเป็นชื่อเล่นเหมือนเดิม
   */
  const latest = new Map<string, (typeof safe)[number]>()
  for (const row of safe) latest.set(row.nickname, row)
  const extraOf = new Map(extras.map((row) => [row.nickname, row]))
  const showcase = [...latest.values()].map((row) => {
    const extra = extraOf.get(row.nickname)
    return {
      ...row,
      shopName: extra?.businessName ?? null,
      artSrc: shopArtSrc(extra?.businessType ?? null, 5),
      likes: extra?.likes ?? 0,
      likedByMe: extra?.likedByMe ?? false,
      praises: extra?.praises ?? 0,
    }
  })

  return NextResponse.json({
    count: showcase.length,
    /** ไม่มีการจัดอันดับ เรียงตามชื่อเล่นเท่านั้น */
    showcase,
    /** งานของตัวเองถูกตัดออกไปกี่ชิ้น — หน้าจอเอาไปบอกได้ว่า "งานของเราอยู่ที่หน้าผลของฉัน" */
    ownHidden: items.length - others.length,
  })
}
