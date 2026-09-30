/**
 * S-08 คำขอเปลี่ยนแผนจากผู้เรียน — ตรรกะล้วน ไม่แตะฐานข้อมูล
 *
 * "ระบบเสนอ ผู้เรียนเลือก" — ใบนี้คือหลักฐานว่าผู้เรียนเป็นเจ้าของการเรียนของตัวเอง
 * จึงต้องเก็บ **สิ่งที่ขอ** กับ **สิ่งที่ได้จริง** ไว้คู่กันเสมอ และเล่าออกมาเป็นภาษาคนได้
 *
 * ไฟล์นี้รับผิดชอบ 3 อย่าง: ตรวจว่าค่าที่ขอใช้ได้จริงไหม · แปลงเป็นค่ามาตรฐานตัวเดียว ·
 * แปลงใบคำขอกับคำตอบของครูเป็นประโยคที่หน้าจอขึ้นได้เลย (ทั้งฝั่งเด็กและฝั่งครูใช้ประโยคเดียวกัน)
 */

/** ขออะไรได้บ้าง — ตรงกับ check constraint ของตาราง plan_requests */
export const PLAN_REQUEST_KINDS = ['level', 'channel', 'skip', 'time'] as const
export type PlanRequestKind = (typeof PLAN_REQUEST_KINDS)[number]

export const PLAN_REQUEST_LABELS: Record<PlanRequestKind, string> = {
  level: 'ขอเปลี่ยนระดับความยาก',
  channel: 'ขอเปลี่ยนช่องทางการเรียน',
  skip: 'ขอข้ามภารกิจนี้',
  time: 'ขอเวลาเพิ่ม',
}

/** ครูตอบได้ 3 แบบ — 'changed' คือให้ แต่ให้ไม่ตรงกับที่ขอ */
export const PLAN_REQUEST_STATUSES = ['approved', 'rejected', 'changed'] as const
export type PlanRequestStatus = (typeof PLAN_REQUEST_STATUSES)[number]

/** ช่องทางการเรียน 4 ทางตามสเปก — ค่าเดียวกับคอลัมน์ learning_route */
export const LEARNING_CHANNELS = ['clip', 'card', 'game', 'buddy'] as const
export type LearningChannel = (typeof LEARNING_CHANNELS)[number]

export const CHANNEL_LABELS: Record<LearningChannel, string> = {
  clip: 'ดูคลิป',
  card: 'อ่านการ์ด',
  game: 'เล่นเกม',
  buddy: 'เรียนกับเพื่อน',
}

/** ขอเวลาเพิ่มได้ครั้งละกี่นาที — ขอเกินนี้ให้ครูคุยกับเด็กแทนการกดปุ่ม */
export const MIN_EXTRA_MINUTES = 1
export const MAX_EXTRA_MINUTES = 15



export type NormalizedValue =
  | { ok: true; value: string | null }
  | { ok: false; message: string }

/**
 * แปลงสิ่งที่ผู้เรียนขอให้เป็นค่ามาตรฐานตัวเดียว
 *
 * เก็บเป็นข้อความเสมอเพราะคอลัมน์ `requested_value` เป็น text และต้องเทียบกับ `granted_value`
 * ที่ครูอาจกรอกมาเป็นค่าอื่น — เก็บชนิดเดียวกันทั้งคู่จึงเทียบกันได้ตรง ๆ
 *
 * 'skip' ไม่ต้องมีค่า คืน null (ตัวคำขอเองคือคำตอบอยู่แล้ว)
 */
