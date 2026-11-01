# QA round 4 — real UI playthrough

Viewportหลัก: Chrome headless, 390×844, new student `qa4-*`, room `UAT777`, UI-only join/setup/play. Teacher account `kru@uat.local` was available and the teacher login form was exercised. Exact `qa4-*` students were deleted after the run.

Verdict: **blocker=1 · major=0 · minor=0 · playthrough=FAIL**

| id | sev | screen | defect | evidence png | suggested fix |
|---|---|---|---|---|---|
| QA4-01 | blocker | Full journey / m1→m4→CEO→certificate | The requested single real playthrough did not reach m4, CEO proposal approval, reflection, or certificate. The run reached the real m1 learning question and separately verified pretest, profile, teacher login, posttest window, and result gating; the final result still showed 0/15 stars and an unsubmitted proposal. This is a failed acceptance run, not counted as a confirmed new product defect without a clean re-run. | [06-m1-result-390.png](qa4/06-m1-result-390.png), [19-certificate-390.png](qa4/19-certificate-390.png) | Re-run from a freshly initialized UAT session with the pretest window enabled, then continue only after each m1 warm-up answer visibly advances; retain the per-step state log until the CEO approval transition is proven. |

## Recheck matrix

| earlier item | 390 result | 360 result |
|---|---|---|
| m1 main-question overlap (MQ1) | Not reached in this run; m1 warm-up question rendered cleanly in the captured 390 state. | Not reverified because the run did not reach m1 main question. |
| result sheet off-screen (S1r) | Not opened in this run. | Not reverified. |
| profile card clipping (PF1) | Profile loaded and its wizard was reachable; no confirmed clipping recorded. | Not reverified. |
| map boss/banner and island badge (H1/H2) | Map screenshot captured; no clipping recorded in the 390 first viewport. | 360 student shell/home captured; map-specific H1/H2 not reverified. |
| m2 tile feedback / expired clock (M2d/M6) | Not reached. | Not reached. |
| m4 board and picked extension (M4g/NF1) | Not reached. | Not reached. |

## Verified UI states

- Join/setup completed through the UI with a new `qa4-*` student.
- Pretest completed through all 10 questions in one run when the pretest link was available.
- Profile wizard rendered and accepted choices through the UI.
- Teacher login form accepted the seeded account; teacher board loaded.
- Teacher posttest switch was exercised; student posttest opened and rendered all 10 questions.
- Result gate rendered the pending proposal/certificate state without claiming completion.

Screenshots and audit JSON are in [qa4/](qa4/).
