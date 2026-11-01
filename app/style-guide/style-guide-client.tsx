'use client'

import { useState } from 'react'
import {
  AchievementBadge,
  BottomNav,
  Button,
  Card,
  CardHeader,
  ChevronRightIcon,
  ChoiceCard,
  Chip,
  ChipSlot,
  CheckIcon,
  DomeAvatar,
  DomeSays,
  EmptyState,
  IconButton,
  InfoIcon,
  ProgressBar,
  PinInput,
  ShopScene,
  Skeleton,
  SkeletonGroup,
  SpeechBubble,
  StarIcon,
  StatBadge,
  TextField,
  Toast,
  ToastViewport,
  stageFromPercent,
  type BottomNavItem,
  type DomeMood,
  type ShopStage,
} from '@/components/ui'

import { AppShell } from '@/components/app-shell'
import { ShopStageCard, ShopStages } from '@/components/shop-stages'

/**
 * หน้ารวมตัวอย่างระบบดีไซน์ — ไว้ให้ทีมและกรรมการดู component ทุกตัวในที่เดียว
 * ข้อมูลในหน้านี้เป็นข้อมูลสมมติของ "หน้าตัวอย่าง" เท่านั้น
 * ไม่ได้ฝังอยู่ในตัว component (ทุกตัวรับค่าผ่าน props ล้วน)
 */

const NAV_ITEMS: BottomNavItem[] = [
  { href: '/home', label: 'หน้าหลัก', icon: 'home' },
  { href: '/map', label: 'ภารกิจ', icon: 'quest', badge: 2 },
  { href: '/knowledge', label: 'ความรู้', icon: 'knowledge' },
  { href: '/rewards', label: 'รางวัล', icon: 'reward' },
  { href: '/profile', label: 'โปรไฟล์', icon: 'profile' },
]

const DOME_MOODS: { mood: DomeMood; label: string }[] = [
  { mood: 'greet', label: 'ทักทาย' },
  { mood: 'cheer', label: 'ชูกำลังใจ' },
  { mood: 'happy', label: 'ดีใจ' },
  { mood: 'think', label: 'คิด' },
  { mood: 'encourage', label: 'ยกนิ้ว' },
  { mood: 'explain', label: 'อธิบาย' },
  { mood: 'surprised', label: 'ว้าว' },
  { mood: 'celebrate', label: 'ฉลอง' },
  { mood: 'wait', label: 'รอฟัง' },
]

