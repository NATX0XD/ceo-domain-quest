// ⚠️ ห้าม import อะไรที่มีโค้ดทำงานจริงเข้าไฟล์นี้ (`import type` เท่านั้น)
//    หน้าเซิร์ฟเวอร์และคอมโพเนนต์ฝั่งเบราว์เซอร์เรียกตัวเดียวกัน ถ้าลากไฟล์ที่ต่อฐานข้อมูลเข้ามา
//    บันเดิลฝั่งเด็กจะพัง และแหล่งความจริงเดียวจะกลายเป็นสองชุดทันที
import type { CertificateStatus } from './certificate-eligibility'

/**
 * **แหล่งความจริงเดียวของคำถาม "ตอนนี้ต้องทำอะไรต่อ"** (FLOW-2 ข้อ 2)
 *
 * ## ทำไมต้องมีไฟล์นี้
 *
 * ก่อนหน้านี้ทุกจอเขียนเงื่อนไข `if` ของตัวเองจาก `CertificateStatus` ตัวเดียวกัน
 * ผลคืองานชิ้นเดียวขึ้น 3 สถานะคนละอย่างใน 3 จอพร้อมกัน (reviewer เจอของจริงใน flow-1.md ข้อ 1):
 *
 *  - `/home` บอกว่า "ครูกำลังอ่านงานของเราอยู่"  → ให้รอ
 *  - ปุ่มใต้ประโยคเดียวกันบอกว่า "ไปแก้งานแล้วส่งใหม่" → ให้ลงมือ
 *  - `/ceo` บอกว่า "ครูส่งกลับมาให้แก้"          → ให้ลงมือ
 *
 * เด็กเลือกเชื่อประโยค แล้วนั่งรอทั้งคาบทั้งที่งานถูกส่งกลับมาให้แก้ตั้งนานแล้ว
 * ต้นเหตุไม่ใช่ถ้อยคำ แต่เป็นการ **ก๊อปเงื่อนไขไปเขียนซ้ำในแต่ละจอ** แก้ทีละจอเดี๋ยวก็เพี้ยนใหม่
 *
 * ## กติกาการใช้
 *
 * ทุกจอที่ต้องบอกว่า "ตอนนี้ต้องทำอะไร" ให้เรียก `studentNextStep()` แล้วแสดงค่าที่ได้
 * **ห้ามเขียน `status === 'pending-teacher' ? ... : ...` ซ้ำในหน้าจอเด็ดขาด**
 * ถ้าถ้อยคำยังไม่ดี ให้มาแก้ที่ไฟล์นี้ที่เดียว ทุกจอจะเปลี่ยนตามพร้อมกันเสมอ
 *
 * ไฟล์นี้เป็นตัวคิดล้วน ๆ ไม่แตะฐานข้อมูล ไม่มีวันที่ ไม่มีการสุ่ม เทสต์ได้ตรง ๆ
 */

export type NextStepTone =
  /** ต้องลงมือทำต่อเดี๋ยวนี้ */
  | 'act'
  /** ส่งไปแล้ว กำลังรอคนอื่น — ต้องบอกเสมอว่าระหว่างรอทำอะไรได้ */
  | 'wait'
  /** จบขั้นนี้แล้ว */
  | 'done'

export interface NextStepAction {
  href: string
  /** คำบนปุ่ม — สั้นพอที่จะไม่ตัดบรรทัดบนจอ 390 */
  label: string
  /**
   * คำบนปุ่มแบบเต็มความหมาย เช่น `ไปภารกิจที่ 2 แยกชิ้นส่วนชื่อเว็บ`
   * จอที่มีที่ว่างพอให้ใช้ตัวนี้ จอที่แคบใช้ `label`
   */
  longLabel: string
}

export interface StudentNextStep {
  /** ป้ายสั้น 1 วลี เอาไปแปะบนการ์ด/แถบสถานะ (ห้ามยาวกว่านี้ จอ 390 ตัดคำ) */
  badge: string
  /** ประโยคเดียวที่สั่งงานได้เลย — ใช้เป็นคำพูดของโดมได้ทันที */
  line: string
  /** ปุ่มหลักของจอ */
  primary: NextStepAction
  /** ปุ่มรอง — null = จอนั้นไม่ต้องมีปุ่มที่สอง */
  secondary: NextStepAction | null
  tone: NextStepTone
}

export interface NextStepInput {
  /** สถานะใบเสนอของด่านบอส มาจาก `certificateStandingOf()` */
  status: CertificateStatus
  /** ครูส่งกลับมาให้แก้กี่ด้าน (ใช้เฉพาะตอน keep-going) */
  missingCount?: number
  /**
   * ภารกิจย่อยถัดไปที่ยังไม่ผ่าน — ถ้ายังมี ต้องมาก่อนด่านบอสเสมอ
   * `order` คือลำดับที่เด็กเห็น (เริ่มที่ 1) ไม่ใช่ index ในอาเรย์
   */
  nextMission?: { id: string; title: string; order: number } | null
  /**
   * true = จอที่เรียกคือ `/ceo` เอง ปุ่มหลักจึงต้องไม่ใช่ "ไปหน้า /ceo"
   * (จอนั้นมีปุ่มลงมือของตัวเองอยู่แล้ว เช่น "แก้แล้วส่งใหม่")
   */
  onBossScreen?: boolean
}

