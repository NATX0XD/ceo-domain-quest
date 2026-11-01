import type { ReactNode } from 'react'
import { ClockIcon, PauseIcon, StarIcon, UsersIcon, cn } from '@/components/ui'

/**
 * ชิ้นส่วนหน้าตาของ "จอหน้าห้อง" (T-04)
 *
 * ทำไมเป็นไฟล์แยก: ตัวหน้าจริงอยู่ที่ `components/board-screen-client.tsx` ซึ่งเป็นของ
 * session frontend และมีตรรกะ poll `/api/teacher/screen` ทุก 3 วินาทีอยู่ข้างใน
 * ไฟล์นี้จึงเก็บเฉพาะ "การนำเสนอ" ล้วน ๆ ไม่มี state ไม่มี fetch ไม่มีตัวจับเวลา
 * รับค่าที่คำนวณแล้วมาทาง props อย่างเดียว เอาไปประกอบได้โดยไม่แตะตรรกะเดิมแม้แต่บรรทัดเดียว
 *
 * ข้อกำหนดเฉพาะของจอนี้ที่ทุกชิ้นต้องเคารพ:
 *  - **ต้องอ่านออกจากหลังห้อง** บนโปรเจกเตอร์ 1280×720 ขึ้นไป
 *  - **ห้ามมีชื่อคนคู่กับคะแนนหรือดาว** (หลักไม่มีกระดานจัดอันดับ) ชิ้นส่วนในไฟล์นี้
 *    จึงไม่มี prop ไหนรับคะแนนรายคนเลย มีแต่ตัวเลขรวมของทั้งห้อง
 *
 * ## ทำไมขนาดตัวอักษรผูกกับ `vh` ไม่ใช่ `rem` คงที่
 *
 * จอนี้ไม่มีการเลื่อน ครูไม่ได้ยืนอยู่ข้างจอ และไม่มีใครลากสกอร์บาร์ให้กลางคาบ
 * **ของที่ตกขอบจอ = ของที่หายไปเฉย ๆ** วัดของจริงที่ 1280×720 แล้วเจอว่า
 * บล็อกรหัสห้อง + QR สูงเกิน 720px ทำให้ **QR ถูกตัดครึ่ง** ทั้งช่วงรอเริ่มและช่วงทบทวน
 * ซึ่งคือช่วงที่เด็กทั้งห้องต้องสแกนเข้าเว็บพอดี
 *
 * ขนาดทุกตัวจึงเป็น `clamp(เล็กสุด, สัดส่วนของความสูงจอ, ใหญ่สุด)`:
 *  - จอเตี้ย (720) ตัวอักษรหดลงให้ยังอยู่ในจอครบ
 *  - จอใหญ่ (1080 ขึ้นไป) ตัวอักษรโตตาม ไม่ใช่เม็ดเล็ก ๆ ลอยกลางจอ
 * ตัวเลขสัดส่วนมาจากการวัดจริงที่ 720 ไม่ใช่การเดา
 *
 * ## ทำไมทุกตัวเลขเป็น tabular-nums และมี min-width
 *
 * จอนี้อัปเดตทุก 3 วินาที นาฬิกาเดินทุกวินาที ถ้าความกว้างตัวเลขไม่คงที่
 * ตัวเลขข้าง ๆ จะขยับซ้ายขวาตลอดเวลา — บนโปรเจกเตอร์คือภาพสั่นที่คนทั้งห้องเห็น
 */

/** ขนาดตัวอักษรของจอหน้าห้อง — รวมไว้ที่เดียวเพื่อให้สัดส่วนทั้งจอสอดคล้องกัน */
const SIZE = {
  /** ชื่อช่วงของคาบบนแถบหัวจอ */
  phase: 'text-[clamp(1.25rem,3.2vh,2.25rem)]',
  /** นาฬิกานับถอยหลัง */
  clock: 'text-[clamp(2.25rem,7vh,4.5rem)]',
  /** หัวข้อใหญ่ประจำช่วง */
  stageTitle: 'text-[clamp(2rem,6.4vh,4.5rem)]',
  /** ข้อความรองใต้หัวข้อ */
  stageSubtitle: 'text-[clamp(1.0625rem,2.9vh,1.875rem)]',
  /** รหัสห้อง — ตัวใหญ่ที่สุดบนจอ */
  roomCode: 'text-[clamp(3rem,10.5vh,7.5rem)]',
  /** ตัวเลขรวมของทั้งห้อง เช่น จำนวนใบเสนอที่ส่งแล้ว */
  bigNumber: 'text-[clamp(5rem,26vh,15rem)]',
  /** ป้ายกำกับรอง ๆ บนจอ */
  caption: 'text-[clamp(1rem,2.6vh,1.75rem)]',
  /** คำอธิบายใต้ตัวเลขรวมตัวโต — ต้องใหญ่ตามตัวเลข ไม่งั้นอ่านไม่ออกว่าตัวเลขนั้นคืออะไร */
  bigCaption: 'text-[clamp(1.25rem,4vh,2.75rem)]',
} as const

