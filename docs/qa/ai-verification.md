# AI verification — fix6

ยืนยันเมื่อ 2026-11-02 ด้วยคีย์ใน local environment โดยไม่พิมพ์ค่า secret ออกมา ผล local มาจาก HTTP flow จริงและตรวจแถวฐานข้อมูลหลังคิวทำงานเสร็จ ค่าทั้งหมดเป็น latency ของเครื่อง/เครือข่ายรอบนั้น

| path | local result | prod result | provider | latency | evidence |
|---|---|---|---|---:|---|
| Dome chat: on-topic | HTTP `/api/dome` `source=ai` | blocked: `/api/teacher/signup` returned 307 → `/landing`; temp teacher/room/student not created | typhoon | n/a | prod signup probe 2026-11-02; local `scripts/qa-fix6-local.ts` |
| Dome chat: off-topic refusal | HTTP `/api/dome` `source=fallback`, `provider=rules`, refusal scope | blocked at signup (307 → `/landing`) | rules (expected scripted refusal) | n/a | prod signup probe; local response fields |
| Dome chat: m5 DNS question | HTTP `/api/dome` `source=ai`, `provider=typhoon`, `scope=general` | blocked at signup (307 → `/landing`) | typhoon | n/a | prod signup probe; local exact message case |
| m1 hint | HTTP `/api/hint` `source=ai`, `provider=typhoon` | blocked at signup (307 → `/landing`) | typhoon | n/a | prod signup probe; local response fields and `hint-served` event |
| m1 learnCheck / open-answer grading | HTTP `/api/mission/m1/learn` status 200; per-question sources included `rule` for keyword-complete item and `typhoon` for the AI-reviewed item | blocked at signup (307 → `/landing`) | typhoon (AI-reviewed item) | n/a | prod signup probe; local response `perQuestion[].source` |
| CEO proposal submit | HTTP `/api/ceo` immediately returns `source=fallback/provider=rules` for the synchronous rule score by design and `gradeJobQueued=true` | blocked at signup (307 → `/landing`) | rules immediate path; AI queued | n/a | prod signup probe; local response fields |
| CEO AI rubric queue | after `/api/jobs/drain`: DB submission row `gradingStatus=done`, `aiProposed.source=ai`, `aiProposed.provider=typhoon` | blocked at signup (307 → `/landing`) | typhoon | n/a | prod signup probe; local `submissions.ai_scores` |
| Teacher review/confirm | teacher board HTTP 200; `/api/teacher/confirm-score` HTTP 200, `changedFrom=ai` | blocked at signup (307 → `/landing`) | AI proposal retained as snapshot | n/a | prod signup probe; local teacher confirm response |
| Reflection / teacher report summary | no AI-generated summary contract: reflection and report summaries are deterministic content/statistics | not reached | n/a | n/a | `app/api/reflect/route.ts`, `app/api/teacher/report/class/route.ts` |

## Production limitation

`~/Desktop/ceo-domain-quest-preview-link.txt` and the invite file were read into process variables without printing either value. On 2026-11-02 the production signup probe returned HTTP 307 to `/landing`, which means the last pushed production commit does not contain `/api/teacher/signup`; no production teacher, classroom, or student was created and no cleanup was needed. The current local commit also contains the CEO `after()` change but has not been pushed, so production auto-drain remains unverified until the owner deploys it.

## Scope fix evidence

The m5 DNS case previously fell through when the model returned `scope=off`. `lib/ai/dome-scope.ts` now recognizes course vocabulary and `components/server/dome-brain.ts` keeps an allowed course question on the AI path; the exact case is covered by `components/server/dome-brain.test.ts`.
