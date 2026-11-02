import { NAV_START_EVENT } from '@/components/cloud-curtain/curtain-events'

const isTeacherPath = (p: string) => p === '/teacher' || p.startsWith('/teacher/')

// ม่านเมฆเริ่มปิดเมื่อเปลี่ยน "หน้า" จริงเท่านั้น — เปลี่ยนแค่ query/hash (เช่น ?replay=1 ในภารกิจ) ไม่นับ
export function onRouterTransitionStart(url: string) {
  try {
    const next = new URL(url, window.location.href)
    if (next.origin !== window.location.origin) return
    if (next.pathname === window.location.pathname) return
    // แดชบอร์ดครูใช้โครงรอโหลด (skeleton) ไม่ใช้ม่านเมฆ — หน้านักเรียนยังใช้ม่านตามเดิม
    if (isTeacherPath(next.pathname) || isTeacherPath(window.location.pathname)) return
    window.dispatchEvent(
      new CustomEvent(NAV_START_EVENT, { detail: window.location.pathname }),
    )
  } catch {
    // ห้ามทำให้การเปลี่ยนหน้าพัง
  }
}
