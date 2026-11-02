import { describe, expect, it } from 'vitest'
import { showcaseSafeForPeers } from './showcase-safety'

describe('ผนังผลงานเพื่อน — ซ่อนผลงานที่ติดตัวกรองคำ', () => {
  it('ชื่อเว็บซ่อนคำหยาบ = ไม่ขึ้นให้เพื่อนเห็น', () => {
    expect(
      showcaseSafeForPeers({ domainName: 'mykuyyhaieieie', tld: '.in.th', reasonText: '1. ตาตึงใจ' }),
    ).toBe(false)
  })
  it('เหตุผลมีคำหยาบ = ไม่ขึ้นให้เพื่อนเห็น', () => {
    expect(showcaseSafeForPeers({ domainName: 'beamdrip', tld: '.com', reasonText: 'ชื่อเหี้ยมาก' })).toBe(false)
  })
  it('ผลงานปกติขึ้นได้', () => {
    expect(
      showcaseSafeForPeers({ domainName: 'beamdrip', tld: '.com', reasonText: 'ชื่อตรงกับป้ายหน้าร้าน' }),
    ).toBe(true)
  })
})
