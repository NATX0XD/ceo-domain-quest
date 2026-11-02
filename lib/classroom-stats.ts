export interface StudentClassroomRow {
  classroom_id: string
}

/** รวมจำนวนนักเรียนจากแถวที่ query มา โดยไม่เปลี่ยนลำดับหรือข้อมูลห้องเรียน */
export function countStudentRowsByClassroom(rows: readonly StudentClassroomRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.classroom_id] = (counts[row.classroom_id] ?? 0) + 1
    return counts
  }, {})
}
