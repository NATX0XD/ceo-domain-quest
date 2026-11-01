# QA post-reflect (posttest then reflection flow)

Played headless at 390x844 and 360x740 with test students rf390/rf360 (deleted after). Shots in 390/ and 360/.
Flow verified: /reflect before posttest -> redirected to /posttest (waiting) -> teacher opens switch -> posttest auto-continued (poll 4s) -> 10 items -> result -> /reflect 5 steps -> submit -> finish. 5 reflections saved (reflect-feel, -1, -conf, -2, -3).

Automated per-state audit (17 states x 2 sizes): tap target <44px = 0, clipped button text = 0, wrapped CTA = 0, covered buttons = 0 (only pre-existing /map boss entry sits under bottom nav at scroll 0), console errors = 0.
Words per screen: waiting 4-7, quiz 21-33, result 14-16, reflect steps 10-18 (was 100+ with StageLine/FlowNote/DomeTip/helper stacks).
Progress indicators: 1 per flow (count pill on wood sign). Nav pair: 1 (back + next in footer).
Chrome (sign + clock + footer) ~ 20% of 844. Hero panel >= 60%.
