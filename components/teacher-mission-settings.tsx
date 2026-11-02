'use client'

import { useMemo, useState } from 'react'
import { Button, Card, EmptyState, missionColor, type Tone } from '@/app/teacher/_ux/ui'
import { Icon3d, type Icon3dName } from '@/app/teacher/_ux/v2'

type MissionId = 'm1' | 'm2' | 'm3' | 'm4' | 'ceo'
type Bag = Record<string, unknown>
type Snapshot = Record<MissionId, { label: string; help: string; info: { title: string; what: string }; defaults: Bag; settings: Bag }>
type Field = { key: string; label: string; help: string; effect: string; min?: number; max?: number; suffix?: string }

const IDS: MissionId[] = ['m1', 'm2', 'm3', 'm4', 'ceo']
const FIELDS: Record<MissionId, Field[]> = {
  m1: [
    { key: 'passScore', label: 'คะแนนผ่าน', help: 'คะแนนเต็ม 100 ที่ต้องได้', effect: 'ถ้าสูงขึ้น: นักเรียนต้องตอบได้แม่นขึ้นจึงจะผ่าน', min: 50, max: 100, suffix: 'คะแนน' },
    { key: 'modesEnabled.watch', label: 'โหมดดูคลิป', help: 'ให้เลือกเรียนด้วยการดูคลิป', effect: 'ถ้าปิด: นักเรียนจะไม่เห็นปุ่มดูคลิป' },
    { key: 'modesEnabled.read', label: 'โหมดอ่าน', help: 'ให้เลือกเรียนด้วยการอ่านการ์ด', effect: 'ถ้าปิด: นักเรียนจะไม่เห็นปุ่มอ่านการ์ด' },
    { key: 'modesEnabled.do', label: 'โหมดลงมือทำ', help: 'ให้เลือกเรียนด้วยการตอบคำถาม', effect: 'ถ้าปิด: นักเรียนจะไม่เห็นปุ่มลงมือทำ' },
    { key: 'aiFeedback', label: 'คำแนะนำจากโดม', help: 'แสดงคำแนะนำหลังส่งคำตอบ', effect: 'ถ้าปิด: นักเรียนจะไม่ได้เห็นคำแนะนำจากโดม' },
  ],
  m2: [
    { key: 'textAttempts', label: 'จำนวนครั้งฝึกเขียน', help: 'จำนวนครั้งสูงสุดก่อนขยับต่อ', effect: 'ถ้าเพิ่ม: นักเรียนมีโอกาสลองเขียนใหม่มากขึ้น', min: 1, max: 6, suffix: 'ครั้ง' },
    { key: 'exitQuestions', label: 'คำถามเช็กความเข้าใจ', help: 'ไม่เกินจำนวนข้อที่มีในเนื้อหา', effect: 'ถ้าเพิ่ม: นักเรียนต้องตอบคำถามท้ายด่านมากขึ้น', min: 1, max: 3, suffix: 'ข้อ' },
    { key: 'passScore', label: 'คะแนนผ่าน', help: 'คะแนนเต็ม 100 ที่ต้องได้', effect: 'ถ้าสูงขึ้น: นักเรียนต้องตอบได้แม่นขึ้นจึงจะผ่าน', min: 50, max: 100, suffix: 'คะแนน' },
    { key: 'simStages', label: 'ด่านจำลอง', help: 'จำนวนช่วงของสถานการณ์จำลอง', effect: 'ถ้าเพิ่ม: นักเรียนจะได้ฝึกสถานการณ์มากขึ้นก่อนผ่าน', min: 1, max: 4, suffix: 'ด่าน' },
    { key: 'aiFeedback', label: 'คำแนะนำจากโดม', help: 'แสดงคำแนะนำหลังส่งคำตอบ', effect: 'ถ้าปิด: นักเรียนจะไม่ได้เห็นคำแนะนำจากโดม' },
  ],
  m3: [
    { key: 'practiceEnabled', label: 'เปิดช่วงฝึกซ้อม', help: 'ให้ลองระบบก่อนเริ่มรอบจริง', effect: 'ถ้าปิด: นักเรียนจะเข้ารอบจริงทันที' },
    { key: 'realCustomers', label: 'จำนวนลูกค้ารอบจริง', help: 'จำนวนลูกค้าที่ต้องดูแลในรอบจริง', effect: 'ถ้าเพิ่ม: นักเรียนต้องดูแลลูกค้ามากขึ้น', min: 1, max: 6, suffix: 'คน' },
    { key: 'customerSeconds', label: 'เวลาต่อลูกค้า', help: 'เวลาที่มีให้ดูแลลูกค้าแต่ละคน', effect: 'ถ้าลด: นักเรียนต้องตัดสินใจเร็วขึ้น', min: 60, max: 600, suffix: 'วินาที' },
    { key: 'extendSeconds', label: 'เวลาเพิ่ม', help: 'เวลาที่เติมได้เมื่อจำเป็น', effect: 'ถ้าเป็น 0: นักเรียนจะกดขอเวลาเพิ่มไม่ได้', min: 0, max: 180, suffix: 'วินาที' },
    { key: 'handbookSeconds', label: 'เวลาอ่านคู่มือ', help: 'เวลาสำหรับอ่านคู่มือก่อนเริ่ม', effect: 'ถ้าลด: นักเรียนมีเวลาอ่านขั้นตอนน้อยลง', min: 5, max: 120, suffix: 'วินาที' },
    { key: 'customerQuestions', label: 'คำถามต่อลูกค้า', help: 'จำนวนคำถามที่ใช้ประเมินลูกค้า', effect: 'ถ้าเพิ่ม: นักเรียนต้องถามเพื่อเข้าใจลูกค้ามากขึ้น', min: 0, max: 6, suffix: 'ข้อ' },
    { key: 'domeQuota', label: 'โควตาคำแนะนำโดม', help: 'เว้นว่าง = ไม่จำกัด', effect: 'ถ้าลด: นักเรียนขอคำแนะนำจากโดมได้จำกัดครั้ง', min: 0, max: 20, suffix: 'ครั้ง' },
    { key: 'hints', label: 'จำนวนคำใบ้', help: 'จำนวนคำใบ้ที่ผู้เรียนขอได้', effect: 'ถ้าลด: นักเรียนมีตัวช่วยระหว่างเล่นน้อยลง', min: 0, max: 5, suffix: 'ใบ' },
    { key: 'tagPass', label: 'เกณฑ์ผ่านการจัดหมวด', help: 'คะแนนเต็ม 100', effect: 'ถ้าสูงขึ้น: ต้องจัดหมวดนามสกุลได้ถูกมากขึ้น', min: 50, max: 100, suffix: 'คะแนน' },
    { key: 'stampPass', label: 'เกณฑ์ผ่านการประทับตรา', help: 'คะแนนเต็ม 100', effect: 'ถ้าสูงขึ้น: ต้องทำขั้นตอนจดทะเบียนได้ถูกมากขึ้น', min: 50, max: 100, suffix: 'คะแนน' },
  ],
  m4: [
    { key: 'timerSeconds', label: 'เวลารวม', help: 'เวลาสำหรับด่านค้นหาชื่อ', effect: 'ถ้าลด: นักเรียนต้องค้นหาและตัดสินใจเร็วขึ้น', min: 120, max: 900, suffix: 'วินาที' },
    { key: 'startCoins', label: 'เหรียญเริ่มต้น', help: 'งบเริ่มต้นของผู้เรียน', effect: 'ถ้าลด: นักเรียนต้องเลือกซื้อชื่ออย่างประหยัดขึ้น', min: 1000, max: 20000, suffix: 'เหรียญ' },
    { key: 'explainPass', label: 'เกณฑ์อธิบายเหตุผล', help: 'จำนวนเหตุผลที่ต้องอธิบายถูก', effect: 'ถ้าเพิ่ม: นักเรียนต้องอธิบายเหตุผลได้ครบมากขึ้น', min: 5, max: 10, suffix: 'ข้อ' },
    { key: 'eventsPass', label: 'เหตุการณ์ที่ต้องผ่าน', help: 'จำนวนเหตุการณ์สำคัญ', effect: 'ถ้าเพิ่ม: นักเรียนต้องผ่านเหตุการณ์ในร้านมากขึ้น', min: 2, max: 4, suffix: 'เหตุการณ์' },
    { key: 'tutorialEnabled', label: 'เปิดบทสอนก่อนเล่น', help: 'แสดงคำแนะนำการเล่นครั้งแรก', effect: 'ถ้าปิด: นักเรียนจะเริ่มเกมโดยไม่เห็นบทสอน' },
  ],
  ceo: [
    { key: 'aiGrading', label: 'ให้โดมช่วยตรวจเบื้องต้น', help: 'ใช้ AI เสนอคะแนนก่อนครูยืนยัน', effect: 'ถ้าปิด: งานจะไม่มีคะแนนแนะนำจากโดม แต่ยังผ่านและได้เกียรติบัตรอัตโนมัติ' },
    { key: 'revisions', label: 'จำนวนรอบแก้ไข', help: 'จำนวนครั้งที่ผู้เรียนแก้งานได้', effect: 'ถ้าเพิ่ม: นักเรียนมีโอกาสปรับงานก่อนส่งใหม่มากขึ้น', min: 0, max: 5, suffix: 'รอบ' },
    { key: 'submitModes.write', label: 'ส่งแบบเขียน', help: 'ให้พิมพ์คำตอบในระบบ', effect: 'ถ้าปิด: นักเรียนจะไม่เห็นช่องส่งคำตอบแบบเขียน' },
    { key: 'submitModes.voice', label: 'ส่งแบบเสียง', help: 'ให้แนบเสียงนำเสนอ', effect: 'ถ้าปิด: นักเรียนจะไม่เห็นช่องแนบเสียงนำเสนอ' },
    { key: 'submitModes.design', label: 'ส่งแบบออกแบบ', help: 'ให้ส่งผลงานออกแบบ', effect: 'ถ้าปิด: นักเรียนจะไม่เห็นช่องส่งผลงานออกแบบ' },
  ],
}

