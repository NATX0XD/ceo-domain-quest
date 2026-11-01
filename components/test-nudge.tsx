import Link from 'next/link'
import { ChevronRightIcon } from '@/components/ui'
import type { TestNudge } from '@/components/server/test-nudge'

/** การ์ดเชิญทำแบบทดสอบ: ไอคอน 3 มิติ + ชื่อสั้น + ป้ายสถานะ · ไม่มีย่อหน้า */
export function TestNudgeCard({ nudge, className = '' }: { nudge: TestNudge; className?: string }) {
  return (
    <Link
      href={nudge.href}
      className={`gf-nudge focus-ring ${className}`}
      data-testid={`nudge-${nudge.kind}`}
    >
      <img
        src={nudge.kind === 'pretest' ? '/icons/3d/clipboard.webp' : '/icons/3d/bullseye.webp'}
        alt=""
        width={40}
        height={40}
      />
      <span className="min-w-0 flex-1">
        <strong className="block truncate">{nudge.title}</strong>
        <span className="gf-nudge-chip">{nudge.waiting ? 'รอครูเปิด' : 'ถึงเวลาแล้ว'}</span>
      </span>
      <ChevronRightIcon aria-hidden width={22} height={22} />
    </Link>
  )
}
