import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { reviewStudentText } from '@/core/content-filter'
import { ProfileClient, type LevelId, type RouteId } from '@/components/profile-client'
import { SignInGate } from '@/components/student-shell'
import { fillTemplate, preferenceQuestionsForClient, selfProfile } from '@/components/server/lesson-content'
import { getClassroomById, getProfile, getStudent } from '@/lib/db/repo'
import {
  CERTIFICATE_DISPLAY_NAME_MAX_LENGTH,
  certificateDisplayNameFromProfile,
  saveCertificateDisplayName,
} from '@/lib/certificate/profile'
import { loadSelfProfileDb, saveOwnGoalTextDb } from '@/components/server/game-state'
import { moderateStudentText } from '@/components/server/moderation'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import { certificateEligibility } from '@/components/server/certificate-eligibility'

export const metadata: Metadata = { title: 'รู้จักตัวเอง — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * ผลของการกดบันทึกเป้าหมายที่พิมพ์เอง ส่งกลับมาให้หน้าเดิมอ่าน
 *
 * ฟอร์มนี้เป็น Server Action ล้วน (ไม่มี JavaScript ฝั่งเบราว์เซอร์) จึงไม่มี state ฝั่งหน้าจอ
 * จึงฝากผลไว้ในคุกกี้อายุสั้นแทน **รวมข้อความเดิมของผู้เรียนด้วยเสมอ** เพื่อเติมกลับเข้าช่อง
 * ห้ามให้ข้อความที่เขาพิมพ์หายไปเพราะถูกทัก
 */
const GOAL_NOTICE_COOKIE = 'dbq_goal_notice'
const CERTIFICATE_NAME_NOTICE_COOKIE = 'dbq_certificate_name_notice'

interface GoalNotice {
  ok: boolean
  message: string
  original: string
}

function encodeNotice(notice: GoalNotice): string {
  return Buffer.from(JSON.stringify(notice), 'utf8').toString('base64url')
}

function decodeNotice(raw: string | undefined): GoalNotice | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<GoalNotice>
    if (typeof parsed.message !== 'string') return null
    return {
      ok: parsed.ok === true,
      message: parsed.message,
      original: typeof parsed.original === 'string' ? parsed.original : '',
    }
  } catch {
    return null
  }
}

/**
 * ผู้เรียนพิมพ์เป้าหมายของตัวเอง — "ระบบเสนอได้ แต่ผู้เรียนตั้งเป้าเอง"
 *
 * ⚠️ ตรวจสิทธิ์ใหม่ในนี้เสมอ (studentId จากคุกกี้ ไม่ใช่จากฟอร์ม)
 * ⚠️ ผ่านด่านกรองคำก่อนบันทึกทุกครั้ง · ไม่ผ่าน = ไม่บันทึก แต่ข้อความเดิมไม่หาย
 */
async function saveOwnGoal(formData: FormData) {
  'use server'

  const session = await readStudentSession()
  if (!session) return

  const text = String(formData.get('ownGoalText') ?? '')
  const jar = await cookies()
  const noticeOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/profile',
    maxAge: 30,
  }

  if (text.trim().length === 0) {
    await saveOwnGoalTextDb(session.studentId, null)
    jar.set(
      GOAL_NOTICE_COOKIE,
      encodeNotice({ ok: true, message: 'ลบเป้าหมายที่พิมพ์ไว้แล้ว เขียนใหม่ได้ทุกเมื่อ', original: '' }),
      noticeOptions,
    )
    return
  }

  const verdict = await moderateStudentText(session.studentId, 'self-goal', text)
  if (!verdict.ok) {
    jar.set(
      GOAL_NOTICE_COOKIE,
      encodeNotice({
        ok: false,
        message: verdict.message ?? 'ข้อความนี้ยังใช้ไม่ได้ ลองเขียนใหม่อีกครั้งนะ',
        original: verdict.original,
      }),
      noticeOptions,
    )
    return
  }

  await saveOwnGoalTextDb(session.studentId, text)
  jar.set(
    GOAL_NOTICE_COOKIE,
    encodeNotice({ ok: true, message: 'บันทึกเป้าหมายของตัวเองแล้ว', original: text }),
    noticeOptions,
  )
}

