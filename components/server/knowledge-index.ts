/**
 * S-34 ชนิดข้อมูลกับตัวค้นของคลังความรู้ — **ตัวคิดล้วน ไม่ import ไฟล์เนื้อหาใด ๆ**
 *
 * ⚠️ ไฟล์นี้ถูก import จากฝั่งเบราว์เซอร์ (`components/knowledge-search-client.tsx`)
 *    จึง **ห้ามเพิ่ม import ของ `content/*.json` หรือ `components/missions` เข้ามาเด็ดขาด**
 *    ไม่งั้น `content/missions.json` ทั้งก้อน (ซึ่งมี `hints` กับ `check.choices`)
 *    จะถูกยัดเข้าบันเดิลฝั่งเบราว์เซอร์ = คำใบ้รั่วทั้งชุดโดยไม่มีใครเห็น
 *    ตัวประกอบดัชนีที่แตะไฟล์เนื้อหาอยู่แยกไว้ที่ `knowledge-search.ts` (ฝั่งเซิร์ฟเวอร์เท่านั้น)
 */

/** ชนิดของชิ้นเนื้อหา — ใช้บอกผู้เรียนว่าที่เจอมาจากส่วนไหนของภารกิจ */
export type KnowledgeKind = 'objective' | 'card' | 'keypoint'

export const KNOWLEDGE_KIND_LABEL: Record<KnowledgeKind, string> = {
  objective: 'เป้าหมายของภารกิจ',
  card: 'การ์ดความรู้',
  keypoint: 'สรุปสั้น',
}

export interface KnowledgeEntry {
  id: string
  missionId: string
  missionTitle: string
  /** ภารกิจที่เท่าไรในลำดับ — ใช้แสดงป้าย และเป็นลำดับรองตอนเรียงผลค้นหา */
  missionIndex: number
  kind: KnowledgeKind
  /** หัวเรื่องของชิ้นนี้ (หน้าการ์ด / ชื่อหัวข้อ) */
  title: string
  /** เนื้อความ (หลังการ์ด / ข้อสรุป) — ว่างได้ถ้าชิ้นนั้นมีแต่หัวเรื่อง */
  body: string
}

/**
 * ทำข้อความให้เทียบกันได้ — ตัดช่องว่างซ้ำและลดรูปตัวพิมพ์
 *
 * ภาษาไทยไม่มีช่องว่างระหว่างคำ การค้นจึงเป็นแบบ "หาสตริงย่อย" ไม่ใช่ "หาคำ"
 * ซึ่งถูกกับการใช้งานจริงของหน้านี้ (เด็กพิมพ์ "โดเมน" แล้วอยากเจอทุกที่ที่มีคำนี้)
 */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * ค้นในดัชนี — เทสต์ตรง ๆ ได้เพราะไม่แตะ DOM ไม่แตะเครือข่าย
 *
 * กติกา:
 *  - คำค้นว่าง = คืนรายการว่าง (หน้าจอจะได้แสดงเนื้อหาเต็มตามปกติ ไม่ใช่ "ไม่พบ")
 *  - เจอที่หัวเรื่องมาก่อนเจอที่เนื้อความ เพราะหัวเรื่องคือสิ่งที่ผู้เรียนจำได้
 *  - ลำดับรองเรียงตามลำดับภารกิจ เนื้อหาเดียวกันจะได้ออกมาเรียงเหมือนในหน้า
 */
export function searchKnowledge(
  entries: readonly KnowledgeEntry[],
  query: string,
  limit = 20,
): KnowledgeEntry[] {
  const needle = normalize(query)
  if (needle.length === 0) return []

  const hits: { entry: KnowledgeEntry; rank: number }[] = []
  for (const entry of entries) {
    const inTitle = normalize(entry.title).includes(needle)
    const inBody = entry.body.length > 0 && normalize(entry.body).includes(needle)
    if (!inTitle && !inBody) continue
    hits.push({ entry, rank: inTitle ? 0 : 1 })
  }

  hits.sort((a, b) => a.rank - b.rank || a.entry.missionIndex - b.entry.missionIndex)
  return hits.slice(0, Math.max(0, limit)).map((h) => h.entry)
}
