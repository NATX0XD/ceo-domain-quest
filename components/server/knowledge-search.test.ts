import { describe, expect, it } from 'vitest'
import {
  KNOWLEDGE_KIND_LABEL,
  knowledgeEntries,
  searchKnowledge,
  type KnowledgeEntry,
} from './knowledge-search'
import { missions } from '../missions'

/**
 * S-34 ค้นหาในคลังความรู้
 *
 * เทสต์สองชั้น:
 *  1. ดัชนีที่ประกอบจากเนื้อหาจริง **ต้องไม่มีเฉลยหลุดเข้ามา** (ข้อนี้สำคัญที่สุด)
 *  2. ตัวค้นเป็นฟังก์ชันล้วน เทสต์ด้วยข้อมูลสมมติได้โดยไม่ต้องพึ่งไฟล์เนื้อหา
 */

const BASE: KnowledgeEntry = {
  id: 'a-objective',
  missionId: 'm1',
  missionTitle: 'ชื่อเว็บคืออะไร',
  missionIndex: 1,
  kind: 'objective',
  title: 'ชื่อเว็บคืออะไร',
  body: 'บอกได้ว่าโดเมนคือที่อยู่ของร้านบนอินเทอร์เน็ต',
}

const SAMPLE: KnowledgeEntry[] = [
  BASE,
  {
    id: 'b-card',
    missionId: 'm2',
    missionTitle: 'นามสกุลเว็บ',
    missionIndex: 2,
    kind: 'card',
    title: 'โดเมนคืออะไร',
    body: 'ชื่อที่ลูกค้าพิมพ์เพื่อเข้าร้านของเรา',
  },
  {
    id: 'c-keypoint',
    missionId: 'm3',
    missionTitle: 'ตั้งชื่อให้ดี',
    missionIndex: 3,
    kind: 'keypoint',
    title: 'สั้น จำง่าย สะกดตามเสียงได้',
    body: '',
  },
]

describe('ดัชนีคลังความรู้', () => {
  it('ประกอบจากเนื้อหาจริงได้ครบทุกภารกิจ', () => {
    const entries = knowledgeEntries()
    expect(entries.length).toBeGreaterThan(0)
    for (const mission of missions) {
      expect(entries.some((e) => e.missionId === mission.id && e.kind === 'objective')).toBe(true)
      expect(entries.some((e) => e.missionId === mission.id && e.kind === 'card')).toBe(true)
    }
  })

  it('ไม่มีคำใบ้หลุดเข้าดัชนี (คำใบ้ไม่เคยอยู่บนหน้าคลังความรู้)', () => {
    const blob = knowledgeEntries()
      .map((e) => `${e.title} ${e.body}`)
      .join('\n')

    for (const mission of missions) {
      for (const hint of mission.hints) {
        expect(blob).not.toContain(hint)
      }
    }
  })

  /**
   * เกณฑ์ที่แรงกว่าการไล่เทียบทีละสตริง: ทุกชิ้นในดัชนีต้องมาจาก 3 แหล่งที่หน้าคลังความรู้
   * แสดงอยู่แล้วเท่านั้น (เป้าหมายภารกิจ · การ์ด · สรุปสั้น) ถ้าวันหน้ามีคนเผลอเพิ่ม
   * `check.choices` หรือ `hints` เข้ามา เทสต์นี้จะจับได้ทันทีโดยไม่ต้องเดาว่าสตริงไหนเป็นความลับ
   *
   * (ตัวเลือกของข้อเช็กอย่าง ".co.th" ไปตรงกับเนื้อหาการ์ดได้เองตามธรรมชาติ
   *  การไล่เทียบสตริงสั้น ๆ จึงฟ้องผิด ต้องตรวจที่ "มาจากแหล่งไหน" แทน)
   */
  it('ทุกชิ้นมาจากเนื้อหาที่หน้าคลังความรู้แสดงอยู่แล้วเท่านั้น', () => {
    for (const entry of knowledgeEntries()) {
      const mission = missions.find((m) => m.id === entry.missionId)
      expect(mission).toBeDefined()
      if (!mission) continue

      const allowed =
        entry.kind === 'objective'
          ? [`${mission.title}|${mission.objective}`]
          : entry.kind === 'card'
            ? mission.channels.card.cards.map((c) => `${c.front}|${c.back}`)
            : mission.channels.clip.keyPoints.map((p) => `${p}|`)

      expect(allowed).toContain(`${entry.title}|${entry.body}`)
    }
  })

  it('ทุกชนิดมีป้ายชื่อภาษาไทยกำกับ', () => {
    for (const entry of knowledgeEntries()) {
      expect(KNOWLEDGE_KIND_LABEL[entry.kind]).toBeTruthy()
    }
  })
})

describe('ค้นหาในคลังความรู้', () => {
  it('คำค้นว่างคืนรายการว่าง (หน้าจอจะได้แสดงเนื้อหาเต็มตามปกติ)', () => {
    expect(searchKnowledge(SAMPLE, '')).toEqual([])
    expect(searchKnowledge(SAMPLE, '   ')).toEqual([])
  })

  it('ค้นเจอทั้งในหัวเรื่องและในเนื้อความ', () => {
    const found = searchKnowledge(SAMPLE, 'โดเมน').map((e) => e.id)
    expect(found).toContain('b-card')
    expect(found).toContain('a-objective')
  })

  it('เจอที่หัวเรื่องต้องมาก่อนเจอที่เนื้อความ', () => {
    const found = searchKnowledge(SAMPLE, 'โดเมน').map((e) => e.id)
    expect(found[0]).toBe('b-card')
  })

  it('ลำดับรองเรียงตามลำดับภารกิจ', () => {
    const entries: KnowledgeEntry[] = [
      { ...BASE, id: 'later', missionIndex: 4, title: 'x', body: 'มีคำว่า ทดสอบ อยู่' },
      { ...BASE, id: 'earlier', missionIndex: 2, title: 'y', body: 'มีคำว่า ทดสอบ อยู่' },
    ]
    expect(searchKnowledge(entries, 'ทดสอบ').map((e) => e.id)).toEqual(['earlier', 'later'])
  })

  it('ไม่สนใจตัวพิมพ์ใหญ่เล็กและช่องว่างซ้ำ', () => {
    const entries: KnowledgeEntry[] = [{ ...BASE, id: 'one', title: 'ใช้  .CO.TH  ได้', body: '' }]
    expect(searchKnowledge(entries, '.co.th').map((e) => e.id)).toEqual(['one'])
  })

  it('ไม่เจอก็คืนรายการว่าง ไม่ throw', () => {
    expect(searchKnowledge(SAMPLE, 'คำที่ไม่มีอยู่จริงเลยแน่นอน')).toEqual([])
  })

  it('จำกัดจำนวนผลตามที่ขอ', () => {
    const many: KnowledgeEntry[] = Array.from({ length: 30 }, (_, i) => ({
      ...BASE,
      id: `e-${i}`,
      missionIndex: i,
      title: 'โดเมน',
    }))
    expect(searchKnowledge(many, 'โดเมน', 5)).toHaveLength(5)
  })
})