export type BoardPhaseBannerProps = {
  /** ชื่อช่วงของคาบจากเซิร์ฟเวอร์ เช่น "ภารกิจย่อย" */
  phaseLabel: string
  /** เวลาที่เหลือในรูปแบบ mm:ss — null เมื่อไม่ต้องโชว์นาฬิกา */
  clock?: string | null
  /** true เมื่อครูกดหยุดเวลาไว้ */
  paused?: boolean
  className?: string
}

/**
 * แถบหัวจอ: ชื่อช่วง + นาฬิกา — ของสองอย่างที่ต้องอยู่มุมเดิมตลอดคาบ
 *
 * ชื่อช่วงเป็นแถบสีทึบเต็มความสูง ไม่ใช่ชิปจาง ๆ เพราะคำถามแรกของคนที่เพิ่งเงยหน้าจาก
 * โทรศัพท์คือ "ตอนนี้ห้องอยู่ช่วงไหน" ต้องตอบได้จากหลังห้องโดยไม่ต้องอ่านอย่างอื่นเลย
 *
 * ⚠️ สีนาฬิกาคงที่ ไม่เปลี่ยนเป็นแดงตอนใกล้หมดเวลา เพื่อลดความกดดัน (กฎ S-11)
 * ⚠️ แถบนี้สูงคงที่ ไม่ว่าจะมีนาฬิกาหรือไม่ — ช่วง "ทำต่อที่บ้าน" ไม่มีนาฬิกา
 *    ถ้าความสูงหดตาม เนื้อหาทั้งจอจะกระโดดขึ้นตอนเปลี่ยนช่วง
 */