const HERO: Record<MissionId, { icon: Icon3dName; art: string }> = {
  m1: { icon: 'books', art: '/ui/teacher/mission-m1.webp' },
  m2: { icon: 'magnifying-glass-tilted-left', art: '/ui/teacher/mission-m2.webp' },
  m3: { icon: 'handshake', art: '/ui/teacher/mission-m3.webp' },
  m4: { icon: 'bullseye', art: '/ui/teacher/mission-m4.webp' },
  ceo: { icon: 'crown', art: '/ui/teacher/mission-ceo.webp' },
}

const MISSION_STEPS: Record<MissionId, string[]> = {
  m1: ['เรียนรู้ประโยชน์ของชื่อเว็บ', 'เลือกช่องทางเรียนที่ถนัด', 'ตอบคำถามท้ายด่าน'],
  m2: ['แยกชิ้นส่วนของชื่อเว็บ', 'ลองต่อชื่อเว็บจากสถานการณ์', 'ตอบคำถามเช็กความเข้าใจ'],
  m3: ['ทำความรู้จักนามสกุลแต่ละประเภท', 'จัดหมวดให้เหมาะกับร้าน', 'ซ้อมรับลูกค้าและจดทะเบียน'],
  m4: ['อ่านเงื่อนไขการจดชื่อเว็บ', 'ค้นหาชื่อที่ยังว่าง', 'เรียงขั้นตอนให้ถูกต้อง'],
  ceo: ['เลือกชื่อและนามสกุลให้ร้าน', 'เขียนเหตุผลจากลูกค้าและธุรกิจ', 'ส่งใบเสนอชื่อเว็บ'],
}