const COLOR_GROUPS: { title: string; note: string; swatches: { name: string; cls: string }[] }[] = [
  {
    title: 'แบรนด์ (ม่วง) — ตัวตนของโดมและปุ่มหลัก',
    note: 'ใช้กับสิ่งที่อยากให้กดมากที่สุด และทุกอย่างที่เป็น "เสียงของโดม"',
    swatches: [
      { name: 'brand-50', cls: 'bg-brand-50' },
      { name: 'brand-100', cls: 'bg-brand-100' },
      { name: 'brand-200', cls: 'bg-brand-200' },
      { name: 'brand-400', cls: 'bg-brand-400' },
      { name: 'brand-500', cls: 'bg-brand-500' },
      { name: 'brand-600', cls: 'bg-brand-600' },
      { name: 'brand-700', cls: 'bg-brand-700' },
      { name: 'brand-900', cls: 'bg-brand-900' },
    ],
  },
  {
    title: 'เควสต์ (เขียว) — ผ่าน ยืนยัน ความคืบหน้า',
    note: 'ปุ่ม "ตรวจคำตอบ" แถบความคืบหน้า และทุกอย่างที่แปลว่าสำเร็จ',
    swatches: [
      { name: 'quest-50', cls: 'bg-quest-50' },
      { name: 'quest-100', cls: 'bg-quest-100' },
      { name: 'quest-300', cls: 'bg-quest-300' },
      { name: 'quest-500', cls: 'bg-quest-500' },
      { name: 'quest-600', cls: 'bg-quest-600' },
      { name: 'quest-700', cls: 'bg-quest-700' },
    ],
  },
  {
    title: 'สปาร์ก (ส้ม) — สิ่งที่ต้องลงมือทำต่อ',
    note: 'ภารกิจใหม่ ป้ายแจ้งเตือน จุดที่อยากให้สายตาไปหยุด',
    swatches: [
      { name: 'spark-50', cls: 'bg-spark-50' },
      { name: 'spark-100', cls: 'bg-spark-100' },
      { name: 'spark-300', cls: 'bg-spark-300' },
      { name: 'spark-500', cls: 'bg-spark-500' },
      { name: 'spark-600', cls: 'bg-spark-600' },
      { name: 'spark-700', cls: 'bg-spark-700' },
    ],
  },
  {
    title: 'รางวัล (ทอง) — ดาวและเกียรติบัตร',
    note: 'ใช้เฉพาะของรางวัลเท่านั้น ถ้าใช้พร่ำเพรื่อ ดาวจะไม่รู้สึกพิเศษ',
    swatches: [
      { name: 'reward-100', cls: 'bg-reward-100' },
      { name: 'reward-300', cls: 'bg-reward-300' },
      { name: 'reward-500', cls: 'bg-reward-500' },
      { name: 'reward-600', cls: 'bg-reward-600' },
      { name: 'reward-700', cls: 'bg-reward-700' },
    ],
  },
  {
    title: 'พื้นผิวและตัวอักษร',
    note: 'พื้นครีมอุ่นตามภาพต้นแบบ การ์ดขาวลอยอยู่บนพื้นครีม',
    swatches: [
      { name: 'surface', cls: 'bg-surface' },
      { name: 'surface-sunken', cls: 'bg-surface-sunken' },
      { name: 'surface-alt', cls: 'bg-surface-alt' },
      { name: 'line', cls: 'bg-line' },
      { name: 'line-contrast', cls: 'bg-line-contrast' },
      { name: 'ink-subtle', cls: 'bg-ink-subtle' },
      { name: 'ink-muted', cls: 'bg-ink-muted' },
      { name: 'ink', cls: 'bg-ink' },
    ],
  },
]

const TYPE_SCALE: { name: string; cls: string; px: string; use: string }[] = [
  { name: 'hero', cls: 'text-hero', px: '36px / 1.25', use: 'ตัวเลขคะแนน หน้าฉลอง' },
  { name: 'display', cls: 'text-display', px: '30px / 1.35', use: 'หัวหน้าจอ' },
  { name: 'title', cls: 'text-title', px: '24px / 1.45', use: 'หัวส่วน' },
  { name: 'title-sm', cls: 'text-title-sm', px: '21px / 1.5', use: 'หัวการ์ด' },
  { name: 'body-lg', cls: 'text-body-lg', px: '19px / 1.7', use: 'โจทย์ภารกิจ คำถาม' },
  { name: 'body', cls: 'text-body', px: '17px / 1.75', use: 'เนื้อหาหลัก' },
  { name: 'label', cls: 'text-label', px: '15px / 1.6', use: 'ป้ายกำกับ ชิป แท็บ' },
  { name: 'note', cls: 'text-note', px: '13px / 1.6', use: 'ข้อความประกอบ' },
]

const SPACING = [
  { token: '1', px: '4px', use: 'ช่องไฟระหว่างไอคอนกับตัวอักษร' },
  { token: '2', px: '8px', use: 'ระหว่างชิปในแถวเดียวกัน' },
  { token: '3', px: '12px', use: 'ระหว่างการ์ดในรายการ' },
  { token: '4', px: '16px', use: 'ขอบซ้ายขวาของหน้าจอ' },
  { token: '5', px: '20px', use: 'ระยะในการ์ด' },
  { token: '6', px: '24px', use: 'ระหว่างบล็อกเนื้อหา' },
  { token: '8', px: '32px', use: 'ระหว่างส่วนใหญ่ของหน้า' },
  { token: '12', px: '48px', use: 'หัวหน้าจอกับเนื้อหาแรก' },
]

const RADII = [
  { token: 'rounded-xs', px: '8px', use: 'แท็กเล็ก' },
  { token: 'rounded-sm', px: '12px', use: 'ช่องกรอก' },
  { token: 'rounded-md', px: '16px', use: 'ปุ่มเล็ก' },
  { token: 'rounded-lg', px: '20px', use: 'ปุ่มหลัก' },
  { token: 'rounded-xl', px: '24px', use: 'การ์ด' },
  { token: 'rounded-2xl', px: '32px', use: 'การ์ดใหญ่' },
  { token: 'rounded-3xl', px: '40px', use: 'กล่องคำพูดโดม' },
]

