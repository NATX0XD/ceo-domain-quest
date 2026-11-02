import { getServiceClient } from '@/lib/db/client'
import type { ClassroomReportRaw } from '@/lib/db/repo'
import type { StudentCardData } from '../_ux/student-cards'

/** ประเภทร้านของแต่ละคน (profiles.business_type) — อ่านเฉพาะนักเรียนที่อยู่ในรายงานห้องของครูคนนี้ */
export async function loadShopTypes(studentIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  if (studentIds.length === 0) return map
  const { data } = await getServiceClient().from('profiles').select('student_id, business_type').in('student_id', studentIds)
  for (const row of (data ?? []) as { student_id: string; business_type: string | null }[]) map.set(row.student_id, row.business_type)
  return map
}

export function toCardData(
  raw: ClassroomReportRaw | null,
  types: Map<string, string | null>,
  pendingIds: Set<string>,
): StudentCardData[] {
  return (raw?.students ?? []).map((st) => ({
    studentId: st.studentId,
    nickname: st.nickname,
    cleared: st.missions.filter((m) => m.passed).length + (st.submission !== null ? 1 : 0),
    ceoDone: st.submission !== null,
    started: st.missions.length > 0,
    typeId: types.get(st.studentId) ?? null,
    stars: st.profile?.earnedStars ?? null,
    pending: pendingIds.has(st.studentId),
  }))
}
