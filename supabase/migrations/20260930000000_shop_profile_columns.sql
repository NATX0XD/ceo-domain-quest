-- รอบ 5: คำตอบ 3 คำถามตั้งต้นของนักเรียนขึ้นมาเป็นคอลัมน์จริง + แยกการนับคำใบ้ออกจากการนับความพยายาม
--
-- ก่อนหน้านี้ฝั่งหน้าเว็บเก็บไว้ใต้ readiness->'shop' (jsonb) เพราะยังไม่มีคอลัมน์
-- แต่ 3 ค่านี้เป็น input ของ evaluateTld ฝั่งเซิร์ฟเวอร์ ต้อง query ตรง ๆ และมี CHECK คุมค่าได้

-- ------------------------------------------------------------- 1) คอลัมน์ใหม่

alter table public.profiles
  add column is_registered_company boolean,
  add column audience              text,
  add column domain_name           text;

alter table public.profiles
  add constraint profiles_audience_check check (audience in ('thai', 'international'));

comment on column public.profiles.is_registered_company is
  'จดทะเบียนบริษัทแล้วหรือยัง — เงื่อนไขของ .co.th ใน evaluateTld';
comment on column public.profiles.audience is
  'กลุ่มลูกค้าหลัก thai | international — ใช้เลือกระหว่าง .ไทย/.th กับ gTLD';
comment on column public.profiles.domain_name is
  'ชื่อโดเมนที่นักเรียนตั้ง (ส่วนหน้านามสกุล)';

-- --------------------------------------------- 2) ย้ายข้อมูลเดิมจาก readiness->'shop'
-- คีย์เดิมที่ฝั่งหน้าเว็บเขียนไว้: { shopName, businessTypeId, domainName, isRegisteredCompany, audience }
-- ย้ายเฉพาะแถวที่มีค่าและชนิดถูกต้อง · ไม่ลบ readiness->'shop' ทิ้งในรอบนี้
-- เพื่อให้หน้าเว็บที่ยังอ่านคีย์เดิมอยู่ไม่พังระหว่างเปลี่ยนผ่าน (ลบได้ในรอบถัดไปเมื่อฝั่งหน้าเว็บย้ายเสร็จ)

update public.profiles
   set domain_name = nullif(readiness -> 'shop' ->> 'domainName', '')
 where jsonb_typeof(readiness -> 'shop' -> 'domainName') = 'string'
   and domain_name is null;

update public.profiles
   set is_registered_company = (readiness -> 'shop' ->> 'isRegisteredCompany')::boolean
 where jsonb_typeof(readiness -> 'shop' -> 'isRegisteredCompany') = 'boolean'
   and is_registered_company is null;

update public.profiles
   set audience = readiness -> 'shop' ->> 'audience'
 where readiness -> 'shop' ->> 'audience' in ('thai', 'international')
   and audience is null;

-- ---------------------------------- 3) การขอคำใบ้ต้องไม่ถูกนับเป็นการตอบผิด
--
-- ของเดิม record_mission_attempt() บวก attempts เสมอ และบวก hints_used เมื่อ p_hint_level > 0
-- ทำให้ "กดขอคำใบ้" กลายเป็น "ตอบผิด 1 ครั้ง" ดาวที่คิดจาก attempts เลยเพี้ยน
-- รอบนี้แยกหน้าที่: attempts นับที่ record_mission_attempt · hints_used นับที่ increment_mission_hint

-- ลายเซ็นเดิมทุกตัว (grant ที่ให้ service_role ไว้จึงยังอยู่) แต่เลิกยุ่งกับ hints_used
create or replace function public.record_mission_attempt(
  p_student_id uuid,
  p_mission_id text,
  p_correct    boolean,
  p_hint_level smallint default 0,
  p_channel    text default null
)
returns setof public.mission_progress
language sql
as $$
  insert into public.mission_progress (
    student_id, mission_id, channel_used, attempts, hints_used, passed_at, updated_at
  )
  values (p_student_id, p_mission_id, p_channel, 1, 0, case when p_correct then now() else null end, now())
  on conflict (student_id, mission_id) do update
    set attempts     = mission_progress.attempts + 1,
        channel_used = coalesce(p_channel, mission_progress.channel_used),
        passed_at    = case
                         when p_correct then coalesce(mission_progress.passed_at, now())
                         else mission_progress.passed_at
                       end,
        updated_at   = now()
  returning *;
$$;

comment on function public.record_mission_attempt(uuid, text, boolean, smallint, text) is
  'นับความพยายาม 1 ครั้ง · ไม่แตะ hints_used · p_hint_level เก็บไว้เพื่อความเข้ากันได้ของลายเซ็น ไม่มีผลต่อการนับแล้ว';

-- บวกคำใบ้อย่างเดียว ไม่แตะ attempts · p_max_hints ใส่เพื่อกันเกินเพดานของภารกิจนั้น (null = ไม่จำกัด)
create or replace function public.increment_mission_hint(
  p_student_id uuid,
  p_mission_id text,
  p_max_hints  smallint default null
)
returns setof public.mission_progress
language sql
as $$
  insert into public.mission_progress (student_id, mission_id, attempts, hints_used, updated_at)
  values (
    p_student_id,
    p_mission_id,
    0,
    case when coalesce(p_max_hints, 1) < 1 then 0 else 1 end,
    now()
  )
  on conflict (student_id, mission_id) do update
    set hints_used = case
                       when p_max_hints is null or mission_progress.hints_used < p_max_hints
                       then mission_progress.hints_used + 1
                       else mission_progress.hints_used
                     end,
        updated_at = now()
  returning *;
$$;

-- ------------------------------------------------------------------------ grants

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

revoke execute on function public.increment_mission_hint(uuid, text, smallint) from anon, public;
grant  execute on function public.increment_mission_hint(uuid, text, smallint) to service_role;
