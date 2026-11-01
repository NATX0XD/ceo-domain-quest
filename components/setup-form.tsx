'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeading, Section, StudentShell } from '@/components/student-shell'
import { AppFooter } from '@/components/app-shell'
import {
  Button,
  CheckIcon,
  ChoiceCard,
  ProgressBar,
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
  const [domainName, setDomainName] = useState('')
  const [isRegisteredCompany, setIsRegisteredCompany] = useState<boolean | null>(null)
  const [audience, setAudience] = useState<Audience | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = shopName.trim()
  const ready =
    trimmedName.length > 0 &&
    businessTypeId.length > 0 &&
    domainName.trim().length > 0 &&
    isRegisteredCompany !== null &&
    audience !== null

  // นับเฉพาะเพื่อแสดงความคืบหน้าให้นักเรียนเห็นว่าเหลืออีกกี่ช่อง — ไม่ได้ใช้ตัดสินอะไร
  const filledCount = [
    trimmedName.length > 0,
    businessTypeId.length > 0,
    domainName.trim().length > 0,
    isRegisteredCompany !== null,
    audience !== null,
  ].filter(Boolean).length

  const selectedBusiness = useMemo(
    () => businessTypes.find((business) => business.id === businessTypeId),
    [businessTypes, businessTypeId],
  )
  const previewImage = businessTypeId ? `/setup/${businessTypeId}.webp` : '/setup/empty-lot.webp'

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
          domainName: domainName.trim(),
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
            {ready ? 'เริ่มคุยกับโดม' : 'ถัดไป'}
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
        description="เลือกภาพร้าน ตั้งชื่อ แล้วค่อยเริ่มภารกิจ ข้อมูลนี้จะถูกล็อกเมื่อเริ่มภารกิจแรก"
      />

      <ProgressBar
        value={filledCount}
        max={5}
        tone="brand"
        label={`ตั้งค่าร้านไปแล้ว ${filledCount} จาก 5 ข้อ`}
        showValue={false}
      />

      <div className="setup-preview-sticky" aria-live="polite">
        <div className="setup-preview-art">
          <img src={previewImage} alt="" draggable={false} />
          <div className="setup-preview-sign">
            <span>{selectedBusiness?.label ?? 'ที่ดินว่าง รอร้านของเรา'}</span>
            <strong>{trimmedName || 'ป้ายชื่อร้านของเรา'}</strong>
            {domainName.trim() ? <small>{domainName.trim()}</small> : null}
          </div>
        </div>
        <p className="setup-preview-caption">
          {businessTypeId
            ? `${selectedBusiness?.label ?? 'ร้านของเรา'}${trimmedName ? ` · ${trimmedName}` : ' · รอชื่อร้าน'}`
            : 'เลือกประเภทร้าน แล้วตั้งชื่อให้ร้านของเรา'}
        </p>
      </div>

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

        <h3 className="mt-6 text-title-sm font-bold text-balance text-ink">2. ร้านของเราขายอะไร</h3>
        <div
          role="radiogroup"
          aria-label="ประเภทของร้าน"
          className="mt-3 grid grid-cols-2 gap-2"
        >
          {businessTypes.map((b) => (
            <ChoiceCard
              key={b.id}
              label={b.label}
              icon={<img src={`/setup/${b.id}.webp`} alt="" className="size-12 rounded-xl object-cover" />}
              selected={businessTypeId === b.id}
              onSelect={() => setBusinessTypeId(b.id)}
            />
          ))}
        </div>
      </Section>

      <Section title="3. ชื่อเว็บของร้าน" description="ใช้ชื่อสั้น ๆ ภาษาอังกฤษหรือตัวเลขก็ได้">
        <TextField
          label="ชื่อโดเมนชั่วคราว"
          value={domainName}
          onChange={(e) => setDomainName(e.target.value)}
          type="text"
          inputMode="url"
          autoComplete="off"
          placeholder="เช่น mycake หรือ gamehub"
          valid={domainName.trim().length > 0}
          hint="ตอนนี้ใช้เป็นชื่อเว็บตัวอย่างในป้ายร้านก่อน"
          inputClassName="text-body-lg font-bold"
        />
      </Section>

      <Section title="4. จดทะเบียนนิติบุคคลแล้วหรือยัง">
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

      <Section title="5. ลูกค้าของเราอยู่ที่ไหน">
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
