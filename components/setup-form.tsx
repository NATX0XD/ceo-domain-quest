'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeading, Section, StudentShell } from '@/components/student-shell'
import { AppFooter } from '@/components/app-shell'
import {
  Button,
  Card,
  CheckIcon,
  ChoiceCard,
  ProgressBar,
  ShopScene,
  TextField,
  Toast,
  ToastViewport,
} from '@/components/ui'

/**
 * ฟอร์มตั้งค่าร้าน — ส่งขึ้นเซิร์ฟเวอร์ที่ POST /api/profile
 *
 * ⚠️ ไม่เก็บโปรไฟล์ในเบราว์เซอร์ ของเดิมนักเรียนแก้ค่าใน sessionStorage แล้วโกงได้ (รีวิว R2 H1)
 * ⚠️ ตัวตนมาจากคุกกี้ dbq_student ที่ออกให้ตอนเข้าห้องผ่าน /api/join เท่านั้น
 *    ไม่มีทางลัดออกคุกกี้เอง และโปรไฟล์ล็อกทันทีที่เริ่มภารกิจแรก (แก้แล้วได้ 409)
 */
type Audience = 'thai' | 'international'

export function SetupForm({
  businessTypes,
}: {
  businessTypes: { id: string; label: string; icon: string }[]
}) {
  const router = useRouter()
  const [shopName, setShopName] = useState('')
  const [businessTypeId, setBusinessTypeId] = useState('')
  const [isRegisteredCompany, setIsRegisteredCompany] = useState<boolean | null>(null)
  const [audience, setAudience] = useState<Audience | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = shopName.trim()
  const ready =
    trimmedName.length > 0 &&
    businessTypeId.length > 0 &&
    isRegisteredCompany !== null &&
    audience !== null

  // นับเฉพาะเพื่อแสดงความคืบหน้าให้นักเรียนเห็นว่าเหลืออีกกี่ช่อง — ไม่ได้ใช้ตัดสินอะไร
  const filledCount = [
    trimmedName.length > 0 && businessTypeId.length > 0,
    isRegisteredCompany !== null,
    audience !== null,
  ].filter(Boolean).length

  async function handleSubmit() {
    if (!ready || isRegisteredCompany === null || audience === null || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          shopName: trimmedName,
          businessTypeId,
          // สถานี A (โรงทำป้าย) ยังไม่เสร็จ ตอนนี้ใช้ชื่อร้านเป็นชื่อโดเมนไปก่อน
          domainName: trimmedName,
          isRegisteredCompany,
          audience,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { message?: string; error?: string }
          | null
        if (res.status === 401) {
          setError(data?.message ?? 'ยังไม่ได้เข้าห้องเรียน ไปใส่รหัสห้องกับ PIN ที่หน้าเข้าห้องก่อน')
          return
        }
        setError(data?.message ?? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      router.push('/dome')
      router.refresh()
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองบันทึกใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <StudentShell
      // ฟอร์ม 3 ข้อยาวเกินจอ ปุ่มบันทึกจึงอยู่แถบท้ายที่ไม่เลื่อน
      // ข้อความบนปุ่มบอกด้วยว่าเหลืออีกกี่ข้อ นักเรียนไม่ต้องเลื่อนขึ้นไปดูแถบความคืบหน้า
      footer={
        <AppFooter>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSubmit}
            disabled={!ready}
            loading={saving}
            loadingLabel="กำลังบันทึกข้อมูลร้าน"
            leadingIcon={ready && !saving ? <CheckIcon width={22} height={22} /> : undefined}
          >
            {ready ? 'บันทึกแล้วไปคุยกับโดม' : `ตอบแล้ว ${filledCount} จาก 3 ข้อ`}
          </Button>
        </AppFooter>
      }
    >
      {error ? (
        <ToastViewport>
          <Toast tone="error" message={error} duration={null} onDismiss={() => setError(null)} />
        </ToastViewport>
      ) : null}

      <PageHeading
        eyebrow="ก่อนเริ่มภารกิจ"
        title="ตั้งค่าร้านของเรา"
        description="ตอบ 3 ข้อ แล้วเริ่มภารกิจได้เลย ข้อมูลนี้จะถูกล็อกเมื่อเริ่มภารกิจแรก"
      />

      <ProgressBar
        value={filledCount}
        max={3}
        tone="brand"
        label={`ตั้งค่าร้านไปแล้ว ${filledCount} จาก 3 ข้อ`}
        showValue={false}
      />

      <Section title="1. ร้านของเราชื่ออะไร" description="พิมพ์ภาษาไทยหรืออังกฤษก็ได้">
        <TextField
          label="ชื่อร้าน"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="เช่น ร้านเค้ก หรือ cakeshop"
          valid={trimmedName.length > 0}
          hint="ชื่อนี้จะขึ้นเป็นป้ายหน้าร้านของเรา"
          inputClassName="text-body-lg font-bold"
        />

        {/* ป้ายหน้าร้านจำลอง — ขึ้นตามที่พิมพ์จริง ไม่มีค่าตัวอย่างฝังไว้ */}
        <Card tone="quest" padding="sm" className="mt-4">
          <div className="grid place-items-center">
            <ShopScene stage={1} decorative />
          </div>
          <div className="mt-2 rounded-xl bg-surface-raised p-3 shadow-soft-1">
            <p className="text-note font-semibold text-ink-muted">ป้ายหน้าร้านของเรา</p>
            <p className="mt-0.5 truncate text-body-lg font-extrabold text-ink">
              {trimmedName.length > 0 ? trimmedName : 'ยังไม่ได้ตั้งชื่อร้าน'}
            </p>
          </div>
        </Card>

        <h3 className="mt-6 text-title-sm font-bold text-balance text-ink">ร้านของเราขายอะไร</h3>
        <div
          role="radiogroup"
          aria-label="ประเภทของร้าน"
          className="mt-3 flex flex-col gap-2"
        >
          {businessTypes.map((b) => (
            <ChoiceCard
              key={b.id}
              label={b.label}
              selected={businessTypeId === b.id}
              onSelect={() => setBusinessTypeId(b.id)}
            />
          ))}
        </div>
      </Section>

      <Section title="2. จดทะเบียนนิติบุคคลแล้วหรือยัง">
        <div
          role="radiogroup"
          aria-label="สถานะการจดทะเบียนนิติบุคคล"
          className="flex flex-col gap-2"
        >
          <ChoiceCard
            label="จดแล้ว"
            description="ร้านเราจดทะเบียนเป็นบริษัทหรือห้างหุ้นส่วนแล้ว"
            selected={isRegisteredCompany === true}
            onSelect={() => setIsRegisteredCompany(true)}
          />
          <ChoiceCard
            label="ยังไม่ได้จด"
            description="ยังขายในนามตัวเองอยู่"
            selected={isRegisteredCompany === false}
            onSelect={() => setIsRegisteredCompany(false)}
          />
        </div>
      </Section>

      <Section title="3. ลูกค้าของเราอยู่ที่ไหน">
        <div role="radiogroup" aria-label="กลุ่มลูกค้าของร้าน" className="flex flex-col gap-2">
          <ChoiceCard
            label="ในไทย"
            description="ขายให้คนไทยเป็นหลัก"
            selected={audience === 'thai'}
            onSelect={() => setAudience('thai')}
          />
          <ChoiceCard
            label="ต่างประเทศด้วย"
            description="อยากให้คนต่างชาติสั่งของเราได้"
            selected={audience === 'international'}
            onSelect={() => setAudience('international')}
          />
        </div>
      </Section>

    </StudentShell>
  )
}