function stepsFor(id: MissionId) {
  return MISSION_STEPS[id]
}

/** กลุ่มของช่องตั้งค่าในแต่ละด่าน — ช่องที่ไม่อยู่ในกลุ่มไหนไปรวมที่ "อื่น ๆ" */
const GROUPS: Record<MissionId, Array<{ title: string; icon: Icon3dName; tone: Tone; keys: string[] }>> = {
  m1: [
    { title: 'รูปแบบการเรียน', icon: 'television', tone: 'blue', keys: ['modesEnabled.watch', 'modesEnabled.read', 'modesEnabled.do'] },
    { title: 'เกณฑ์และตัวช่วย', icon: 'bullseye', tone: 'green', keys: ['passScore', 'aiFeedback'] },
  ],
  m2: [
    { title: 'การฝึกเขียน', icon: 'memo', tone: 'purple', keys: ['textAttempts', 'simStages'] },
    { title: 'เกณฑ์และตัวช่วย', icon: 'bullseye', tone: 'green', keys: ['exitQuestions', 'passScore', 'aiFeedback'] },
  ],
  m3: [
    { title: 'ช่วงฝึกซ้อม', icon: 'light-bulb', tone: 'amber', keys: ['practiceEnabled', 'hints', 'domeQuota'] },
    { title: 'รอบจริงหน้าร้าน', icon: 'stopwatch', tone: 'orange', keys: ['realCustomers', 'customerSeconds', 'extendSeconds', 'handbookSeconds', 'customerQuestions'] },
    { title: 'เกณฑ์ผ่าน', icon: 'check-mark-button', tone: 'green', keys: ['tagPass', 'stampPass'] },
  ],
  m4: [
    { title: 'เวลาและงบ', icon: 'alarm-clock', tone: 'teal', keys: ['timerSeconds', 'startCoins', 'tutorialEnabled'] },
    { title: 'เกณฑ์ผ่าน', icon: 'check-mark-button', tone: 'green', keys: ['explainPass', 'eventsPass'] },
  ],
  ceo: [
    { title: 'การตรวจงาน', icon: 'robot', tone: 'purple', keys: ['aiGrading', 'revisions'] },
    { title: 'ช่องทางส่งงาน', icon: 'speech-balloon', tone: 'rose', keys: ['submitModes.write', 'submitModes.voice', 'submitModes.design'] },
  ],
}

