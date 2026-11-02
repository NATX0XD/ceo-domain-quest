/**
 * ข้อความบนจอผลภารกิจ ("ภารกิจที่ N สำเร็จ") — บอกผลจริง ไม่ใช่ตัวเลขลอย ๆ
 *
 * เจ้าของโปรเจกต์ติว่าแถว "คำตอบของเรา: ข้อ ก" กับ "ผ่านแล้ว 2 จาก 4 เกาะ" ไม่มีความหมาย
 * จอผลต้องตอบ 3 อย่าง: ตอบท้ายภารกิจถูกไหม · ได้ดาวเพราะอะไร · อยากได้ดาวเพิ่มต้องทำอะไร
 *
 * ดาวมาจาก 2 ทาง (ตรงกับฝั่งเซิร์ฟเวอร์ ห้ามคิดดาวเองที่นี่ ใช้ค่าดาวจากฐานข้อมูลเท่านั้น):
 *   - `check` — ข้อตรวจท้ายภารกิจ ถูกครั้งแรก 3 ดาว · ผิด 1 ครั้ง 2 ดาว · ผิด 2 ครั้งขึ้นไป 1 ดาว
 *     (content/rubric.json คีย์ missionStars) ผ่านแล้วตอบซ้ำไม่ได้ ดาวจึงไม่เปลี่ยน
 *   - `exit-score` — m2 ให้ดาวจากคะแนนท้ายภารกิจ 90 ขึ้นไป 3 ดาว · 60–89 2 ดาว
 *     (components/server/m2-flow.ts) เล่นซ้ำได้ ระบบเก็บดาวรอบที่ดีที่สุด
 */
export type StarSource = 'check' | 'exit-score'

export interface MissionResultRecap {
  /** บรรทัดผล เช่น "ตอบคำถามท้ายภารกิจถูก" */
  verdict: string
  /** ได้ดาวเพราะอะไร */
  starHow: string
  /** ทำยังไงให้ได้ดาวเพิ่ม — null = ได้ครบแล้ว */
  improve: string | null
}

export function missionResultRecap({
  stars,
  wrong,
  starSource,
  learnScore,
  canReplay,
  maxStars = 3,
}: {
  stars: number
  /** จำนวนครั้งที่ตอบข้อตรวจยังไม่ถูกก่อนตอบถูก */
  wrong: number
  starSource: StarSource
  /** คะแนนเส้นทางเรียนรอบที่ดีที่สุด (0–100) — ใช้กับ exit-score */
  learnScore: number | null
  /** จอนี้มีปุ่ม "เล่นใหม่" ไหม — ไม่มีก็ห้ามบอกให้กด */
  canReplay: boolean
  maxStars?: number
}): MissionResultRecap {
  const full = stars >= maxStars

  if (starSource === 'exit-score') {
    const score = learnScore === null ? null : Math.max(0, Math.min(100, Math.round(learnScore)))
    return {
      verdict: 'ผ่านแบบทดสอบท้ายภารกิจแล้ว',
      starHow:
        score === null
          ? `ได้ ${stars} ดาวจากคะแนนท้ายภารกิจ (90 ขึ้นไปได้ 3 ดาว)`
          : `ได้ ${score} คะแนน จึงได้ ${stars} ดาว (90 ขึ้นไปได้ 3 ดาว)`,
      improve: full
        ? null
        : canReplay
          ? 'กด "เล่นใหม่" ทำให้ได้ 90 คะแนนขึ้นไป ระบบเก็บรอบที่ดีที่สุด'
          : 'ภารกิจต่อไปเปิดคำใบ้ก่อนตอบได้ ไม่หักดาว',
    }
  }

  const wrongTimes = Math.max(0, Math.floor(wrong))
  return {
    verdict: 'ตอบคำถามท้ายภารกิจถูก',
    starHow: full
      ? 'ตอบถูกตั้งแต่ครั้งแรก ได้ดาวครบ'
      : wrongTimes > 0
        ? `ตอบผิด ${wrongTimes} ครั้งก่อนตอบถูก จึงได้ ${stars} ดาว (ถูกครั้งแรกได้ 3 ดาว)`
        : `ได้ ${stars} ดาว (ถูกครั้งแรกได้ 3 ดาว)`,
    improve: full
      ? null
      : canReplay
        ? 'ภารกิจต่อไปเปิดคำใบ้ก่อนตอบได้ ไม่หักดาว · กด "เล่นใหม่" เพื่อทบทวน'
        : 'ภารกิจต่อไปเปิดคำใบ้ก่อนตอบได้ ไม่หักดาว',
  }
}