/** บันทึกชื่อเต็มบนเกียรติบัตร — ใช้ตัวกรองกลางและเก็บข้อความเดิมไว้เมื่อถูกปฏิเสธ */
async function saveCertificateName(formData: FormData) {
  'use server'

  const session = await readStudentSession()
  if (!session) return

  const original = String(formData.get('certificateDisplayName') ?? '').trim()
  const confirmed = formData.get('confirmCertificateName') === 'on'
  const jar = await cookies()
  const noticeOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/profile',
    maxAge: 30,
  }

  // ตั้งชื่อบนเกียรติบัตรได้ครั้งเดียว — กันออกใบใหม่ด้วยชื่ออื่นไปเรื่อย ๆ (พิมพ์ผิดให้ครูช่วยแก้)
  if (certificateDisplayNameFromProfile(await getProfile(session.studentId).catch(() => null))) {
    jar.set(
      CERTIFICATE_NAME_NOTICE_COOKIE,
      encodeNotice({ ok: false, message: 'ตั้งชื่อบนเกียรติบัตรไปแล้ว แก้เองไม่ได้ ถ้าพิมพ์ผิดให้บอกครู', original }),
      noticeOptions,
    )
    return
  }

  if (!original) {
    jar.set(CERTIFICATE_NAME_NOTICE_COOKIE, encodeNotice({ ok: false, message: 'พิมพ์ชื่อก่อนกดบันทึก', original }), noticeOptions)
    return
  }

  if (!confirmed) {
    jar.set(
      CERTIFICATE_NAME_NOTICE_COOKIE,
      encodeNotice({ ok: false, message: 'ติ๊กยืนยันว่าตรวจตัวสะกดแล้วก่อนบันทึกนะ', original }),
      noticeOptions,
    )
    return
  }

  if (original.length > CERTIFICATE_DISPLAY_NAME_MAX_LENGTH) {
    jar.set(
      CERTIFICATE_NAME_NOTICE_COOKIE,
      encodeNotice({ ok: false, message: `ชื่อเกียรติบัตรยาวได้ไม่เกิน ${CERTIFICATE_DISPLAY_NAME_MAX_LENGTH} ตัวอักษร`, original }),
      noticeOptions,
    )
    return
  }

  const verdict = reviewStudentText(original, { field: 'certificate-name', studentId: session.studentId })
  if (!verdict.accepted) {
    jar.set(
      CERTIFICATE_NAME_NOTICE_COOKIE,
      encodeNotice({ ok: false, message: verdict.studentMessage ?? 'ชื่อนี้ยังใช้ไม่ได้ ลองเขียนใหม่อีกครั้งนะ', original }),
      noticeOptions,
    )
    return
  }

  const saved = await saveCertificateDisplayName(session.studentId, original || null)
  jar.set(
    CERTIFICATE_NAME_NOTICE_COOKIE,
    encodeNotice({
      ok: saved,
      message: saved ? 'บันทึกชื่อบนเกียรติบัตรแล้ว' : 'ยังบันทึกไม่ได้ ระบบจะใช้ชื่อเล่นแทนจนกว่าจะอัปเดตฐานข้อมูล',
      original,
    }),
    noticeOptions,
  )
}

/**
 * ขั้นที่ 2 รู้จักตัวเอง
 * เซิร์ฟเวอร์โหลดเนื้อหา ตัดน้ำหนักคะแนนของตัวเลือกทิ้ง แล้วส่งเฉพาะข้อความให้หน้าจอ
 * ค่าทุกตัวที่แสดง (ข้อเสนอ ระดับ เป้าหมาย) อ่านจากฐานข้อมูลของนักเรียนคนที่ถือคุกกี้
 */
