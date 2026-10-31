/**
 * E-07 เรื่องราวเฉพาะคน — ส่วนที่ไม่ต้องใช้เน็ต
 *
 * ไฟล์นี้เก็บ 3 อย่าง: การอ่านคลังเรื่องราว · การเติมช่องว่างด้วยข้อมูลจริงของนักเรียน (ประโยคสำรอง)
 * และ **รายการตรวจผลจาก AI** ตามสเปก E-07 ซึ่งเป็นด่านสุดท้ายก่อนข้อความถึงตาเด็ก
 *
 * กฎเหล็กจากสเปกหัวข้อ 2.6 ข้อ 3: **AI เขียนได้เฉพาะส่วนเล่าเรื่อง**
 * คำสั่ง ตัวเลือก เฉลย และเกณฑ์ผ่าน มาจาก content/missions.json เท่านั้น ไม่เคยผ่านมือ AI
 * ตัวตรวจข้างล่างจึงปัดทิ้งทุกเรื่องที่มีข้อความหน้าตาเหมือนชื่อเว็บหรือนามสกุลเว็บ
 * แล้วสลับไปใช้ประโยคสำรองเป็นรายเรื่อง ไม่ใช่ทิ้งทั้งชุด
 */
import storySeedsJson from '../../content/story-seeds.json' with { type: 'json' }
import { gateAiText } from '../../core/content-filter'
import { guardAiText, topicKeywords } from './topic-lock'
import type { AiSource, FallbackReason, StoryInput, StoryItem, StoryResult } from './types'

const meta = storySeedsJson.meta as {
  maxWordsPerStory: number
  maxCharsPerStory: number
  maxSlugLength: number
  maxSlugLengthHardLimit: number
  storyCount: number
}

interface SeedRow {
  id: string
  kind: string
  missionId?: string
  seed: string
  fallback: string
  variants?: ReadonlyArray<{ id: string; when: string; seed: string; fallback: string }>
}

const seeds = storySeedsJson.stories as ReadonlyArray<SeedRow>
const categories = storySeedsJson.categories as ReadonlyArray<{
  id: string
  name: string
  character: string
}>
const businessTypeMap = storySeedsJson.businessTypeToCategory as ReadonlyArray<{
  businessTypeId: string
  categoryId: string
}>

export const STORY_IDS: string[] = seeds.map((s) => s.id)
export const MAX_STORY_WORDS = meta.maxWordsPerStory
export const MAX_STORY_CHARS = meta.maxCharsPerStory
export const MAX_SLUG_LENGTH = meta.maxSlugLength
export const PROMPT_RULES = storySeedsJson.promptRules as readonly string[]
export const SLUG_FALLBACK_PROMPT = storySeedsJson.slugFallbackPrompt as string

const DEFAULT_CATEGORY =
  categories.find((c) => c.id === storySeedsJson.defaultCategoryId) ?? categories[categories.length - 1]!

/** หมวดธุรกิจและตัวละครของนักเรียนคนนี้ — จัดไม่ได้ให้ใช้หมวด "อื่น ๆ" ตามสเปก */
export function resolveCategory(input: StoryInput): { id: string; name: string; character: string } {
  const direct = input?.categoryId
    ? categories.find((c) => c.id === input.categoryId)
    : undefined
  if (direct) return direct

  const mapped = businessTypeMap.find((m) => m.businessTypeId === input?.businessTypeId)
  const byBusiness = mapped ? categories.find((c) => c.id === mapped.categoryId) : undefined
  return byBusiness ?? DEFAULT_CATEGORY
}

/** แก่นเรื่องที่ส่งให้ AI — B-T4 มีสองแบบตามสถานะการจดทะเบียนของร้าน */
function seedRowFor(id: string, input: StoryInput): { seed: string; fallback: string } {
  const row = seeds.find((s) => s.id === id)
  if (!row) return { seed: '', fallback: storySeedsJson.genericFallback as string }
  if (input?.isRegisteredCompany && row.variants?.length) {
    const variant = row.variants.find((v) => v.when === 'registered')
    if (variant) return { seed: variant.seed, fallback: variant.fallback }
  }
  return { seed: row.seed, fallback: row.fallback }
}

/** แก่นเรื่องทุกรหัสเป็นข้อความเดียว ใช้ต่อท้าย prompt */
export function storySeedBrief(input: StoryInput): string {
  return seeds
    .map((row) => `${row.id}: ${seedRowFor(row.id, input).seed}`)
    .join('\n')
}

/**
 * เติมช่องว่างด้วยข้อมูลจริงของนักเรียน
 * **{ชื่อ} ถูกเติมที่นี่เท่านั้น ไม่เคยถูกส่งออกไปให้ AI** ตามสเปก E-07 ข้อมูลเข้า
 */
