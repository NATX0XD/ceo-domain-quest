// นำเข้าแบบ path ตรง ไม่ใช่ alias `@/` เพราะโปรเจกต์ยังไม่มี vitest config ที่รู้จัก alias
// (ไฟล์นี้มีเทสต์คู่กันอยู่ที่ knowledge-search.test.ts)
import { missions } from '../missions'
import type { KnowledgeEntry } from './knowledge-index'

/**
 * S-34 ตัวประกอบดัชนีค้นหาของคลังความรู้ — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * **ไม่มี API ใหม่โดยตั้งใจ**: เนื้อหาคลังความรู้เป็นไฟล์คงที่ (`content/missions.json`)
 * เท่ากันทุกคนทั้งห้อง หน้าเซิร์ฟเวอร์ประกอบดัชนีแล้วส่งไปกับหน้าเลยทีเดียวจบ
 * ค้นในเครื่องได้ทันทีโดยไม่ต้องรอเน็ต — สำคัญมากตอน 30 เครื่องใช้ไวไฟห้องเดียวกัน
 *
 * ⚠️ **ห้าม import ไฟล์นี้จากคอมโพเนนต์ที่ขึ้นต้นด้วย `'use client'`**
 *    มันดึง `components/missions` เข้ามา ซึ่งลาก `content/missions.json` ทั้งก้อน
 *    (มี `hints` กับ `check.choices`) เข้าบันเดิลฝั่งเบราว์เซอร์ตามไปด้วย
 *    ฝั่งหน้าจอให้ import ชนิดข้อมูลกับตัวค้นจาก `./knowledge-index` แทน
 * ⚠️ ดัชนีมีแค่ 3 แหล่งที่หน้าคลังความรู้แสดงอยู่แล้ว (เป้าหมาย · การ์ด · สรุปสั้น)
 *    **ห้ามใส่ `check.choices` / `hints`** เพราะดัชนีนี้ถูกส่งเข้าบันเดิลฝั่งเบราว์เซอร์
 * ⚠️ ไม่มีข้อมูลของผู้เรียนอยู่ในนี้เลย ทุกคนได้ดัชนีชุดเดียวกัน
 */

export {
  KNOWLEDGE_KIND_LABEL,
  searchKnowledge,
  type KnowledgeEntry,
  type KnowledgeKind,
} from './knowledge-index'

/** ดัชนีทั้งหมดของคลังความรู้ — ประกอบจากเนื้อหาจริงฝั่งเซิร์ฟเวอร์ */
export function knowledgeEntries(): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = []

  missions.forEach((mission, index) => {
    const base = { missionId: mission.id, missionTitle: mission.title, missionIndex: index + 1 }

    entries.push({
      ...base,
      id: `${mission.id}-objective`,
      kind: 'objective',
      title: mission.title,
      body: mission.objective,
    })

    mission.channels.card.cards.forEach((card, i) => {
      entries.push({
        ...base,
        id: `${mission.id}-card-${i}`,
        kind: 'card',
        title: card.front,
        body: card.back,
      })
    })

    mission.channels.clip.keyPoints.forEach((point, i) => {
      entries.push({
        ...base,
        id: `${mission.id}-keypoint-${i}`,
        kind: 'keypoint',
        title: point,
        body: '',
      })
    })
  })

  return entries
}
