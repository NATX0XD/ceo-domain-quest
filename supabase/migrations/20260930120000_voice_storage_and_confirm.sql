-- รอบ 6: ที่เก็บไฟล์เสียงด่านบอส + ร่องรอยการยืนยันคะแนนของครู
--
-- เสียงของนักเรียนเป็นข้อมูลส่วนบุคคล bucket ต้อง private เสมอ
-- ห้ามตั้ง public = true เด็ดขาด ไม่งั้นใครเดา path ถูกก็ฟังเสียงเด็กได้ทั้งห้อง

-- ------------------------------------------------------------------- 1) bucket
-- โครงสร้าง path: <student_id>/<uuid>.<ext>  (โฟลเดอร์ชั้นแรก = student_id เสมอ)
-- policy ด้านล่างอ่าน student_id จากชื่อโฟลเดอร์ ห้ามเปลี่ยนรูปแบบ path โดยไม่แก้ policy

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-submissions',
  'voice-submissions',
  false,                                   -- private
  2097152,                                 -- 2 MiB · เสียงพูด 2 นาทีปกติ ~1 MB
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']
)
on conflict (id) do update
  set public            = false,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- --------------------------------------------------------- 2) policy ของ storage
-- storage.objects เปิด RLS อยู่แล้วโดย Supabase
-- ไม่สร้าง policy ให้ anon เลย = anon แตะ bucket นี้ไม่ได้ (ตั้งใจ)
-- นักเรียนไม่มีบัญชี Supabase จึงเข้าผ่าน signed URL ที่เซิร์ฟเวอร์ออกให้เท่านั้น
-- การอัปโหลดทำด้วย service_role ในฝั่งเซิร์ฟเวอร์ (bypass RLS) — ไม่มี policy insert ให้ role อื่น

drop policy if exists "voice read by owning teacher" on storage.objects;

create policy "voice read by owning teacher" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'voice-submissions'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and public.owns_student(((storage.foldername(name))[1])::uuid)
  );

-- ------------------------------------------------- 3) ร่องรอยการยืนยันคะแนนของครู
-- ai_scores เก็บสิ่งที่ AI/กฎเสนอ (มีคีย์ source = 'ai' | 'fallback' อยู่ข้างใน)
-- teacher_confirmed_scores เก็บสิ่งที่ครูตัดสิน — ครูเป็นคนตัดสินเสมอ AI เป็นแค่ข้อเสนอ

alter table public.submissions
  add column confirmed_by       uuid references public.teachers (id) on delete set null,
  add column confirmed_at       timestamptz,
  add column teacher_changed    boolean,       -- ครูแก้ตัวเลขจากที่ AI เสนอหรือไม่
  add column ai_scores_snapshot jsonb;         -- ค่าที่ AI เสนอ ณ วินาทีที่ครูกดยืนยัน

comment on column public.submissions.ai_scores_snapshot is
  'สำเนา ai_scores ณ ตอนครูกดยืนยัน ใช้เทียบย้อนหลังว่าครูแก้จากเท่าไรเป็นเท่าไร';

-- ลายเซ็นเดิม (grant เดิมยังอยู่) เพิ่มการบันทึกร่องรอย
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
         needs_review             = false,
         confirmed_by             = p_teacher_id,
         confirmed_at             = now(),
         ai_scores_snapshot       = s.ai_scores,
         teacher_changed          = case
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

-- ------------------------------------------------------------------------ grants

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
