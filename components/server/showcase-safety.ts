import { safeToShowPeers } from '@/core/content-filter'

/**
 * ผลงานชิ้นนี้ผ่านตัวกรองคำแบบ "เพื่อนเห็น" ไหม — ชื่อเว็บ (รวมนามสกุล) และเหตุผลต้องผ่านทั้งคู่
 * ไม่ผ่าน = ค่าเริ่มต้นคือซ่อนจากเพื่อน ครูยังเห็นและติดป้ายไว้ ข้อมูลเดิมไม่ถูกแก้ ไม่แตะคะแนน
 */
export function showcaseSafeForPeers(item: {
  domainName: string | null
  tld: string | null
  reasonText: string | null
}): boolean {
  const domain = `${item.domainName ?? ''}${item.tld ?? ''}`
  return safeToShowPeers(domain) && safeToShowPeers(item.reasonText ?? '')
}

/**
 * เพื่อนเห็นผลงานชิ้นนี้บนผนังไหม (ตัดสินฝั่งเซิร์ฟเวอร์ที่ /api/me/showcase)
 * `peerVisible` = ครูตั้งเอง: true = อนุมัติให้เห็น (แม้ติดตัวกรอง) · false = ซ่อน · null = ให้ตัวกรองตัดสิน
 */
export function showcaseVisibleToPeers(item: {
  domainName: string | null
  tld: string | null
  reasonText: string | null
  peerVisible?: boolean | null
}): boolean {
  if (item.peerVisible === true) return true
  if (item.peerVisible === false) return false
  return showcaseSafeForPeers(item)
}

/**
 * ชื่อเว็บนี้ขึ้นเกียรติบัตรได้ไหม — ติดตัวกรองคำ = ใบประกาศแสดงแค่ชื่อร้าน (มติเจ้าของ)
 * ใช้ทั้งหน้า /result และ PDF จาก /api/certificate ให้ตรงกันเสมอ
 */
export function certificateDomain(domainFull: string): string {
  const domain = domainFull.trim()
  return domain && safeToShowPeers(domain) ? domain : ''
}
