import type { SVGProps } from 'react'

/**
 * ชุดไอคอนของระบบดีไซน์ — วาดเป็น inline SVG ทั้งหมด
 *
 * ทำไมถึงไม่โหลดจาก /public/icons/*.svg ผ่าน <img>:
 * ไอคอนในแถบเมนูต้องเปลี่ยนสีตามสถานะ (เลือกอยู่ = ม่วง, ไม่ได้เลือก = เทา)
 * `<img>` เปลี่ยนสีข้างในไฟล์ไม่ได้ ส่วน inline SVG ใช้ `currentColor` รับสีจาก
 * `text-*` ของ element แม่ได้ทันที
 * ไฟล์ใน /public/icons/ เป็นภาพชุดเดียวกัน ไว้ใช้ตอนต้องการไฟล์จริง
 * (เช่น og-image, ส่งให้ฝ่ายสื่อ, ใส่ใน PDF เกียรติบัตร)
 *
 * ทุกไอคอนเป็น `aria-hidden` เสมอ — ความหมายต้องมาจากข้อความข้าง ๆ
 * หรือ `aria-label` ของปุ่มที่ครอบมัน ไม่ใช่จากตัวไอคอนเอง
 */

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.2 10.6 12 3.6l8.8 7" />
      <path d="M5.4 9.6V19a1.4 1.4 0 0 0 1.4 1.4h3.4v-5.2h3.6v5.2h3.4A1.4 1.4 0 0 0 18.6 19V9.6" />
    </Icon>
  )
}

export function QuestIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3.2v17.6" />
      <path d="M6 4.6h9.4l-1.6 3.2 1.6 3.2H6" />
      <circle cx="6" cy="20.4" r="1.4" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function KnowledgeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.4 5.2A9.6 9.6 0 0 1 12 7.4a9.6 9.6 0 0 1 8.6-2.2v12.4A9.6 9.6 0 0 0 12 19.8a9.6 9.6 0 0 0-8.6-2.2Z" />
      <path d="M12 7.4v12.4" />
    </Icon>
  )
}

export function RewardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.4 3.6h9.2v5a4.6 4.6 0 1 1-9.2 0Z" />
      <path d="M7.4 5.4H4.6v1.4a3.2 3.2 0 0 0 3 3.2" />
      <path d="M16.6 5.4h2.8v1.4a3.2 3.2 0 0 1-3 3.2" />
      <path d="M12 13.2v3.4" />
      <path d="M8.4 20.4h7.2l-1-3.8H9.4Z" />
    </Icon>
  )
}

export function ProfileIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.4" r="3.8" />
      <path d="M4.6 20.4a7.4 7.4 0 0 1 14.8 0" />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.8 12.6 9.6 17.4 19.2 6.6" />
    </Icon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </Icon>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 7.6v5" />
      <path d="M12 16.2h.01" />
    </Icon>
  )
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 16.4v-5" />
      <path d="M12 7.8h.01" />
    </Icon>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.8" y="10.4" width="14.4" height="9.8" rx="3" />
      <path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6" />
    </Icon>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.4 5.6 15.8 12l-6.4 6.4" />
    </Icon>
  )
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20.4 3.6 10.8 13.2" />
      <path d="M20.4 3.6 14.4 20.4l-3.6-7.2-7.2-3.6Z" />
    </Icon>
  )
}

export function MicIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="2.6" width="6" height="11.2" rx="3" />
      <path d="M5.4 11.4a6.6 6.6 0 0 0 13.2 0" />
      <path d="M12 18v3.4" />
    </Icon>
  )
}

export function StopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2.4" fill="currentColor" stroke="none" />
    </Icon>
  )
}

/** ครูกดหยุดเวลาไว้ — คู่กับ ClockIcon บนจอหน้าห้อง (สถานะห้ามสื่อด้วยสีอย่างเดียว) */
export function PauseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="7" y="6.2" width="3.6" height="11.6" rx="1.4" fill="currentColor" stroke="none" />
      <rect x="13.4" y="6.2" width="3.6" height="11.6" rx="1.4" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 7.2V12l3.2 2" />
    </Icon>
  )
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.6 5.6 8.2 12l6.4 6.4" />
      <path d="M8.6 12h11" />
    </Icon>
  )
}

