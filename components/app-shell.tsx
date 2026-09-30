import type { ReactNode } from 'react'
import { cn } from '@/components/ui'

/**
 * โครงหน้าจอแบบแอปของทั้งระบบ — **ทุกหน้าใช้ตัวนี้ ห้ามเขียนโครงเองรายหน้า**
 *
 * กติกาที่โครงนี้บังคับให้เกิดขึ้นเอง โดยหน้าที่เรียกใช้ไม่ต้องรู้:
 *  1. สูงเท่าจอพอดีด้วย 100dvh (ไม่ใช่ 100vh) เอกสารทั้งใบไม่มีแถบเลื่อน
 *  2. html/body ถูกปิดการเลื่อนไว้ที่ globals.css ส่วนที่เลื่อนได้มีที่เดียวคือ main
 *  3. header กับ footer เป็น flex item ที่ไม่หดและไม่เลื่อน ปุ่มลงมือหลักจึงอยู่ให้เห็นเสมอ
 *  4. header กินพื้นที่ปลอดภัยด้านบน footer กินด้านล่าง ด้านซ้าย/ขวาอยู่ที่ตัว shell
 *     ถ้าหน้าไหนไม่มี header/footer พื้นที่ปลอดภัยด้านนั้นจะย้ายมาอยู่ที่ shell แทน
 *
 * ⚠️ ไฟล์นี้ไม่มีข้อมูลของผู้เรียนฝังอยู่เลย เป็นโครงเปล่าล้วน ๆ
 *
 * ── วิธีใช้กับหน้าใหม่ ──────────────────────────────────────────────────────
 *
 * หน้าฝั่งนักเรียน: ใช้ `StudentShell` (components/student-shell.tsx) ซึ่งห่อ AppShell
 * ไว้อีกชั้นแล้วเติมนาฬิกาช่วงกิจกรรมกับแถบเมนูล่างให้เอง — ไม่ต้องเรียก AppShell ตรง ๆ
 *
 *   <StudentShell withBottomNav footer={<AppFooter><Button …/></AppFooter>}>
 *     …เนื้อหาที่ยาวได้…
 *   </StudentShell>
 *
 * หน้าอื่น (ครู · จอหน้าห้อง · หน้าเปล่า) ใช้ AppShell ตรง:
 *
 *   <AppShell
 *     width="wide"                                  // app (ค่าเริ่มต้น) | wide | full
 *     header={<AppHeader><AppBar title="ชื่อหน้า" /></AppHeader>}
 *     footer={<AppFooter><Button>ปุ่มลงมือหลัก</Button></AppFooter>}
 *   >
 *     <div className="px-4 pt-4 pb-6">…เนื้อหา…</div>
 *   </AppShell>
 *
 * กฎที่ต้องจำ 4 ข้อ:
 *  1. **หน้าละ AppShell หนึ่งตัวเท่านั้น** อะไรที่อยู่นอก AppShell จะถูก body ตัดหาย
 *     และเลื่อนไปดูไม่ได้เลย (เคยเกิดจริงกับฟอร์มใน /profile) ถ้า component ลูกเป็นคนสร้าง
 *     AppShell อยู่แล้ว ให้ส่งของเข้าไปทาง prop อย่าวางเป็นพี่น้องข้างนอก
 *  2. ห้ามใส่ `min-h-dvh` / `h-screen` / `100vh` ที่ไหนอีก — ความสูงเป็นหน้าที่ของ shell
 *  3. ปุ่มลงมือหลักของหน้า (ส่งคำตอบ / ไปต่อ / ขอคำใบ้) ต้องอยู่ใน `footer`
 *     ถ้าเป็นปุ่ม submit ของฟอร์มที่อยู่ในส่วนเลื่อนได้ ผูกกลับด้วย `form="<id ของฟอร์ม>"`
 *     ปุ่มจะยังเป็น submit ตัวเดิมโดยไม่ต้องย้ายฟอร์มหรือแก้ตรรกะ
 *  4. ห้ามใส่ `overflow-y: auto` ให้กล่องข้างในอีก — หน้าหนึ่งมีชั้นที่เลื่อนได้ชั้นเดียว
 *     (ยกเว้น textarea/select ที่เลื่อนเนื้อหาตัวเองตามปกติ)
 *
 * ตรวจหน้าใหม่ว่าโครงถูก: `node measure.mjs` ใน scratchpad — เกณฑ์คือ
 * `document.scrollingElement.scrollHeight === clientHeight` ที่ 390/768/1280
 */

export type AppShellWidth =
  /** มือถือเป็นหลัก จอกว้างจำกัดไว้ 480px กลางจอ — ใช้กับทุกหน้าฝั่งนักเรียน */
  | 'app'
  /** ตารางฝั่งครูที่ต้องการคอลัมน์เยอะ — จำกัด 1024px กลางจอ */
  | 'wide'
  /** จอหน้าห้องที่ฉายขึ้นโปรเจกเตอร์ — เต็มความกว้าง */
  | 'full'

const WIDTH_CLASS: Record<AppShellWidth, string> = {
  app: 'app-shell-app',
  wide: 'app-shell-wide',
  full: '',
}

