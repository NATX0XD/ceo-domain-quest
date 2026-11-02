'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section } from '@/components/student-shell'
import { AppFooter, AppShell } from '@/components/app-shell'
import { SessionClock } from '@/components/session-clock'
import { GameHeader } from '@/components/learn/game-header'
import { shopArtFallbackSrc } from '@/components/shop-art'
import { ShopArtImg } from '@/components/shop-art-img'
import {
  Button,
  CheckIcon,
  ChoiceCard,
  TextField,
  Toast,
  ToastViewport,
} from '@/components/ui'
import './setup-form.css'

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
  businessTypes: { id: string; label: string; icon: string; art?: string }[]
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

  const selectedBusiness = useMemo(
    () => businessTypes.find((business) => business.id === businessTypeId),
    [businessTypes, businessTypeId],
  )
  // ภาพร้านชุดเดียวกับหน้า /home — นักเรียนใหม่เริ่มที่ร้านขั้น 1 ของประเภทที่เลือก แล้วร้านโตตามภารกิจที่ผ่าน
  const previewFallback = shopArtFallbackSrc(1)
  const previewImage = selectedBusiness?.art ?? previewFallback

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
    <AppShell
      className="student-world student-display setup-world-shell"
      header={
        <>
          <GameHeader className="setup-game-header" title="ตั้งค่าร้านของเรา" onBack={() => router.push('/home')} backLabel="กลับหน้าหลัก" />
          <SessionClock />
        </>
      }
      // ฟอร์ม 5 ข้อยาวเกินจอ ปุ่มบันทึกจึงอยู่แถบท้ายที่ไม่เลื่อน
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
      <div className="setup-page">
      {error ? (
        <ToastViewport>
          <Toast tone="error" message={error} duration={null} onDismiss={() => setError(null)} />
        </ToastViewport>
      ) : null}


      <div className="setup-panel setup-preview" aria-live="polite">
        <div className="setup-preview-scene">
          <ShopArtImg src={previewImage} fallback={previewFallback} alt="" className="setup-preview-art" />
        </div>
        <div className="setup-preview-sign">
          <span>{selectedBusiness?.label.split('/')[0]?.trim() ?? 'ร้านของเรา'}</span>
          <strong>{trimmedName || 'ป้ายชื่อร้านของเรา'}</strong>
          {domainName.trim() ? <small>{domainName.trim()}</small> : null}
        </div>
        <p className="setup-preview-caption">
          {trimmedName ? 'ร้านนี้จะไปรอที่หน้าหลัก แล้วโตขึ้นทุกภารกิจ' : 'พิมพ์ชื่อร้าน แล้วดูป้ายเปลี่ยนตาม'}
        </p>
      </div>

      <Section className="setup-panel" title="1. ร้านของเราชื่ออะไร" description="พิมพ์ภาษาไทยหรืออังกฤษก็ได้">
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

      </Section>

      <Section className="setup-panel" title="2. ร้านของเราขายอะไร">
        <div
          role="radiogroup"
          aria-label="ประเภทของร้าน"
          className="grid grid-cols-2 gap-2"
        >
          {businessTypes.map((b) => (
            <ChoiceCard
              key={b.id}
              label={b.label.split('/')[0]?.trim() ?? b.label}
              ariaLabel={`ประเภทร้าน ${b.label}`}
              layout="tile"
              icon={<img src={`/setup/${b.id}.webp`} alt="" className="size-full object-cover" />}
              selected={businessTypeId === b.id}
              onSelect={() => setBusinessTypeId(b.id)}
            />
          ))}
        </div>
      </Section>

      <Section className="setup-panel" title="3. ชื่อเว็บของร้าน" description="ใช้ชื่อสั้น ๆ ภาษาอังกฤษหรือตัวเลขก็ได้">
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

      <Section className="setup-panel" title="4. จดทะเบียนนิติบุคคลแล้วหรือยัง">
        <div
          role="radiogroup"
          aria-label="สถานะการจดทะเบียนนิติบุคคล"
          className="flex flex-col gap-2"
        >
          <ChoiceCard
            label="จดแล้ว"
            description="มีนิติบุคคลแล้ว"
            selected={isRegisteredCompany === true}
            onSelect={() => setIsRegisteredCompany(true)}
          />
          <ChoiceCard
            label="ยังไม่ได้จด"
            description="ร้านส่วนตัว"
            selected={isRegisteredCompany === false}
            onSelect={() => setIsRegisteredCompany(false)}
          />
        </div>
      </Section>

      <Section className="setup-panel" title="5. ลูกค้าของเราอยู่ที่ไหน">
        <div role="radiogroup" aria-label="กลุ่มลูกค้าของร้าน" className="flex flex-col gap-2">
          <ChoiceCard
            label="ในไทย"
            description="ลูกค้าหลักอยู่ในไทย"
            selected={audience === 'thai'}
            onSelect={() => setAudience('thai')}
          />
          <ChoiceCard
            label="ต่างประเทศด้วย"
            description="มีลูกค้าต่างประเทศ"
            selected={audience === 'international'}
            onSelect={() => setAudience('international')}
          />
        </div>
      </Section>
      </div>
    </AppShell>
  )
}
