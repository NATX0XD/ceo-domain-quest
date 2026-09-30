import type { Metadata } from 'next'
import { StyleGuideClient } from './style-guide-client'

export const metadata: Metadata = {
  title: 'ระบบดีไซน์ — CEO Domain Quest',
  description:
    'หน้ารวม component ทุกตัวของระบบดีไซน์ พร้อมโทเคนสี ตัวอักษร ระยะห่าง และสถานะปุ่ม',
  robots: { index: false, follow: false },
}

export default function StyleGuidePage() {
  return <StyleGuideClient />
}
