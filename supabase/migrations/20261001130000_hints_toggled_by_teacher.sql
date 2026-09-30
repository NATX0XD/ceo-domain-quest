-- รอบ 10.1: ครูปรับระดับตัวช่วยให้นักเรียนได้ (T-06) จึงต้องมีค่า 'teacher'
--
-- เดิม hints_toggled_by รับได้แค่ 'student' | 'system' ซึ่งตอบไม่ได้ว่า "ครูเป็นคนปรับ"
-- ค่าเดิมทุกแถวยังใช้ได้เหมือนเดิม แค่เพิ่มค่าที่ยอมรับ

alter table public.profiles drop constraint if exists profiles_hints_toggled_by_check;
alter table public.profiles add constraint profiles_hints_toggled_by_check
  check (hints_toggled_by = any (array['student', 'system', 'teacher']));