const MAP: NextStepAction = {
  href: '/map',
  label: 'กลับไปแผนภารกิจ',
  longLabel: 'กลับไปแผนภารกิจ',
}
const KNOWLEDGE: NextStepAction = {
  href: '/knowledge',
  label: 'อ่านคลังความรู้',
  longLabel: 'อ่านคลังความรู้ระหว่างรอครู',
}
const SHOWCASE: NextStepAction = {
  href: '/showcase',
  label: 'ดูผลงานของเพื่อน',
  longLabel: 'ดูผลงานของเพื่อนระหว่างรอครู',
}

export function studentNextStep(input: NextStepInput): StudentNextStep {
  const { status, nextMission = null, onBossScreen = false } = input
  const missing = Math.max(0, input.missingCount ?? 0)

  /**
   * ภารกิจย่อยยังไม่ครบ = ยังไม่ต้องพูดเรื่องด่านบอสเลย
   * เด็กทำทีละอย่าง ประโยคที่พูดสองเรื่องพร้อมกันคือประโยคที่เด็กไม่ทำอะไรสักอย่าง
   */
  if (nextMission) {
    return {
      badge: `ภารกิจที่ ${nextMission.order}`,
      line: `ต่อไปทำภารกิจที่ ${nextMission.order} "${nextMission.title}" กดปุ่มด้านล่างได้เลย`,
      primary: {
        href: `/mission/${nextMission.id}`,
        label: 'ทำภารกิจต่อ',
        longLabel: `ไปภารกิจที่ ${nextMission.order} ${nextMission.title}`,
      },
      secondary: MAP,
      tone: 'act',
    }
  }

  switch (status) {
    case 'not-submitted':
      return {
        badge: 'ยังไม่ได้ส่งใบเสนอ',
        line: 'ภารกิจย่อยครบแล้ว เหลือขั้นสุดท้าย ส่งใบเสนอชื่อเว็บที่ด่านบอส CEO',
        primary: onBossScreen
          ? { href: '/ceo', label: 'ส่งใบเสนอ', longLabel: 'ส่งใบเสนอชื่อเว็บ' }
          : { href: '/ceo', label: 'ไปด่านบอส CEO', longLabel: 'ไปด่านบอส CEO ส่งใบเสนอชื่อเว็บ' },
        secondary: MAP,
        tone: 'act',
      }

    case 'pending-teacher':
      return {
        badge: 'ส่งแล้ว รอครูอ่าน',
        line: 'ส่งใบเสนอแล้ว ครูกำลังอ่านอยู่ · ระหว่างรอ ไปอ่านคลังความรู้หรือดูผลงานเพื่อนได้ ไม่ต้องนั่งรอเฉย ๆ',
        primary: onBossScreen
          ? KNOWLEDGE
          : { href: '/ceo', label: 'ดูสถานะงานที่ส่งไป', longLabel: 'ดูสถานะงานที่ส่งไป' },
        secondary: onBossScreen ? SHOWCASE : KNOWLEDGE,
        tone: 'wait',
      }

    /**
     * ครูอ่านแล้วและส่งกลับมาให้แก้ — **ต้องเป็นคำสั่งให้ลงมือ ห้ามมีคำว่า "รอ" อยู่ในประโยค**
     * นี่คือจุดที่ทั้งสามจอเคยพูดไม่ตรงกันจนเด็กนั่งรอทั้งคาบ
     */
    case 'keep-going':
      return {
        badge: missing > 0 ? `ครูส่งกลับมาให้แก้ ${missing} ด้าน` : 'ครูส่งกลับมาให้แก้',
        line:
          (missing > 0
            ? `ครูอ่านงานเราแล้ว และส่งกลับมาให้แก้ ${missing} ด้าน`
            : 'ครูอ่านงานเราแล้ว และส่งกลับมาให้แก้') +
          ' · แก้แล้วส่งใหม่ได้เลย ฉบับเดิมยังอยู่',
        primary: onBossScreen
          ? { href: '/ceo', label: 'แก้แล้วส่งใหม่', longLabel: 'แก้แล้วส่งใหม่' }
          : {
              href: '/ceo',
              label: 'ไปแก้งานแล้วส่งใหม่',
              longLabel: 'ไปแก้งานที่ครูส่งกลับมาแล้วส่งใหม่',
            },
        secondary: onBossScreen ? null : MAP,
        tone: 'act',
      }

    case 'passed':
      return {
        badge: 'ครูยืนยันครบทุกด้านแล้ว',
        line: 'ครูยืนยันแล้วว่าทำได้ครบทั้ง 4 ด้าน ไปรับใบประกาศได้เลย',
        primary: { href: '/result', label: 'ดูผลและรับใบประกาศ', longLabel: 'ดูผลและรับใบประกาศ' },
        secondary: { href: '/reflect', label: 'ไปทบทวนตัวเอง', longLabel: 'ไปทบทวนตัวเอง' },
        tone: 'done',
      }
  }
}
