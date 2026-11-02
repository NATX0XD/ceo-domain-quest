/**
 * สมองของ "เลขาโดม"
 *
 * ลำดับการตอบ (askDome):
 * 1. ปุ่มตอบเร็ว → บทสำเร็จรูป (ปุ่มกระโดดไปหน้าอื่นใช้ได้ทันที ไม่เสียโควตา AI)
 * 2. จัดหมวดข้อความด้วย lib/ai/dome-scope: unsafe / injection / ข้อมูลส่วนตัว / ขอเฉลย / นอกวิชา / ภารกิจถัดไป
 *    → โดมปฏิเสธหรือเลื่อนเองด้วยบทของโดม ไม่ส่งเข้าโมเดล
 * 3. ภารกิจปัจจุบัน / ภารกิจที่ผ่านมา / คุยทั่วไป → AI จริงผ่าน createAiClient().domeChat
 *    (ตัวเลือกผู้ให้บริการ + failover + circuit breaker ใช้ชุดเดียวกับคำใบ้) แล้วผ่านตัวกันหัวข้อ + ตัวกันเฉลย
 * 4. ผู้ให้บริการล้มทุกเจ้า / ติดลิมิต / ไม่มีคีย์ / คำตอบไม่ผ่านตัวกัน → กฎในไฟล์นี้ตอบแทน (source: 'fallback')
 *
 * ⚠️ ฝั่งเซิร์ฟเวอร์เท่านั้น และห้ามให้โดมเฉลยข้อสอบ — บทพูดทุกบรรทัดในไฟล์นี้เป็นคำอธิบายกว้าง ๆ
 *    ไม่มีคำตอบของข้อ check ภารกิจไหนอยู่ในนี้
 */
import { createAiClient } from '../../lib/ai'
import type { AiClient } from '../../lib/ai/types'
import { classifyDomeMessage, isCourseTopicMessage, type DomeScope } from '../../lib/ai/dome-scope'
import { guardMissionScopedText, missionIndex, normalizeMissionId } from '../../lib/ai/topic-lock'
import { leaksAnswer } from './dome-guard'

export type DomeSource = 'ai' | 'fallback'

export interface DomeSuggestion {
  id: string
  label: string
}

export interface DomeAction {
  href: string
  label: string
}

export interface DomeReply {
  reply: string
  source: DomeSource
  suggestions: DomeSuggestion[]
  action: DomeAction | null
  /** ผู้ให้บริการที่ตอบจริง (typhoon · gemini · cloudflare) หรือ 'rules' เมื่อเป็นกฎในโค้ด */
  provider?: string
  /** หมวดที่จัดให้ข้อความนี้ ใช้ตรวจย้อนหลังและเขียนเทสต์ */
  scope?: DomeScope
}

export const DOME_PERSONA =
  'คุณคือ "โดม" เลขาส่วนตัวหุ่นยนต์ของนักเรียน ปวช.1 พูดไทยสุภาพ สั้น ให้กำลังใจ อธิบายเรื่องชื่อโดเมนให้เข้าใจง่าย ห้ามเฉลยข้อสอบ'

const QUICK_REPLIES: DomeSuggestion[] = [
  { id: 'want-website', label: 'ฉันอยากสร้างเว็บไซต์ของตัวเอง' },
  { id: 'explain-domain', label: 'ช่วยอธิบายเรื่องโดเมนให้หน่อย' },
  { id: 'ready', label: 'ฉันพร้อมเริ่มภารกิจแล้ว' },
  { id: 'other', label: 'มีคำถามอื่น ๆ' },
]

export function domeQuickReplies(): DomeSuggestion[] {
  return QUICK_REPLIES
}

export function domeGreeting(shopName: string | null): DomeReply {
  return {
    reply: shopName
      ? `สวัสดีครับ ผมโดม เลขาส่วนตัวของคุณ วันนี้เรามาทำให้ร้าน${shopName} มีชื่อเว็บเป็นของตัวเองกันครับ อยากทำอะไรก่อนดีครับ`
      : 'สวัสดีครับ ผมโดม เลขาส่วนตัวของคุณ วันนี้เราจะมาตั้งชื่อเว็บให้ร้านของคุณกันครับ เลือกได้เลย หรือพิมพ์คุยกับผมได้',
    source: 'fallback',
    suggestions: QUICK_REPLIES,
    action: shopName ? null : { href: '/setup', label: 'ตั้งชื่อร้านก่อน' },
  }
}

