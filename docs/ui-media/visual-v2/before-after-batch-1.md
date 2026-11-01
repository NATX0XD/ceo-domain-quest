# Batch 1 screenshot pairs

The pair set is intentionally kept beside the visual-v2 audit. Existing owner/audit
images are the before state; fresh headless-Chrome captures are the after state.

- Join 390: `ux-audit-6/join-empty-390.png` → `output/playwright/join-390x844-after.png`
- Join 360: `ux-audit-6/join-empty-360.png` → `output/playwright/join-360x740-after.png`
- Profile: `ux-audit-6/profile-s1-q2-answered-390.png` → pending authenticated capture

The pending pair is not marked as pass because a sign-in session is required to
render the multi-step profile flow.
