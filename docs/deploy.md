# ขึ้นคลาวด์ — จาก Supabase local ไปโปรเจกต์จริง

เขียนเมื่อ 29 กันยายน 2569 · **ปรับล่าสุด 30 กันยายน 2569 (T74)** · กำหนดส่งลิงก์ 1 พฤศจิกายน 2569 · วันแข่ง 3 พฤศจิกายน 2569
อ่านคู่กับ `auth-and-roles.md` (ข้อ 6 กฎความปลอดภัย) · `pre-flight.md` (เช็คลิสต์หน้างาน) · `.env.example`

> **อ่านก่อนถ้าไม่ได้อยู่ตอนทำ**: ลำดับที่ถูกต้องคือ
> **สร้างค่าลับใหม่ (ข้อ 3.5) → push migration (ข้อ 2) → ตั้ง env บน Vercel (ข้อ 4) → สร้างครูจริง (ข้อ 5) → ตรวจ (ข้อ 6)**
> ข้ามข้อ 3.5 แล้วเอา `.env.local` ของเครื่องพัฒนาไปวางบน Vercel = คุกกี้ครูถูกปลอมได้ทันที

> ยังไม่มีบัญชีคลาวด์และยังไม่ได้ deploy จริง เอกสารนี้คือทางที่เตรียมไว้ให้ทำตามได้ทันทีเมื่อได้บัญชี
> ทุกคำสั่งในนี้ทดสอบรูปแบบมาจากของ local แล้ว ยกเว้นขั้นที่ต้องมีโปรเจกต์คลาวด์จริง

**เวลาที่ต้องใช้**: ครั้งแรกประมาณ 45–60 นาที ถ้าไม่ติดเรื่องบัญชี

---

## 0. เตรียมก่อนเริ่ม

| ต้องมี | หมายเหตุ |
|---|---|
| บัญชี Supabase | ฟรีทีเรียงพอสำหรับ 1 ห้องเรียน |
| บัญชี Vercel | ต่อกับ GitHub repo ของโปรเจกต์ |
| repo อยู่บน GitHub | Vercel deploy จาก repo |
| อีเมลจริงของครู 1 บัญชี | ใช้ล็อกอินหน้าแผงครู |

รันตรวจของ local ให้เขียวก่อน อย่าเพิ่งขึ้นคลาวด์ถ้ายังแดง

```bash
npx tsx scripts/check-deploy.ts
```

---

## 1. สร้างโปรเจกต์ Supabase cloud

1. เข้า https://supabase.com/dashboard → **New project**
2. ตั้งชื่อ `digital-biz-quest`
3. **Region: `Southeast Asia (Singapore) ap-southeast-1`** — ใกล้ไทยที่สุดที่ Supabase มี (หน่วงราว 30–50 ms)
4. ตั้ง Database password แล้วเก็บไว้ในที่ปลอดภัย (ไม่ใช่ในโปรเจกต์นี้)
5. รอสร้างเสร็จ (~2 นาที) แล้วจด **Project Reference ID** จาก URL: `https://supabase.com/dashboard/project/<project-ref>`

---

## 2. link แล้ว push migration ทั้ง 23 ไฟล์

```bash
npx supabase login                      # เปิดเบราว์เซอร์ให้ยืนยันครั้งเดียว
npx supabase link --project-ref <project-ref>
npx supabase migration list --linked    # ดูว่าฝั่งคลาวด์ยังว่าง
npx supabase db push                    # ดัน migration ขึ้นไปตามลำดับเวลา
```

**ลำดับสำคัญ** — ไฟล์ต้อง apply เรียงตามชื่อ (ชื่อขึ้นต้นด้วยเวลา 14 หลัก) ไฟล์หลัง ๆ แก้ของที่ไฟล์ก่อนสร้างไว้
`supabase db push` เรียงให้เองอยู่แล้ว **ห้ามรันไฟล์เองทีละไฟล์แบบสลับลำดับ**

> ทดสอบแล้วเมื่อ 30 ก.ย. 2569 (T74): ตั้งฐานข้อมูลเปล่าใหม่แล้วลงทั้ง 23 ไฟล์เรียงกัน ผ่านหมด
> ได้ 30 ตาราง · 97 ฟังก์ชัน · 29 policy · 79 index · 313 คอลัมน์ · 77 CHECK · 9 trigger
> **เท่ากับฐานข้อมูลที่ใช้พัฒนาอยู่ทุกตัวเลข** — แปลว่าไฟล์ชุดนี้สร้างระบบขึ้นมาใหม่จากศูนย์ได้จริง

ไฟล์ที่ต้องขึ้นครบ (เรียงตามชื่อ = ลำดับที่ต้อง apply):

