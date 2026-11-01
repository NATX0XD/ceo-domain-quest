# QA round 3 — real UI playthrough

Date: 2026-11-02 · Chrome headless · 390×844 primary viewport · room `UAT777` · temporary students `qa3-*` (all deleted at end)

Verdict: blocker=0 · major=1 · minor=0 · playthrough=FAIL

The run used the UI only: join, intro, setup, pretest, profile, m1 warm-up, mode popup, “ดู” mode, 8-scene story, and both CEO chat prompts. It did not reach m2–m4, CEO proposal, teacher approval, posttest, reflection, or certificate. The run stopped while the second free-text m1 answer remained in the async “กำลังตรวจคำตอบ” state; this is recorded as a playthrough failure, not treated as a pass.

| id | sev | screen | defect | evidence png | suggested fix |
|---|---|---|---|---|---|
| QA3-01 | major | m1 CEO chat → second free-text answer, 390×844 | After submitting the second chat answer, the UI remained on the chat screen with the primary control reading `กำลังตรวจคำตอบ` alongside `ส่งคำตอบ`; the run could not advance to the main question within the observed wait window. Confirm whether this is normal grading latency or a stuck state, and provide a clear loading/timeout/retry path. | [qa3/26-m1-main-question.png](qa3/26-m1-main-question.png), [qa3/27-m1-main-question.png](qa3/27-m1-main-question.png) | Disable duplicate submit while grading, show explicit progress/error state, and transition automatically when grading completes; add a bounded retry if the grading request does not resolve. |

## Earlier blocker/major recheck status

The 390 run reached the m1 mode popup and scene flow successfully. The requested 360px mission recheck and later full-game screens were not completed after the m1 chat grading stop, so earlier findings for m1 main-question at 360, map 360, m4, CEO, teacher approval, posttest, reflection, and certificate remain unverified in this round. Existing prior reports should not be interpreted as rechecked by this run.

## Cleanup

All students matching the exact `qa3-*` prefix in `UAT777` were deleted after the run. No product code was edited.