export function LightbulbIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.2 17.4a6 6 0 1 1 5.6 0v2a1.6 1.6 0 0 1-1.6 1.6h-2.4a1.6 1.6 0 0 1-1.6-1.6Z" />
      <path d="M9.6 17.4h4.8" />
    </Icon>
  )
}

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 11.4a8 8 0 1 0-.8 4.4" />
      <path d="M20.4 4.8v5h-5" />
    </Icon>
  )
}

export function SkipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.6 5.6 13.2 12l-7.6 6.4Z" />
      <path d="M17.2 5.6v12.8" />
    </Icon>
  )
}

export function BookmarkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.4 4.6h11.2v16l-5.6-3.6-5.6 3.6Z" />
    </Icon>
  )
}

export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9.4" cy="8.4" r="3.4" />
      <path d="M3.6 19.6a5.8 5.8 0 0 1 11.6 0" />
      <path d="M16 5.4a3.4 3.4 0 0 1 0 6" />
      <path d="M17.6 14.6a5.8 5.8 0 0 1 2.8 5" />
    </Icon>
  )
}

export function ShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="17.6" cy="5.8" r="2.8" />
      <circle cx="6.4" cy="12" r="2.8" />
      <circle cx="17.6" cy="18.2" r="2.8" />
      <path d="M8.9 10.7 15.1 7.1" />
      <path d="M8.9 13.3l6.2 3.6" />
    </Icon>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.6v11.2" />
      <path d="M7.6 10.8 12 15.2l4.4-4.4" />
      <path d="M4.6 18.6h14.8" />
    </Icon>
  )
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.4 4.6h6v6" />
      <path d="M19.4 4.6 11 13" />
      <path d="M17.4 14v4.4a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.4V8.2a1.6 1.6 0 0 1 1.6-1.6H10" />
    </Icon>
  )
}

export function TargetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.8" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.6 4.8 19 12 7.6 19.2Z" />
    </Icon>
  )
}

export function GripIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={0} fill="currentColor" stroke="none">
      <circle cx="9" cy="6.5" r="1.6" />
      <circle cx="15" cy="6.5" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="17.5" r="1.6" />
      <circle cx="15" cy="17.5" r="1.6" />
    </Icon>
  )
}

/** ดาว — `filled` คุมว่าเป็นดาวที่ได้แล้วหรือดาวว่าง */
export function StarIcon({ filled = true, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M12 2.6 14.9 8.6 21.4 9.5 16.7 14.1 17.8 20.6 12 17.5 6.2 20.6 7.3 14.1 2.6 9.5 9.1 8.6 Z"
        fill={filled ? 'var(--color-reward-500)' : 'var(--color-surface-sunken)'}
        stroke={filled ? 'var(--color-reward-700)' : 'var(--color-line-contrast)'}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** มงกุฎ — ใช้ทำเครื่องหมายด่านบอส ให้ต่างจากภารกิจย่อยตั้งแต่แรกเห็น */
export function CrownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 18h16l1-9-5 3-4-6-4 6-5-3 1 9Z" />
      <path d="M4 21h16" />
    </Icon>
  )
}

/** ถุงเงิน/กระเป๋าธุรกิจ — ใช้กับภารกิจที่ว่าด้วยการขายและช่องทาง */
export function BagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8h16l-1.2 12H5.2L4 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </Icon>
  )
}

/** โลก/เว็บ — ใช้กับภารกิจเรื่องชื่อเว็บและตัวตนบนอินเทอร์เน็ต */
export function GlobeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 3 2.6 15 0 18-2.6-3-2.6-15 0-18Z" />
    </Icon>
  )
}

/** ชื่อไอคอนที่แถบเมนูล่างเลือกใช้ได้ */
export const NAV_ICONS = {
  home: HomeIcon,
  quest: QuestIcon,
  knowledge: KnowledgeIcon,
  reward: RewardIcon,
  profile: ProfileIcon,
} as const

export type NavIconName = keyof typeof NAV_ICONS
