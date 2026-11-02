import Link from 'next/link'
import './dome-fab.css'

/** หน้าแท็บหลักที่ปุ่มโดมลอยพากลับมาได้หลังคุยจบ — ใช้ตรวจ ?from= ของ /dome ด้วย */
export const MAIN_TAB_PATHS = ['/home', '/map', '/knowledge', '/rewards', '/profile'] as const

export function mainTabReturnPath(from: unknown): string {
  return typeof from === 'string' && (MAIN_TAB_PATHS as readonly string[]).includes(from) ? from : '/home'
}

/** ปุ่มโดมลอย — แตะแล้วไปห้องคุยกับเลขาโดม และกลับมาหน้าแท็บเดิมได้ด้วยปุ่มย้อนกลับ */
export function DomeFab({ from, className }: { from: string; className?: string }) {
  return (
    <Link
      href={`/dome?from=${encodeURIComponent(mainTabReturnPath(from))}`}
      aria-label="คุยกับเลขาโดม"
      className={`dome-fab focus-ring${className ? ` ${className}` : ''}`}
    >
      <span className="dome-fab__badge" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- มาสคอตทางการ ขนาดเล็ก */}
        <img
          src="/dome/mascot/dome-greet.webp"
          alt=""
          draggable={false}
          className="dome-fab__art"
          style={{ width: 46, height: 55 }}
        />
      </span>
      <span className="dome-fab__tag" aria-hidden="true">ถามโดม</span>
    </Link>
  )
}
