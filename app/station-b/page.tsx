import { redirect } from 'next/navigation'

/**
 * สถานี B ถูกยุบเข้าเป็นภารกิจที่ 3 แล้ว (เส้นทางจริงตาม ceo.jpg มี 4 ภารกิจ ไม่มีสถานีแยก)
 * เก็บ redirect ไว้กันลิงก์เก่าที่ครูหรือเอกสารอ้างถึงพัง
 */
export default function StationBPage() {
  redirect('/mission/m3')
}