export function fillPlaceholders(template: string, input: StoryInput): string {
  const category = resolveCategory(input)
  const replacements: Record<string, string> = {
    '{ชื่อ}': (input?.nickname ?? '').trim() || 'CEO',
    '{แบรนด์}': (input?.brandName ?? '').trim() || 'ร้านของเรา',
    '{ตัวละคร}': category.character,
    '{สินค้า}': (input?.description ?? '').trim() || 'สินค้าของร้าน',
    '{ลูกค้า}': (input?.customers ?? '').trim() || 'ลูกค้าของร้าน',
    '{กลุ่มลูกค้าใหม่}': (input?.newCustomerGroup ?? '').trim() || 'ลูกค้ากลุ่มใหม่',
  }

  let out = template ?? ''
  for (const [token, value] of Object.entries(replacements)) {
    out = out.split(token).join(value)
  }
  return out
}

/** ประโยคสำรองของเรื่องเดียว — กฎล้วน ไม่แตะเน็ต ใช้ได้เสมอแม้ไม่มีคีย์ AI */
export function fallbackStoryText(id: string, input: StoryInput): string {
  const { fallback } = seedRowFor(id, input)
  return fillPlaceholders(fallback, input)
}

/**
 * ชุดเรื่องราวสำรองทั้ง 10 เรื่อง
 * ใช้เมื่อไม่มีคีย์ AI · AI ล่ม · หรือตอบมาแล้วไม่ผ่านการตรวจทั้งชุด
 */
export function fallbackStorySet(input: StoryInput, reason: FallbackReason): StoryResult {
  const category = resolveCategory(input)
  const slug = slugFromBrand(input?.brandName ?? '')
  return {
    categoryId: category.id,
    categoryName: category.name,
    character: category.character,
    brandSlug: slug,
    brandSlugAlternatives: [],
    needsBrandSlugFromStudent: slug === null,
    brandSlugPrompt: slug === null ? SLUG_FALLBACK_PROMPT : null,
    stories: seeds.map((row) => ({
      id: row.id,
      kind: row.kind === 'boss' ? 'boss' : 'mission',
      missionId: row.missionId ?? null,
      text: fallbackStoryText(row.id, input),
      source: 'fallback' as AiSource,
      fallbackReason: reason,
    })),
    safety: { famousBrand: false, inappropriate: false },
    source: 'fallback',
    provider: 'rules',
    fallbackReason: reason,
  }
}

/**
 * สร้างชื่อภาษาอังกฤษของแบรนด์แบบกฎล้วน ใช้เมื่อ AI ไม่ได้ให้มาหรือให้มาแล้วใช้ไม่ได้
 * คืน null เมื่อชื่อร้านเป็นอักษรไทยล้วน — กรณีนั้นสเปกให้เลขาโดมถามนักเรียนเอง
 */
export function slugFromBrand(brandName: string): string | null {
  const ascii = (brandName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (ascii.length < 3) return null
  return ascii.slice(0, MAX_SLUG_LENGTH)
}

/** กฎของ brand_slug ตามสเปก: a-z 0-9 และขีด ยาวไม่เกินเพดาน */
export function isValidSlug(slug: unknown): slug is string {
  if (typeof slug !== 'string') return false
  const trimmed = slug.trim()
  return (
    trimmed.length >= 3 &&
    trimmed.length <= meta.maxSlugLengthHardLimit &&
    /^[a-z0-9-]+$/.test(trimmed)
  )
}

/**
 * ข้อความหน้าตาเหมือนชื่อเว็บหรือนามสกุลเว็บหรือไม่
 * สเปกห้าม AI พิมพ์ชื่อเว็บหรือนามสกุลเว็บลงในเรื่องราวเด็ดขาด เพราะจะกลายเป็นการเฉลยโจทย์
 * และเป็นข้อเท็จจริงเรื่องโดเมนที่ AI ไม่มีสิทธิ์เขียนเอง
 */
export function looksLikeDomain(text: string): boolean {
  const value = (text ?? '').toLowerCase()
  if (/\bwww\s*\./.test(value)) return true
  if (/https?:\/\//.test(value)) return true
  // จับ .com .co.th .in.th .shop และนามสกุลอื่นที่ติดกับตัวอักษร
  if (/\.(com|net|org|shop|store|online|site|th|co|in|ac|go|or|net\.th)\b/.test(value)) return true
  if (/\.ไทย/.test(value)) return true
  return false
}

/** นับคำแบบหยาบ ๆ ด้วยช่องว่าง ใช้คู่กับเพดานตัวอักษรเพราะภาษาไทยเขียนติดกัน */
export function wordCount(text: string): number {
  return (text ?? '').trim().split(/\s+/).filter(Boolean).length
}

export interface StoryCheck {
  ok: boolean
  reason: string | null
}

/**
 * รายการตรวจผลจาก AI รายเรื่อง ตามสเปก E-07
 * - ไม่เกิน 60 คำ (และไม่เกินเพดานตัวอักษร)
 * - มีชื่อแบรนด์อยู่ในเรื่อง
 * - ไม่มีข้อความที่หน้าตาเหมือนชื่อเว็บหรือนามสกุลเว็บ
 * - ผ่านการกรองเนื้อหา E-11
 */
export function checkStoryText(text: unknown, input: StoryInput): StoryCheck {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ok: false, reason: 'ไม่มีข้อความ' }
  }
  const value = text.trim()

  if (wordCount(value) > MAX_STORY_WORDS) {
    return { ok: false, reason: `ยาวเกิน ${MAX_STORY_WORDS} คำ` }
  }
  if (value.length > MAX_STORY_CHARS) {
    return { ok: false, reason: `ยาวเกิน ${MAX_STORY_CHARS} ตัวอักษร` }
  }

  const brand = (input?.brandName ?? '').trim()
  // AI เขียน {ชื่อ} ไว้ให้ระบบแทนเอง ส่วนชื่อแบรนด์ต้องปรากฏจริงในเรื่อง
  if (brand.length > 0 && !value.includes(brand) && !value.includes('{แบรนด์}')) {
    return { ok: false, reason: 'ไม่มีชื่อแบรนด์ในเรื่อง' }
  }

  if (looksLikeDomain(value)) {
    return { ok: false, reason: 'มีข้อความที่หน้าตาเหมือนชื่อเว็บหรือนามสกุลเว็บ' }
  }

  if (!guardAiText(value, topicKeywords(`${input.brandName} ${input.description ?? ''} ${input.businessTypeId ?? ''}`), '')) {
    return { ok: false, reason: 'หลุดหัวข้อหรือไม่ปลอดภัย' }
  }

  const gate = gateAiText(value)
  if (!gate.usable) return { ok: false, reason: gate.reason }

  return { ok: true, reason: null }
}