| ไฟล์ | ได้อะไร |
|---|---|
| `20260929000000_init_schema.sql` | 7 ตารางหลัก + RLS + helper `owns_student` / `is_classroom_owner` |
| `20260929120000_personalized_learning.sql` | route_changes · reflections · mission_progress · peer_feedback + rpc |
| `20260929180000_personalized_evidence.sql` | คอลัมน์หลักฐาน suggested/override · ดาว 15 · เป้า 6/10/14 |
| `20260929210000_coach_and_dome.sql` | confidence jsonb · mission_skips · chat_messages · voice_submissions |
| `20260929230000_deploy_checks.sql` | ฟังก์ชัน `public.rls_status()` ให้สคริปต์ตรวจใช้ |
| `20260930000000_shop_profile_columns.sql` | คอลัมน์ is_registered_company / audience / domain_name + rpc `increment_mission_hint` |
| `20260930120000_voice_storage_and_confirm.sql` | bucket `voice-submissions` (private) + ร่องรอยการยืนยันคะแนนของครู |
| `20260930180000_stars_showcase_retention.sql` | rpc `recalc_student_stars` · `classroom_showcase` · อายุไฟล์เสียง 90 วัน |
| `20260930220000_grade_jobs_and_rubric_scores.sql` | ตาราง `grade_jobs` (คิวตรวจงาน) + rpc `claim_next_grade_job` / `reclaim_stale_grade_jobs` / `complete_grade_job` / `fail_grade_job` · ครูให้คะแนนรายด้าน |
| `20261001000000_session_control_survey_buddy.sql` | ครูคุมช่วงของคาบ (`class_sessions`) · แบบสอบถาม (`survey_responses`) · คู่หู (`buddy_requests`) · rpc รายงาน `student_report` / `classroom_report` |
| `20261001120000_teacher_overrides_broadcast_showcase.sql` | ครูแก้แผนรายคน (`teacher_overrides`) · บันทึกการโค้ช (`teacher_notes`) · ข้อความถึงทั้งห้อง (`broadcasts`) · ปักหมุดผลงาน |
| `20261001130000_hints_toggled_by_teacher.sql` | ครูปรับระดับตัวช่วยให้นักเรียนได้ — เพิ่มค่า `'teacher'` ใน `hints_toggled_by` |
| `20261001180000_story_jobs_content_flags.sql` | คิวสร้างเรื่องราวเฉพาะคน (`story_jobs`) · ธงคำไม่เหมาะสมถึงแผงครู (`content_flags`) |
| `20261001200000_flag_before_join_and_skipped_by.sql` | `content_flags.student_id` ยอม null (ติดธงตั้งแต่ตอนพิมพ์ชื่อเล่น) · `mission_progress.skipped_by` |
| `20261001220000_class_plan_requests_home_deadline.sql` | แผนของทั้งคาบ · คำขอเปลี่ยนแผนจากผู้เรียน (`plan_requests`) · กำหนดส่งงานที่บ้าน |
| `20261001230000_home_deadline_default_null.sql` | `set_home_deadline(p_deadline)` มีค่าตั้งต้น null |
| `20261001240000_phase_plan_guards_buddy_auth.sql` | ด่านกันช่วงของคาบ/แผน + ตรวจเจ้าของในคิวรีเดียวกับคู่หู |
| `20261001250000_recalc_bypass_and_buddy_nulls.sql` | แก้ `recalc_student_stars` กับค่า null ของคู่หูที่การทดสอบจับได้ |
| `20261001260000_quiz_item_responses.sql` | คำตอบรายข้อของแบบทดสอบ (`quiz_item_responses`) → ค่าความยาก p / อำนาจจำแนก r · **แผ่นคำตอบที่ส่งให้ครูไม่มี `choice_index` เพื่อไม่ให้เฉลยรั่ว** |
| `20261001270000_classroom_aggregates_no_fanout.sql` | rpc `classroom_screen_stats` / `classroom_peer_feedback` / `classroom_efficiency_raw` — เลิกส่งรายชื่อ uuid ทั้งห้องใน URL (ห้องเกิน 200 คนเคยตอบ 500) |
| `20261001280000_ai_scores_no_teacher_flag.sql` | CHECK กันเขียนธง "ครูยืนยันแล้ว" ลงคอลัมน์ `ai_scores` — ครูเขียนที่ `teacher_confirmed_scores` เท่านั้น |
| `20261001290000_teacher_scores_before.sql` | `submissions.teacher_scores_before` + `confirm_submission_scores` เก็บคะแนนครูรอบก่อน (ครูจึงรู้ว่ารอบนี้ตัวเองแก้ด้านไหน) |
| `20261001300000_demo_classroom.sql` | โหมดสาธิต: `classrooms.is_demo` · trigger กันติดป้ายย้อนหลัง · rpc `reset_demo_classroom` |

ตรวจซ้ำว่าขึ้นครบ:

```bash
npx supabase migration list --linked     # ทุกแถวต้องมีทั้งคอลัมน์ local และ remote
```

**อย่าตรวจแค่จำนวนไฟล์** — ไฟล์ครบแต่คอลัมน์ขาดก็เป็นไปได้ถ้า push ค้างกลางทาง
ข้อ 6.1 (`check-deploy.ts`) ตรวจถึงระดับคอลัมน์ให้แล้ว ใช้ตัวนั้นเป็นคำตอบสุดท้าย

---

## 3. ตรวจ RLS บนคลาวด์ว่าเหมือน local

เปิด Dashboard → **SQL Editor** แล้วรันทีละคำสั่ง

```sql
-- 3.1 ทุกตารางต้องได้ rowsecurity = true (ปัจจุบัน 22 ตาราง)
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- 3.2 ต้องไม่มีตารางไหนที่เปิด RLS แล้วแต่ไม่มี policy (เปิดแล้วไม่มีนโยบาย = ไม่มีใครเข้าได้ อาจตั้งใจ แต่ต้องรู้ตัว)
select t.tablename, count(p.policyname) as policies
from pg_tables t
left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
group by t.tablename
order by policies, t.tablename;

-- 3.3 anon ต้องไม่มีสิทธิ์อะไรเลยในตารางของเรา — ผลลัพธ์ต้องเป็น 0 แถว
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public';

-- 3.4 ฟังก์ชันที่ยอมให้เรียกได้ต้องเป็นของ service_role เท่านั้น
select p.proname, r.rolname, has_function_privilege(r.rolname, p.oid, 'execute') as can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join (select rolname from pg_roles where rolname in ('anon','authenticated','service_role')) r
where n.nspname = 'public'
order by p.proname, r.rolname;
```

ผลที่ถูกต้อง: 3.1 ได้ `true` ทุกแถว · 3.3 ได้ 0 แถว · 3.4 `anon` ต้อง `can_execute = false` ทุกฟังก์ชัน

---

## 3.5 สร้างค่าลับใหม่สำหรับเซิร์ฟเวอร์จริง (ห้ามข้าม)

ค่าลับบนเครื่องพัฒนาผ่านมือคนไปหลายรอบแล้ว (เทอร์มินัล · ไฟล์ผลตรวจ · เครื่องที่แชร์กัน)
**เอาไปใช้บนเซิร์ฟเวอร์จริงไม่ได้** โดยเฉพาะ `SESSION_SECRET` ที่ใช้เซ็นคุกกี้ครู — รู้ค่านี้ = ปลอมเป็นครูคนไหนก็ได้

สร้างใหม่ 2 ตัว (พิมพ์ทีละบรรทัด คัดลอกค่าไปวางบน Vercel ทันที **อย่าเขียนลงไฟล์ในโปรเจกต์**):

