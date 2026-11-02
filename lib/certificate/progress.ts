/**
 * ดาวและภารกิจที่พิมพ์บนเกียรติบัตร — ที่มาเดียวกับ /home และ /rewards
 *
 * ทั้งพรีวิวหน้า /result และ PDF จาก /api/certificate ต้องส่ง `lessonSummary()` เข้าฟังก์ชันนี้
 * ห้ามอ่าน `profiles.earned_stars` หรือบวกดาวเองอีก (เคยทำให้หน้าเว็บโชว์ 11 แต่ PDF พิมพ์ 14)
 */
export interface CertificateProgressSource {
  /** ดาวสะสมที่นักเรียนเห็นบน /home และ /rewards (ภารกิจย่อย + ภารกิจใหญ่ เพดาน 15) */
  totalStars: number
  maxStars: number
  missions: ReadonlyArray<{ passed: boolean }>
}

export interface CertificateProgress {
  starsTotal: number
  starsMax: number
  missionsPassed: number
  missionsTotal: number
}

export function certificateProgressOf(summary: CertificateProgressSource): CertificateProgress {
  return {
    starsTotal: summary.totalStars,
    starsMax: summary.maxStars,
    missionsPassed: summary.missions.filter((m) => m.passed).length,
    missionsTotal: summary.missions.length,
  }
}
