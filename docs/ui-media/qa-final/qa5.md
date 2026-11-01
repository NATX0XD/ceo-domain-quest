# QA round 5 — segmented real UI playthrough

Date: 2026-11-02 · Headless Chrome · primary 390×844 · alternate 360×740 · room `UAT777` · temporary student `qa5-58285870` (deleted at end)

Verdict: **blocker=0 · major=0 · minor=0 · playthrough=PASS**

The run used separate persistent browser scripts and resumed each segment with `POST /api/join/resume`; screenshots were reviewed from the rendered UI. No product code or progress rows were directly edited. Teacher posttest state was opened through the teacher UI and reverted to its original closed state.

| segment | result | evidence |
|---|---|---|
| S1 join, shop setup, pretest | PASS | [s1-01.png](qa5/s1-01.png)–[s1-23.png](qa5/s1-23.png); profile and pretest completed |
| S2 m1 “ดู” + 360px “ลงมือทำ” | PASS | [s2-18.png](qa5/s2-18.png) alternate 360 activity; [s2-35.png](qa5/s2-35.png) result; [s2-36.png](qa5/s2-36.png) map 3/3 |
| S3 m2 “อ่าน” | PASS | [s3-06.png](qa5/s3-06.png) result; [s3-07.png](qa5/s3-07.png) map 3/3 |
| S4 m3 Pixel Counter | PASS | [s4-23.png](qa5/s4-23.png) 100/100, 4/4 customers, tags 100%; [s4-27.png](qa5/s4-27.png) mission result |
| S5 m4 registrar | PASS | [s5-16.png](qa5/s5-16.png) explanation 8/10; [s5-17.png](qa5/s5-17.png) “รับใบรับรองจดชื่อเว็บ”, 90/100; [s5-18.png](qa5/s5-18.png) map 3/3 |
| S6 CEO proposal + teacher approval | PASS | [s6-04.png](qa5/s6-04.png) submitted; [s6-07.png](qa5/s6-07.png) teacher UI confirmation; [s6-08.png](qa5/s6-08.png) student sees approved, 4/4 |
| S7 posttest, reflection, certificate | PASS | [s7-12.png](qa5/s7-12.png) posttest submitted; [s7-18.png](qa5/s7-18.png) reflection complete; [s7-19.png](qa5/s7-19.png) certificate |

## Defects

| id | sev | screen | defect | evidence | fix |
|---|---|---|---|---|---|
| — | — | — | No reproducible human-UI product defects found. | All requested screens and transitions completed through the UI. | — |

## Script-only recoveries

The segmented scripts needed selector/timing corrections for slow join hashing, dynamic shop-name pieces, intro-to-game buttons, registrar quiz sheets/route cards, and teacher tooltip-name strictness. Each was corrected in the QA scripts and rerun; none blocked a human UI flow.

Cleanup completed: exact student `qa5-58285870` deleted; teacher posttest toggle reverted to `false`; session cookie removed.