```bash
# SESSION_SECRET — เซ็นคุกกี้ครู/นักเรียน
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"

# GRADE_WORKER_SECRET — ให้สคริปต์ตรวจงานเบื้องหลังยิง /api/jobs/drain จากเครื่องอื่นได้
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

**คีย์ AI (`TYPHOON_API_KEY` / `GEMINI_API_KEY`) สร้างใหม่เองไม่ได้** ต้องออกคีย์ใหม่จากหน้าเว็บผู้ให้บริการ
ถ้าไม่ออกใหม่ อย่างน้อยต้องรู้ว่าคีย์ตัวเดียวกันถูกใช้ทั้งสองที่ และเพิกถอนทันทีที่สงสัยว่าหลุด

### ตรวจว่า "ค่าบนเซิร์ฟเวอร์จริงไม่ใช่ค่าเดียวกับเครื่องพัฒนา" โดยไม่ต้องเอาค่ามาวางเทียบ

`check-deploy.ts` พิมพ์ **ลายนิ้วมือ** ของแต่ละค่าลับออกมา (sha256 ใส่เกลือ ตัดเหลือ 8 ตัวอักษร ย้อนกลับไม่ได้):

```bash
npx tsx scripts/check-deploy.ts | grep -E 'SESSION_SECRET|GRADE_WORKER_SECRET'
# [ผ่าน  ] SESSION_SECRET
#           ยาว 48 ตัว · ลายนิ้วมือ xxxxxxxx (บนเซิร์ฟเวอร์จริงต้องได้ลายนิ้วมือไม่ซ้ำกับของเครื่องพัฒนา)
```

1. รันบนเครื่องพัฒนา จดลายนิ้วมือ 8 ตัวไว้
2. รันอีกครั้งโดยชี้ env ไปที่ค่าของเซิร์ฟเวอร์จริง
3. **ลายนิ้วมือต้องต่างกัน** ถ้าเหมือนกัน = ลอกค่าเก่ามา ให้กลับไปทำข้อ 3.5 ใหม่

สคริปต์ยังปัดตกค่าที่ไม่ควรใช้ให้เองด้วย โดยไม่พิมพ์ค่าออกมาเลย:
สั้นกว่าเกณฑ์ · ตัวอักษรต่างกันไม่ถึง 12 ตัว · มีคำอย่าง `dev` `test` `example` `change` ปนอยู่ ·
หรือค่านั้นถูกพิมพ์อยู่ในไฟล์ที่ commit ได้ (= รั่วแล้ว ต้องสร้างใหม่ทันที)

---

## 4. ตั้ง environment variables บน Vercel

Vercel → Project → **Settings → Environment Variables** (ใส่ให้ทั้ง Production และ Preview)

| ชื่อ | เอามาจาก | ลับไหม |
|---|---|:--:|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | ไม่ |
| `SUPABASE_ANON_KEY` | Dashboard → Project Settings → API → anon public | ไม่ |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → Project Settings → API → service_role | **ลับ** |
| `SESSION_SECRET` | **ค่าใหม่จากข้อ 3.5** ห้ามลอกจาก `.env.local` | **ลับ** |
| `APP_BASE_URL` | `https://<your-app>.vercel.app` — **ไม่ตั้ง = QR รหัสห้องชี้กลับ `http://localhost:3000` นักเรียนสแกนแล้วเข้าไม่ได้** | ไม่ |
| `TYPHOON_API_KEY` | https://opentyphoon.ai — **มีคีย์จริงแล้ว** อยู่ใน `.env.local` ของเครื่องพัฒนา คัดลอกค่ามาวางใน Vercel โดยตรง ห้ามผ่านไฟล์กลาง | **ลับ** |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey — **มีคีย์จริงแล้ว** อยู่ใน `.env.local` ของเครื่องพัฒนา | **ลับ** |
| `GRADE_WORKER_SECRET` | **ค่าใหม่จากข้อ 3.5** ห้ามใช้ค่าเดียวกับใน `.env.local` ของเครื่องพัฒนา | **ลับ** |
| `DEMO_MODE` | **ต้องเป็น `0`** ตอนส่งลิงก์จริง (ดูข้อ 4.3) | ไม่ |

> **การถือคีย์ AI**: ห้าม `cat` / `echo` / `grep` ค่าคีย์ออกมาในเทอร์มินัล ไฟล์ผล เอกสาร หรือ Postman ต่อให้เป็นบางส่วนก็ห้าม
> วิธีตรวจว่ามีคีย์โดยไม่เปิดค่า: `npx tsx scripts/check-deploy.ts` (รายงานแค่ "มี/ไม่มี" ไม่พิมพ์ค่า)
> ห้ามเขียนคีย์ลง `.env.example` และห้ามตั้งชื่อ env ขึ้นต้น `NEXT_PUBLIC_`

**ระบบต้องเล่นจบได้แม้ AI ล่ม** — เน็ตโรงเรียนไม่แน่นอน ถ้า provider ตอบช้าเกิน timeout หรือคีย์หมดโควตา
`lib/ai/fallback.ts` จะรับช่วงด้วยกฎในโค้ด แล้วติดป้าย `source: 'fallback'` ให้ครูเห็นบนแผง
อย่าทำให้เส้นทางนี้ขาด และอย่าลบข้อความตัวสำรองออกจากเดโม — นี่คือจุดขายของงาน

### ลูกโซ่สำรองของผู้ช่วย AI + โควตาที่ต้องเผื่อ

#### โหมดผู้เยาว์และตัวเลือกผู้ให้บริการ

ตอนทดสอบกับผู้ใหญ่ที่สวมบทบาทเป็นนักเรียน ใช้ Gemini ได้ตามปกติ แต่ก่อนให้นักเรียนอายุต่ำกว่า 18 ปีใช้จริง ต้องตั้ง `AI_MINORS_MODE=1` เสมอ ระบบจะตัด Gemini ออกจากลูกโซ่ (ผู้ให้บริการที่มีข้อจำกัดอายุจะถูกปิด) ตรวจเงื่อนไขล่าสุดของ Google ได้ที่ https://ai.google.dev/gemini-api/terms

Cloudflare Workers AI ปิดไว้เป็นค่าเริ่มต้น หากต้องการเปิดให้ตั้ง `CF_ACCOUNT_ID`, `CF_AI_TOKEN`, `CF_AI_MODEL` และตั้งลิมิต `CF_RPS`, `CF_RPM`, `CF_RPD`; ไม่มี token จะไม่ยิงเครือข่าย ค่าลิมิตของ Typhoon/Gemini ตั้งทับได้ด้วย `TYPHOON_RPS/RPM/RPD` และ `GEMINI_RPS/RPM/RPD` ระบบเก็บหน้าต่างเลื่อนแยกต่อ provider และหยุด provider ที่ตอบ 429/5xx ประมาณ 60 วินาที

#### แชตโดม (/dome) ใช้ AI จริงผ่านลูกโซ่เดียวกัน

`app/api/dome/route.ts` → `components/server/dome-brain.ts` → `createAiClient().domeChat` ใช้ตัวเลือกผู้ให้บริการ failover คิวจำกัดอัตรา และ circuit breaker ชุดเดียวกับคำใบ้ ไม่มีโค้ดเฉพาะผู้ให้บริการในส่วนโดม เพิ่มเจ้าใหม่ได้ด้วยการตั้ง env เท่านั้น

