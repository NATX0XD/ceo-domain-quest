/**
 * ธีมรายด่านของ learn path — ภาพพื้นหลังมาจาก public/learn/<m>/ (สร้างแยก)
 * ไฟล์ยังไม่มี = ใช้ไล่สีสำรองด้านล่างแทน ไม่มีหน้าจอว่าง
 */
export type LearnThemeId = 'm1' | 'm2' | 'm3' | 'm4'

export interface LearnTheme {
  id: LearnThemeId
  bg: string
  /** ไล่สีสำรอง + ชั้นปรับโทนทับภาพ */
  fallback: string
  blur: string
  veil: string
  dark: boolean
  /** สีแถบบน */
  bar: string
  barText: string
  pixel: boolean
}

export const THEMES: Record<LearnThemeId, LearnTheme> = {
  m1: {
    id: 'm1',
    bg: '/learn/m1/bg-bakery.webp',
    fallback: 'linear-gradient(160deg, #fff4e0 0%, #ffd9b0 55%, #f6b98a 100%)',
    blur: 'blur(6px)',
    veil: 'rgba(255, 244, 228, 0.35)',
    dark: false,
    bar: 'rgba(255, 250, 242, 0.95)',
    barText: 'text-ink',
    pixel: false,
  },
  m2: {
    id: 'm2',
    bg: '/ui/m2/bg-bakery.webp',
    fallback: 'linear-gradient(160deg, #fff1c8 0%, #f7c98b 54%, #d88653 100%)',
    blur: 'blur(5px)',
    veil: 'rgba(255, 238, 201, 0.42)',
    dark: false,
    bar: 'rgba(80, 39, 17, 0.97)',
    barText: 'text-white',
    pixel: false,
  },
  m3: {
    id: 'm3',
    bg: '/learn/m3/bg-pixel-office.webp',
    fallback: 'linear-gradient(180deg, #fff8e6 0%, #f3e4c4 62%, #d59b58 100%)',
    blur: 'blur(2px)',
    veil: 'rgba(255, 248, 230, 0.28)',
    dark: false,
    bar: 'rgba(255, 248, 230, 0.96)',
    barText: 'text-ink',
    pixel: true,
  },
  m4: {
    id: 'm4',
    bg: '/learn/m4/bg-boss-office.webp',
    fallback: 'linear-gradient(180deg, #fff8e6 0%, #f1dfbd 58%, #c98948 100%)',
    blur: 'blur(2px)',
    veil: 'rgba(255, 248, 230, 0.24)',
    dark: false,
    bar: 'rgba(255, 248, 230, 0.96)',
    barText: 'text-ink',
    pixel: true,
  },
}

export function themeFor(missionId: string): LearnTheme {
  const key = missionId.slice(0, 2) as LearnThemeId
  return THEMES[key] ?? THEMES.m1
}