export function BoardPhaseBanner({
  phaseLabel,
  clock = null,
  paused = false,
  className,
}: BoardPhaseBannerProps) {
  return (
    <div
      className={cn(
        'flex min-h-[max(5.5rem,13vh)] flex-wrap items-center justify-between gap-4',
        className,
      )}
    >
      <p
        className={cn(
          'inline-flex items-center gap-4 rounded-2xl bg-brand-700 px-7 py-3 font-black text-ink-onbrand',
          SIZE.phase,
        )}
      >
        <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full bg-reward-400" />
        {phaseLabel}
      </p>

      {clock ? (
        <p
          className={cn(
            'inline-flex items-center gap-4 rounded-2xl bg-surface-raised px-7 py-3 leading-none font-black text-ink shadow-soft-2 ring-1 ring-line ring-inset',
            SIZE.clock,
          )}
        >
          <ClockIcon
            width={40}
            height={40}
            aria-hidden
            className="size-[0.85em] shrink-0 text-brand-600"
          />
          {/* ตัวเลขกว้างคงที่ นาฬิกาจึงไม่ขยับซ้ายขวาทุกวินาที */}
          <span className="tabular-nums">{clock}</span>
          {paused ? (
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-xl bg-spark-100 px-4 py-1.5 font-bold text-spark-700',
                SIZE.caption,
              )}
            >
              <PauseIcon width={24} height={24} aria-hidden className="size-[1em] shrink-0" />
              หยุดเวลา
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}

export type BoardRoomCodeProps = {
  roomCode: string
  /** QR ที่เซิร์ฟเวอร์เรนเดอร์มาแล้วเป็นสตริง SVG */
  qrSvg?: string | null
  /** ลิงก์เต็มของหน้าเข้าห้อง ใช้เป็นคำอธิบาย QR ให้โปรแกรมอ่านหน้าจอ */
  joinUrl?: string
  /** จำนวนคนที่เข้าห้องแล้ว — ตัวเลขรวมของห้อง ไม่ใช่รายคน */
  joined?: number
  className?: string
}

/**
 * บล็อกรหัสห้อง + QR — ของที่เด็กทั้งห้องต้องอ่านจากหลังห้องพร้อมกัน
 *
 * ⚠️ **วางเรียงกันแนวนอนบนจอกว้าง** ของเดิมเรียงลงล่างอย่างเดียว พอจอสูง 720
 *    QR ตกขอบจอไปครึ่งหนึ่ง (วัดจริงแล้ว) เรียงแนวนอนทำให้ความสูงรวมเหลือ
 *    เท่าชิ้นที่สูงที่สุดชิ้นเดียว ไม่ใช่ผลรวมของทั้งสองชิ้น
 * QR ผูกขนาดกับความสูงจอเช่นกัน จะได้ไม่ล้นเมื่อครูต่อจอที่เตี้ยกว่านี้
 */
export function BoardRoomCode({
  roomCode,
  qrSvg = null,
  joinUrl,
  joined,
  className,
}: BoardRoomCodeProps) {
  return (
    <div className={cn('flex w-full flex-col items-center gap-[3vh]', className)}>
      <div className="flex w-full flex-col items-center justify-center gap-[3vh] lg:flex-row lg:items-stretch lg:gap-10">
        <div className="flex min-w-0 flex-col items-center justify-center gap-3 rounded-3xl bg-surface-raised px-[clamp(1.5rem,4vw,4rem)] py-[3vh] shadow-soft-3 ring-1 ring-brand-100 ring-inset">
          <p className={cn('font-bold text-ink-muted', SIZE.caption)}>รหัสห้องของเรา</p>
          <p
            className={cn(
              'leading-none font-black tracking-[0.14em] text-brand-700 tabular-nums',
              SIZE.roomCode,
            )}
          >
            {roomCode}
          </p>
          <span aria-hidden="true" className="h-1.5 w-28 rounded-full bg-reward-500" />
        </div>

        {qrSvg ? (
          <div
            className="size-[min(38vh,22rem)] shrink-0 rounded-3xl bg-surface-raised p-4 shadow-soft-2 ring-1 ring-brand-100 ring-inset [&>svg]:size-full"
            role="img"
            aria-label={joinUrl ? `QR code ของลิงก์ ${joinUrl}` : 'QR code สำหรับเข้าห้องเรียน'}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        ) : null}
      </div>

      {typeof joined === 'number' ? (
        <p
          className={cn(
            'inline-flex items-center gap-4 rounded-full bg-quest-100 px-8 py-3 font-extrabold text-quest-700',
            SIZE.stageSubtitle,
          )}
        >
          <UsersIcon width={32} height={32} aria-hidden className="size-[1.2em] shrink-0" />
          {/* ตัวเลขกว้างคงที่ ป้ายนี้จึงไม่ขยับตอนมีคนเข้าห้องเพิ่มทุก 3 วินาที */}
          เข้าแล้ว <span className="tabular-nums">{joined}</span> คน
        </p>
      ) : null}
    </div>
  )
}

export type BoardBigNumberProps = {
  /** ตัวเลขรวมของทั้งห้อง เช่น จำนวนใบเสนอที่ส่งแล้ว */
  value: number
  /** คำอธิบายใต้ตัวเลข */
  caption: string
  className?: string
}

/**
 * ตัวเลขรวมตัวโต — ใช้ในช่วงด่านบอสและช่วงที่ต้องโชว์ความคืบหน้าของทั้งห้อง
 *
 * ตัวเลขนี้คือเนื้อหาทั้งหมดของจอในช่วงนั้น จึงกินความสูงราวหนึ่งในสี่ของจอ
 * ของเดิมสูง 112px บนจอ 720 = เม็ดเล็กลอยกลางจอ อ่านจากหลังห้องไม่ออก
 * ⚠️ `tabular-nums` + กล่องกว้างคงที่ ตัวเลขจึงไม่ขยับตอนเปลี่ยนจาก 9 เป็น 10
 */
export function BoardBigNumber({ value, caption, className }: BoardBigNumberProps) {
  return (
    <div className={cn('flex flex-col items-center gap-[1.5vh]', className)}>
      <p
        className={cn(
          'min-w-[2ch] text-center leading-[0.85] font-black text-brand-700 tabular-nums',
          SIZE.bigNumber,
        )}
      >
        {value}
      </p>
      <span aria-hidden="true" className="h-2 w-32 rounded-full bg-reward-500" />
      <p className={cn('font-bold text-pretty text-ink-muted', SIZE.bigCaption)}>{caption}</p>
    </div>
  )
}

export type BoardWorkCardProps = {
  /** ชื่อเล่นเจ้าของผลงาน — ไม่บังคับ และ **ห้ามส่งคะแนนหรือดาวมาคู่กัน** */
  nickname?: string | null
  domain: string
  reason: string
  className?: string
}

/**
 * การ์ดผลงานบนจอหน้าห้อง — ชื่อเว็บเป็นพระเอก เหตุผลเป็นตัวรอง
 * จงใจไม่มี prop สำหรับคะแนน/ดาว เพื่อให้เขียนหน้าที่ผิดกฎไม่ได้ตั้งแต่ชั้น type
 */
export function BoardWorkCard({ nickname, domain, reason, className }: BoardWorkCardProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-3xl bg-surface-raised text-left shadow-soft-3 ring-1 ring-brand-100 ring-inset',
        className,
      )}
    >
      <div className="flex items-center gap-3 bg-brand-700 px-6 py-[1.6vh]">
        <StarIcon
          width={24}
          height={24}
          aria-hidden
          className="size-[1.1em] shrink-0 text-reward-400"
        />
        <p
          className={cn(
            'min-w-0 flex-1 truncate font-black break-all text-ink-onbrand',
            SIZE.stageSubtitle,
          )}
        >
          {domain}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-6 py-[2vh]">
        {nickname ? (
          <p className={cn('font-bold text-brand-700', SIZE.caption)}>{nickname}</p>
        ) : null}
        <p
          className={cn(
            'mt-1 line-clamp-6 whitespace-pre-line text-pretty text-ink',
            SIZE.caption,
          )}
        >
          {reason}
        </p>
      </div>
    </div>
  )
}