const SHADOWS = [
  { token: 'shadow-soft-1', use: 'ชิป ป้าย การ์ดที่ยังไม่ใช่พระเอก' },
  { token: 'shadow-soft-2', use: 'การ์ดทั่วไปและปุ่มหลัก' },
  { token: 'shadow-soft-3', use: 'การ์ดพระเอก แถบแจ้งผล' },
  { token: 'shadow-lift', use: 'ของที่ลอยอยู่เหนือทุกอย่าง' },
]

export function StyleGuideClient() {
  const [choice, setChoice] = useState<string | null>(null)
  const [selectedChip, setSelectedChip] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [progress, setProgress] = useState(60)
  const [toastOpen, setToastOpen] = useState(false)
  const [shopName, setShopName] = useState('')
  const [pin, setPin] = useState('')

  const stage: ShopStage = stageFromPercent(progress)
  /* ชุดภาพใหม่นับเป็นด่านจริง 0–5 ไม่ใช่สเตจ 1–4 ของชุดเดิม
     ในหน้าตัวอย่างนี้จึงแปลงจากแถบเลื่อนเปอร์เซ็นต์ให้เห็นครบทั้ง 6 ขั้น */
  const clearedDemo = Math.round((progress / 100) * 5)

  return (
    <AppShell footer={<BottomNav items={NAV_ITEMS} activeHref="/home" />}>
      <div className="px-4 pt-6 pb-8">
      {toastOpen ? (
        <ToastViewport>
          <Toast
            tone="success"
            message="บันทึกชื่อโดเมนของร้านเรียบร้อยแล้ว"
            duration={4000}
            onDismiss={() => setToastOpen(false)}
          />
        </ToastViewport>
      ) : null}

      <header className="mb-8">
        <p className="text-label font-bold text-brand-700">ระบบดีไซน์</p>
        <h1 className="mt-1 text-display font-extrabold text-balance text-ink">
          CEO Domain Quest
        </h1>
        <p className="mt-2 text-body text-pretty text-ink-muted">
          หน้ารวม component ทุกตัวที่หน้าอื่นหยิบไปใช้ได้ทันที ออกแบบสำหรับจอมือถือ 390px
          เป็นหลัก เอกสารเหตุผลการเลือกทุกค่าอยู่ที่ <code className="rounded-xs bg-surface-sunken px-1.5 py-0.5 text-label">docs/design-system.md</code>
        </p>
      </header>

      <Section id="color" title="1. โทเคนสี" subtitle="ตั้งชื่อตามความหมาย ไม่ใช่ชื่อสี">
        <div className="flex flex-col gap-5">
          {COLOR_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-title-sm font-bold text-ink">{group.title}</h3>
              <p className="mt-0.5 mb-2 text-label text-ink-muted">{group.note}</p>
              <ul className="grid grid-cols-4 gap-2">
                {group.swatches.map((s) => (
                  <li key={s.name} className="min-w-0">
                    <div
                      className={`h-12 w-full rounded-md ring-1 ring-line ring-inset ${s.cls}`}
                      aria-hidden="true"
                    />
                    <p className="mt-1 truncate text-note text-ink-muted">{s.name}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section id="type" title="2. สเกลตัวอักษรไทย" subtitle="ใหญ่กว่าสเกลอังกฤษหนึ่งขั้น เพราะสระบนล่างของไทย">
        <ul className="flex flex-col gap-4">
          {TYPE_SCALE.map((t) => (
            <li key={t.name} className="border-b border-line pb-3 last:border-0">
              <p className={`${t.cls} font-bold text-pretty text-ink`}>
                ตั้งชื่อโดเมนให้ร้านของฉัน
              </p>
              <p className="mt-1 text-note text-ink-muted">
                <code className="font-semibold text-brand-700">text-{t.name}</code> · {t.px} · {t.use}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="space" title="3. ระยะห่าง รัศมีมุม และเงา" subtitle="ฐาน 4px ทุกค่าหารด้วย 4 ลงตัว">
        <h3 className="mb-2 text-title-sm font-bold text-ink">ระยะห่าง</h3>
        <ul className="mb-6 flex flex-col gap-2">
          {SPACING.map((s) => (
            <li key={s.token} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-note font-bold tabular-nums text-brand-700">
                {s.px}
              </span>
              <span
                aria-hidden="true"
                className="h-3 shrink-0 rounded-full bg-brand-400"
                style={{ width: s.px }}
              />
              <span className="min-w-0 flex-1 text-note text-ink-muted">{s.use}</span>
            </li>
          ))}
        </ul>

        <h3 className="mb-2 text-title-sm font-bold text-ink">รัศมีมุม</h3>
        <ul className="mb-6 grid grid-cols-2 gap-2">
          {RADII.map((r) => (
            <li key={r.token} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`size-12 shrink-0 bg-brand-200 ${r.token}`}
              />
              <span className="min-w-0 text-note text-ink-muted">
                <span className="block font-bold text-brand-700">{r.px}</span>
                {r.use}
              </span>
            </li>
          ))}
        </ul>

        <h3 className="mb-2 text-title-sm font-bold text-ink">เงา</h3>
        <ul className="grid grid-cols-2 gap-3">
          {SHADOWS.map((s) => (
            <li key={s.token}>
              <div
                aria-hidden="true"
                className={`h-14 w-full rounded-xl bg-surface-raised ${s.token}`}
              />
              <p className="mt-1.5 text-note text-ink-muted">
                <span className="block font-bold text-brand-700">{s.token}</span>
                {s.use}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="button" title="4. ปุ่ม" subtitle="4 แบบ · สูงอย่างน้อย 44px ทุกขนาด">
        <div className="flex flex-col gap-3">
          <Button variant="primary" fullWidth size="lg" trailingIcon={<ChevronRightIcon width={22} height={22} />}>
            เริ่มภารกิจแรก
          </Button>
          <Button variant="success" fullWidth leadingIcon={<CheckIcon width={22} height={22} />}>
            ตรวจคำตอบ
          </Button>
          <Button variant="secondary" fullWidth>
            ดูคำใบ้
          </Button>
          <Button variant="ghost" fullWidth>
            ข้ามภารกิจนี้
          </Button>
        </div>

        <h3 className="mt-6 mb-2 text-title-sm font-bold text-ink">สถานะปุ่ม</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm">ปกติ</Button>
          <Button variant="primary" size="sm" disabled>ปิดใช้งาน</Button>
          <Button variant="primary" size="sm" loading loadingLabel="กำลังบันทึก">กำลังบันทึก</Button>
          <Button variant="secondary" size="sm">รอง</Button>
          <Button variant="secondary" size="sm" disabled>รอง ปิด</Button>
          <Button variant="success" size="sm" disabled>ยืนยัน ปิด</Button>
        </div>
        <p className="mt-2 text-note text-ink-muted">
          สถานะ hover / กดค้าง / โฟกัสด้วยคีย์บอร์ด ลองกด Tab ไล่ดูได้ — วงแหวนโฟกัสหนา 3px
          เว้นขอบ 3px ผ่านเกณฑ์ไม่ใช่ตัวอักษร 3:1 ทุกพื้นหลังในระบบนี้
        </p>

        <h3 className="mt-6 mb-2 text-title-sm font-bold text-ink">ปุ่มไอคอนล้วน</h3>
        <div className="flex flex-wrap items-center gap-2">
          <IconButton aria-label="ดูข้อมูลเพิ่มเติม" icon={<InfoIcon width={22} height={22} />} />
          <IconButton
            aria-label="ไปภารกิจถัดไป"
            variant="primary"
            icon={<ChevronRightIcon width={22} height={22} />}
          />
          <IconButton
            aria-label="ทำเครื่องหมายว่าเสร็จแล้ว"
            variant="success"
            size="sm"
            icon={<CheckIcon width={20} height={20} />}
          />
        </div>
        <p className="mt-2 text-note text-ink-muted">
          ปุ่มไอคอนล้วนบังคับให้ใส่ <code className="font-semibold">aria-label</code> ตั้งแต่ชั้น
          TypeScript — ลืมใส่แล้ว build ไม่ผ่าน
        </p>
      </Section>

      <Section id="field" title="4.5 ช่องกรอก" subtitle="label จริงเสมอ · ช่องรหัสแยกช่อง · ผิดแล้วมีไอคอนคู่">
        <div className="flex flex-col gap-5">
          <TextField
            label="ชื่อร้านของฉัน"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="เช่น ขนมบ้านยาย"
            hint="ตั้งชื่อที่ลูกค้าจำง่าย"
            valid={shopName.trim().length > 0}
          />
          <TextField
            label="รหัสห้อง 6 ตัว"
            value=""
            readOnly
            center
            placeholder="QUEST9"
            error="ไม่พบห้องนี้ ตรวจรหัสห้อง 6 ตัวอีกครั้ง"
            inputClassName="text-title font-extrabold tracking-[0.3em] uppercase"
          />
          <PinInput
            value={pin}
            onChange={setPin}
            label="ตั้งรหัส 4 หลักของตัวเอง"
            hint={pin.length === 4 ? 'ครบ 4 หลักแล้ว' : `ใส่อีก ${4 - pin.length} หลัก`}
          />
        </div>
      </Section>

      <Section id="card" title="5. การ์ด" subtitle="สีการ์ดสื่อประเภทของเนื้อหา">
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader
              title="ภารกิจ 2 เลือกชื่อโดเมนและจดโดเมน"
              description="ประกอบชื่อเว็บไซต์ให้ถูกต้อง แล้วเลือกนามสกุลให้ตรงประเภทธุรกิจ"
              icon={<StarIcon width={22} height={22} />}
              trailing={<StatBadge kind="star" value={2} max={3} label="ดาว" hideLabel size="sm" />}
            />
          </Card>
          <Card tone="quest">
            <p className="text-body font-semibold text-ink">ผ่านภารกิจแล้ว ได้ 3 ดาวเต็ม</p>
          </Card>
          <Card tone="spark">
            <p className="text-body font-semibold text-ink">มีภารกิจใหม่รออยู่ 2 ภารกิจ</p>
          </Card>
          <Card tone="reward" elevated>
            <p className="text-body font-semibold text-ink">ปลดล็อกเกียรติบัตรแล้ว</p>
          </Card>
        </div>
      </Section>

      <Section id="stat" title="6. ป้ายตัวเลขสถานะ" subtitle="ดาว เปอร์เซ็นต์ จำนวน">
        <div className="flex flex-wrap items-center gap-2">
          <StatBadge kind="star" value={320} label="ดาวสะสม" />
          <StatBadge kind="star" value={2} max={3} label="ดาวภารกิจนี้" hideLabel />
          <StatBadge kind="percent" value={progress} label="ความคืบหน้า" />
          <StatBadge kind="count" value="ม.ปวช.1/3" label="ห้อง" hideLabel size="sm" />
          <StatBadge kind="star" value={5} max={5} label="ดาวเต็ม" hideLabel size="lg" />
        </div>
      </Section>

      <Section id="progress" title="7. แถบความคืบหน้าและภาพร้าน" subtitle="ร้านค่อย ๆ สร้างเสร็จตามคะแนน">
        <ProgressBar value={progress} label="ความคืบหน้าร้านขนมบ้านยาย" />
        <div className="mt-4 flex flex-wrap gap-2">
          {[0, 30, 75, 100].map((v) => (
            <Button key={v} size="sm" variant="secondary" onClick={() => setProgress(v)}>
              {`ตั้งเป็น ${v}%`}
            </Button>
          ))}
        </div>
        <div className="mt-4 grid place-items-center rounded-2xl bg-quest-50 p-3">
          <ShopScene stage={stage} />
          <p className="mt-1 text-label font-semibold text-ink-muted">{`ภาพร้านสเตจที่ ${stage} จาก 4`}</p>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <ProgressBar value={40} max={100} label="ความคืบหน้าแบบสีแบรนด์" tone="brand" size="sm" />
          <ProgressBar value={85} max={100} label="เวลาที่ใช้ไปในคาบ" tone="spark" size="lg" />
        </div>
      </Section>

      <Section
        id="shop-stages"
        title="7.1 ภาพร้าน 6 ขั้น (ชุดใหม่)"
        subtitle="ขั้น 0 ยังไม่เริ่ม ถึงขั้น 5 ผ่านครบทุกด่าน — หนึ่งด่านต่อหนึ่งขั้น"
      >
        <p className="text-body text-pretty text-ink-muted">
          ทุกขั้นเปลี่ยนทั้งความสูง ความกว้างฐาน และจำนวนชิ้นส่วนพร้อมกัน
          เงาของทรงจึงต่างกันทุกขั้นแม้ภาพย่อเล็ก · วาดเป็น SVG ในโค้ด ไม่โหลดไฟล์จากที่ไหน
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {([0, 1, 2, 3, 4, 5] as const).map((lv) => (
            <li key={lv} className="rounded-2xl bg-brand-50 p-2 ring-1 ring-brand-100 ring-inset">
              <ShopStages level={lv} decorative />
              <p className="mt-1 text-center text-note font-bold text-brand-700">{`ขั้นที่ ${lv}`}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <ShopStageCard
            stagesCleared={clearedDemo}
            stagesTotal={5}
            percent={progress}
            label={`ร้านโตมาแล้ว ${clearedDemo} จาก 5 ด่าน`}
            shopName="ร้านขนมบ้านยาย (ตัวอย่างในหน้าระบบดีไซน์)"
          />
        </div>
      </Section>

      <Section id="choice" title="8. การ์ดตัวเลือก" subtitle="กดเลือกได้ · บอกถูกผิดด้วยไอคอน ไม่ใช่สีอย่างเดียว">
        <div className="flex flex-col gap-2">
          <ChoiceCard
            marker="ก"
            label=".com"
            description="ธุรกิจทั่วไป ใช้ได้ทุกประเทศ"
            selected={choice === 'com'}
            onSelect={() => setChoice('com')}
          />
          <ChoiceCard
            marker="ข"
            label=".co.th"
            description="ธุรกิจที่จดทะเบียนในประเทศไทย"
            selected={choice === 'coth'}
            onSelect={() => setChoice('coth')}
          />
          <ChoiceCard marker="ค" label=".org" description="องค์กรไม่แสวงหากำไร" state="correct" />
          <ChoiceCard marker="ง" label=".net" description="ผู้ให้บริการเครือข่าย" state="wrong" />
          <ChoiceCard marker="จ" label=".ac.th" description="ยังปลดล็อกไม่ได้" state="locked" />
        </div>
      </Section>

      <Section id="chip" title="9. ชิปลากวาง" subtitle="ลากด้วยเมาส์ก็ได้ แตะเลือกแล้วแตะช่องปลายทางก็ได้">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ChipSlot label="ช่องหน้าชื่อเว็บ" state="correct">
            www.
          </ChipSlot>
          <ChipSlot
            label="ช่องชื่อโดเมน"
            active={selectedChip != null && slot == null}
            onDropValue={(v) => setSlot(v || selectedChip)}
          >
            {slot}
          </ChipSlot>
          <ChipSlot label="ช่องนามสกุลโดเมน">{null}</ChipSlot>
        </div>
        <div className="row-scroll">
          {['kanom', 'banyai', '.com', '.net', '.org'].map((v) => (
            <Chip
              key={v}
              draggable
              dragValue={v}
              selected={selectedChip === v}
              tone={v.startsWith('.') ? 'spark' : 'brand'}
              onSelect={() => setSelectedChip(selectedChip === v ? null : v)}
            >
              {v}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone="quest" size="sm">
            ตอบถูก
          </Chip>
          <Chip tone="neutral" size="sm" selected>
            เลือกอยู่
          </Chip>
          <Chip tone="brand" size="sm" disabled>
            ปิดใช้งาน
          </Chip>
        </div>
      </Section>

      <Section id="dome" title="10. โดมและกล่องคำพูด" subtitle="ตัวละครมอนสเตอร์ 9 อารมณ์">
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-brand-50 p-3">
          {DOME_MOODS.map(({ mood, label }) => (
            <figure key={mood} className="flex flex-col items-center">
              <DomeAvatar mood={mood} size={88} />
              <figcaption className="mt-1 text-note font-semibold text-ink-muted">
                {label}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <DomeSays mood="greet" speakerName="โดม">
            สวัสดีครับ ผมโดม เลขาส่วนตัวของคุณ วันนี้อยากทำอะไรดีครับ
          </DomeSays>
          <DomeSays mood="cheer" speakerName="โดม" reverse>
            ใกล้เสร็จแล้วครับ อีกนิดเดียวร้านขนมบ้านยายจะพร้อมเปิดออนไลน์แล้ว
          </DomeSays>
          <SpeechBubble speaker="student" tail="right" speakerName="น้องครีม">
            ฉันอยากสร้างเว็บไซต์ของตัวเอง
          </SpeechBubble>
        </div>
      </Section>

      <Section id="feedback" title="11. แถบแจ้งผล โครงร่างโหลด และหน้าจอว่าง" subtitle="">
        <Button variant="secondary" onClick={() => setToastOpen(true)}>
          แสดงแถบแจ้งผลด้านบนจอ
        </Button>
        <div className="mt-4 flex flex-col gap-2">
          <Toast tone="success" message="ส่งคำตอบเรียบร้อย ได้ 3 ดาว" duration={null} />
          <Toast tone="error" message="ส่งไม่สำเร็จ ลองกดอีกครั้ง" duration={null} />
          <Toast tone="info" message="ครูกำลังตรวจผลงานของเพื่อนอยู่" duration={null} />
        </div>

        <h3 className="mt-6 mb-2 text-title-sm font-bold text-ink">โครงร่างระหว่างรอโหลด</h3>
        <SkeletonGroup label="กำลังโหลดภารกิจ">
          <Card>
            <div className="flex items-start gap-3">
              <Skeleton shape="circle" width="2.75rem" />
              <div className="min-w-0 flex-1">
                <Skeleton shape="title" width="70%" />
                <div className="mt-2">
                  <Skeleton shape="text" lines={3} />
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Skeleton shape="chip" width="6rem" />
              <Skeleton shape="chip" width="4.5rem" />
            </div>
          </Card>
        </SkeletonGroup>

        <h3 className="mt-6 mb-2 text-title-sm font-bold text-ink">หน้าจอว่าง</h3>
        <EmptyState
          as="h3"
          title="ยังไม่มีผลงานของเพื่อนในห้องนี้"
          description="รอเพื่อนส่งใบเสนอชื่อเว็บก่อนนะ แล้วค่อยกลับมาดูใหม่"
          illustration={<DomeAvatar mood="cheer" size={110} decorative />}
          action={
            <Button variant="primary" fullWidth>
              กลับไปทำภารกิจต่อ
            </Button>
          }
        />
      </Section>

      <Section id="badge" title="12. ตราเกียรติบัตร" subtitle="ได้รับแล้ว / ยังไม่ได้รับ">
        <div className="flex items-start justify-around gap-4">
          <AchievementBadge caption="นักธุรกิจออนไลน์รุ่นเยาว์" />
          <AchievementBadge caption="ยังไม่ได้รับ" earned={false} />
        </div>
      </Section>

      <Section id="nav" title="13. แถบเมนูล่าง 5 ปุ่ม" subtitle="ตัวจริงอยู่ท้ายจอนี้แล้ว">
        <p className="text-body text-ink-muted">
          แถบเมนูตัวจริงเป็นชั้น footer ของ AppShell อยู่ท้ายจอตอนนี้ — ปุ่มละสูง 56px
          แบ่งความกว้างเท่ากัน 5 ช่อง บนจอ 390px ได้ช่องละประมาณ 76px
          และ AppShell เว้นพื้นที่ปลอดภัยของ iPhone ให้แล้ว
        </p>
      </Section>
      </div>
    </AppShell>
  )
}

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mb-10">
      <h2 id={`${id}-heading`} className="text-title font-extrabold text-balance text-ink">
        {title}
      </h2>
      {subtitle ? <p className="mt-0.5 mb-4 text-label text-ink-muted">{subtitle}</p> : <div className="mb-4" />}
      {children}
    </section>
  )
}
