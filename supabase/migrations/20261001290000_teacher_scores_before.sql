-- ============================================================================
-- เก็บ "คะแนนที่ครูยืนยันไว้ครั้งก่อน" ไว้ก่อนเขียนทับ (T67 · result-api5 ข้อ 4)
--
-- อาการ: `changedDimensions` ของ POST /api/teacher/confirm-score ขึ้นครบ 4 ด้านเสมอ
--        แม้ครูกดยืนยันเฉย ๆ โดยไม่แก้อะไรเลย
--
-- สาเหตุ 2 ชั้น:
--   1. route เทียบคะแนนครูกับ `ai_scores_snapshot.dimensions` ซึ่งเป็น **array ของ object**
--      (`[{id, name, score, ...}]`) ไม่ใช่ map `{dim-x: 3}` — `aiDimensions[id]` จึง undefined ทุกตัว
--   2. ต่อให้อ่าน array ถูก ก็ยังตอบคำถามที่ครูอยากรู้ไม่ได้ว่า **"รอบนี้ฉันแก้ด้านไหนจากรอบก่อน"**
--      เพราะไม่มีใครเก็บค่าที่ครูยืนยันไว้ครั้งก่อนไว้เลย — `ai_scores_snapshot` เก็บของกฎ/AI อย่างเดียว
--
-- แก้: เพิ่มคอลัมน์ `teacher_scores_before` แล้วให้ UPDATE เก็บค่าเดิมลงไปก่อนเขียนทับ
-- (ใน UPDATE ของ Postgres ฝั่งขวาของ `=` อ่านค่าจากแถว **ก่อนแก้** เสมอ จึงได้ค่าเดิมตรง ๆ)
--
-- ได้ร่องรอยถาวรไว้ตอบกรรมการด้วยว่าครูเปลี่ยนคำตัดสินของตัวเองตอนไหน ไม่ใช่แค่ต่างจาก AI
-- ============================================================================

alter table public.submissions
  add column if not exists teacher_scores_before jsonb;

comment on column public.submissions.teacher_scores_before is
  'คะแนนที่ครูยืนยันไว้ครั้งก่อนหน้า (null = ครั้งนี้เป็นการยืนยันครั้งแรก) ใช้หาว่ารอบนี้ครูแก้ด้านไหน';

-- teacher_confirmed_scores เก็บรูปแบบใหม่: คะแนน 4 ด้าน + ด้านที่ถ่วง 2 เท่า + คะแนนรวมถ่วงน้ำหนัก
-- ของเดิมที่เก็บ score ก้อนเดียวยังอ่านได้ จึงเทียบทั้งสองคีย์
-- (คัดลอกจาก 20260930220000 มาทั้งดุ้น เพิ่มบรรทัด teacher_scores_before บรรทัดเดียว)
create or replace function public.confirm_submission_scores(
  p_teacher_id    uuid,
  p_submission_id uuid,
  p_scores        jsonb
)
returns setof public.submissions
language sql
as $$
  update public.submissions s
     set teacher_confirmed_scores = p_scores,
         -- ค่าเดิมก่อนถูกเขียนทับ — ฝั่งเว็บเอาไปหาว่ารอบนี้ครูแก้ด้านไหนจริง ๆ
         teacher_scores_before    = s.teacher_confirmed_scores,
         needs_review             = false,
         confirmed_by             = p_teacher_id,
         confirmed_at             = now(),
         ai_scores_snapshot       = s.ai_scores,
         teacher_changed          = case
                                      when p_scores ? 'weightedTotal' and s.ai_scores ? 'weightedTotal'
                                        then (p_scores ->> 'weightedTotal') is distinct from (s.ai_scores ->> 'weightedTotal')
                                      when p_scores ? 'dimensions' and s.ai_scores ? 'dimensions'
                                        then (p_scores -> 'dimensions') is distinct from (s.ai_scores -> 'dimensions')
                                      when p_scores ? 'score' and s.ai_scores ? 'score'
                                        then (p_scores ->> 'score') is distinct from (s.ai_scores ->> 'score')
                                      else null
                                    end,
         updated_at               = now()
   where s.id = p_submission_id
     and exists (
       select 1
       from public.students st
       join public.classrooms c on c.id = st.classroom_id
       where st.id = s.student_id
         and c.teacher_id = p_teacher_id
     )
  returning s.*;
$$;

revoke execute on function public.confirm_submission_scores(uuid, uuid, jsonb) from anon, public;
grant  execute on function public.confirm_submission_scores(uuid, uuid, jsonb) to service_role;