interface Rule {
  keywords: string[]
  reply: string
  action?: DomeAction
}

/** กฎง่าย ๆ จับคำในข้อความ ถ้าไม่เข้ากฎไหนเลยจะตอบแบบชวนคุยต่อ */
const RULES: Rule[] = [
  {
    // ถามว่าอยากมีเว็บ/อยากสร้างเว็บ ต้องได้คำตอบเรื่องเริ่มต้น ไม่ใช่คำปลอบใจ (QA-1 งง-2)
    keywords: ['อยากสร้าง', 'อยากมีเว็บ', 'สร้างเว็บ', 'เว็บไซต์ของตัวเอง', 'เปิดเว็บ'],
    reply:
      'ดีเลยครับ เริ่มจากทำความรู้จักตัวเองก่อน ผมจะได้เสนอวิธีเรียนที่เข้ากับคุณ แล้วคุณเลือกเองได้ว่าจะเอาตามที่ผมเสนอหรือจะเปลี่ยน',
    action: { href: '/profile', label: 'ไปทำความรู้จักตัวเอง' },
  },
  {
    keywords: ['โดเมน', 'domain', 'ชื่อเว็บ'],
    reply:
      'ชื่อโดเมนคือที่อยู่ของร้านเราบนอินเทอร์เน็ตครับ เหมือนบ้านเลขที่ที่คนพิมพ์แล้วมาถึงร้านเราได้เลย ชื่อร้านของเราจะอยู่ข้างหน้า ส่วนที่อยู่หลังจุดเราเรียกว่านามสกุลโดเมน',
    action: { href: '/mission/m1', label: 'ไปภารกิจที่ 1' },
  },
  {
    keywords: ['นามสกุล', '.com', '.th', 'co.th', 'in.th', 'ไทย'],
    reply:
      'นามสกุลโดเมนบอกว่าร้านเราเป็นใครครับ .com ใครก็จดได้ .co.th ต้องเป็นบริษัทที่จดทะเบียนในไทย .in.th บุคคลธรรมดาจดได้ ส่วน .ไทย ต้องมีชื่อ .th อยู่ก่อนและชื่อต้องเป็นอักษรไทย',
    action: { href: '/mission/m3', label: 'ไปภารกิจเลือกนามสกุล' },
  },
  {
    keywords: ['จด', 'ทะเบียน', 'ขั้นตอน', 'ราคา', 'ค่าใช้จ่าย'],
    reply:
      'การจดชื่อโดเมนคือการเช่าชื่อไว้เป็นรายปีครับ ต้องเลือกชื่อ เลือกนามสกุล ตรวจว่าชื่อว่างไหม แล้วยื่นเอกสารตามเงื่อนไขของนามสกุลนั้น',
    action: { href: '/mission/m4', label: 'ไปภารกิจจดชื่อเว็บ' },
  },
  {
    keywords: ['เริ่ม', 'ภารกิจ', 'พร้อม', 'ไปต่อ'],
    reply: 'ดีเลยครับ ไปเริ่มจากภารกิจที่ 1 กันก่อน ผมรออยู่ตรงนี้ ถ้าติดตรงไหนกดเรียกผมได้ทุกเมื่อ',
    action: { href: '/map', label: 'ดูแผนภารกิจของฉัน' },
  },
  {
    keywords: ['ไม่เข้าใจ', 'งง', 'ช่วย', 'ยาก', 'ติด'],
    reply:
      'ไม่เป็นไรเลยครับ การบอกว่ายังไม่เข้าใจคือสิ่งที่คนเก่งทำกัน ลองเปลี่ยนวิธีเรียนดูไหมครับ ในภารกิจมีทั้งคลิป การ์ด มินิเกม และคู่หู เปลี่ยนกลางคันได้ตลอด',
    action: { href: '/profile', label: 'เลือกเส้นทางของฉันใหม่' },
  },
  {
    keywords: ['ร้าน', 'ธุรกิจ', 'ขาย'],
    reply:
      'ร้านของคุณจะเป็นตัวตั้งต้นของทุกภารกิจเลยครับ ถ้ายังไม่ได้ตั้งชื่อร้าน ไปตั้งก่อนได้ แล้วผมจะช่วยคิดชื่อเว็บให้เข้ากับร้าน',
    action: { href: '/setup', label: 'ตั้งค่าร้านของฉัน' },
  },
]

