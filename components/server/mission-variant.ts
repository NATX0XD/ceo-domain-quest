import type { Mission } from '../missions'
import type { LearnPath } from './learn-path'

/** M2 สอน 3 ส่วนคงที่ แต่ suffix เป็นตัวอย่างที่เปลี่ยนได้ต่อผู้เรียน */
const M2_SUFFIXES = ['.com', '.net', '.org', '.shop'] as const
const M2_SLUGS = ['sweetleaf', 'booknest', 'pixelpet', 'greenbowl', 'craftcorner', 'brightbean'] as const

export type M2Variant = { slug: string; suffix: (typeof M2_SUFFIXES)[number] }

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (const char of seed) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pick<T>(items: readonly T[], seed: number, offset: number): T {
  return items[(seed + offset) % items.length]!
}

/** สุ่มแบบคงที่ต่อผู้เรียน รีเฟรชแล้วโจทย์ไม่เปลี่ยนกลางเกม */
export function m2VariantFor(studentId: string, preferredSlug?: string): M2Variant {
  const seed = hashSeed(studentId)
  const safeSlug = preferredSlug?.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)
  return { slug: safeSlug || pick(M2_SLUGS, seed, 0), suffix: pick(M2_SUFFIXES, seed, 1) }
}

function personalizeText(text: string, variant: M2Variant): string {
  return text
    .replaceAll('kanombanyai.com', `${variant.slug}${variant.suffix}`)
    .replaceAll('www.kanombanyai', `www.${variant.slug}`)
    .replaceAll('kanombanyai', variant.slug)
    .replaceAll('kanomwan.com', `${variant.slug}${variant.suffix}`)
    .replaceAll('www.kanomwan', `www.${variant.slug}`)
    .replaceAll('kanomwan', variant.slug)
    .replaceAll('.com', variant.suffix)
    .replace(/(^|\s)com(?=\s|$)/g, `$1${variant.suffix.slice(1)}`)
}

function mapStrings(value: unknown, variant: M2Variant): unknown {
  if (typeof value === 'string') return personalizeText(value, variant)
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, variant))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, variant)]))
  }
  return value
}

export function personalizeM2Mission(mission: Mission, variant: M2Variant): Mission {
  return mission.id === 'm2' ? (mapStrings(mission, variant) as Mission) : mission
}

export function personalizeM2LearnPath(path: LearnPath, variant: M2Variant): LearnPath {
  return path.missionId === 'm2' ? (mapStrings(path, variant) as LearnPath) : path
}

/** สลับชิ้นส่วนตาม student id แต่คง piece id เดิมให้ server ตรวจได้ */
export function shuffleForStudent<T>(items: readonly T[], studentId: string): T[] {
  const output = [...items]
  let state = hashSeed(studentId)
  for (let i = output.length - 1; i > 0; i -= 1) {
    state = Math.imul(state ^ (state >>> 13), 0x5bd1e995) >>> 0
    const j = state % (i + 1)
    ;[output[i], output[j]] = [output[j]!, output[i]!]
  }
  return output
}
