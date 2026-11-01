import type { Metadata } from 'next'
import { Landing } from '@/components/landing/landing'

export const metadata: Metadata = {
  title: 'CEO Domain Quest — สร้างร้านในฝัน เรียนรู้โดเมนอย่างสนุก',
  description: 'เกมการเรียนรู้ชื่อโดเมนสำหรับนักเรียน ปวช. ผ่าน 4 ภารกิจและบอส CEO พร้อมโดม ผู้ช่วย AI',
  openGraph: { title: 'CEO Domain Quest', description: 'สร้างร้านในฝัน เรียนรู้โดเมนอย่างสนุก', images: ['/landing/logo.webp'] },
}

// NEXT_PUBLIC_OPEN_AT ถูกฝังตอน build — เปลี่ยนวันเปิดแล้วต้อง redeploy
export default function LandingPage() {
  return <Landing openAtEnv={process.env.NEXT_PUBLIC_OPEN_AT} />
}
