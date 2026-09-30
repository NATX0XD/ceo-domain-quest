'use client'

import { Button, Card } from '@/components/ui'

/**
 * S-20 การ์ดข้อเสนอ "ลองอีกแบบ" — ข้อสำรองสำหรับผู้เรียนที่ติดจริง ๆ
 *
 * **เป็นข้อเสนอ ไม่ใช่การบังคับ** ปุ่มปฏิเสธเด่นเท่าปุ่มรับ และปฏิเสธแล้วยังขอเองได้ทีหลัง
 *
 * ⚠️ ข้อความชวนมาจากเซิร์ฟเวอร์ (`core/alt-item.ts`) หน้าจอห้ามแต่งเอง
 *    เพราะถ้อยคำถูกคุมด้วยเทสต์ไม่ให้มีคำตำหนิหรือคำที่แปลว่า "เธอทำข้อเดิมไม่ได้"
 * ⚠️ บอกจำนวนดาวล่วงหน้าเสมอ ไม่ให้รู้ทีหลังว่าได้น้อยกว่าที่คิด
 * ⚠️ คอมโพเนนต์นี้ไม่ยิง API เอง — เจ้าของหน้าภารกิจส่ง prop เข้ามาและจัดการปุ่ม
 *    (เส้นทางตรวจคำตอบอยู่ใน app/api/mission ซึ่งเป็นของอีก session)
 */

export interface AltItemOfferProps {
  /** ขึ้นการ์ดนี้ไหม — มาจาก shouldOfferAltItem().offer */
  offer: boolean
  /** ข้อความชวนจากเซิร์ฟเวอร์ */
  message: string
  /** ดาวที่จะได้ถ้าผ่านด้วยข้อสำรอง */
  starsIfPassed: number
  /** ผู้เรียนกดขอข้อสำรองเองได้ไหม (ปฏิเสธไปแล้วก็ยังขอได้) */
  canRequest?: boolean
  busy?: boolean
  /** กด "ลองอีกแบบ" */
  onAccept: () => void
  /** กด "ขอลองข้อเดิมต่อ" */
  onDecline: () => void
  /** กดปุ่มขอข้อสำรองเองตอนที่การ์ดไม่ได้ขึ้น */
  onRequest?: () => void
  className?: string
}

export function AltItemOffer({
  offer,
  message,
  starsIfPassed,
  canRequest = false,
  busy = false,
  onAccept,
  onDecline,
  onRequest,
  className,
}: AltItemOfferProps) {
  if (!offer) {
    // ไม่ได้เสนอ แต่ยังเปิดประตูไว้ให้ขอเองเมื่อไรก็ได้ — ไม่ใช่ปิดตายเพราะเคยปฏิเสธ
    if (!canRequest || !onRequest) return null
    return (
      <Button variant="ghost" className={className} disabled={busy} onClick={onRequest}>
        ขอลองข้อแบบอื่น
      </Button>
    )
  }

  return (
    <Card tone="spark" padding="md" className={className} elevated>
      <h3 className="font-semibold">ลองอีกแบบไหม</h3>
      <p className="mt-1 text-sm">{message}</p>
      <p className="mt-1 text-sm opacity-70">ผ่านแบบนี้ได้ {starsIfPassed} ดาว และนับว่าผ่านเรื่องนี้เหมือนกัน</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="success" disabled={busy} onClick={onAccept}>
          ลองอีกแบบ
        </Button>
        {/* ปุ่มปฏิเสธต้องเห็นชัดพอ ๆ กัน ไม่ใช่ซ่อนไว้จนเหมือนบังคับให้รับ */}
        <Button variant="secondary" disabled={busy} onClick={onDecline}>
          ขอลองข้อเดิมต่อ
        </Button>
      </div>
    </Card>
  )
}