/**
 * ประกอบผลจาก AI เป็นชุดเรื่องราวที่ใช้ได้จริง
 * **เรื่องที่ไม่ผ่านการตรวจถูกแทนด้วยประโยคสำรองเป็นรายเรื่อง** ไม่ทิ้งทั้งชุด (สเปก E-07 ข้อ 3)
 * ผลลัพธ์จึงมีครบ 10 เรื่องเสมอ ไม่ว่า AI จะตอบดีแค่ไหน
 */
export function buildStoryResult(
  raw: { intros?: Record<string, unknown>; brand_slug?: unknown; brand_slug_alternatives?: unknown; safety?: unknown },
  input: StoryInput,
  provider: StoryResult['provider'],
): StoryResult {
  const category = resolveCategory(input)
  const intros = (raw?.intros ?? {}) as Record<string, unknown>

  const stories: StoryItem[] = seeds.map((row) => {
    const candidate = intros[row.id]
    const check = checkStoryText(candidate, input)
    if (!check.ok) {
      return {
        id: row.id,
        kind: row.kind === 'boss' ? 'boss' : 'mission',
        missionId: row.missionId ?? null,
        text: fallbackStoryText(row.id, input),
        source: 'fallback',
        fallbackReason: 'bad-response',
        rejectReason: check.reason,
      }
    }
    return {
      id: row.id,
      kind: row.kind === 'boss' ? 'boss' : 'mission',
      missionId: row.missionId ?? null,
      // AI เขียน {ชื่อ} ไว้ ระบบแทนชื่อเล่นตอนนี้ AI จึงไม่เคยเห็นชื่อจริงของนักเรียน
      text: fillPlaceholders((candidate as string).trim(), input),
      source: 'ai',
      fallbackReason: null,
    }
  })

  const slugFromAi = typeof raw?.brand_slug === 'string' ? raw.brand_slug.trim().toLowerCase() : ''
  const brandSlug = isValidSlug(slugFromAi) ? slugFromAi : slugFromBrand(input?.brandName ?? '')

  const alternatives = Array.isArray(raw?.brand_slug_alternatives)
    ? raw.brand_slug_alternatives
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => isValidSlug(s))
    : []

  const safety = (raw?.safety ?? {}) as { famous_brand?: unknown; inappropriate?: unknown }
  const usableCount = stories.filter((s) => s.source === 'ai').length

  return {
    categoryId: category.id,
    categoryName: category.name,
    character: category.character,
    brandSlug,
    brandSlugAlternatives: alternatives,
    needsBrandSlugFromStudent: brandSlug === null,
    brandSlugPrompt: brandSlug === null ? SLUG_FALLBACK_PROMPT : null,
    stories,
    safety: {
      famousBrand: safety.famous_brand === true,
      inappropriate: safety.inappropriate === true,
    },
    // ชุดนี้นับว่ามาจาก AI เมื่อมีอย่างน้อย 1 เรื่องที่ผ่านการตรวจ ไม่งั้นถือว่าตกกฎทั้งชุด
    source: usableCount > 0 ? 'ai' : 'fallback',
    provider: usableCount > 0 ? provider : 'rules',
    fallbackReason: usableCount > 0 ? null : 'bad-response',
  }
}