export function normalizeRequestedValue(
  kind: PlanRequestKind,
  raw: unknown,
): NormalizedValue {
  const text = typeof raw === 'string' ? raw.trim() : raw === null || raw === undefined ? '' : String(raw).trim()

  if (kind === 'skip') return { ok: true, value: null }

  if (kind === 'level') {
    if (!/^[123]$/.test(text)) {
      return { ok: false, message: 'ระดับที่ขอต้องเป็น 1 2 หรือ 3' }
    }
    return { ok: true, value: text }
  }

  if (kind === 'channel') {
    if (!(LEARNING_CHANNELS as readonly string[]).includes(text)) {
      return {
        ok: false,
        message: `ช่องทางที่ขอต้องเป็นอย่างใดอย่างหนึ่งใน ${LEARNING_CHANNELS.join(' · ')}`,
      }
    }
    return { ok: true, value: text }
  }

  // time
  const minutes = Number(text)
  if (!Number.isInteger(minutes) || minutes < MIN_EXTRA_MINUTES || minutes > MAX_EXTRA_MINUTES) {
    return {
      ok: false,
      message: `ขอเวลาเพิ่มได้ครั้งละ ${MIN_EXTRA_MINUTES}-${MAX_EXTRA_MINUTES} นาที ถ้าต้องการมากกว่านี้ให้คุยกับครูโดยตรง`,
    }
  }
  return { ok: true, value: String(minutes) }
}

function missionLabel(missionId: string | null | undefined): string {
  if (!missionId) return ''
  if (missionId === 'boss') return ' (ด่านบอส)'
  const n = /^m([1-4])$/.exec(missionId)?.[1]
  return n ? ` (ภารกิจที่ ${n})` : ` (${missionId})`
}

function valueLabel(kind: PlanRequestKind, value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  if (kind === 'level') return `ระดับ ${value}`
  if (kind === 'channel') {
    return CHANNEL_LABELS[value as LearningChannel] ?? value
  }
  if (kind === 'time') return `${value} นาที`
  return value
}

/** ใบคำขอเล่าเป็นประโยคเดียว — ฝั่งเด็กและแผงครูใช้ประโยคเดียวกัน จะได้ไม่เข้าใจคนละอย่าง */
export function describeRequest(input: {
  kind: PlanRequestKind
  requestedValue?: string | null
  missionId?: string | null
}): string {
  const head = PLAN_REQUEST_LABELS[input.kind]
  const value = valueLabel(input.kind, input.requestedValue)
  const where = missionLabel(input.missionId)
  return value ? `${head} เป็น ${value}${where}` : `${head}${where}`
}

/**
 * คำตอบของครูเล่าเป็นประโยคเดียว — **บอกทั้งสิ่งที่ขอและสิ่งที่ได้เสมอ**
 * เพราะ 'changed' คือได้ไม่ตรงกับที่ขอ ถ้าเล่าแค่ค่าที่ได้ เด็กจะไม่รู้ว่าคำขอตัวเองไปไหน
 */
export function describeAnswer(input: {
  kind: PlanRequestKind
  status: PlanRequestStatus
  requestedValue?: string | null
  grantedValue?: string | null
  teacherResponse?: string | null
}): string {
  const requested = valueLabel(input.kind, input.requestedValue)
  const granted = valueLabel(input.kind, input.grantedValue)
  const note = (input.teacherResponse ?? '').trim()
  const tail = note ? ` — ครูบอกว่า “${note}”` : ''

  if (input.status === 'rejected') {
    return `ครูยังไม่ให้รอบนี้${tail}`
  }

  if (input.status === 'changed') {
    const from = requested ? `ที่ขอไว้คือ ${requested} ` : ''
    return granted ? `${from}ครูให้เป็น ${granted} แทน${tail}` : `ครูให้แบบอื่นแทน${tail}`
  }

  return granted ? `ครูให้แล้ว: ${granted}${tail}` : `ครูให้แล้ว${tail}`
}

/** ยังรอครูตอบอยู่ไหม — คำขอที่ยังไม่ตอบต้องขึ้นเด่นทั้งบนจอเด็กและแผงครู */
export function isPending(status: string | null | undefined): boolean {
  return status === 'pending' || status === null || status === undefined
}