| ตัวแปร env | เปิดผู้ให้บริการ |
|---|---|
| `TYPHOON_API_KEY` | Typhoon (ลำดับแรกสำหรับงานโดม) |
| `GEMINI_API_KEY` | Gemini (ถูกตัดออกเมื่อ `AI_MINORS_MODE=1`) |
| `CF_ACCOUNT_ID` + `CF_AI_TOKEN` (ทางเลือก `CF_AI_MODEL`, `CF_AI_BASE_URL`) | Cloudflare Workers AI |

- ไม่มีคีย์เลย / ครูปิด AI ทั้งห้อง / ทุกเจ้าล้ม ติดลิมิต / คำตอบไม่ผ่านตัวกันหัวข้อหรือตัวกันเฉลย = โดมตอบด้วยกฎใน `dome-brain.ts` (ผลมี `source: "fallback"`)
- ลิมิตต่อคน: เรียกโมเดลได้ `DOME_AI_PER_MINUTE` ครั้งต่อนาที (ค่าเริ่มต้น 8) เกินแล้วใช้กฎ ไม่ error แชตโดมไม่กินโควตา `AI_MAX_CALLS_PER_STUDENT` ของคำใบ้
- ภารกิจปัจจุบันของนักเรียนอ่านจาก DB ฝั่งเซิร์ฟเวอร์ (ภารกิจแรกที่ยังไม่ผ่าน) ไม่เชื่อค่าจากเบราว์เซอร์ ล็อกหัวข้อตาม `lib/ai/topic-lock.ts` และ `lib/ai/dome-scope.ts`
- เฉลยจาก `content/*-answers.json` ไม่เคยถูกส่งให้โมเดล และคำตอบที่คัดลอกประโยคเฉลยมาจะถูกทิ้ง (`components/server/dome-guard.ts`)

ลำดับเดียวกันทุกชนิดงาน (`lib/ai/index.ts` → `providerChain`): **Typhoon → Gemini → กฎในโค้ด** งบเวลารวมทั้งลูกโซ่ 5 วินาที

```
Typhoon ──ล่ม / ช้าเกิน / ไม่มีคีย์──▶ Gemini ──429 / ล่ม──▶ กฎในโค้ด (fallback.ts)
   │                                    │                        │
source: 'ai'                       source: 'ai'           source: 'fallback'
```

| provider | บทบาท | โควตาจริง | สถานะที่ทดสอบ |
|---|---|---|---|
| Typhoon | **ตัวหลัก** | 5 RPS · 200 RPM | ตอบจริง `source='ai'` ~840 ms (คำใบ้) · ~9–17 วินาที (ตรวจงานยาว) |
| Gemini | **ตัวสำรอง** | free tier **5 RPM** สาย Flash · **15 RPM** สาย Flash Lite | คีย์ใช้ได้ แต่เคยติด HTTP 429 — ไม่ใช่คีย์เสีย |
| กฎในโค้ด | ตัวสุดท้าย พร้อมเสมอ | ไม่จำกัด | ไม่ต้องต่อเน็ต ไม่มีค่าใช้จ่าย ติดป้าย `source: 'fallback'` |

**ทำไม Gemini ถึงเป็นตัวสำรอง ไม่ใช่ตัวหลัก**: ห้อง 30 คนกดพร้อมกัน = 30 คำขอ Typhoon รับได้ในไม่กี่วินาที
ส่วน free tier 5–15 RPM ของ Gemini ต้องใช้เวลา 2 นาทีขึ้นไป **โควตาหมดไม่ต้องทำอะไร** ระบบตกไปชั้นถัดไปเองตามลูกโซ่

**สิ่งที่ต้องทำก่อนวันสอนจริง**
- [ ] เช็กโควตาที่เหลือของทั้งสองเจ้าก่อนเริ่มคาบ (`npx tsx scripts/check-ai.ts`)
- [ ] เผื่อว่าทั้งสองเจ้าล่มพร้อมกัน — เดโมยังต้องเล่นจบได้ด้วยกฎในโค้ด ทดสอบเส้นทางนี้ก่อนขึ้นเวทีหนึ่งรอบ (ลบคีย์ออกจาก env ชั่วคราวแล้วเล่นให้จบ)
- [ ] 429 ไม่ใช่เหตุให้หยุดคาบ ครูจะเห็นป้าย `กฎในระบบเสนอ (ไม่ได้ใช้ AI)` บนแผง แล้วสอนต่อได้ตามปกติ

> ห้ามตั้งชื่อขึ้นต้น `NEXT_PUBLIC_` ให้ตัวที่ทำเครื่องหมาย **ลับ** เด็ดขาด
> Next.js จะฝังค่านั้นลงไฟล์ JavaScript ฝั่งเบราว์เซอร์ = แจกกุญแจฐานข้อมูลให้ทุกคนที่เปิดเว็บ

**Region ของ Vercel**: Settings → Functions → Function Region → เลือก **Singapore (`sin1`)** ให้อยู่ภูมิภาคเดียวกับฐานข้อมูล ไม่งั้นทุก query วิ่งข้ามทวีปกลับไปกลับมา

Deploy: push ขึ้น branch หลักของ GitHub แล้ว Vercel build ให้เอง

---

## 4.1 bucket ไฟล์เสียงด่านบอส (ต้องมีบนคลาวด์ด้วย)

ไฟล์ `20260930120000_voice_storage_and_confirm.sql` สร้าง bucket ให้อยู่แล้วตอน `db push`
แต่ Supabase บางเวอร์ชันไม่ยอมให้ migration แตะ `storage.buckets` **ให้ตรวจซ้ำทุกครั้ง** ว่ามีจริง

```sql
-- Dashboard → SQL Editor · ต้องได้ 1 แถว public = false
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'voice-submissions';
```

ไม่มีแถว = สร้างเองด้วย SQL เดียวกับใน migration (อย่าสร้างจากหน้า UI เพราะ UI ตั้ง public เป็นค่าเริ่มต้น)

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-submissions', 'voice-submissions', false, 2097152,
        array['audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav'])
on conflict (id) do nothing;

-- policy เดิม: ครูเจ้าของห้องเท่านั้นที่อ่านไฟล์ในโฟลเดอร์ของนักเรียนในห้องตัวเองได้
create policy "voice read by owning teacher" on storage.objects
  for select to authenticated
  using (bucket_id = 'voice-submissions'
         and public.owns_student((storage.foldername(name))[1]::uuid));