const FALLBACK_REPLY =
  'ผมยังตอบเรื่องนี้ได้ไม่ละเอียดครับ แต่ถ้าเป็นเรื่องชื่อเว็บ นามสกุลโดเมน หรือขั้นตอนจดทะเบียน ถามผมได้เลย หรือจะเริ่มภารกิจก่อนก็ได้ครับ'

const READY_INTENT = /พร้อม|เริ่ม|ลุย|ไปต่อ|ไป.*ภารกิจ|แผนที่|ทำภารกิจ/i

const SETUP_FIRST_REPLY = 'ตั้งร้านก่อนนะครับ พอมีร้านแล้วเราค่อยออกไปทำภารกิจด้วยกัน'
const SETUP_FIRST_ACTION: DomeAction = { href: '/setup', label: 'ไปตั้งร้านก่อน' }



/**
 * ศัพท์เฉพาะที่เป็น "เนื้อหาหลัก" ของแต่ละภารกิจ — ถ้านักเรียนยังไม่ถึงภารกิจนั้นแต่คำตอบสอนศัพท์เหล่านี้ ให้ทิ้งคำตอบ
 * ตั้งใจให้แคบ เพราะคำกว้างอย่าง .com / www / จดทะเบียน โผล่เป็นตัวอย่างในคำตอบปกติได้
 */
const STRONG_LATER_TERMS: Record<'m2' | 'm3' | 'm4' | 'm5', string[]> = {
  m2: ['นามสกุลโดเมน', 'โฮสต์', 'tld'],
  m3: ['.co.th', '.in.th', '.ไทย', '.net', '.shop', 'ประเภทผู้จด'],
  m4: ['ตรวจชื่อว่าง', 'ขั้นตอนการจด', 'ค่าธรรมเนียม', 'ผู้ให้บริการจด'],
  m5: ['รูบริก', 'ใบเสนอชื่อเว็บ'],
}

/** คำตอบสอนศัพท์เฉพาะของภารกิจที่นักเรียนยังไม่ถึงหรือไม่ */
function teachesLater(reply: string, missionId: string): boolean {
  const lower = reply.toLowerCase()
  const idx = missionIndex(missionId)
  return (Object.entries(STRONG_LATER_TERMS) as Array<[keyof typeof STRONG_LATER_TERMS, string[]]>)
    .filter(([id]) => missionIndex(id) > idx)
    .some(([, terms]) => terms.some((t) => lower.includes(t)))
}

/** ประวัติสั้น ๆ ที่ส่งให้โมเดลเป็นบริบท (route โหลดจากตารางแชท) */
export interface DomeTurn {
  role: 'student' | 'dome'
  text: string
}

function matchRule(text: string): Rule | undefined {
  // เลือกกฎที่ตรงคำมากที่สุด ไม่ใช่กฎแรกที่เจอ จะได้ไม่ตอบผิดเรื่อง
  let matched: Rule | undefined
  let bestHits = 0
  for (const rule of RULES) {
    const hits = rule.keywords.filter((k) => text.includes(k)).length
    if (hits > bestHits) {
      bestHits = hits
      matched = rule
    }
  }
  return matched
}

function scripted(reply: string, action: DomeAction | null, scope?: DomeScope): DomeReply {
  return { reply, source: 'fallback', suggestions: QUICK_REPLIES, action, provider: 'rules', scope }
}