/** ประโยค "นักเรียนจะเจอ" แบบสดจากค่าที่กำลังตั้ง */
function previewOf(id: MissionId, v: (k: string) => unknown): string {
  const n = (k: string) => (v(k) === null || v(k) === undefined ? null : Number(v(k)))
  const on = (k: string) => v(k) === true
  const mins = (sec: number | null) => (sec === null ? '-' : sec >= 60 ? `${Math.round((sec / 60) * 10) / 10} นาที` : `${sec} วินาที`)
  if (id === 'm1') {
    const modes = [on('modesEnabled.watch') && 'ดูคลิป', on('modesEnabled.read') && 'อ่านการ์ด', on('modesEnabled.do') && 'ลงมือทำ'].filter(Boolean)
    return `เลือกเรียนได้ ${modes.length > 0 ? modes.join(' / ') : 'ยังไม่เปิดรูปแบบใดเลย'} · ผ่านเมื่อได้ ${n('passScore')} คะแนน`
  }
  if (id === 'm2') return `ฝึกเขียนได้ ${n('textAttempts')} ครั้ง · จำลอง ${n('simStages')} ช่วง · ตอบเช็กความเข้าใจ ${n('exitQuestions')} ข้อ · ผ่านที่ ${n('passScore')} คะแนน`
  if (id === 'm3') return `${on('practiceEnabled') ? `ลูกค้าฝึก 1 + ` : 'ข้ามช่วงฝึก · '}จริง ${n('realCustomers')} คน · ${mins(n('customerSeconds'))}/คน · อ่านคู่มือ ${mins(n('handbookSeconds'))} · ใบ้ได้ ${n('hints')} ใบ`
  if (id === 'm4') return `เวลา ${mins(n('timerSeconds'))} · เริ่มด้วย ${n('startCoins')?.toLocaleString('th-TH')} เหรียญ · ต้องอธิบายถูก ${n('explainPass')} ข้อ และผ่าน ${n('eventsPass')} เหตุการณ์`
  const sub = [on('submitModes.write') && 'เขียน', on('submitModes.voice') && 'เสียง', on('submitModes.design') && 'ออกแบบ'].filter(Boolean)
  return `ส่งงานแบบ ${sub.length > 0 ? sub.join(' / ') : 'ยังไม่เปิดช่องทางใดเลย'} · แก้ไขได้ ${n('revisions')} รอบ · ${on('aiGrading') ? 'โดมช่วยตรวจเบื้องต้น แล้วครูยืนยัน' : 'ครูตรวจเองทั้งหมด'}`
}

function displayValue(value: unknown, suffix?: string): string {
  if (value === null || value === undefined) return 'ไม่จำกัด'
  if (typeof value === 'boolean') return value ? 'เปิด' : 'ปิด'
  return `${Number(value).toLocaleString('th-TH')}${suffix ? ` ${suffix}` : ''}`
}