```

ต้องเป็น **private** เสมอ: เสียงนักเรียนเป็นข้อมูลส่วนบุคคล เว็บเข้าถึงผ่าน signed URL อายุสั้นที่ออกให้ครูเท่านั้น
อายุไฟล์ 90 วัน ดูข้อ 6.8

- [ ] `select ... from storage.buckets` ได้ 1 แถว และ `public = false`
- [ ] `npx tsx scripts/check-deploy.ts` ขึ้น `[ผ่าน] bucket voice-submissions`

---

## 4.2 คิวตรวจงานเบื้องหลัง (`grade_jobs`) — **ไม่ต้องตั้ง cron**

นักเรียนกดส่งงานด่านบอสแล้ว **ได้คะแนนจากกฎในโค้ดทันที** (ไม่แตะเน็ต ~100 ms) แล้วงานค่อยเข้าคิว `grade_jobs`
ให้ AI ตรวจทีหลัง ผล AI ไปอยู่ใต้คีย์ `aiProposed` เท่านั้น **ไม่เคยทับดาวของนักเรียนและไม่ทับคะแนนที่ครูยืนยัน**

| ตัวปลุก worker | ใช้เมื่อไหร่ |
|---|---|
| **หน้าแผงครู** ยิง `POST /api/jobs/drain` เองระหว่างเปิดค้างอยู่ | ทางหลักตอนสอนจริง — ครูต้องเปิดแผงค้างไว้ทั้งคาบ |
| `npx tsx scripts/grade-worker.ts --watch` (วนทุก 10 วินาที) | ทางสำรอง รันบนเครื่องครูหรือเครื่องใดก็ได้ที่มี `GRADE_WORKER_SECRET` |

ยิงเองด้วยมือก็ได้:

```bash
curl -s -X POST https://<your-app>.vercel.app/api/jobs/drain \
  -H "x-worker-secret: $GRADE_WORKER_SECRET"
# {"ok":true,"reclaimed":0,"processed":1}
```

สิทธิ์: คุกกี้ครูที่ล็อกอินอยู่ **หรือ** header `x-worker-secret` ตรงกับ `GRADE_WORKER_SECRET` เท่านั้น อย่างอื่น 401

**ทุกครั้งที่ drain ทำ 2 อย่างตามลำดับ**
1. `reclaim_stale_grade_jobs()` — งานที่ `claimed` ค้างเกิน 5 นาที (worker ตายกลางทาง) กลับเป็น `pending`
2. หยิบงานด้วย `claim_next_grade_job()` ซึ่งใช้ `FOR UPDATE SKIP LOCKED` — หลาย worker แย่งกันไม่ได้งานซ้ำ
   คืน `null` **ไม่ได้แปลว่าคิวหมดเสมอไป** อาจโดน SKIP LOCKED จึงลองซ้ำอีกรอบก่อนสรุป

งานที่พังครบ 3 ครั้งถูกปักเป็น `failed` และหยุดวน — ครูยังให้คะแนนเองได้ตามปกติ คะแนนจากกฎยังอยู่ครบ

ดูคิวบนคลาวด์:

```sql
select status, count(*) from public.grade_jobs group by status;
-- ค้างที่ claimed นาน ๆ = ไม่มีใครปลุก worker ให้เปิดแผงครูหรือรัน --watch
```

- [ ] ตั้ง `GRADE_WORKER_SECRET` บน Vercel (ค่าใหม่ ไม่ใช่ค่าของเครื่องพัฒนา)
- [ ] ยิง `POST /api/jobs/drain` หนึ่งครั้งหลัง deploy ได้ `{"ok":true,...}`
- [ ] ยิงโดยไม่มี secret และไม่มีคุกกี้ ต้องได้ **401**

---

## 4.3 ปิดโหมดสาธิต ก่อนส่งลิงก์จริง

"โหมดสาธิต" มี 2 อย่างที่ไม่เกี่ยวกัน ต้องปิดทั้งคู่:

**ก. `DEMO_MODE` (ตัวแปรสภาพแวดล้อม)** — เปิดอยู่ = นักเรียนเลื่อนระดับตัวช่วยเองได้ ทำให้ข้อมูลการทดลองเพี้ยน

```bash
# Vercel → Settings → Environment Variables → DEMO_MODE = 0
# เปลี่ยนแล้วต้อง Redeploy ด้วย env ใหม่ ถึงจะมีผล (แก้ค่าเฉย ๆ ของเดิมยังรันอยู่)
```

**ข. ห้องสาธิต (`classrooms.is_demo = true`)** — ห้องหุ่น 20 คนของ `scripts/seed-demo.ts` (รหัส `QUEST9`)
ห้องนี้มี **ปุ่มล้างทั้งห้อง** อยู่บนแผงครู และตัวเลขของมันเป็นข้อมูลหุ่น ไม่ใช่ผลการทดลอง

- อยู่บนเครื่องซ้อม/เครื่องที่ใช้เดโมวันแข่ง: **ให้อยู่** นั่นคือตัวที่จะใช้สาธิต
- อยู่บนลิงก์ที่ส่งให้นักเรียนจริง: **ลบทิ้ง**

```sql
-- ดูว่ามีห้องสาธิตค้างอยู่ไหม (check-deploy.ts ตรวจให้อยู่แล้ว)
select room_code, created_at from public.classrooms where is_demo;
-- ลบทิ้ง (ลบห้อง ไม่ใช่แค่ล้างข้อมูลในห้อง)
delete from public.classrooms where is_demo and room_code = 'QUEST9';
```

> ห้องเรียนจริงจะกลายเป็นห้องสาธิตไม่ได้ — trigger `classrooms_guard_demo_flag` ปฏิเสธการติดป้าย
> `is_demo` ย้อนหลังให้ห้องที่มีนักเรียนอยู่แล้ว และ `reset_demo_classroom` ปฏิเสธห้องที่ไม่ได้ติดป้าย
> แปลว่าปุ่มล้างบนแผงครูไม่มีทางลบห้องเรียนจริงได้ ต่อให้ยิง API ตรงข้ามหน้าจอไปก็ตาม

---

## 5. สร้างบัญชีครูจริงและเปิดห้องเรียน

ทำจากเครื่องตัวเอง โดยชี้ env ไปที่คลาวด์ชั่วคราว (อย่าคอมมิตค่าเหล่านี้)

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
SEED_TEACHER_EMAIL=teacher@example.ac.th \
SEED_TEACHER_PASSWORD='<รหัสผ่านที่ตั้งเอง>' \
SEED_TEACHER_NAME='ครูผู้สอน' \
npx tsx scripts/seed-production.ts
```

