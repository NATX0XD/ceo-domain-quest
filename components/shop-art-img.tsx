'use client'

/* eslint-disable @next/next/no-img-element -- ภาพร้านเป็น webp โปร่งใสใน public/ui/home */
import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react'

/**
 * รูปภาพร้านที่สลับไปภาพสำรองเองเมื่อไฟล์ของประเภทนั้นโหลดไม่ขึ้น
 * - onError: กรณีเปลี่ยน src หลัง hydrate แล้ว (เช่นเลือกประเภทร้านใหม่ในหน้า /setup)
 * - useEffect: กรณีรูปพังไปก่อน hydrate (onError ของ React ไม่ทันจับ) — ดู complete + naturalWidth
 */
export function ShopArtImg({
  src,
  fallback,
  alt = '',
  ...rest
}: { src: string; fallback: string } & Omit<ComponentPropsWithoutRef<'img'>, 'src' | 'onError'>) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const ref = useRef<HTMLImageElement>(null)
  const current = failedSrc === src ? fallback : src

  useEffect(() => {
    const img = ref.current
    if (img && current === src && img.complete && img.naturalWidth === 0) setFailedSrc(src)
  }, [current, src])

  return (
    <img
      ref={ref}
      src={current}
      alt={alt}
      draggable={false}
      onError={() => {
        if (current !== fallback) setFailedSrc(src)
      }}
      {...rest}
    />
  )
}