function settingPreview(id: MissionId, key: string, value: unknown, read?: (key: string) => unknown): { text?: string; chips?: Array<{ label: string; on: boolean }> } {
  if (id === 'm1' && key.startsWith('modesEnabled.')) {
    return {
      chips: [
        { label: 'ดูคลิป', on: key.endsWith('watch') ? value === true : read?.('modesEnabled.watch') === true },
        { label: 'อ่านการ์ด', on: key.endsWith('read') ? value === true : read?.('modesEnabled.read') === true },
        { label: 'ลงมือทำ', on: key.endsWith('do') ? value === true : read?.('modesEnabled.do') === true },
      ],
    }
  }
  const text: Record<string, string> = {
    'm1.passScore': `แถบผ่าน: ${displayValue(value, 'คะแนน')}`,
    'm1.aiFeedback': value === true ? 'หลังตอบ: มีคำแนะนำจากโดม' : 'หลังตอบ: ไม่มีคำแนะนำจากโดม',
    'm2.textAttempts': `กล่องฝึกเขียน: ลองได้ ${displayValue(value, 'ครั้ง')}`,
    'm2.exitQuestions': `ท้ายด่าน: มีคำถาม ${displayValue(value, 'ข้อ')}`,
    'm2.passScore': `แถบผ่าน: ${displayValue(value, 'คะแนน')}`,
    'm2.simStages': `สถานการณ์จำลอง: ${displayValue(value, 'ช่วง')}`,
    'm2.aiFeedback': value === true ? 'หลังตอบ: มีคำแนะนำจากโดม' : 'หลังตอบ: ไม่มีคำแนะนำจากโดม',
    'm3.practiceEnabled': value === true ? 'ก่อนเล่น: มีช่วงลองระบบ' : 'ก่อนเล่น: เข้ารอบจริงทันที',
    'm3.realCustomers': `รอบจริง: ลูกค้า ${displayValue(value, 'คน')}`,
    'm3.customerSeconds': `นาฬิกา: ${displayValue(value, 'วินาที')} ต่อลูกค้า`,
    'm3.extendSeconds': `ปุ่มเพิ่มเวลา: ${displayValue(value, 'วินาที')}`,
    'm3.handbookSeconds': `คู่มือก่อนเริ่ม: ${displayValue(value, 'วินาที')}`,
    'm3.customerQuestions': `คำถามหน้าร้าน: ${displayValue(value, 'ข้อ')} ต่อลูกค้า`,
    'm3.domeQuota': `คำแนะนำจากโดม: ${displayValue(value, 'ครั้ง')}`,
    'm3.hints': `ปุ่มคำใบ้: ${displayValue(value, 'ใบ')}`,
    'm3.tagPass': `จัดหมวดผ่านที่: ${displayValue(value, 'คะแนน')}`,
    'm3.stampPass': `ประทับตราผ่านที่: ${displayValue(value, 'คะแนน')}`,
    'm4.timerSeconds': `นาฬิกาด่าน: ${displayValue(value, 'วินาที')}`,
    'm4.startCoins': `กระเป๋าเริ่มต้น: ${displayValue(value, 'เหรียญ')}`,
    'm4.explainPass': `ต้องอธิบายถูก: ${displayValue(value, 'ข้อ')}`,
    'm4.eventsPass': `เหตุการณ์ที่ต้องผ่าน: ${displayValue(value, 'เหตุการณ์')}`,
    'm4.tutorialEnabled': value === true ? 'ก่อนเล่น: เห็นบทสอน' : 'ก่อนเล่น: ข้ามบทสอน',
    'ceo.aiGrading': value === true ? 'หลังส่ง: มีคะแนนแนะนำจากโดม' : 'หลังส่ง: ครูดูงานเอง',
    'ceo.revisions': `ปุ่มส่งใหม่: แก้ได้ ${displayValue(value, 'รอบ')}`,
    'ceo.submitModes.write': value === true ? 'ช่องส่งงาน: เขียน' : 'ช่องส่งงาน: ไม่มีแบบเขียน',
    'ceo.submitModes.voice': value === true ? 'ช่องส่งงาน: เสียง' : 'ช่องส่งงาน: ไม่มีแบบเสียง',
    'ceo.submitModes.design': value === true ? 'ช่องส่งงาน: ออกแบบ' : 'ช่องส่งงาน: ไม่มีแบบออกแบบ',
  }
  return { text: text[`${id}.${key}`] ?? `ตัวอย่างนักเรียน: ${displayValue(value)}` }
}

function passWhen(id: MissionId, v: (k: string) => unknown): string {
  const n = (key: string) => Number(v(key) ?? 0).toLocaleString('th-TH')
  if (id === 'm1') return `ตอบเช็กความเข้าใจได้ ${n('passScore')} คะแนนขึ้นไป`
  if (id === 'm2') return `ได้ ${n('passScore')} คะแนน และผ่านจำลอง ${n('simStages')} ช่วง`
  if (id === 'm3') return `จัดหมวด ${n('tagPass')} คะแนน + ประทับตรา ${n('stampPass')} คะแนน ในรอบจริง`
  if (id === 'm4') return `อธิบายถูก ${n('explainPass')} ข้อ และผ่าน ${n('eventsPass')} เหตุการณ์`
  return 'ส่งงานตามช่องทางที่เปิด นักเรียนผ่านและได้เกียรติบัตรอัตโนมัติ'
}

const stepFor = (suffix?: string) => (suffix === 'วินาที' ? 5 : suffix === 'เหรียญ' ? 500 : 1)