สคริปต์จะพิมพ์ **รหัสห้อง 6 ตัว** ออกมา — เอาไปฉายขึ้นจอให้นักเรียนพิมพ์
รันซ้ำได้ ไม่สร้างบัญชี/ห้องซ้ำ และไม่ใส่นักเรียนจำลองใด ๆ

อยากกำหนดรหัสห้องเอง ใส่ `SEED_ROOM_CODE=QUEST9` (ใช้ตัวอักษรจากชุด `23456789ABCDEFGHJKMNPQRSTUVWXYZ` เท่านั้น ไม่มี `0 O 1 I L` เพราะอ่านสับสนบนโปรเจกเตอร์)

หลังรันเสร็จ **ลบ `SEED_TEACHER_PASSWORD` ออกจาก shell history และ .env.local ทันที**

---

## 6. ตรวจก่อนส่งลิงก์ (เช็คลิสต์)

ทำตามลำดับ ติ๊กให้ครบทุกข้อก่อนส่งลิงก์ให้ใคร

### 6.1 สคริปต์ตรวจอัตโนมัติ

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_ANON_KEY=<anon key> \
SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
SESSION_SECRET=<ค่าเดียวกับบน Vercel> \
GRADE_WORKER_SECRET=<ค่าเดียวกับบน Vercel> \
APP_BASE_URL=https://<your-app>.vercel.app \
DEMO_MODE=0 \
npx tsx scripts/check-deploy.ts --linked
```
ต้องได้ **ไม่ผ่าน 0 ข้อ**

`--linked` เปิด **โหมดเข้ม**: ข้อที่ตอนรันบนเครื่องพัฒนาเป็นแค่ "เตือน" จะกลายเป็น "ไม่ผ่าน"
(`DEMO_MODE` ยังไม่ปิด · ไม่มี `APP_BASE_URL` หรือไม่ใช่ https · มีห้องสาธิตค้าง · ไม่มี `GRADE_WORKER_SECRET`)
อยากลองโหมดเข้มกับ local ใช้ `--strict` แทน

รายการที่สคริปต์ตรวจให้ (ตัวเลขอัปเดต 30 ก.ย. 2569):

- [ ] env ครบ 4 ตัว · `SESSION_SECRET` และ `GRADE_WORKER_SECRET` แข็งแรงพอ + **ลายนิ้วมือต่างจากเครื่องพัฒนา** (ข้อ 3.5)
- [ ] `APP_BASE_URL` ตั้งแล้วและเป็น `https://`
- [ ] `DEMO_MODE=0`
- [ ] migration ครบ **23 ไฟล์** บนคลาวด์
- [ ] ตารางครบ **30** ตาราง
- [ ] rpc ครบ **88** ตัว (รายการมาจากการไล่ `.rpc('` ทั้งโปรเจกต์ — โค้ดเรียกตัวไหน รายการนี้มีตัวนั้น)
- [ ] **คอลัมน์ครบ 46 คอลัมน์ใน 11 ตาราง** — ตารางครบไม่ได้แปลว่าคอลัมน์ครบ ถ้า push ค้างกลางทางจะจับได้ตรงนี้
- [ ] ไม่มีห้องสาธิต (`is_demo`) ค้างอยู่
- [ ] bucket `voice-submissions` มีจริงและเป็น private
- [ ] RLS เปิดครบทุกตาราง
- [ ] anon อ่านตารางไม่ได้สักตาราง
- [ ] ไม่มีคีย์จริงหลุดในไฟล์ที่ commit ได้ (สคริปต์สแกนทุกไฟล์ ยกเว้น `.env.local`)

> ถ้าเพิ่มตาราง/rpc/คอลัมน์ใหม่ในอนาคต **ต้องเติมลงรายการใน `scripts/check-deploy.ts` ด้วย**
> ไม่งั้นสคริปต์จะเขียวทั้งที่ของหาย ซึ่งทำให้ทั้งไฟล์นี้เชื่อถือไม่ได้

### 6.2 anon เข้าตารางไม่ได้ (ตรวจด้วยมือซ้ำ)

```bash
ANON=<anon key>
for t in teachers classrooms students profiles progress submissions events \
         route_changes reflections mission_progress peer_feedback \
         mission_skips chat_messages voice_submissions grade_jobs \
         class_sessions session_phase_changes student_phase_unlocks \
         survey_responses survey_completions buddy_requests buddy_offers; do
  printf "%-18s -> " "$t"
  curl -s -o /dev/null -w '%{http_code}\n' \
    "https://<project-ref>.supabase.co/rest/v1/$t?select=*" \
    -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
done
```
ทุกบรรทัดต้องเป็น **401** (ไม่ใช่ 200 และไม่ใช่ 404)

### 6.3 service_role ไม่หลุดฝั่งเบราว์เซอร์

ตรวจจากไฟล์ที่ deploy แล้วจริง ๆ ไม่ใช่จากซอร์ส

```bash
# ตรวจ bundle ที่ build ในเครื่อง
npm run build
grep -rl "service_role" .next/static 2>/dev/null | head        # ต้องไม่มีผลลัพธ์
grep -rlE "eyJ[A-Za-z0-9_-]{20,}\." .next/static 2>/dev/null | head   # ต้องไม่มีผลลัพธ์
grep -rl "SESSION_SECRET" .next/static 2>/dev/null | head      # ต้องไม่มีผลลัพธ์

# ตรวจจากเว็บที่ deploy แล้ว: โหลดไฟล์ JS ทุกก้อนของหน้าแรกมาค้น
curl -s https://<your-app>.vercel.app | grep -oE '/_next/static/[^"]+\.js' | sort -u \
  | while read -r p; do
      curl -s "https://<your-app>.vercel.app$p" \
        | grep -qE "service_role|SESSION_SECRET|eyJ[A-Za-z0-9_-]{20,}\." && echo "พบของลับใน $p"
    done
# ไม่มีบรรทัด "พบของลับ" = ผ่าน
```
- [ ] ไม่มีคำว่า `service_role` ใน static bundle
- [ ] ไม่มี JWT รูปแบบ `eyJ...` ใน static bundle
- [ ] เปิด DevTools → Application → Cookies เห็น `dbq_student` / `dbq_teacher` เป็น **HttpOnly**

### 6.4 เฉลยไม่หลุด

```bash
# แผงครูต้องไม่มีเฉลยปนมากับคำถามโค้ช
curl -s -b teacher-cookie.txt \
  "https://<your-app>.vercel.app/api/teacher/board?classroomId=<id>" \
  | grep -cE '"answerIndex"|"explanation"|"choices"|"correct'
# ต้องได้ 0
```
- [ ] response ของ `/api/teacher/board` ได้ 0
- [ ] ไฟล์เฉลย (`content/*-answers.json`) ไม่ถูก import จาก client component — `grep -rl "answers.json" components app | grep -v server`
- [ ] การ์ดโค้ชบนหน้าครูไม่มีปุ่ม "ดูเฉลย" (ตำราให้ครูถาม ไม่ใช่บอกคำตอบ)

