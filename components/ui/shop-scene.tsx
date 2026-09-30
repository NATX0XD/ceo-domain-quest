import { cn } from './cn'

/**
 * ภาพร้านแบบ isometric ที่ค่อย ๆ สร้างเสร็จตามความคืบหน้าของนักเรียน
 *
 * ชื่อไฟล์ผูกกับสเตจ 1–4 ตรง ๆ ไม่ผูกกับเปอร์เซ็นต์ เพื่อให้เปลี่ยนเกณฑ์
 * ตัดสเตจได้ที่เดียวใน `stageFromPercent()` โดยไม่ต้องแก้ภาพ
 */

export type ShopStage = 1 | 2 | 3 | 4

const STAGE_ALT: Record<ShopStage, string> = {
  1: 'ร้านขั้นที่ 1 จาก 4: ที่ดินเปล่ารอสร้างร้าน',
  2: 'ร้านขั้นที่ 2 จาก 4: ลงเสาและวางโครงร้าน',
  3: 'ร้านขั้นที่ 3 จาก 4: ก่อผนังและมุงหลังคาเสร็จ',
  4: 'ร้านขั้นที่ 4 จาก 4: ร้านเปิดบริการพร้อมป้ายชื่อเว็บ',
}

/** แปลงเปอร์เซ็นต์ความคืบหน้า (0–100) เป็นสเตจของภาพร้าน */
export function stageFromPercent(percent: number): ShopStage {
  if (percent >= 100) return 4
  if (percent >= 60) return 3
  if (percent >= 25) return 2
  return 1
}

export type ShopSceneProps = {
  stage: ShopStage
  /** ความกว้างสูงสุด — ค่าเริ่มต้นยืดเต็มพ่อแม่ (ไม่มี fixed width) */
  className?: string
  /** ซ่อนจากโปรแกรมอ่านหน้าจอ เมื่อมีข้อความบอกความคืบหน้าอยู่ข้าง ๆ แล้ว */
  decorative?: boolean
}

export function ShopScene({ stage, className, decorative = false }: ShopSceneProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ไฟล์ SVG สถิตในโฟลเดอร์ public ไม่ต้องผ่านตัวปรับขนาดภาพ
    <img
      src={`/shop/shop-stage-${stage}.svg`}
      alt={decorative ? '' : STAGE_ALT[stage]}
      aria-hidden={decorative || undefined}
      width={320}
      height={260}
      className={cn('block h-auto w-full max-w-[20rem] select-none', className)}
      draggable={false}
    />
  )
}

export type AchievementBadgeProps = {
  /** ข้อความใต้ตรา เช่น ชื่อรางวัล */
  caption?: string
  size?: number
  earned?: boolean
  className?: string
}

/** ตราเกียรติบัตร — ใช้ในหน้ารางวัลและหน้าจบคาบ */
export function AchievementBadge({
  caption,
  size = 120,
  earned = true,
  className,
}: AchievementBadgeProps) {
  return (
    <figure className={cn('flex flex-col items-center gap-2', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ไฟล์ SVG สถิตในโฟลเดอร์ public */}
      <img
        src="/icons/badge-certificate.svg"
        alt={earned ? 'ตราเกียรติบัตรที่ได้รับแล้ว' : 'ตราเกียรติบัตรที่ยังไม่ได้รับ'}
        width={size}
        height={size}
        draggable={false}
        className={cn('select-none', !earned && 'opacity-40 grayscale')}
      />
      {caption ? (
        <figcaption className="text-label font-bold text-balance text-ink">{caption}</figcaption>
      ) : null}
    </figure>
  )
}
