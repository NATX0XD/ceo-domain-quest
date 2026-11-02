import { listClassroomReflections } from '../../../lib/db/repo'
import { Icon3d } from '../_ux/v2'
import { StatTile } from '../_ux/ui'
import { BarList, ColorBar } from '../_ux/data-viz'

/**
 * สรุปการทบทวนตัวเองของทั้งห้อง (ทำหลังแบบทดสอบหลังเรียน) — ไม่ให้คะแนน ใช้ดูภาพรวมเท่านั้น
 * ความรู้สึกเป็นแถบสี · ความมั่นใจเป็นค่าเฉลี่ยดาว · เรื่องที่ยังสงสัยเปิดอ่านได้ (ไม่แสดงเป็นรายการยาวตั้งแต่แรก)
 */
const FEELINGS = ['สนุกมาก', 'ภูมิใจ', 'เฉย ๆ', 'งงนิดหน่อย', 'เหนื่อย'] as const
const FEEL_COLOR = {
  สนุกมาก: 'var(--d-passed)',
  ภูมิใจ: 'var(--d-passed)',
  'เฉย ๆ': 'var(--d-notstarted)',
  งงนิดหน่อย: 'var(--d-atrisk)',
  เหนื่อย: 'var(--d-failed)',
} as const

type Row = { student_id: string; question_id: string; answer_text: string; students?: { nickname?: string } | null }

export async function ReflectionPanel({
  teacherId,
  classroomId,
}: {
  teacherId: string
  classroomId: string | null
}) {
  if (!classroomId) return null
  const rows = (await listClassroomReflections(teacherId, classroomId)) as unknown as Row[]
  const answered = new Set(rows.map((r) => r.student_id)).size
  if (answered === 0) return null

  const feelCount = new Map<string, number>()
  const conf: number[] = []
  const wonders: { name: string; text: string }[] = []
  for (const r of rows) {
    if (r.question_id === 'reflect-feel') feelCount.set(r.answer_text, (feelCount.get(r.answer_text) ?? 0) + 1)
    if (r.question_id === 'reflect-conf' && /^\d$/.test(r.answer_text)) conf.push(Number(r.answer_text))
    if (r.question_id === 'reflect-2' && r.answer_text.trim().length > 0)
      wonders.push({ name: r.students?.nickname ?? 'นักเรียน', text: r.answer_text })
  }
  const avgConf = conf.length > 0 ? conf.reduce((a, b) => a + b, 0) / conf.length : null
  const feelTotal = [...feelCount.values()].reduce((a, b) => a + b, 0)

  return (
    <section className="t2-card" aria-label="ทบทวนตัวเองของห้อง">
      <h2 className="t2-card-title">
        <Icon3d name="memo" size={28} />
        ทบทวนตัวเอง
      </h2>
      <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-3">
        <StatTile label="ทบทวนแล้ว" value={answered} unit="คน" icon={<Icon3d name="busts-in-silhouette" size={30} />} />
        <StatTile label="มั่นใจเฉลี่ย (เต็ม 5)" value={avgConf === null ? '-' : avgConf.toFixed(1)} icon={<Icon3d name="glowing-star" size={30} />} />
        <StatTile label="ยังสงสัย" value={wonders.length} unit="เรื่อง" icon={<Icon3d name="speech-balloon" size={30} />} />
      </div>
      {feelTotal > 0 ? (
        <div className="mt-5">
        <BarList>
          {FEELINGS.map((f) => (
            <ColorBar
              key={f}
              label={f}
              value={feelCount.get(f) ?? 0}
              max={feelTotal}
              display={`${feelCount.get(f) ?? 0} คน`}
              color={FEEL_COLOR[f]}
            />
          ))}
        </BarList>
        </div>
      ) : null}
      {wonders.length > 0 ? (
        <details className="t2-more">
          <summary className="focus-ring">เรื่องที่นักเรียนยังสงสัย ({wonders.length})</summary>
          <div className="t2-more__body">
            <ul className="flex flex-col gap-2">
              {wonders.map((w, i) => (
                <li key={i} className="rounded-lg bg-[var(--c-sunken)] p-3">
                  <p className="text-note font-bold text-ink-muted">{w.name}</p>
                  <p className="mt-0.5 text-body whitespace-pre-line text-ink">{w.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </section>
  )
}