### 6.5 เข้าห้องด้วยมือถือจริง

- [ ] เปิดลิงก์บนมือถือที่ใช้ 4G/5G (ไม่ใช่ Wi-Fi ห้องเดียวกัน) เข้าห้องด้วยรหัส 6 ตัวได้
- [ ] พิมพ์ชื่อเล่นภาษาไทยได้ · ชื่อซ้ำแล้วระบบเติมเลขท้ายให้จริง
- [ ] ปิดเบราว์เซอร์แล้วเปิดใหม่ยังอยู่ในห้องเดิม (cookie ยังอยู่)
- [ ] ล้างข้อมูลเบราว์เซอร์แล้วกลับเข้าด้วยรหัส 4 หลักได้ (หน้า resume)
- [ ] ทดสอบพร้อมกัน 5 เครื่องก่อน แล้วค่อยขยายเป็น 30 (ตาม `auth-and-roles.md` ข้อ 8)

### 6.6 ครู B แตะห้องครู A ไม่ได้

สร้างบัญชีครูทดสอบอีกหนึ่งบัญชี แล้วล็อกอินเป็นครู B

```bash
curl -s -b teacher-b-cookie.txt \
  "https://<your-app>.vercel.app/api/teacher/board?classroomId=<ห้องของครู A>"
# ต้องได้ 404 {"error":"not-found"}

curl -s -b teacher-b-cookie.txt -X PATCH \
  "https://<your-app>.vercel.app/api/teacher/classroom" \
  -H 'Content-Type: application/json' \
  -d '{"classroomId":"<ห้องของครู A>","status":"closed"}'
# ต้องได้ 404 และห้องของครู A ต้องยัง status = open
```
- [ ] อ่านบอร์ดห้องคนอื่น → 404
- [ ] ปิดห้องคนอื่น → 404 และห้องนั้นยังเปิดอยู่จริง
- [ ] ลบบัญชีครูทดสอบทิ้งหลังตรวจเสร็จ

### 6.7 ตรวจว่า deploy ขึ้นสำเร็จจริง (5 คำสั่ง จบใน 2 นาที)

รันจากเครื่องไหนก็ได้ที่ต่อเน็ต แทนค่า `APP=https://<your-app>.vercel.app` ก่อน
**ทั้ง 5 ข้อต้องได้ตามที่เขียนไว้ ถ้าข้อไหนไม่ตรง แปลว่ายังไม่สำเร็จ อย่าส่งลิงก์**

```bash
APP=https://<your-app>.vercel.app

# 1) หน้าแรกขึ้นจริง ไม่ใช่หน้า error ของ Vercel
curl -s -o /dev/null -w 'หน้าแรก %{http_code} · %{time_total}s\n' "$APP/"
# ต้องได้ 200 และไม่เกิน 3 วินาที

# 2) ฐานข้อมูลต่อติด — ใส่รหัสห้องมั่วต้องได้ "ไม่พบห้อง" ไม่ใช่ 500
curl -s "$APP/api/join" -X POST -H 'Content-Type: application/json' \
  -d '{"roomCode":"ZZZZZZ","nickname":"ตรวจระบบ","pin":"1234"}' | head -c 120
# ต้องได้ {"error":"room-not-found",...}  ← 500 = ต่อฐานข้อมูลไม่ติด / env ผิด

# 3) ไม่มีคุกกี้ครู ต้องเข้าเส้นครูไม่ได้
curl -s -o /dev/null -w 'เส้นครูไม่มีคุกกี้ %{http_code}\n' "$APP/api/teacher/board?classroomId=00000000-0000-4000-8000-000000000000"
# ต้องได้ 401

# 4) service_role ต้องไม่หลุดฝั่งเบราว์เซอร์
curl -s "$APP/" | grep -coE 'service_role|SUPABASE_SERVICE_ROLE'
# ต้องได้ 0

# 5) คิวตรวจงานเบื้องหลังตื่นอยู่
curl -s -X POST "$APP/api/jobs/drain" -H "x-worker-secret: <GRADE_WORKER_SECRET ของ production>" | head -c 120
# ต้องได้ {"ok":true,"reclaimed":...,"processed":...}
```

จบแล้วเปิดเบราว์เซอร์เล่นจริง 1 รอบ: `$APP/join` → เข้าห้อง → ผ่านแบบทดสอบก่อนเรียน → เห็นแผนที่ → ทำภารกิจ 1 ด่าน
แล้วเปิด `$APP/teacher` อีกแท็บ ต้องเห็นชื่อคนที่เพิ่งเข้าโผล่บนแผงห้องเรียนสดภายใน 3 วินาที

### 6.7.1 สุดท้าย

- [ ] `DEMO_MODE=0` บน Production **และ Redeploy แล้ว**
- [ ] ไม่มีห้อง `is_demo` ค้างบนลิงก์จริง (ข้อ 4.3)
- [ ] ปิดห้องเรียนที่ใช้ทดสอบ และเปิดห้องใหม่ให้วันสอนจริง
- [ ] ลบนักเรียนทดสอบออกจากห้องจริง

---

## 6.8 นโยบายเก็บไฟล์เสียง (PDPA) — ต้องตั้ง cron ก่อนใช้จริง

เสียงของนักเรียนเป็นข้อมูลส่วนบุคคล เก็บเท่าที่จำเป็นต่อการให้คะแนนและทบทวนเท่านั้น

| กติกา | ทำที่ไหน |
|---|---|
| เก็บไม่เกิน **90 วัน** นับจากวันอัด แล้วลบอัตโนมัติ | `voice_submissions.expires_at` (default `now() + 90 days`) + `scripts/purge-expired-voice.ts` |
| **ครูสั่งลบก่อนได้** ทุกเมื่อ | `DELETE /api/teacher/voice` (ลบทั้งไฟล์ใน bucket และแถวใน DB) |
| **ลบห้องเรียน = ลบไฟล์เสียงของห้องนั้นด้วย** | `DELETE /api/teacher/classroom` ลบไฟล์ใน storage ก่อน แล้วแถวลูกหายตาม FK cascade |

ดูของที่ถึงกำหนดโดยยังไม่ลบ:

```bash
npx tsx scripts/purge-expired-voice.ts --dry-run
```

