import Image from 'next/image'
import type { CSSProperties } from 'react'

/** รูปใน public/landing เป็น WebP อยู่แล้ว — ไม่ผ่าน optimizer ให้ได้ขนาดตรงตัวและไม่พึ่ง sharp บนเซิร์ฟเวอร์ */
export function Pic(props: {
  src: string
  alt: string
  width: number
  height: number
  priority?: boolean
  className?: string
  style?: CSSProperties
  sizes?: string
}) {
  const { priority, ...rest } = props
  return <Image unoptimized priority={priority} loading={priority ? undefined : 'lazy'} {...rest} />
}

/** เมฆวาดเอง (SVG) — ขอบนุ่ม ไม่มีเศษภาพจากชีตเอฟเฟกต์ */
export function Cloud({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 100" aria-hidden focusable="false">
      <g fill="#dcefff"><circle cx="55" cy="68" r="28" /><circle cx="98" cy="56" r="38" /><circle cx="142" cy="66" r="30" /><circle cx="172" cy="74" r="20" /><rect x="40" y="70" width="145" height="26" rx="13" /></g>
      <g fill="#fff"><circle cx="55" cy="62" r="28" /><circle cx="98" cy="46" r="38" /><circle cx="142" cy="58" r="30" /><circle cx="172" cy="68" r="20" /><rect x="40" y="62" width="145" height="26" rx="13" /></g>
    </svg>
  )
}