export type BoardStageProps = {
  /** หัวข้อใหญ่ของช่วงนั้น */
  title: string
  /** ข้อความรองใต้หัวข้อ */
  subtitle?: ReactNode
  children?: ReactNode
  className?: string
  /** ไอคอน 3 มิติเหนือหัวข้อ (ตกแต่ง) */
  icon?: ReactNode
}

/**
 * โครงกลางจอของแต่ละช่วง — หัวข้อใหญ่ + เนื้อหา จัดกลางทั้งแนวตั้งแนวนอน
 *
 * ⚠️ **เป็นแผงที่กินพื้นที่ที่เหลือทั้งหมด ไม่ใช่กล่องลอยกลางจอ**
 *    บางช่วงมีเนื้อหาชิ้นเดียว (เช่นตัวเลขใบเสนอ) ถ้าไม่มีแผงรองรับ จอจะเหลือ
 *    พื้นที่ว่างเปล่าบนล่างอย่างละเกือบ 200px แล้วดูเหมือนหน้าโหลดไม่เสร็จ
 *    แผงนี้ทำให้ช่วงที่ข้อมูลน้อยกับช่วงที่ข้อมูลเยอะดูเป็นจอเดียวกัน
 * ⚠️ `justify-center` ทำให้เนื้อหาที่งอกมาทีหลัง (เช่นการ์ดผลงานที่ครูเพิ่งปักหมุด)
 *    ดันออกจากกึ่งกลางเท่า ๆ กันทั้งบนล่าง ไม่ใช่กระโดดลงมาจากขอบบน
 */
export function BoardStage({ title, subtitle, children, className, icon }: BoardStageProps) {
  return (
    <section
      className={cn(
        'relative flex min-h-0 flex-1 flex-col items-center justify-center gap-[3vh]',
        'overflow-hidden rounded-[2rem] px-[clamp(1.5rem,3vw,3rem)] py-[3vh] text-center',
        'bg-surface-raised/45 ring-1 ring-brand-100 ring-inset',
        className,
      )}
    >
      {/* แสงนวลมุมบนขวา ให้แผงที่มีของชิ้นเดียวยังดูเป็นจอที่ตั้งใจจัด ไม่ใช่จอโล่ง */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-[18vh] -right-[8vw] size-[46vh] rounded-full opacity-45"
        style={{
          backgroundImage:
            'radial-gradient(circle, var(--color-brand-100) 0%, transparent 70%)',
        }}
      />

      {icon ? <div className="relative">{icon}</div> : null}
      <h2
        className={cn(
          'relative leading-tight font-black text-balance text-ink',
          SIZE.stageTitle,
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className={cn('relative max-w-[52rem] text-pretty text-ink-muted', SIZE.stageSubtitle)}>
          {subtitle}
        </p>
      ) : null}
      {/**
       * กล่องเนื้อหา — **ไม่ใช่ flex-1**
       *
       * ถ้าให้กล่องนี้กินพื้นที่ที่เหลือ หัวข้อจะถูกดันไปติดขอบบนแล้วเนื้อหาไปจมกลางล่าง
       * เกิดช่องว่างใหญ่คั่นกลางทุกช่วงที่มีของชิ้นเดียว (วัดจริงที่ 720: ว่างเกือบ 200px)
       * ปล่อยให้สูงตามเนื้อหาแล้วให้ `justify-center` ของแผงจัด หัวข้อ+เนื้อหา ลงกลางเป็นก้อนเดียว
       */}
      <div className="relative flex w-full min-h-0 flex-col items-center justify-center">
        {children}
      </div>
    </section>
  )
}
