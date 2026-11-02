import { safeToShowPeers } from '@/core/content-filter'

/**
 * ผลงานชิ้นนี้ขึ้นผนังให้เพื่อนเห็นได้ไหม — ชื่อเว็บ (รวมนามสกุล) และเหตุผลต้องผ่านตัวกรองแบบ "เพื่อนเห็น"
 * ไม่ผ่าน = ซ่อนจากเพื่อนเท่านั้น ครูยังเห็นและติดป้ายไว้ ข้อมูลเดิมไม่ถูกแก้ ไม่แตะคะแนน
 */
export function showcaseSafeForPeers(item: {
  domainName: string | null
  tld: string | null
  reasonText: string | null
}): boolean {
  const domain = `${item.domainName ?? ''}${item.tld ?? ''}`
  return safeToShowPeers(domain) && safeToShowPeers(item.reasonText ?? '')
}
