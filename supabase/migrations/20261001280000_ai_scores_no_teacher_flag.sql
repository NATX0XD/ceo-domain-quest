-- ============================================================================
-- ปิดประตูที่ผิดของ "คะแนนที่ครูยืนยัน" (T65 · QA-3 ข้อ 1.1)
--
-- โครงข้อมูลเดิมชวนให้พลาด: ตาราง submissions มีคอลัมน์คะแนน 2 ตัว
--   ai_scores                 ข้อเสนอจากกฎ/AI ระบบเขียนเองตอนเด็กกดส่ง **ไม่ใช่คะแนนจริง**
--   teacher_confirmed_scores  คะแนนของครู ครูเท่านั้นที่เขียน **เป็นคะแนนจริงเสมอ**
--
-- พลาดจริงมาแล้ว: app/api/ceo/route.ts ไปอ่านคีย์ confirmedByTeacher จาก ai_scores
-- ซึ่งไม่เคยมีคีย์นั้น ผลคือเด็กที่ครูยืนยัน 15/15 และรับใบประกาศไปแล้ว
-- ยังเห็นจอขึ้นว่า "AI กำลังช่วยอ่านงานนี้อีกรอบ" พร้อมคะแนน 11/15 ของกฎ
--
-- แก้ที่โค้ดอย่างเดียวไม่พอ เพราะรอบหน้าใครก็พลาดซ้ำได้เงียบ ๆ
-- constraint นี้ทำให้ "เขียนธงของครูลงช่องของ AI" กลายเป็น error ทันทีตั้งแต่ตอนเขียน
-- ไม่ใช่ไปโผล่เป็นตัวเลขผิดบนจอเด็กตอนสาธิต
--
-- ตรวจก่อนใส่แล้ว: ข้อมูลปัจจุบันมี 0 แถวที่ละเมิด (ทั้งชั้นบนและใน ruleScores)
-- ทางที่ถูกทางเดียว: lib/db/submission-scores.ts readTeacherConfirmedScores() / isTeacherConfirmed()
-- ============================================================================

alter table public.submissions
  drop constraint if exists submissions_ai_scores_no_teacher_flag;

alter table public.submissions
  add constraint submissions_ai_scores_no_teacher_flag check (
    ai_scores is null
    or (
      not (ai_scores ? 'confirmedByTeacher')
      and not (coalesce(ai_scores -> 'ruleScores', '{}'::jsonb) ? 'confirmedByTeacher')
      and not (coalesce(ai_scores -> 'aiProposed', '{}'::jsonb) ? 'confirmedByTeacher')
    )
  );

comment on constraint submissions_ai_scores_no_teacher_flag on public.submissions is
  'คะแนนที่ครูยืนยันอยู่ที่ teacher_confirmed_scores เท่านั้น ห้ามเขียนธง confirmedByTeacher ลง ai_scores (QA-3 ข้อ 1.1)';

-- ก้อนที่ AI/กฎเสนอก็ห้ามแอบอ้างเป็นคะแนนครูเช่นกัน
alter table public.submissions
  drop constraint if exists submissions_ai_scores_snapshot_no_teacher_flag;

alter table public.submissions
  add constraint submissions_ai_scores_snapshot_no_teacher_flag check (
    ai_scores_snapshot is null or not (ai_scores_snapshot ? 'confirmedByTeacher')
  );