/** บทปฏิเสธ/เลื่อนของโดม (ข้อความสั้น ปวช. อ่านรู้เรื่อง ไม่ดุ ไม่มีคำว่าตก/ไม่ผ่าน) */
export function domeRefusal(scope: DomeScope, missionId: string): DomeReply | null {
  const mission = normalizeMissionId(missionId)
  const num = mission.replace('m', '')
  const back: DomeAction = { href: `/mission/${mission}`, label: `กลับไปภารกิจที่ ${num}` }
  switch (scope) {
    case 'unsafe':
      return scripted('เรื่องนี้โดมช่วยไม่ได้นะครับ ถ้าไม่สบายใจหรืออยากคุยเรื่องส่วนตัว ลองบอกครูหรือผู้ใหญ่ที่ไว้ใจได้นะครับ ส่วนเรื่องชื่อเว็บ โดมยินดีช่วยเสมอ', back, scope)
    case 'injection':
      return scripted('อันนี้โดมขอไม่ทำตามนะครับ โดมช่วยได้แค่เรื่องชื่อโดเมนกับภารกิจของเรา ลองถามเรื่องที่ติดอยู่ดูไหมครับ', back, scope)
    case 'personal':
      return scripted('ข้อมูลส่วนตัวอย่าเพิ่งบอกโดมนะครับ ทั้งเบอร์โทร เลขบัตร และรหัสผ่าน เก็บไว้กับตัวเองดีที่สุด เรากลับมาคุยเรื่องชื่อเว็บของร้านกันต่อดีกว่าครับ', back, scope)
    case 'answer-seek':
      return scripted('เฉลยตรง ๆ โดมบอกไม่ได้นะครับ เพราะอยากให้คุณคิดเองได้ แต่โดมช่วยใบ้ได้ ลองบอกว่าติดตรงไหน หรือกดขอคำใบ้ในภารกิจได้เลยครับ', back, scope)
    case 'offtopic':
      return scripted('เรื่องนี้นอกวิชาของโดมนะครับ โดมถนัดเรื่องชื่อโดเมนกับการตั้งชื่อเว็บให้ร้านของคุณ ลองถามเรื่องนี้ดูไหมครับ', back, scope)
    case 'later':
      return scripted(`เรื่องนี้เราจะได้เรียนในภารกิจถัดไปนะครับ ตอนนี้ขอให้ผ่านภารกิจที่ ${num} ก่อน แล้วโดมจะอธิบายให้เต็มที่ครับ`, back, scope)
    default:
      return null
  }
}

function scriptedFallback(text: string, scope?: DomeScope, why?: string): DomeReply {
  if (why && process.env.NODE_ENV !== 'test') console.warn(`[dome] ใช้กฎแทน AI: ${why}`)
  const matched = matchRule(text)
  return scripted(matched?.reply ?? FALLBACK_REPLY, matched?.action ?? null, scope)
}

/**
 * ตอบข้อความของผู้เรียน — พยายามใช้ AI จริงก่อน ตกไปใช้กฎเมื่อไม่ได้
 * ai ใส่เองได้ในเทสต์ (ไม่ใส่ = ชั้น lib/ai ตัวจริงที่อ่านคีย์จาก env)
 */
