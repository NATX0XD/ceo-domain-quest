import { describe, expect, it } from 'vitest'
import { certificateDomain, showcaseSafeForPeers, showcaseVisibleToPeers } from './showcase-safety'

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

describe('ครูตั้งการแสดงผลงานให้เพื่อนเห็นเอง', () => {
  const flagged = { domainName: 'mykuyyhaieieie', tld: '.in.th', reasonText: '1. ตาตึงใจ' }
  const clean = { domainName: 'beamdrip', tld: '.com', reasonText: 'ชื่อตรงกับป้ายหน้าร้าน' }
  it('ไม่ได้ตั้ง = ตัวกรองตัดสิน', () => {
    expect(showcaseVisibleToPeers({ ...flagged, peerVisible: null })).toBe(false)
    expect(showcaseVisibleToPeers(clean)).toBe(true)
  })
  it('ครูอนุมัติชิ้นที่ติดตัวกรอง = เพื่อนเห็น', () => {
    expect(showcaseVisibleToPeers({ ...flagged, peerVisible: true })).toBe(true)
  })
  it('ครูซ่อนชิ้นปกติ = เพื่อนไม่เห็น', () => {
    expect(showcaseVisibleToPeers({ ...clean, peerVisible: false })).toBe(false)
  })
})

describe('ชื่อเว็บบนเกียรติบัตร', () => {
  it('ติดตัวกรอง = ไม่แสดงชื่อเว็บ', () => {
    expect(certificateDomain('mykuyyhaieieie.in.th')).toBe('')
  })
  it('ปกติ = แสดงตามเดิม', () => {
    expect(certificateDomain('beamdrip.com')).toBe('beamdrip.com')
  })
})
