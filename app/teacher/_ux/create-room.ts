/** สร้างห้องใหม่ผ่าน POST /api/teacher/classroom — รหัสห้องมาจากเซิร์ฟเวอร์เท่านั้น */
export async function createRoomRequest(): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const res = await fetch('/api/teacher/classroom', { method: 'POST' })
    const data = (await res.json().catch(() => null)) as { message?: string; classroom?: { id?: string } } | null
    if (!res.ok || !data?.classroom?.id) return { ok: false, message: data?.message ?? 'เปิดห้องไม่สำเร็จ ลองใหม่อีกครั้ง' }
    return { ok: true, id: data.classroom.id }
  } catch {
    return { ok: false, message: 'ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง' }
  }
}

/** ปลายทางหลังสร้างห้อง — สลับไปห้องใหม่ แล้วให้แถบ "ห้องพร้อมแล้ว" ขึ้นที่หัวหน้า */
export const createdRoomHref = (id: string) => `/teacher?classroomId=${id}&created=1`
