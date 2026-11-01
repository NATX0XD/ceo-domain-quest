import { listClassroomReflections } from '../../../lib/db/repo'
import { Bar, Bars, Icon3d, Kpi, KpiGrid } from '../_ux/v2'

/**
 * สรุปการทบทวนตัวเองของทั้งห้อง (ทำหลังแบบทดสอบหลังเรียน) — ไม่ให้คะแนน ใช้ดูภาพรวมเท่านั้น
 * ความรู้สึกเป็นแถบสี · ความมั่นใจเป็นค่าเฉลี่ยดาว · เรื่องที่ยังสงสัยเปิดอ่านได้ (ไม่แสดงเป็นรายการยาวตั้งแต่แรก)
 */
const FEELINGS = ['สนุกมาก', 'ภูมิใจ', 'เฉย ๆ', 'งงนิดหน่อย', 'เหนื่อย'] as const
const FEEL_COLOR = { สนุกมาก: 'green', ภูมิใจ: 'green', 'เฉย ๆ': 'gold', งงนิดหน่อย: 'coral', เหนื่อย: 'red' } as const

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
        <Icon3d name="memo" size={32} />
        ทบทวนตัวเอง
      </h2>
      <KpiGrid cols={3}>
        <Kpi label="ทบทวนแล้ว" value={answered} tone="sky" icon="busts-in-silhouette" />
        <Kpi
          label="มั่นใจเฉลี่ย (เต็ม 5)"
          value={avgConf === null ? '-' : avgConf.toFixed(1)}
          tone="yellow"
          icon="glowing-star"
        />
        <Kpi label="ยังสงสัย" value={wonders.length} tone="peach" icon="speech-balloon" />
      </KpiGrid>
      {feelTotal > 0 ? (
        <Bars>
          {FEELINGS.map((f) => (
            <Bar
              key={f}
              label={f}
              value={feelCount.get(f) ?? 0}
              max={feelTotal}
              display={`${feelCount.get(f) ?? 0} คน`}
              color={FEEL_COLOR[f]}
            />
          ))}
        </Bars>
      ) : null}
      {wonders.length > 0 ? (
        <details className="t2-more">
          <summary className="focus-ring">เรื่องที่นักเรียนยังสงสัย ({wonders.length})</summary>
          <div className="t2-more__body">
            <ul className="flex flex-col gap-2">
              {wonders.map((w, i) => (
                <li key={i} className="rounded-[18px] bg-[#f6f2e8] p-3">
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
