/* eslint-disable @next/next/no-img-element -- ภาพเกียรติบัตรเป็น asset นิ่งใน public/ui/cert */
import type { CSSProperties } from 'react'
import { DECOR_POS, type GameCertificateContent } from '@/lib/certificate/game'
import type { CertArtKey, CertTheme } from '@/lib/certificate/art'
import './certificate-preview.css'

/**
 * พรีวิวเกียรติบัตรบนหน้า /result — ดีไซน์เดียวกับ PDF (lib/certificate/game.ts)
 * วางตำแหน่งเป็นสัดส่วนของ A4 แนวนอน (297 x 210 มม.) และย่อขยายตามความกว้างจอด้วย container query
 * `art` = URL ของรูปที่มีจริง (ตัดสินฝั่งเซิร์ฟเวอร์) — null = วาดรูปทรงสำรองด้วย CSS / ไม่วาด
 */
/** y เป็นมิลลิเมตรจากขอบบนของ PDF (ตำแหน่ง baseline) */
function at(yMm: number, sizePt: number): CSSProperties {
  return { top: `${(yMm / 210) * 100}%`, fontSize: `${(sizePt * 0.3528 * 100) / 297}cqw` }
}

export function CertificatePreview({
  content,
  art,
  theme = 'classic',
}: {
  content: GameCertificateContent
  art: Record<CertArtKey, string | null>
  theme?: CertTheme
}) {
  const stars = Array.from({ length: content.starsTotal }, (_, i) => i < content.starsFilled)
  const pos = DECOR_POS[theme]
  /** กล่องมิลลิเมตรของ PDF → % ของแผ่น */
  const box = (x: number, y: number, w: number, h: number): CSSProperties => ({
    left: `${(x / 297) * 100}%`,
    top: `${(y / 210) * 100}%`,
    width: `${(w / 297) * 100}%`,
    height: `${(h / 210) * 100}%`,
  })
  const plankTitle = theme === 'domain' && art.bg
  return (
    <figure className="cert-preview" aria-label={`ตัวอย่างเกียรติบัตรของ ${content.nickname}`}>
      <div className={`cert-sheet cert-theme-${theme} ${art.bg ? 'has-bg' : 'no-bg'}`}>
        {art.bg ? <img className="cert-bg" src={art.bg} alt="" /> : null}
        {plankTitle ? (
          <p className="cert-line cert-plank-title" style={at(31, 28)}>{content.title}</p>
        ) : (
          <div className={`cert-ribbon ${art.ribbon ? 'has-art' : ''}`}>
            {art.ribbon ? <img src={art.ribbon} alt="" /> : null}
            <span>{content.title}</span>
          </div>
        )}
        <p className="cert-line cert-product" style={at(59, 16)}>{content.product}</p>
        <p className="cert-line cert-muted" style={at(68, 13)}>{content.presentTo}</p>
        <p className="cert-line cert-name" style={at(86, 40)}>{content.nickname}</p>
        <p className="cert-line cert-strong" style={at(100, 15)}>{content.shopLine}</p>
        <p className="cert-line" style={at(109, 13)}>{content.achievement}</p>
        {content.scoreLine ? (
          <p className="cert-line cert-score" style={at(117, 13)}>{content.scoreLine}</p>
        ) : null}
        <div className="cert-stars" aria-label={content.starsLabel}>
          {stars.map((on, i) => {
            const src = on ? art.starFull : art.starEmpty
            return src ? <img key={i} src={src} alt="" /> : <span key={i} className={on ? 'cert-star on' : 'cert-star'} />
          })}
        </div>
        <p className="cert-line cert-muted" style={at(140, 11)}>{content.starsLabel}</p>
        <p className="cert-line cert-strong" style={at(152, 12)}>{content.course}</p>
        <p className="cert-line cert-muted" style={at(159, 11)}>{content.school}</p>
        <p className="cert-line" style={at(168, 12)}>{content.date}</p>
        {/* ไม่มีรูปโดม = ไม่วาดอะไร (เดิมเป็นวงกลมม่วงที่ดูเหมือนของหลุด) */}
        {art.dome ? (
          <img className="cert-dome" src={art.dome} alt="" style={box(pos.dome.x, pos.dome.y, pos.dome.w, pos.dome.h)} />
        ) : null}
        {art.seal ? (
          <img className="cert-seal" src={art.seal} alt="" style={box(pos.seal.x, pos.seal.y, pos.seal.size, pos.seal.size)} />
        ) : (
          <span
            className="cert-seal cert-seal-fallback"
            aria-hidden="true"
            style={box(pos.seal.x, pos.seal.y, pos.seal.size, pos.seal.size)}
          >
            CEO
          </span>
        )}
      </div>
    </figure>
  )
}
