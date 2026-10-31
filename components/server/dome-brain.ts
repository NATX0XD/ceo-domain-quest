/**
 * สมองของ "เลขาโดม" — ตอนนี้เป็นบทสนทนาแบบกฎ (scripted) ยังไม่ได้ต่อโมเดล
 * (คีย์ AI มีแล้วและใช้กับคำใบ้/การให้คะแนนอยู่ จะสลับโดมมาใช้โมเดลเมื่อไรก็ได้)
 *
 * รอยต่อสำหรับสลับไปใช้ AI จริง (อีก session กำลังทำ lib/ai/ ที่คืน source: 'ai' | 'fallback'):
 * แก้แค่ใน askDome() 3 บรรทัด
 *   import { askAi } from '@/lib/ai'
 *   const ai = await askAi({ system: DOME_PERSONA, message })
 *   if (ai.source === 'ai') return { reply: ai.text, source: 'ai', suggestions: defaultSuggestions() }
 * หน้าจอไม่ต้องแก้เลย เพราะสัญญาการคืนค่าเป็นตัวเดียวกันอยู่แล้ว
 *
 * ⚠️ ฝั่งเซิร์ฟเวอร์เท่านั้น และห้ามให้โดมเฉลยข้อสอบ — บทพูดทุกบรรทัดในไฟล์นี้เป็นคำอธิบายกว้าง ๆ
 *    ไม่มีคำตอบของข้อ check ภารกิจไหนอยู่ในนี้
 */
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

/**
 * ตอบข้อความของผู้เรียน
 * ตอนนี้ source เป็น 'fallback' เสมอ พอเสียบ AI จริงแล้วค่อยคืน 'ai'
 */
export async function askDome(input: {
  message: string
  quickReplyId?: string | null
  shopName: string | null
  missionId?: string
  role?: 'dome'
}): Promise<DomeReply> {
  // จุดเสียบ AI จริง — ดูหัวไฟล์
  const text = input.message.trim()

  if (input.quickReplyId === 'want-website') {
    return {
      reply: `เยี่ยมเลยครับ งั้นเริ่มจากทำความรู้จักตัวเองก่อน ผมจะได้เสนอวิธีเรียนที่เข้ากับคุณที่สุด แล้วคุณเลือกเองได้ว่าจะเอาตามที่ผมเสนอหรือจะเปลี่ยน`,
      source: 'fallback',
      suggestions: QUICK_REPLIES,
      action: { href: '/profile', label: 'ไปทำความรู้จักตัวเอง' },
    }
  }
  if (input.quickReplyId === 'explain-domain') {
    const rule = RULES[0]
    return {
      reply: rule?.reply ?? FALLBACK_REPLY,
      source: 'fallback',
      suggestions: QUICK_REPLIES,
      action: rule?.action ?? null,
    }
  }
  if (input.quickReplyId === 'ready') {
    return {
      reply: 'พร้อมแล้วก็ลุยเลยครับ ผมจะคอยเชียร์อยู่ข้าง ๆ ถ้าติดตรงไหนกดขอคำใบ้ได้',
      source: 'fallback',
      suggestions: QUICK_REPLIES,
      action: { href: '/map', label: 'ดูแผนภารกิจของฉัน' },
    }
  }
  if (input.quickReplyId === 'other') {
    return {
      reply: 'ถามมาได้เลยครับ พิมพ์คำถามในช่องข้างล่าง ผมตอบเรื่องชื่อโดเมนได้เกือบทุกเรื่อง',
      source: 'fallback',
      suggestions: QUICK_REPLIES,
      action: null,
    }
  }

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
  return {
    reply: matched?.reply ?? FALLBACK_REPLY,
    source: 'fallback',
    suggestions: QUICK_REPLIES,
    action: matched?.action ?? null,
  }
}
