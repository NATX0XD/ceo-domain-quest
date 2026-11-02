import type { Metadata, Viewport } from 'next'
import { Mitr, Noto_Sans_Thai } from 'next/font/google'
import './globals.css'
import './kit2.css'
import { PRODUCT_NAME_FULL } from '@/components/product'
import { CloudCurtain } from '@/components/cloud-curtain/cloud-curtain'
import { SwRegister } from '@/components/sw-register'
import { KeyboardInset } from '@/components/keyboard-inset'

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-noto-sans-thai',
})

const mitr = Mitr({
  subsets: ['thai', 'latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-display-thai',
})

export const metadata: Metadata = {
  // ชื่อผลงานอยู่ที่ components/product.ts ที่เดียว (มติ T40: อังกฤษเป็นหลัก ไทยเป็นชื่อรอง)
  title: PRODUCT_NAME_FULL,
  description:
    'สื่อการสอนแบบเกม วิชา 21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล — ตั้งชื่อโดเมนให้ร้านของตัวเอง',
  // black-translucent: พื้นหน้าจอลามไปใต้แถบสถานะตอนเปิดจากไอคอนบนโฮมสกรีน (header เว้น safe-area-inset-top เอง)
  appleWebApp: { capable: true, title: 'Domain Quest', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // ให้ผู้ใช้ซูมได้ถึง 5 เท่า — ห้ามล็อกซูม เพราะนักเรียนสายตาสั้นต้องขยายอ่าน
  maximumScale: 5,
  // สีแถบบนของเบราว์เซอร์ให้ตรงกับ --color-surface (ครีมอุ่น) ขอบจอจะได้ไม่เป็นคนละสีกับหน้า
  themeColor: '#FDF9F1',
  // จำเป็นสำหรับ env(safe-area-inset-*) ใน globals.css — ถ้าไม่ใส่ iOS จะคืนค่า 0 เสมอ
  // และเนื้อหาจะไปอยู่ใต้จอบาก/แถบ home indicator
  viewportFit: 'cover',
  // Android Chrome: คีย์บอร์ดย่อ layout viewport จริง (iOS ไม่รองรับ ใช้ components/keyboard-inset.tsx ชดเชยด้วย visualViewport)
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${notoSansThai.variable} ${mitr.variable}`}>
      <body className="font-sans">
        {children}
        <CloudCurtain />
        <SwRegister />
        <KeyboardInset />
      </body>
    </html>
  )
}