ลบจริง (กู้คืนไม่ได้):

```bash
npx tsx scripts/purge-expired-voice.ts
```

### ตั้ง cron — เลือกทางใดทางหนึ่ง

**ทางที่ 1 (แนะนำ): GitHub Actions** — ไม่ต้องเปิดเซิร์ฟเวอร์ทิ้งไว้ ใช้ secret ของ repo

```yaml
# .github/workflows/purge-voice.yml   (ยังไม่ได้สร้างไฟล์นี้ รอ deploy จริงก่อน)
name: purge expired voice
on:
  schedule:
    - cron: '0 19 * * *'      # 02:00 ตามเวลาไทย (UTC+7)
  workflow_dispatch:
jobs:
  purge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npx tsx scripts/purge-expired-voice.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

**ทางที่ 2: pg_cron บน Supabase** — ลบได้เฉพาะแถวใน DB ไฟล์ใน bucket ยังค้าง จึงต้องคู่กับการเก็บกวาดไฟล์อยู่ดี

```sql
-- Dashboard → Database → Extensions → เปิด pg_cron ก่อน
select cron.schedule(
  'purge-expired-voice',
  '0 19 * * *',
  $$ select public.expire_voice_submissions() $$
);
```

ตรวจว่าทำงานจริง:

```sql
select count(*) as ค้างเกินกำหนด
from public.voice_submissions
where expires_at <= now();
-- ควรได้ 0 หลัง cron รันรอบล่าสุด
```

- [ ] ตั้ง cron ไว้แล้ว (ทางที่ 1 หรือ 2)
- [ ] ทดสอบ `--dry-run` บนคลาวด์ครั้งหนึ่งก่อนเปิดใช้จริง
- [ ] แจ้งนโยบาย 90 วันนี้ในเอกสารขออนุญาตผู้ปกครอง

---

## 7. ถ้าพัง ย้อนกลับยังไง

### 7.1 เว็บพัง (ฝั่ง Vercel)

Vercel → Deployments → เลือก deployment ตัวก่อนหน้าที่เขียว → **⋯ → Promote to Production**
กลับได้ภายใน 30 วินาที ไม่แตะฐานข้อมูล **ทำอันนี้ก่อนเสมอ** ถ้าไม่รู้ว่าพังเพราะอะไร

### 7.2 ตั้ง env ผิด

แก้ค่าใน Settings → Environment Variables แล้ว **Redeploy** (env ใหม่ไม่มีผลจนกว่าจะ deploy ใหม่)
ถ้าเปลี่ยน `SESSION_SECRET` ทุกคนที่ล็อกอินอยู่จะหลุดทันที — ห้ามเปลี่ยนกลางคาบ

### 7.3 migration พังกลางทาง

`supabase db push` รันทีละไฟล์ในทรานแซกชันของตัวเอง ไฟล์ที่ผ่านไปแล้วจะไม่ย้อนอัตโนมัติ

```bash
npx supabase migration list --linked        # ดูว่าค้างที่ไฟล์ไหน
```

- **ก่อนเปิดใช้จริง (ยังไม่มีข้อมูลนักเรียน)**: ง่ายที่สุดคือรีเซ็ตทั้งก้อน
  Dashboard → Settings → General → ลบโปรเจกต์แล้วสร้างใหม่ ทำข้อ 1–2 ซ้ำ
- **หลังเปิดใช้จริง (มีข้อมูลนักเรียนแล้ว)**: **ห้าม** `supabase db reset` กับคลาวด์เด็ดขาด — คำสั่งนั้นลบข้อมูลทั้งหมด
  ให้เขียน migration ใหม่ที่ย้อนสิ่งที่เพิ่งทำแทน (เช่น `alter table ... drop column ...`) แล้ว push ตามปกติ
  migration ในโปรเจกต์นี้เป็น "เพิ่มอย่างเดียว" อยู่แล้ว การย้อนจึงคือการเพิ่มไฟล์ใหม่ ไม่ใช่การแก้ไฟล์เก่า

### 7.4 ข้อมูลหาย / แก้ผิดตาราง

Supabase ฟรีทีเรียเก็บ backup รายวัน: Dashboard → Database → Backups → Restore
กู้ได้ถึงจุดของ backup ล่าสุดเท่านั้น (ข้อมูลหลังจากนั้นหาย) — ก่อนวันสอนจริงให้กด backup เองหนึ่งครั้ง

### 7.5 นักเรียนเข้าไม่ได้กลางคาบ

1. ดูว่า `status` ของห้องยังเป็น `open` ไหม (ครูอาจเผลอกดปิด) → เปิดใหม่ผ่านแผงครู
2. ดูว่า `closes_at` เลยเวลาไปแล้วหรือยัง
3. ถ้า Vercel ล่ม ให้ promote deployment เก่า (7.1)
4. แผนสำรองหน้างาน: เปิดจากเครื่องครูด้วย `npm run dev` + `npx supabase start` แล้วให้นักเรียนต่อ Wi-Fi เดียวกัน เข้าที่ IP ของเครื่องครู

---

## 8. สิ่งที่ยังไม่ได้ทำ (ต้องตัดสินใจก่อนวันส่ง)

| เรื่อง | สถานะ |
|---|---|
| บัญชี Supabase / Vercel | ยังไม่มี — รออนุมัติ |
| key ของ Typhoon / Gemini | **ได้มาแล้วและใช้ได้จริง** · Typhoon ตอบจริง `source='ai'` ~840 ms · Gemini คีย์ดีแต่ติดโควตา 429 ต้องเผื่อไว้ · เหลือแค่ตั้งเป็น secret บน Vercel ตอน deploy |
| ไฟล์เสียงด่านบอส | **เสร็จแล้ว** bucket `voice-submissions` (private) + policy อยู่ใน migration ไฟล์ที่ 7 · บนคลาวด์ตรวจซ้ำตามข้อ 4.1 |
| ตัวปลุก worker ตรวจงาน | **ไม่ต้องตั้ง cron** — หน้าแผงครูปลุกเองขณะเปิดอยู่ · สำรองด้วย `scripts/grade-worker.ts --watch` (ข้อ 4.2) |
| cron ลบไฟล์เสียงหมดอายุ | ยังไม่ได้ตั้ง — เลือกทางใดทางหนึ่งในข้อ 6.8 ก่อนใช้จริง |
| โดเมนของเว็บ | ยังใช้ `*.vercel.app` ถ้าต้องการโดเมนสถาบันต้องขอล่วงหน้า |
| backup ก่อนวันสอน | ต้องกดเองหนึ่งครั้ง (7.4) |
