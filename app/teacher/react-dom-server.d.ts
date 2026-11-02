/**
 * โปรเจกต์ไม่ได้ลง `@types/react-dom` (และรอบนี้ห้ามแตะ package.json)
 * เทสต์หน้าจอของครูใช้แค่ `renderToStaticMarkup` ตัวเดียว จึงประกาศชนิดเท่าที่ใช้จริงไว้ตรงนี้
 */
declare module 'react-dom/server' {
  import type { ReactNode } from 'react'
  export function renderToStaticMarkup(element: ReactNode): string
  export function renderToString(element: ReactNode): string
}

declare module 'react-dom' {
  import type { ReactNode, ReactPortal } from 'react'
  export function createPortal(children: ReactNode, container: Element | DocumentFragment, key?: string | null): ReactPortal
}
