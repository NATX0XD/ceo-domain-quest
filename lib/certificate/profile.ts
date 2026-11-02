import { getProfile, upsertProfile, type ProfilePatch } from '@/lib/db/repo'

export const CERTIFICATE_DISPLAY_NAME_MAX_LENGTH = 60

/** อ่านชื่อสำหรับใบประกาศแบบ optional เพื่อให้ production ที่ยังไม่มีคอลัมน์ใช้ชื่อเล่นต่อได้ */
export function certificateDisplayNameFromProfile(profile: unknown): string | null {
  if (!profile || typeof profile !== 'object') return null
  const value = (profile as { certificate_display_name?: unknown }).certificate_display_name
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function certificateDisplayNameFor(profile: unknown, nickname: string): string {
  return certificateDisplayNameFromProfile(profile) ?? nickname
}

/** คอลัมน์นี้เป็น migration ใหม่ จึงกลืน error ไว้เพื่อไม่ให้การตั้งค่า profile พังทั้งหน้า */
export async function saveCertificateDisplayName(studentId: string, value: string | null): Promise<boolean> {
  try {
    const next = value?.trim() || null
    const current = certificateDisplayNameFromProfile(await getProfile(studentId))
    // นักเรียนตั้งได้ครั้งเดียว แม้จะเรียกจาก route ใหม่หรือส่งคำขอซ้ำ
    if (current && current !== next) return false
    await upsertProfile(studentId, { certificate_display_name: next } as unknown as ProfilePatch)
    return true
  } catch {
    return false
  }
}

/** ครูเจ้าของห้องใช้แก้/ล้างชื่อเพื่อเปิดสิทธิ์ให้นักเรียนตั้งใหม่ */
export async function setTeacherCertificateDisplayName(studentId: string, value: string | null): Promise<boolean> {
  try {
    await upsertProfile(studentId, { certificate_display_name: value?.trim() || null } as unknown as ProfilePatch)
    return true
  } catch {
    return false
  }
}
