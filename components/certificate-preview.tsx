/* eslint-disable @next/next/no-img-element -- ภาพเกียรติบัตรเป็น asset นิ่งใน public/ui/cert */
import type { CSSProperties } from 'react'
import type { GameCertificateContent } from '@/lib/certificate/game'
import type { CertArtKey } from '@/lib/certificate/art'
import './certificate-preview.css'

/**
 * พรีวิวเกียรติบัตรบนหน้า /result — ดีไซน์เดียวกับ PDF (lib/certificate/game.ts)
 * วางตำแหน่งเป็นสัดส่วนของ A4 แนวนอน (297 x 210 มม.) และย่อขยายตามความกว้างจอด้วย container query
 * รูปไหนยังไม่มีใน public/ui/cert/ (ตัดสินฝั่งเซิร์ฟเวอร์) จะวาดรูปทรงสำรองด้วย CSS แทน
 */
const ART_BASE = '/ui/cert'

/** y เป็นมิลลิเมตรจากขอบบนของ PDF (ตำแหน่ง baseline) */
function at(yMm: number, sizePt: number): CSSProperties {
  return { top: `${(yMm / 210) * 100}%`, fontSize: `${(sizePt * 0.3528 * 100) / 297}cqw` }
}

export function CertificatePreview({
  content,
  art,
}: {
  content: GameCertificateContent
  art: Record<CertArtKey, boolean>
}) {
  const stars = Array.from({ length: content.starsTotal }, (_, i) => i < content.starsFilled)
  return (
    <figure className="cert-preview" aria-label={`ตัวอย่างเกียรติบัตรของ ${content.nickname}`}>
      <div className={`cert-sheet ${art.bg ? 'has-bg' : 'no-bg'}`}>
        {art.bg ? <img className="cert-bg" src={`${ART_BASE}/cert-bg.webp`} alt="" /> : null}
        <div className={`cert-ribbon ${art.ribbon ? 'has-art' : ''}`}>
          {art.ribbon ? <img src={`${ART_BASE}/cert-ribbon.webp`} alt="" /> : null}
          <span>{content.title}</span>
        </div>
        <p className="cert-line cert-product" style={at(59, 16)}>{content.product}</p>
        <p className="cert-line cert-muted" style={at(68, 13)}>{content.presentTo}</p>
        <p className="cert-line cert-name" style={at(86, 40)}>{content.nickname}</p>
        <p className="cert-line cert-strong" style={at(100, 15)}>{content.shopLine}</p>
        <p className="cert-line" style={at(109, 13)}>{content.achievement}</p>
        {content.scoreLine ? (
          <p className="cert-line cert-score" style={at(117, 13)}>{content.scoreLine}</p>
        ) : null}
        <div className="cert-stars" aria-label={content.starsLabel}>
          {stars.map((on, i) =>
            (on ? art.starFull : art.starEmpty) ? (
              <img key={i} src={`${ART_BASE}/${on ? 'cert-star-full' : 'cert-star-empty'}.webp`} alt="" />
            ) : (
              <span key={i} className={on ? 'cert-star on' : 'cert-star'} />
            ),
          )}
        </div>
        <p className="cert-line cert-muted" style={at(140, 11)}>{content.starsLabel}</p>
        <p className="cert-line cert-strong" style={at(152, 12)}>{content.course}</p>
        <p className="cert-line cert-muted" style={at(159, 11)}>{content.school}</p>
        <p className="cert-line" style={at(168, 12)}>{content.date}</p>
        {art.dome ? (
          <img className="cert-dome" src={`${ART_BASE}/cert-dome.webp`} alt="" />
        ) : (
          <span className="cert-dome cert-dome-fallback" aria-hidden="true" />
        )}
        {art.seal ? (
          <img className="cert-seal" src={`${ART_BASE}/cert-seal.webp`} alt="" />
        ) : (
          <span className="cert-seal cert-seal-fallback" aria-hidden="true">
            CEO
          </span>
        )}
      </div>
    </figure>
  )
}
