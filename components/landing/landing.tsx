import './landing.css'
import { Hero } from './hero'
import { DecoLayer } from './deco'
import { MotionRoot } from './reveal'
import { AiSection, FinalSection, HowSection, MissionsSection, TeacherSection, TourSection } from './sections'

/** "วันอังคารที่ 3 พ.ย. 11:00 น." — ทำฝั่งเซิร์ฟเวอร์ให้ข้อความตรงกันทุกเครื่อง */
export function formatOpenAt(iso: string | undefined): { openAt: string | null; label: string } {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return { openAt: null, label: 'เร็ว ๆ นี้' }
  const label = new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
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
        <section className="ld-landscape ld-landscape--beach"><DecoLayer scene="sky" /><MissionsSection /></section>
        <section className="ld-landscape ld-landscape--island"><DecoLayer scene="island" tone="purple" /><HowSection /></section>
        <TourSection />
        <TeacherSection />
        <AiSection />
        <FinalSection openAt={openAt} openLabel={label} />
      </main>
    </MotionRoot>
  )
}
