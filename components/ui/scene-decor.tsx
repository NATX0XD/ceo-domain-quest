import { cn } from './cn'

/**
 * ของตกแต่งพื้นหลังแนวการ์ตูน — เมฆ เนินหญ้า ต้นไม้ ประกาย
 *
 * ## ทำไมต้องมี
 *
 * เจ้าของสั่งว่าทุกจอต้องมีบรรยากาศ ไม่ใช่พื้นครีมเปล่า ๆ แต่ของตกแต่งห้ามบังปุ่มหรือข้อความ
 * และห้ามทำให้สีตัดกันตก ตัวนี้จึงถูกออกแบบให้ปลอดภัยโดยโครงสร้าง
 *
 *  - `aria-hidden` + `pointer-events-none` — โปรแกรมอ่านหน้าจอไม่เห็น นิ้วแตะทะลุได้
 *  - วางเป็นชั้นล่างสุด (`-z-10` ในกล่องที่เป็น `relative isolate`) เนื้อหาอยู่เหนือเสมอ
 *  - สีอ่อนทั้งหมดและอยู่ "หลัง" ตัวหนังสือ จึงไม่เข้าไปเป็นพื้นหลังของข้อความชิ้นไหน
 *  - **ไม่มี animation เลย** จึงไม่มีอะไรต้องปิดในโหมดลดการเคลื่อนไหว
 *  - เป็น SVG ในโค้ด ไม่โหลดไฟล์ ไม่เพิ่ม dependency
 *
 * ใช้: วางเป็นลูกคนแรกของกล่องที่มี `relative isolate overflow-hidden`
 */

export type SceneDecorProps = {
  /**
   * ความหนาแน่นของของตกแต่ง
   *  - `full` เมฆ + เนิน + ต้นไม้ + ประกาย (จอที่มีที่ว่างเยอะ)
   *  - `light` เมฆกับประกายอย่างเดียว (จอที่มีการ์ดเต็มพื้นที่อยู่แล้ว)
   */
  density?: 'full' | 'light'
  className?: string
}

export function SceneDecor({ density = 'light', className }: SceneDecorProps) {
  const full = density === 'full'
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 160"
      preserveAspectRatio="none"
      /* ขนาดเขียนเป็น style ตรง ๆ ไม่ใช้คลาส — svg มีอัตราส่วนในตัวจาก viewBox
         ถ้าความสูงไม่ถูกกำหนดจริง มันจะยืดตามความกว้าง (390 -> 624px) แล้วดันให้หน้าเลื่อน
         วัดเจอมาแล้วตอนใช้คลาส size-full จึงล็อกด้วย style ให้ไม่มีทางพลาด */
      style={{ width: '100%', height: '100%' }}
      className={cn('pointer-events-none absolute inset-0 -z-10 select-none', className)}
    >
      {/* เมฆ — วางบนสุดซึ่งเป็นแถบที่เนื้อหามักเป็นหัวข้อสั้น ๆ */}
      <g className="fill-surface-raised opacity-70">
        <ellipse cx={14} cy={12} rx={9} ry={4} />
        <ellipse cx={21} cy={13} rx={6} ry={3} />
        <ellipse cx={84} cy={8} rx={8} ry={3.5} />
        <ellipse cx={78} cy={9} rx={5} ry={2.6} />
      </g>

      {/* ริบบิ้นโค้งจาง ๆ ให้จอไม่เป็นพื้นเรียบ */}
      <path
        d="M-5 34 Q30 26 55 34 T105 30"
        fill="none"
        className="stroke-brand-100"
        strokeWidth={2}
        strokeLinecap="round"
      />

      {full ? (
        <>
          {/* เนินหญ้าล่างจอ + ต้นไม้ — อยู่ใต้แถบปุ่มเสมอเพราะปุ่มอยู่ในชั้น footer คนละชั้นกัน */}
          <ellipse cx={18} cy={158} rx={40} ry={16} className="fill-quest-100" />
          <ellipse cx={86} cy={159} rx={34} ry={14} className="fill-quest-100" />
          <g className="fill-quest-200">
            <circle cx={9} cy={143} r={7} />
            <circle cx={16} cy={147} r={5} />
            <circle cx={93} cy={145} r={6} />
          </g>
        </>
      ) : null}

      {/* ประกายเล็ก ๆ 3 ดวง */}
      <g className="fill-reward-300 opacity-70">
        <path d="M7 60 Q7.6 62.4 10 63 Q7.6 63.6 7 66 Q6.4 63.6 4 63 Q6.4 62.4 7 60 Z" />
        <path d="M94 74 Q94.5 75.8 96.4 76.3 Q94.5 76.8 94 78.6 Q93.5 76.8 91.6 76.3 Q93.5 75.8 94 74 Z" />
        <path d="M89 118 Q89.6 120.4 92 121 Q89.6 121.6 89 124 Q88.4 121.6 86 121 Q88.4 120.4 89 118 Z" />
      </g>
    </svg>
  )
}