export async function askDome(input: {
  message: string
  quickReplyId?: string | null
  shopName: string | null
  missionId?: string
  role?: 'dome'
  history?: DomeTurn[]
  /** ขออนุญาตเรียกโมเดล (ลิมิตต่อคน) เรียกเฉพาะเมื่อข้อความจะถึงโมเดลจริง; false = ใช้กฎแทน */
  allowAi?: boolean | (() => boolean)
  ai?: Pick<AiClient, 'domeChat'>
}): Promise<DomeReply> {
  const text = input.message.trim()
  const missionId = normalizeMissionId(input.missionId)

  if (!input.shopName && (input.quickReplyId === 'ready' || READY_INTENT.test(text))) {
    return scripted(SETUP_FIRST_REPLY, SETUP_FIRST_ACTION)
  }

  if (input.quickReplyId === 'want-website') {
    return scripted('เยี่ยมเลยครับ งั้นเริ่มจากทำความรู้จักตัวเองก่อน ผมจะได้เสนอวิธีเรียนที่เข้ากับคุณที่สุด แล้วคุณเลือกเองได้ว่าจะเอาตามที่ผมเสนอหรือจะเปลี่ยน', { href: '/profile', label: 'ไปทำความรู้จักตัวเอง' })
  }
  if (input.quickReplyId === 'explain-domain') {
    const rule = RULES[0]
    return scripted(rule?.reply ?? FALLBACK_REPLY, rule?.action ?? null)
  }
  if (input.quickReplyId === 'ready') {
    return scripted('พร้อมแล้วก็ลุยเลยครับ ผมจะคอยเชียร์อยู่ข้าง ๆ ถ้าติดตรงไหนกดขอคำใบ้ได้', { href: '/map', label: 'ดูแผนภารกิจของฉัน' })
  }
  if (input.quickReplyId === 'other') {
    return scripted('ถามมาได้เลยครับ พิมพ์คำถามในช่องข้างล่าง ผมตอบเรื่องชื่อโดเมนได้เกือบทุกเรื่อง', null)
  }
  if (!text) return scriptedFallback(text)

  const scope = classifyDomeMessage(text, missionId)
  const refusal = domeRefusal(scope, missionId)
  if (refusal) return refusal
  const allowed = typeof input.allowAi === 'function' ? input.allowAi() : input.allowAi !== false
  if (!allowed) return scriptedFallback(text, scope, 'เกินลิมิตต่อคน')

  const mode = scope === 'earlier' ? 'earlier' : scope === 'current' ? 'current' : 'general'
  const client = input.ai ?? createAiClient()
  let result
  try {
    result = await client.domeChat({ missionId, message: text, mode, shopName: input.shopName, history: input.history })
  } catch (error) {
    return scriptedFallback(text, scope, `domeChat throw ${error instanceof Error ? error.message : 'unknown'}`)
  }
  if (result.source !== 'ai') return scriptedFallback(text, scope, `provider ไม่ตอบ (${result.fallbackReason ?? 'unknown'})`)
  /**
   * Models occasionally mark a perfectly valid course question as off-topic
   * (notably DNS vs domain at the boss stage). The deterministic classifier is
   * the source of truth for safety; course vocabulary is an explicit allowlist.
   * Never turn an allowed course question into the scripted off-topic refusal.
   */
  if (result.scope === 'off' && !isCourseTopicMessage(text)) {
    return domeRefusal('offtopic', missionId) ?? scriptedFallback(text, scope)
  }

  const reply = result.text.trim()
  // ย้อนทบทวนภารกิจก่อนหน้า = อนุญาตคำของภารกิจก่อนหน้าในคำตอบ ไม่ให้ตัวกันหัวข้อตีเป็นหลุดเรื่อง
  const guarded = guardMissionScopedText(reply, {
    missionId,
    role: 'dome',
    // คำยึดเรื่อง: คำตอบที่ยังพูดถึงโดเมน/เว็บ/ร้าน ถือว่าอยู่ในเรื่อง (ตัวกัน unsafe/injection ยังทำงานเสมอ)
    keywords: ['โดเมน', 'DNS', 'domain', 'นามสกุล', 'ส่วนขยาย', 'ชื่อเว็บ', 'เว็บไซต์', 'เว็บ', 'ร้าน', 'ภารกิจ'],
    fallback: '',
  })
  if (guarded === '') return scriptedFallback(text, scope, 'ตัวกันหัวข้อตีคำตอบตก')
  if (leaksAnswer(guarded)) return scriptedFallback(text, scope, 'ตัวกันเฉลยจับได้')
  if (teachesLater(guarded, missionId)) return scriptedFallback(text, scope, 'คำตอบสอนศัพท์ภารกิจที่ยังไม่ถึง')

  return {
    reply: guarded,
    source: 'ai',
    suggestions: QUICK_REPLIES,
    action: matchRule(text)?.action ?? null,
    provider: result.provider,
    scope,
  }
}
