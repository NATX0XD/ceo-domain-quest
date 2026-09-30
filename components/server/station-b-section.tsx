import Link from 'next/link'
import { tlds } from '@/core/content'
import { hintsForLevel } from '@/core/tld-rules'
import { StationBClient, type StationBSlot } from '@/components/station-b-client'
import type { ScaffoldLevel } from '@/components/shop-profile'
import { isDemoMode } from '@/components/server/demo-mode'
import {
  loadSelfProfileDb,
  loadShopProfile,
  loadStationBDb,
} from '@/components/server/game-state'

/**
 * สำนักงานจดทะเบียน (เดิมคือหน้า /station-b) ตอนนี้เป็นส่วนหนึ่งของภารกิจที่ 3
 *
 * ⚠️ ฝั่งเซิร์ฟเวอร์ — กรองตัวช่วยตามระดับก่อนส่งให้เบราว์เซอร์ บรรทัดที่ระดับนี้ไม่ควรเห็นจะไม่ถูกส่งไปเลย
 * การตัดสินผ่าน/ไม่ผ่านอยู่ที่ POST /api/station-b/submit เหมือนเดิม
 */
const STATION_MISSION_ID = 'm3'

/** ขอตัวช่วยไป n ครั้ง = ลดระดับลง n ขั้น ต่ำสุดคือระดับ 1 (เห็นครบ) */
function effectiveLevel(level: ScaffoldLevel, hintsUsed: number): ScaffoldLevel {
  const lowered = level - hintsUsed
  if (lowered <= 1) return 1
  if (lowered === 2) return 2
  return 3
}

export async function buildStationSection(missionId: string, studentId: string) {
  if (missionId !== STATION_MISSION_ID) return null

  const profile = await loadShopProfile(studentId)
  if (!profile) {
    return (
      <section className="card-soft mt-6">
        <h2 className="text-title-sm font-bold text-ink">สำนักงานจดทะเบียน</h2>
        <p className="mt-1 text-body text-pretty text-ink-muted">
          ต้องตั้งค่าร้านก่อน ระบบจะได้รู้ว่าร้านเราจดนามสกุลไหนได้บ้าง
        </p>
        <Link href="/setup" className="btn-quest mt-4 bg-brand-600 text-ink-onbrand hover:bg-brand-700">
          ไปตั้งค่าร้าน
        </Link>
      </section>
    )
  }

  const [self, station] = await Promise.all([
    loadSelfProfileDb(studentId),
    loadStationBDb(studentId),
  ])
  const shownLevel = effectiveLevel(self.scaffoldLevel, station.hintsUsed)

  const slots: StationBSlot[] = tlds.map((tld) => {
    const hints = hintsForLevel(tld, shownLevel)
    return {
      id: tld.id,
      suffix: tld.suffix,
      label: tld.label,
      hints: [
        hints.whoCanRegister ? { label: 'ใครจดได้', text: hints.whoCanRegister } : null,
        hints.goodFor ? { label: 'เหมาะกับ', text: hints.goodFor } : null,
        hints.watchOut ? { label: 'ระวัง', text: hints.watchOut } : null,
      ].filter((h) => h !== null),
    }
  })

  return (
    <StationBClient
      shopName={profile.shopName}
      domainName={profile.domainName}
      isRegisteredCompany={profile.isRegisteredCompany}
      audience={profile.audience}
      slots={slots}
      level={shownLevel}
      demoMode={isDemoMode()}
      attempts={station.attempts}
      hintsUsed={station.hintsUsed}
      hintExhausted={station.hintsUsed >= 2 || shownLevel === 1}
      acceptedTldId={station.completed ? 'ผ่านแล้ว' : null}
    />
  )
}