export type AppShellProps = {
  /** แถบบนที่อยู่กับที่ — ปุ่มย้อนกลับ ชื่อหน้า ดาว นาฬิกา */
  header?: ReactNode
  /** แถบล่างที่อยู่กับที่ — ปุ่มลงมือหลักของหน้า หรือแถบเมนูล่าง */
  footer?: ReactNode
  /** เนื้อหาที่ยาวได้ ไปอยู่ในชั้นเดียวที่เลื่อนได้ */
  children: ReactNode
  width?: AppShellWidth
  className?: string
  /** คลาสเพิ่มให้ชั้นที่เลื่อนได้ เช่นอยากจัดกลางแนวตั้งตอนเนื้อหาสั้น */
  mainClassName?: string
  /** ป้ายกำกับของส่วนเนื้อหาสำหรับโปรแกรมอ่านหน้าจอ เมื่อหน้ามีหลายภูมิภาค */
  mainLabel?: string
  /**
   * โหมด "จบในหน้าเดียว" — ชั้นเนื้อหาไม่เลื่อนเลย (UX-1 ข้อ 1)
   *
   * เปิดเฉพาะหน้าที่ออกแบบมาให้พอดีจอจริง ๆ แล้ว **ไม่ใช่ค่าเริ่มต้น**
   * หน้าที่เนื้อหายาวกว่าจอ (ข้อสอบ 10 ข้อ · คลังความรู้ฉบับเก่า) ถ้าเปิดโหมดนี้
   * เนื้อหาครึ่งล่างจะหายไปเลยและกดไม่ได้ ซึ่งแย่กว่าการเลื่อน
   * ของที่ยาวให้ย้ายไปอยู่ใน `<Sheet>` แทนการต่อหน้าให้ยาว
   */
  fit?: boolean
}

export function AppShell({
  header,
  footer,
  children,
  width = 'app',
  className,
  mainClassName,
  mainLabel,
  fit = false,
}: AppShellProps) {
  return (
    <div
      // data-* สามตัวนี้มีไว้ให้สคริปต์วัดผลจับชั้นของโครงได้ตรงตัว ไม่ต้องเดาจากคลาส
      data-app-shell=""
      className={cn(
        'app-shell',
        WIDTH_CLASS[width],
        // ไม่มีแถบหัว/แถบท้าย = ไม่มีใครรับพื้นที่ปลอดภัยด้านนั้น ต้องมารับที่ shell เอง
        header ? null : 'app-shell-safe-t',
        footer ? null : 'app-shell-safe-b',
        className,
      )}
    >
      {header ? (
        <div data-app-shell-header="" className="app-shell-header">
          {header}
        </div>
      ) : null}

      <main
        data-app-shell-main=""
        className={cn('app-shell-main', fit && 'app-shell-main-fit', mainClassName)}
        aria-label={mainLabel}
      >
        {children}
      </main>

      {footer ? (
        <div data-app-shell-footer="" className="app-shell-footer">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

export type AppHeaderProps = {
  children: ReactNode
  /** เส้นคั่นใต้แถบหัว ช่วยให้เห็นว่าเนื้อหาเลื่อนลอดอยู่ข้างใต้ */
  divider?: boolean
  className?: string
}

/** กล่องมาตรฐานของแถบหัว — จัดระยะขอบและความกว้างให้ตรงกับเนื้อหาข้างใน main */
export function AppHeader({ children, divider = true, className }: AppHeaderProps) {
  return (
    <div
      className={cn(
        'surface-veil px-4 pt-3 pb-3',
        divider ? 'border-b border-line' : null,
        className,
      )}
    >
      {children}
    </div>
  )
}

export type AppFooterProps = {
  children: ReactNode
  /** เส้นคั่นเหนือแถบท้าย */
  divider?: boolean
  className?: string
}

/**
 * กล่องมาตรฐานของแถบท้าย — ที่อยู่ของ "ปุ่มลงมือหลัก 1 ปุ่มของหน้านี้"
 * (ส่งคำตอบ / ไปต่อ / ขอคำใบ้) นักเรียนต้องเห็นโดยไม่ต้องเลื่อนหา
 */
export function AppFooter({ children, divider = true, className }: AppFooterProps) {
  return (
    <div
      className={cn(
        'surface-veil px-4 pt-3 pb-3',
        divider ? 'border-t border-line' : null,
        className,
      )}
    >
      {children}
    </div>
  )
}

export type AppBarProps = {
  /** ปุ่มย้อนกลับหรือไอคอนมุมซ้าย */
  leading?: ReactNode
  title?: ReactNode
  /** บรรทัดรองใต้ชื่อหน้า */
  subtitle?: ReactNode
  /** มุมขวา เช่น ป้ายดาว นาฬิกา */
  trailing?: ReactNode
  className?: string
}

/**
 * แถบหัวแบบมาตรฐาน: [ย้อนกลับ] ชื่อหน้า [ดาว/นาฬิกา]
 * ชื่อหน้าเป็น h1 ของหน้านั้น จึงต้องมีหน้าละครั้งเดียว
 */
export function AppBar({ leading, title, subtitle, trailing, className }: AppBarProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        {title ? (
          <h1 className="truncate text-title-sm font-extrabold text-ink">{title}</h1>
        ) : null}
        {subtitle ? <p className="truncate text-note text-ink-muted">{subtitle}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  )
}

export type AppScrollProps = {
  children: ReactNode
  className?: string
}

/**
 * ระยะขอบมาตรฐานของเนื้อหาในชั้นที่เลื่อนได้
 * pb-6 ท้ายสุดกันบรรทัดสุดท้ายไปติดขอบ footer พอดีจนดูเหมือนยังไม่จบ
 */
export function AppScrollArea({ children, className }: AppScrollProps) {
  return <div className={cn('px-4 pt-4 pb-6', className)}>{children}</div>
}
