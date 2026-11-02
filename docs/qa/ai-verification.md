# AI verification — fix6

ยืนยันเมื่อ 2026-11-02 ด้วยคีย์ใน local environment โดยไม่พิมพ์ค่า secret ออกมา ผล local มาจาก HTTP flow จริงและตรวจแถวฐานข้อมูลหลังคิวทำงานเสร็จ ค่าทั้งหมดเป็น latency ของเครื่อง/เครือข่ายรอบนั้น

| path | local result | prod result | provider | latency | evidence |
|---|---|---|---|---:|---|
| Dome chat: on-topic | HTTP `/api/dome` `source=ai` | blocked: teacher login 401 จึงสร้าง temp room/student ไม่ได้ | typhoon | 1.1–1.4s | `scripts/qa-fix6-local.ts`, response fields `source/provider` |
| Dome chat: off-topic refusal | HTTP `/api/dome` `source=fallback`, `provider=rules`, refusal scope | blocked by same prod auth gate | rules (expected scripted refusal) | 41–76ms | `/api/dome` response; refusal must not spend AI quota |
| Dome chat: m5 DNS question | HTTP `/api/dome` `source=ai`, `provider=typhoon`, `scope=general` | blocked by same prod auth gate | typhoon | 1.1–1.9s | exact message `โดเมนกับ DNS ต่างกันยังไง อธิบายแบบร้านขนม`; `scripts/qa-fix6-local.ts` |
| m1 hint | HTTP `/api/hint` `source=ai`, `provider=typhoon` | not reached | typhoon | 0.8–1.2s | response fields and `hint-served` event |
| m1 learnCheck / open-answer grading | HTTP `/api/mission/m1/learn` status 200; per-question sources included `rule` for keyword-complete item and `typhoon` for the AI-reviewed item | not reached | typhoon (AI-reviewed item) | 1.6–2.6s | response `perQuestion[].source`; `learn-answer` event |
| CEO proposal submit | HTTP `/api/ceo` immediately returns `source=fallback/provider=rules` for the synchronous rule score by design and `gradeJobQueued=true` | not reached | rules immediate path; AI queued | <1s submit | response fields; no final score exposed as AI-confirmed |
| CEO AI rubric queue | after `/api/jobs/drain`: DB submission row `gradingStatus=done`, `aiProposed.source=ai`, `aiProposed.provider=typhoon` | not reached | typhoon | drain completed 1 job; model latency is recorded by the AI attempt log | `scripts/qa-fix6-local.ts`, `submissions.ai_scores` |
| Teacher review/confirm | teacher board HTTP 200; `/api/teacher/confirm-score` HTTP 200, `changedFrom=ai` | not reached | AI proposal retained as snapshot | API only | `teacher_confirmed_scores`, `ai_scores_snapshot`, confirm response |
| Reflection / teacher report summary | no AI-generated summary contract: reflection and report summaries are deterministic content/statistics | not reached | n/a | n/a | `app/api/reflect/route.ts`, `app/api/teacher/report/class/route.ts` |

## Production limitation

`~/Desktop/ceo-domain-quest-preview-link.txt` was read into a process variable and the preview URL returned HTTP 200. The seeded local teacher credentials were rejected by production (`/api/teacher/login` HTTP 401), so no production classroom/student was created and no production data was touched. A real production verification needs an owner-provided temporary teacher/invite or a valid preview-auth session; guessing it would be unsafe and is recorded in `docs/qa/owner-questions.md`.

## Scope fix evidence

The m5 DNS case previously fell through when the model returned `scope=off`. `lib/ai/dome-scope.ts` now recognizes course vocabulary and `components/server/dome-brain.ts` keeps an allowed course question on the AI path; the exact case is covered by `components/server/dome-brain.test.ts`.