function getValue(settings: Bag, key: string): unknown {
  return key.split('.').reduce<unknown>((current, part) => (current && typeof current === 'object' ? (current as Bag)[part] : undefined), settings)
}

function setValue(settings: Bag, key: string, value: unknown): Bag {
  const parts = key.split('.')
  const next: Bag = structuredClone(settings)
  let cursor = next
  for (const part of parts.slice(0, -1)) {
    cursor[part] = { ...(cursor[part] as Bag) }
    cursor = cursor[part] as Bag
  }
  cursor[parts.at(-1)!] = value
  return next
}

export function TeacherMissionSettings({ classroomId, initial }: { classroomId: string | null; initial: Snapshot | null }) {
  const [active, setActive] = useState<MissionId>('m1')
  const [values, setValues] = useState<Snapshot | null>(initial)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const current = values?.[active]
  const fields = useMemo(() => FIELDS[active], [active])
  const fieldByKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields])

  function update(key: string, value: unknown) {
    if (!values) return
    setValues({ ...values, [active]: { ...values[active], settings: setValue(values[active].settings, key, value) } })
    setNotice(null)
  }

  async function save() {
    if (!classroomId || !current) return
    setSaving(true)
    setNotice(null)
    try {
      const res = await fetch(`/api/teacher/mission-settings?classroomId=${classroomId}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ missionId: active, settings: current.settings }),
      })
      const body = await res.json().catch(() => null) as { message?: string; setting?: { settings?: Bag } } | null
      if (!res.ok) throw new Error(body?.message ?? 'บันทึกไม่สำเร็จ')
      if (body?.setting?.settings) setValues({ ...values, [active]: { ...current, settings: body.setting.settings } })
      setNotice('บันทึกค่าด่านแล้ว')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ')
    } finally { setSaving(false) }
  }

  function reset() {
    if (!values) return
    setValues({ ...values, [active]: { ...values[active], settings: structuredClone(values[active].defaults) } })
    setNotice('คืนค่าเริ่มต้นแล้ว กดบันทึกเพื่อใช้ค่านี้')
  }

  if (!classroomId || !values || !current) {
    return (
      <Card>
        <EmptyState title="ยังไม่ได้เลือกห้องเรียน" body="เลือกห้องเรียนก่อนจึงจะตั้งค่าด่านได้" />
      </Card>
    )
  }

  const activeNo = IDS.indexOf(active) + 1
  const bad = Boolean(notice && notice.includes('ไม่สำเร็จ'))
  const color = missionColor(activeNo)
  const groups = [
    ...GROUPS[active],
  ]
  const used = new Set(groups.flatMap((g) => g.keys))
  const rest = fields.filter((f) => !used.has(f.key)).map((f) => f.key)
  if (rest.length > 0) groups.push({ title: 'อื่น ๆ', icon: 'gear', tone: 'gray', keys: rest })
  const get = (k: string) => getValue(current.settings, k)
  const info = { ...current.info, steps: stepsFor(active) }

  return (
    <section className="grid gap-5" aria-label="ตั้งค่าด่าน">
      <div role="tablist" aria-label="เลือกด่าน" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {IDS.map((id, index) => {
          const on = id === active
          const c = missionColor(index + 1)
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => { setActive(id); setNotice(null) }}
              className="flex items-center gap-3 rounded-2xl border bg-white p-3 text-left transition-all focus-visible:ring-2 focus-visible:ring-[var(--c-brand-ring)] focus-visible:outline-none"
              style={{
                borderColor: on ? c : 'var(--c-line)',
                boxShadow: on ? `0 0 0 3px color-mix(in srgb, ${c} 22%, transparent), var(--sh-1)` : 'var(--sh-1)',
              }}
            >
              <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${c} 16%, white)` }}>
                <Icon3d name={HERO[id].icon} size={26} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold" style={{ color: on ? c : 'var(--c-ink)' }}>ด่าน {index < 4 ? index + 1 : 'CEO'}</span>
                <span className="block truncate text-[12px] text-[var(--c-ink-3)]">{values[id].label.split('·')[1]?.trim()}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 min-w-0 flex-1 text-[14px] leading-6 text-[var(--c-ink-2)]">
          <span aria-hidden className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: color }} />
          {current.help}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={reset}>คืนค่าเริ่มต้น</Button>
          <Button size="sm" kind="primary" data-topbar-save onClick={() => void save()} disabled={saving}>
            {saving ? 'กำลังบันทึก…' : 'บันทึกด่านนี้'}
          </Button>
        </div>
      </div>

      <article className="t3-card grid gap-4 overflow-hidden p-4 sm:grid-cols-[190px_minmax(0,1fr)]" style={{ borderColor: `color-mix(in srgb, ${color} 35%, white)` }}>
        <div className="flex min-h-36 items-center justify-center overflow-hidden rounded-2xl" style={{ background: `color-mix(in srgb, ${color} 10%, white)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HERO[active].art} alt="" width={640} height={400} className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="m-0 text-[12px] font-extrabold uppercase tracking-[0.16em]" style={{ color }}>ภาพรวมด่าน</p>
              <h2 className="m-0 mt-1 text-[20px] leading-7 font-extrabold text-[var(--c-ink)]">{info.title}</h2>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-[var(--c-ink-2)] shadow-[var(--sh-1)]">ปรับได้เฉพาะห้องนี้</span>
          </div>
          <p className="m-0 mt-3 text-[14px] leading-5 text-[var(--c-ink-2)]"><strong className="text-[var(--c-ink)]">ด่านนี้คืออะไร</strong> {info.what}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="m-0 text-[12px] font-extrabold text-[var(--c-ink)]">นักเรียนต้องทำอะไร</p>
              <ol className="m-0 mt-1.5 list-decimal space-y-0.5 pl-5 text-[13px] leading-5 text-[var(--c-ink-2)]">
                {info.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
            <div className="rounded-xl bg-white/80 p-3">
              <p className="m-0 text-[12px] font-extrabold text-[var(--c-ink)]">ผ่านเมื่อ</p>
              <p className="m-0 mt-1 text-[14px] leading-5 font-bold text-[var(--c-ink-2)]" aria-live="polite">{passWhen(active, get)}</p>
            </div>
          </div>
        </div>
      </article>

      <div className="t3-card flex flex-wrap items-center gap-3 p-4" style={{ borderColor: `color-mix(in srgb, ${color} 35%, white)`, background: `color-mix(in srgb, ${color} 7%, white)` }}>
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-white shadow-[var(--sh-1)]"><Icon3d name="eyes" size={24} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold" style={{ color }}>นักเรียนจะเจอ</p>
          <p className="text-[15px] font-semibold text-[var(--c-ink)]" aria-live="polite">{previewOf(active, get)}</p>
        </div>
      </div>

      {notice ? (
        <p
          role="status"
          className="rounded-xl px-4 py-2.5 text-[14px] font-semibold"
          style={{ background: bad ? 'var(--s-danger-soft)' : 'var(--s-success-soft)', color: bad ? 'var(--s-danger-ink)' : 'var(--s-success-ink)' }}
        >
          {notice}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map((g) => {
          const gf = g.keys.map((k) => fieldByKey.get(k)).filter(Boolean) as typeof fields
          if (gf.length === 0) return null
          return (
            <Card key={g.title} title={g.title} icon={<Icon3d name={g.icon} size={22} />} tone={g.tone} className={gf.length > 3 && g.keys.length > 3 ? 'lg:col-span-2' : ''}>
              <div className={`grid gap-3 ${gf.length > 3 ? 'lg:grid-cols-2' : ''}`}>
                {gf.map((field) => {
                  const value = get(field.key)
                  const recommended = getValue(current.defaults, field.key)
                  const preview = settingPreview(active, field.key, value, get)
                  if (field.min === undefined) {
                    const checked = value === true
                    return (
                      <button
                        key={field.key}
                        type="button"
                        role="switch"
                        aria-checked={checked}
                        onClick={() => update(field.key, !checked)}
                        className="flex w-full items-center justify-between gap-4 rounded-2xl border p-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--c-brand-ring)] focus-visible:outline-none"
                        style={{ borderColor: checked ? 'var(--s-success)' : 'var(--c-line)', background: checked ? 'var(--s-success-soft)' : '#fff' }}
                      >
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-[var(--c-ink)]">
                            {field.label}
                            <span className="rounded-full bg-[var(--c-sunken)] px-2 py-0.5 text-[11px] font-bold text-[var(--c-ink-3)]">แนะนำ {displayValue(recommended)}</span>
                          </span>
                          <span className="block text-[13px] text-[var(--c-ink-3)]">{field.help}</span>
                          <span className="mt-1 block text-[12px] leading-4 text-[var(--c-ink-2)]">{field.effect}</span>
                          {preview.chips ? <span className="mt-2 flex flex-wrap gap-1.5" aria-label="ตัวอย่างโหมดที่นักเรียนเห็น">{preview.chips.map((chip) => <span key={chip.label} className="rounded-full border px-2 py-1 text-[11px] font-bold" style={{ borderColor: chip.on ? `color-mix(in srgb, ${color} 30%, white)` : 'var(--c-line)', color: chip.on ? color : 'var(--c-ink-3)', background: chip.on ? `color-mix(in srgb, ${color} 8%, white)` : 'var(--c-sunken)' }}>{chip.label}</span>)}</span> : null}
                          {preview.text ? <span className="mt-2 inline-flex rounded-lg bg-white/80 px-2 py-1 text-[12px] font-semibold text-[var(--c-ink-2)]">นักเรียนเห็น: {preview.text}</span> : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-[12px] font-bold" style={{ color: checked ? 'var(--s-success-ink)' : 'var(--c-ink-3)' }}>{checked ? 'เปิด' : 'ปิด'}</span>
                          <span aria-hidden className="relative h-6 w-11 rounded-full transition-colors" style={{ background: checked ? 'var(--s-success)' : 'var(--c-line-strong)' }}>
                            <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform" style={{ transform: checked ? 'translateX(20px)' : 'none' }} />
                          </span>
                        </span>
                      </button>
                    )
                  }
                  const step = stepFor(field.suffix)
                  const num = value === null || value === undefined ? null : Number(value)
                  return (
                    <div key={field.key} className="rounded-2xl border border-[var(--c-line)] bg-white p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-[var(--c-ink)]">
                            {field.label}
                            <span className="rounded-full bg-[var(--c-sunken)] px-2 py-0.5 text-[11px] font-bold text-[var(--c-ink-3)]">แนะนำ {displayValue(recommended, field.suffix)}</span>
                          </p>
                          <p className="text-[13px] text-[var(--c-ink-3)]">{field.help}</p>
                          <p className="m-0 mt-1 text-[12px] leading-4 text-[var(--c-ink-2)]">{field.effect}</p>
                        </div>
                        <span className="shrink-0 rounded-xl px-2.5 py-1 text-[15px] font-extrabold tabular-nums" style={{ background: `color-mix(in srgb, ${color} 12%, white)`, color }}>
                          {num === null ? 'ไม่จำกัด' : `${num.toLocaleString('th-TH')} ${field.suffix ?? ''}`}
                        </span>
                      </div>
                      {preview.chips ? (
                        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="ตัวอย่างโหมดที่นักเรียนเห็น">
                          {preview.chips.map((chip) => <span key={chip.label} className="rounded-full border px-2 py-1 text-[11px] font-bold" style={{ borderColor: chip.on ? `color-mix(in srgb, ${color} 30%, white)` : 'var(--c-line)', color: chip.on ? color : 'var(--c-ink-3)', background: chip.on ? `color-mix(in srgb, ${color} 8%, white)` : 'var(--c-sunken)' }}>{chip.label}</span>)}
                        </div>
                      ) : preview.text ? <p className="m-0 mt-2 rounded-lg bg-[var(--c-sunken)] px-2 py-1 text-[12px] font-semibold text-[var(--c-ink-2)]">นักเรียนเห็น: {preview.text}</p> : null}
                      <div className="mt-3 flex items-center gap-2.5">
                        <Button size="sm" aria-label={`ลด ${field.label}`} onClick={() => update(field.key, Math.max(field.min!, Number(value ?? field.min) - step))}>−</Button>
                        <input
                          aria-label={`${field.label} (แถบเลื่อน)`}
                          type="range"
                          className="t3-range"
                          min={field.min}
                          max={field.max}
                          step={step}
                          value={num ?? field.min}
                          onChange={(event) => update(field.key, Number(event.target.value))}
                          style={{ background: `linear-gradient(to right, ${color} ${(((num ?? field.min!) - field.min!) / ((field.max! - field.min!) || 1)) * 100}%, var(--c-line) 0)`, ['--thumb' as string]: color }}
                        />
                        <Button size="sm" aria-label={`เพิ่ม ${field.label}`} onClick={() => update(field.key, Math.min(field.max!, Number(value ?? field.min) + step))}>+</Button>
                        <input
                          aria-label={field.label}
                          type="number"
                          min={field.min}
                          max={field.max}
                          value={num === null ? '' : num}
                          onChange={(event) => update(field.key, event.target.value === '' ? null : Number(event.target.value))}
                          className="h-9 w-20 shrink-0 rounded-xl border border-[var(--c-line-strong)] bg-white px-2 text-center text-[15px] tabular-nums outline-none focus:border-[var(--c-brand)] focus:ring-2 focus:ring-[var(--c-brand-ring)]"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