export default async function ProfilePage() {
  const session = await readStudentSession()
  if (!session) {
    return <SignInGate message="ใส่รหัสห้อง 6 ตัวกับรหัส 4 หลักที่ครูให้ก่อน แล้วโดมจะช่วยหาเส้นทางที่เหมาะกับเรา" />
  }

  const [state, student, profile, certificate] = await Promise.all([
    loadSelfProfileDb(session.studentId),
    getStudent(session.studentId),
    getProfile(session.studentId),
    certificateEligibility(session.studentId),
  ])

  /**
   * ข้อความในไฟล์เนื้อหามีโทเคน `{nickname}` (content/self-profile.json)
   * `/result` กับ `/reflect` แทนค่าให้แล้ว แต่หน้านี้เคยส่งดิบ ๆ ออกจอ
   * เด็กจึงเห็นหัวข้อว่า "การ์ดตัวตนของ {nickname}" (FLOW-1 ข้อ 9)
   */
  const nickname = student?.nickname ?? 'เรา'
  // รหัสห้องโชว์ในกล่องยืนยันออกจากระบบ ให้เด็กจดไว้ใช้กลับเข้ามา (ไม่มีก็ยังออกได้)
  const classroom = student?.classroom_id ? await getClassroomById(student.classroom_id).catch(() => null) : null
  const identity = {
    ...selfProfile.identityCard,
    title: fillTemplate(selfProfile.identityCard.title, { nickname }),
    subtitle: fillTemplate(selfProfile.identityCard.subtitle, { nickname }),
  }
  const notice = decodeNotice((await cookies()).get(GOAL_NOTICE_COOKIE)?.value)
  const certificateNameNotice = decodeNotice((await cookies()).get(CERTIFICATE_NAME_NOTICE_COOKIE)?.value)
  // ถูกทักแล้วต้องเห็นข้อความเดิมของตัวเองในช่อง ไม่ใช่ช่องว่างเปล่า
  const goalFieldValue = notice && !notice.ok ? notice.original : (state.ownGoalText ?? '')
  const lockedCertificateName = certificateDisplayNameFromProfile(profile)
  const certificateNameFieldValue = certificateNameNotice && !certificateNameNotice.ok
    ? certificateNameNotice.original
    : (certificateDisplayNameFromProfile(profile) ?? '')

  const suggestion =
    state.suggestedRoute && state.suggestedLevel
      ? {
          suggestedRoute: state.suggestedRoute as RouteId,
          routeReason: state.routeReason ?? '',
          routeScores: {},
          suggestedLevel: state.suggestedLevel as LevelId,
          levelReason: state.levelReason ?? '',
          weakObjectives: state.weakObjectives,
          talentId: state.talentId,
        }
      : null

  return (
      <ProfileClient
        meta={{
          headline: selfProfile.meta.headline,
          subHeadline: selfProfile.meta.subHeadline,
          ownershipNote: selfProfile.meta.ownershipNote,
          finishButtonLabel: selfProfile.meta.finishButtonLabel,
          minuteFrom: selfProfile.meta.minuteFrom,
          minuteTo: selfProfile.meta.minuteTo,
        }}
        questions={preferenceQuestionsForClient()}
        channels={selfProfile.channels}
        talents={selfProfile.talents}
        goals={selfProfile.goalOptions}
        objectives={selfProfile.objectives.map((o) => ({ id: o.id, shortName: o.shortName }))}
        identity={identity}
        goalPolicyNote={selfProfile.goalPolicy.explainerForStudent}
        initial={{
          nickname,
          roomCode: classroom?.room_code ?? null,
          prefAnswers: state.prefAnswers,
          suggestion,
          route: (state.route ?? null) as RouteId | null,
          routeChosenBy: state.routeChosenBy,
          level: state.routeChosenBy ? (state.scaffoldLevel as LevelId) : null,
          goalId: state.goalId,
          finished: state.goalId !== null && state.route !== null,
          nicknameLocked: certificate.eligible,
        }}
        certificateNameForm={
          lockedCertificateName ? (
            <div className="rounded-xl bg-brand-50 p-3 ring-1 ring-brand-200 ring-inset">
              <p className="text-label font-bold text-ink">ชื่อที่จะแสดงบนเกียรติบัตร</p>
              <p className="mt-1 text-body font-extrabold text-ink">{lockedCertificateName}</p>
              <p className="mt-1 text-note font-semibold text-brand-700">ตั้งแล้ว แก้เองไม่ได้ ถ้าพิมพ์ผิดให้บอกครู</p>
            </div>
          ) : (
          <form action={saveCertificateName} className="rounded-xl bg-brand-50 p-3 ring-1 ring-brand-200 ring-inset">
            <label htmlFor="certificate-display-name" className="text-label font-bold text-ink">
              ชื่อที่จะแสดงบนเกียรติบัตร
            </label>
            <p className="mt-2 text-note font-semibold text-brand-700">ใส่ชื่อ-นามสกุลจริง ตั้งได้ครั้งเดียว ตรวจตัวสะกดก่อนกดบันทึก (ถ้าไม่ตั้งจะใช้ชื่อเล่น)</p>
            <input
              id="certificate-display-name"
              name="certificateDisplayName"
              defaultValue={certificateNameFieldValue}
              maxLength={CERTIFICATE_DISPLAY_NAME_MAX_LENGTH}
              placeholder="เช่น อาร์ม ใจดี"
              className="mt-1 min-h-11 w-full rounded-xl bg-surface-raised px-3 text-label text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-500"
            />
            <label className="mt-2 flex items-start gap-2 text-note font-semibold text-ink">
              <input type="checkbox" name="confirmCertificateName" className="mt-0.5 size-4 accent-[var(--color-brand-600)]" />
              <span>ตรวจตัวสะกดแล้ว ชื่อนี้จะใช้บนเกียรติบัตรและแก้เองไม่ได้</span>
            </label>
            {certificateNameNotice ? (
              <p
                role="status"
                className={certificateNameNotice.ok
                  ? 'mt-2 rounded-xl bg-quest-100 p-2 text-note font-semibold text-quest-700'
                  : 'mt-2 rounded-xl bg-spark-100 p-2 text-note font-semibold text-spark-700'}
              >
                {certificateNameNotice.message}
              </p>
            ) : null}
            <button type="submit" className="btn-base mt-3 w-full rounded-xl bg-brand-600 text-label font-bold text-ink-onbrand hover:bg-brand-700">
              บันทึกชื่อบนเกียรติบัตร
            </button>
          </form>
          )
        }
        goalForm={
      /*
        เป้าหมายที่ผู้เรียนพิมพ์เอง (Personalized Learning: ระบบเสนอได้ แต่ผู้เรียนตั้งเป้าเอง)
        เป็นฟอร์มเซิร์ฟเวอร์ล้วน ใช้งานได้แม้ JavaScript ไม่ทำงาน และข้อความไม่หายเมื่อถูกทัก
      */
      <section className="mt-4">
        <form
          action={saveOwnGoal}
          className="game-card rounded-2xl bg-surface-raised p-4 ring-1 ring-line ring-inset"
        >
          <h2 className="text-label font-bold text-ink">เป้าหมายของฉันเอง</h2>
          <p className="mt-1 text-note text-ink-muted">
            เป้าหมายข้างบนเป็นตัวเลือกที่ระบบเตรียมไว้ ถ้าอยากตั้งเป้าเป็นคำของตัวเอง เขียนตรงนี้ได้เลย
            ครูจะได้รู้ว่าคาบนี้เราอยากได้อะไรกลับไป
          </p>

          <label htmlFor="ownGoalText" className="sr-only">
            เป้าหมายที่เขียนเอง
          </label>
          <textarea
            id="ownGoalText"
            name="ownGoalText"
            rows={3}
            maxLength={300}
            defaultValue={goalFieldValue}
            placeholder="เช่น วันนี้อยากตั้งชื่อเว็บร้านให้เพื่อนจำได้ตั้งแต่ครั้งแรก"
            className="mt-3 min-h-24 w-full rounded-xl bg-surface-sunken p-3 text-label text-ink ring-1 ring-line ring-inset outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />

          {notice ? (
            <p
              role="status"
              className={
                notice.ok
                  ? 'mt-3 rounded-xl bg-quest-100 p-3 text-label font-semibold text-quest-700'
                  : 'mt-3 rounded-xl bg-spark-100 p-3 text-label font-semibold text-spark-700'
              }
            >
              {notice.message}
              {notice.ok ? null : ' ข้อความเดิมยังอยู่ในช่อง แก้แล้วกดบันทึกอีกครั้งได้เลย'}
            </p>
          ) : null}

          <button
            type="submit"
            className="btn-base mt-3 w-full cursor-pointer rounded-xl bg-brand-600 px-4 text-body font-bold text-ink-onbrand hover:bg-brand-700"
          >
            บันทึกเป้าหมายของฉัน
          </button>
        </form>
      </section>
        }
      />
  )
}
