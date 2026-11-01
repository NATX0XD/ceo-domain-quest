import './landing.css'
import { Hero } from './hero'
import { MotionRoot } from './reveal'
import { AiSection, FinalSection, HowSection, MissionsSection, TeacherSection, TourSection } from './sections'

/** "3 พ.ย. 2569 08:00 น." — ทำฝั่งเซิร์ฟเวอร์ให้ข้อความตรงกันทุกเครื่อง */
export function formatOpenAt(iso: string | undefined): { openAt: string | null; label: string } {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return { openAt: null, label: 'เร็ว ๆ นี้' }
  const label = new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  }).format(d)
  return { openAt: d.toISOString(), label: `${label} น.` }
}

export function Landing({ openAtEnv }: { openAtEnv?: string }) {
  const { openAt, label } = formatOpenAt(openAtEnv)
  return (
    <MotionRoot>
      <main className="ld">
        <Hero openAt={openAt} openLabel={label} />
        <MissionsSection />
        <HowSection />
        <TourSection />
        <TeacherSection />
        <AiSection />
        <FinalSection openAt={openAt} openLabel={label} />
      </main>
    </MotionRoot>
  )
}
