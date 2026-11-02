-- ชื่อเต็มที่ผู้เรียนต้องการให้พิมพ์บนเกียรติบัตร (nullable เพื่อ fallback เป็นชื่อเล่น)
alter table public.profiles
  add column if not exists certificate_display_name text;

alter table public.profiles
  drop constraint if exists profiles_certificate_display_name_check;

alter table public.profiles
  add constraint profiles_certificate_display_name_check
  check (certificate_display_name is null or char_length(btrim(certificate_display_name)) between 1 and 60);

comment on column public.profiles.certificate_display_name is
  'ชื่อที่ผู้เรียนเลือกให้แสดงบนเกียรติบัตร; null = ใช้ students.nickname';

-- RLS ของ profiles_owner ที่สร้างไว้ใน init_schema ครอบคลุมคอลัมน์ใหม่นี้แล้ว
