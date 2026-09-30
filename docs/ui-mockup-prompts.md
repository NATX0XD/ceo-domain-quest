# Prompt ภาพ UI/UX ทุกหน้า — วางแล้วยิงได้เลย (Google Flow)

30 หน้า · นักเรียน 21 · ครู 9 · **ทุกบล็อกสมบูรณ์ในตัวเอง** ก๊อปทั้งบล็อกวางช่อง prompt ได้เลย ไม่ต้องเอาอะไรมาต่อหน้า

ค่าสี ความโค้ง เงา ดึงจาก `app/globals.css` ของจริง

**ตั้งค่าใน Google Flow ก่อนยิง**
- หน้านักเรียน ตั้ง aspect ratio **9:16** · หน้าครู ตั้ง **16:9**
- เลือกโหมดภาพนิ่ง (Imagen / Frames) ไม่ใช่วิดีโอ
- ยิงหน้าละ 2-3 ใบแล้วเลือก
- ตัวหนังสือไทยจะเพี้ยน ทุกโมเดลเป็นเหมือนกัน ถ้าต้องใช้ในเอกสารส่งให้พิมพ์ทับใน Figma/Canva ทีหลัง

---

# ฝั่งนักเรียน — 21 หน้า (9:16)

## S01 `/join` เข้าห้องเรียน

```
High-fidelity mobile app UI screenshot, straight-on, no device frame, no hands, no desk. iPhone screen 390x844 portrait, the entire screen fits with no scrolling. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, spark orange #ED7A2D, reward gold #EAB532, warm cream background #FDF9F1, white cards #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Corner radii: chips 8px, inputs 12px, small buttons 16px, primary buttons 20px, cards 24px, panels 32px. Soft layered shadows at 8 percent navy only, never hard black; 2px #7651D3 focus ring. Style: friendly Thai vocational-school learning game, cheerful cartoon flat illustration, rounded shapes, generous whitespace, touch targets at least 44px, exactly one primary button, bold rounded Thai-style typography. Background: warm cream with faint rounded confetti shapes and pale purple corner blobs at 10 percent opacity.
SCREEN — welcome and join a classroom. Top third: a large cartoon mascot, a friendly purple dome-shaped robot secretary with big round eyes and a small bow tie, floating on a pale purple blob. Middle: one white card with 24px radius and a soft shadow, holding a large rounded nickname input with a pencil glyph on the left, and below it four separate 56px square PIN boxes in sunken cream with 12px radius, the first box focused with a 2px purple ring and a blinking caret. Bottom sticky bar: one full-width 20px-radius button in brand purple with a bold white label, and a small muted helper line beneath it. FEEL: the very first touch, warm and welcoming, zero clutter, nothing to read twice.
```

## S02 `/intro` เปิดเรื่อง

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone screen 390x844 portrait, entire screen fits with no scrolling. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, spark orange #ED7A2D, reward gold #EAB532, warm cream #FDF9F1, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770. Radii: chips 8px, inputs 12px, buttons 20px, cards 24px, panels 32px. Soft layered shadows at 8 percent navy only. Style: friendly Thai vocational-school learning game, cartoon flat illustration, rounded shapes, generous whitespace, one primary button, bold rounded Thai-style typography.
SCREEN — story opening. Top 55 percent: a full-bleed cartoon illustration of a small empty shop lot under a purple evening sky with floating confetti and a tiny signboard with no name yet, the illustration block has 32px rounded bottom corners. Middle: a white sheet overlapping the illustration by 24px, holding one bold heading line and two muted paragraph lines. Just above the bottom bar: three page dots, the first an elongated purple pill, the other two small grey circles. Bottom sticky bar: one full-width spark orange #ED7A2D button with a right chevron. FEEL: a storybook first page, cinematic, makes you want to tap next.
```

## S03 `/pretest` แบบทดสอบก่อนเรียน

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone screen 390x844 portrait, entire screen fits with no scrolling, sticky top bar and sticky bottom action bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, pale green #CBF3DE, warm cream #FDF9F1, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, inputs 12px, cards 24px, primary buttons 20px. Soft layered shadows at 8 percent navy; 2px #7651D3 focus ring. Style: friendly Thai vocational-school learning game, cartoon flat, rounded, generous whitespace, one primary button, bold rounded Thai-style typography, warm cream background with faint confetti at 10 percent opacity.
SCREEN — pre-lesson quiz, one question at a time. Sticky top: a slim quest-green progress bar filled to 20 percent and a small counter chip in pale green reading one of five. Content: a white question card with 24px radius holding a bold two-line question. Below it four answer options as separate 16px-radius white cards with hairline borders, each with a 24px circular radio on the left; the second option is selected — pale purple fill, 2px purple border, filled radio dot. Bottom sticky bar: a full-width purple button, shown at 40 percent opacity because no answer is chosen yet. FEEL: calm and unhurried, no timer, one decision on screen.
```

## S04 `/check` เช็กความเข้าใจ

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, entire screen fits with no scrolling, sticky top and bottom bars. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, pale green #CBF3DE, warm cream #FDF9F1, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, inputs 12px, cards 24px, buttons 20px. Soft layered shadows at 8 percent navy. Style: friendly Thai vocational-school learning game, cartoon flat, rounded, generous whitespace, bold rounded Thai-style typography, cream background with faint confetti.
SCREEN — quick understanding check with a confidence rating. Sticky top: green progress bar and a small counter chip reading question two of four. Content: a white question card, then four white answer cards each with a circular radio, the third one selected in pale purple. Under them a confidence strip on a sunken-cream panel with 16px radius, holding a three-stop slider with a purple thumb sitting on the middle stop, and three tiny cartoon face glyphs under the stops going from unsure to sure. Bottom sticky bar: full-width purple primary button. FEEL: adds self-rating without adding pressure, the slider must look playful not clinical.
```

## S05 `/profile` รู้จักตัวเอง

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky bottom action bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, reward gold #EAB532, warm cream #FDF9F1, white #FFFFFF, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, cards 24px, buttons 20px. Soft layered shadows at 8 percent navy. Style: friendly Thai vocational-school learning game, cartoon flat illustration, rounded shapes, generous whitespace, bold rounded Thai-style typography, cream background with pale purple corner blobs.
SCREEN — learner picks how they like to learn. Top: an 88px circular cartoon avatar with a gold ring, and a name chip underneath. Content: a 2x2 grid of four selectable cards, each white with 24px radius, holding a large flat cartoon glyph on top — a play button for video, a comic panel, a book for text, a headphone for audio — with a short label under each. The top-left card is selected: pale purple fill, 2px purple border, small white check badge in its top-right corner and a slight lift shadow. Bottom sticky bar: full-width purple button. FEEL: character creation, every card equally attractive so no option reads as the correct answer.
```

## S06 `/setup` ตั้งร้านของฉัน

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky bottom action bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, pale green #CBF3DE, spark orange #ED7A2D, warm cream #FDF9F1, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, inputs 12px, thumbnails 20px, cards 24px, buttons 20px. Soft layered shadows at 8 percent navy; 2px #7651D3 focus ring. Style: friendly Thai vocational-school learning game, cartoon flat illustration, rounded, generous whitespace, bold rounded Thai-style typography, cream background with faint confetti.
SCREEN — the learner creates their own shop. Block one: a rounded text input for the shop name with a small storefront glyph on the left. Block two: a horizontal row of four 96px square business-type cards with cartoon illustrations — bakery, coffee shop, clothing store, phone repair — with 20px radius; the coffee card is selected with a 2px purple border and a lift shadow, the row hints a fifth card cut off at the right edge. Block three: a domain-name input with a grey "www." prefix chip on the left and a green circular check badge with a white tick on the right, plus a short green helper line underneath. Bottom sticky bar: full-width quest green #009D6B primary button. FEEL: this is the moment the learner owns something, it should feel like naming a pet.
```

## S07 `/home` หน้าแรกของผู้เรียน

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky top bar and sticky bottom tab bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, pale green #CBF3DE, spark orange #ED7A2D, reward gold #EAB532, warm cream #FDF9F1, white #FFFFFF, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, cards 24px, big cards 32px, buttons 20px. Soft layered shadows at 8 percent navy plus one stronger lift shadow on the hero card. Style: friendly Thai vocational-school learning game, cartoon flat illustration, rounded, generous whitespace, exactly one primary button, bold rounded Thai-style typography, cream background with pale purple corner blobs and faint confetti.
SCREEN — learner home, the map of what to do next. Sticky top: a greeting line on the left and a 40px gold progress ring on the right. Hero: one large white card with 32px radius and a lift shadow, holding a small stage badge chip in pale green, a bold one-line instruction, and a full-width spark orange button inside the card; a small cartoon purple dome mascot peeks over the card's top-right corner. Below the hero: two smaller secondary cards side by side, flat white, no shadow, muted labels and thin outline glyphs. Bottom: a sticky four-tab navigation bar, the active tab in purple with a filled glyph and a label, the other three muted grey outline glyphs. FEEL: exactly one obvious next action, everything else deliberately quiet.
```

## S08 `/map` แผนที่ภารกิจ

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky bottom tab bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, pale green #CBF3DE, reward gold #EAB532, warm cream #FDF9F1, white #FFFFFF, ink navy #2C2644, muted ink #5B5770, grey #B8B5C6. Radii: chips 8px, cards 24px. Soft layered shadows at 8 percent navy. Style: friendly Thai vocational-school learning game, cartoon flat illustration, rounded shapes, bold rounded Thai-style typography.
SCREEN — the mission map. Background: a cartoon town map on cream, with pale green grass blobs, tiny rounded buildings, a small tree and a cloud, all flat and simple. Content: a winding dashed path running from the bottom to the top linking six circular level nodes. Nodes one to three are completed — quest green fill, a white tick inside, three small gold stars underneath each. Node four is the current one — brand purple, noticeably larger, with a white pulsing ring around it and the small purple dome mascot standing beside it pointing at it. Nodes five and six are locked — grey fill with a padlock glyph and dimmed grey stars. Bottom: sticky four-tab navigation bar with the map tab active in purple. FEEL: a board game you want to keep playing, instantly obvious where you are.
```

## S09 `/mission/[id]` หน้าภารกิจ

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky top bar and sticky bottom action bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, reward gold #EAB532, warm cream #FDF9F1, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, inputs 12px, small buttons 16px, cards 24px, buttons 20px. Soft layered shadows at 8 percent navy; 2px #7651D3 focus ring. Style: friendly Thai vocational-school learning game, cartoon flat, rounded, generous whitespace, one primary button, bold rounded Thai-style typography, cream background with faint confetti.
SCREEN — playing one mission. Sticky top: a back chevron on the left, a mission title in the centre, and a gold star counter chip on the right showing two filled stars and one empty. Content: a white task card with 24px radius holding a bold prompt line and two muted supporting lines, then a gold pill hint button with a lightbulb glyph aligned to the right, then a large rounded answer input with a purple focus ring and a soft placeholder. Bottom sticky bar: a full-width purple submit button with a paper-plane glyph. FEEL: focused, a single task, the hint is reachable but visually quieter than the answer field.
```

## S10 `/station-b` สถานีเสริม

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky bottom action bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, pale green #CBF3DE, warm cream #FDF9F1, white #FFFFFF, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, cards 24px, buttons 20px. Soft layered shadows at 8 percent navy. Style: friendly Thai vocational-school learning game, cartoon flat, rounded, bold rounded Thai-style typography, cream background with faint confetti.
SCREEN — a drag-to-match practice station. Content: a two-column matching board. The left column holds four pale purple chips with short domain-name text, the right column holds four pale green chips with short meaning text. Three curved purple connector lines are already drawn between matched pairs. The fourth pair is unconnected and highlighted with a dashed purple outline and a small drag-handle glyph on the draggable chip, with a faint dotted trail showing where it would go. Bottom sticky bar: full-width purple check button. FEEL: hands-on puzzle, obvious what connects to what, satisfying.
```

## S11 `/dome` คุยกับเลขาโดม

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky top bar and sticky bottom input bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, warm cream #FDF9F1, white #FFFFFF, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, inputs 12px, cards 24px, speech bubbles 40px. Soft layered shadows at 8 percent navy. Style: friendly Thai vocational-school learning game, cartoon flat illustration, rounded, bold rounded Thai-style typography, cream background with pale purple corner blobs.
SCREEN — chatting with the AI shop secretary. Sticky top: a round cartoon avatar of a purple dome-shaped robot with a small green online dot, a name line, and a back chevron. Content: three chat bubbles — assistant bubbles on the left in white with 40px radius and a small tail, learner bubbles on the right in brand purple with white text, and a typing indicator of three grey dots under the last assistant bubble. Just above the input: a horizontal row of three rounded quick-reply chips in pale purple with purple text. Bottom sticky bar: a rounded text input plus a circular purple send button with a paper-plane glyph. FEEL: a friendly helper, warm and human, never a robot terminal.
```

## S12 `/knowledge` คลังความรู้

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky top search bar and sticky bottom tab bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, pale green #CBF3DE, warm cream #FDF9F1, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, inputs 12px, thumbnails 20px, cards 20px. Soft layered shadows at 8 percent navy. Style: friendly Thai vocational-school learning game, cartoon flat, rounded, generous whitespace, bold rounded Thai-style typography, cream background.
SCREEN — the knowledge library. Sticky top: a rounded search field on sunken cream with a magnifier glyph. Directly under it: a horizontal row of four filter chips, the first active in brand purple with white text, the other three outlined in hairline grey. Content: a vertical list of five article rows, each a white card with 20px radius holding a 64px rounded cartoon thumbnail on the left, a bold title line, a muted one-line summary, and a small reading-time chip in pale green on the right. Bottom: sticky four-tab navigation bar. FEEL: browsable and tidy, like a well-kept bookshelf, never a wall of text.
```

## S13 `/my-site` เว็บร้านของฉัน

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky bottom action bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, spark orange #ED7A2D, reward gold #EAB532, warm cream #FDF9F1, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, small buttons 16px, cards 24px, buttons 20px. Soft layered shadows at 8 percent navy plus one lift shadow on the preview frame. Style: friendly Thai vocational-school learning game, cartoon flat illustration, rounded, bold rounded Thai-style typography, cream background with confetti.
SCREEN — previewing the shop website the learner built. Content: a rounded browser-frame card with 24px radius, a grey URL pill at the top showing a domain, and inside it a miniature cartoon storefront webpage — a coffee-shop banner illustration, a 2x2 product grid with price chips, and a thin footer strip. Under the frame: a row of three small outline buttons with pencil, palette and eye glyphs. Bottom sticky bar: a full-width quest green share button with a link glyph. FEEL: a proud reveal, the preview frame is clearly the hero of the screen.
```

## S14 `/board` กระดานห้อง

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky top bar and sticky bottom tab bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, reward gold #EAB532, alert red #E23A3D, warm cream #FDF9F1, white #FFFFFF, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, tiles 16px, cards 24px. Soft layered shadows at 8 percent navy. Style: friendly Thai vocational-school learning game, cartoon flat, rounded, bold rounded Thai-style typography, cream background with faint confetti.
SCREEN — the live class board seen by a learner. Sticky top: a room-code chip in pale purple and a small red live dot with a short label. Content: a four-column grid of twenty small tiles, each white with 16px radius holding a tiny cartoon avatar, a one-line nickname, and a row of three progress dots. Three tiles wear a small gold star badge in the corner. One tile is the learner's own and is outlined with a 2px purple border and lifted slightly. Bottom: sticky four-tab navigation bar. FEEL: class energy and belonging, clearly not a leaderboard, nobody is ranked last.
```

## S15 `/ceo` ด่านบอส

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky top bar and sticky bottom action bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, spark orange #ED7A2D, deep orange #C3500B, reward gold #EAB532, warm cream #FDF9F1, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, inputs 12px, cards 24px, big panels 32px, buttons 20px. Soft layered shadows at 8 percent navy plus a lift shadow on the main card. Style: friendly Thai vocational-school learning game, cartoon flat, rounded, bold rounded Thai-style typography, cream background with confetti and a faint gold glow behind the card.
SCREEN — the final boss stage where the learner submits a proposal. Sticky top: a bold title with a small cartoon crown glyph and a countdown chip in pale orange on the right. Content: one white card with 32px radius holding a label line and a tall multi-line text area on sunken cream, under it a dashed-border upload box with a plus glyph and a tiny image thumbnail already added, then a checklist of four rows with rounded square checkboxes, the first two ticked in quest green. Bottom sticky bar: a full-width deep orange #C3500B button with a bold label. FEEL: the big moment of the lesson, weightier than every other screen but encouraging, not intimidating.
```

## S16 `/showcase` ผนังผลงาน

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky bottom tab bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, reward gold #EAB532, warm cream #FDF9F1, white #FFFFFF, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, cards 24px. Soft layered shadows at 8 percent navy. Style: friendly Thai vocational-school learning game, cartoon flat illustration, rounded, bold rounded Thai-style typography, cream background with confetti.
SCREEN — the class showcase wall. Content: a two-column masonry of six cards of varying heights, each white with 24px radius, holding a flat cartoon shop illustration on top — bakery, coffee, clothing, flower, game, phone repair — then a bold shop name, a muted owner nickname, and a small heart chip with a count. One card is pinned by the teacher and wears a gold ribbon folded over its top-right corner. Bottom: sticky four-tab navigation bar. FEEL: a proud gallery, celebratory, every piece of work looks good.
```

## S17 `/result` สรุปผล

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky bottom action bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, pale green #CBF3DE, reward gold #EAB532, warm cream #FDF9F1, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, cards 24px, buttons 20px. Soft layered shadows at 8 percent navy. Style: friendly Thai vocational-school learning game, cartoon flat, rounded, bold rounded Thai-style typography, cream background with confetti sprinkles.
SCREEN — end-of-lesson result. Hero: a large 160px circular progress ring in gold sitting on a pale purple blob, with a big bold number in the centre and a small label under it, confetti sprinkles scattered around it. Content: a three-row comparison card — a rule-based score row, an AI score row, and a teacher-confirmed score row — each with a small source chip, a mini horizontal bar, and a number on the right; the teacher row is highlighted in pale green with a white check badge and a slightly thicker border. Below: a four-bar horizontal chart by topic in brand purple with muted labels. Bottom sticky bar: a full-width purple continue button. FEEL: a proud, trustworthy summary; the three-source table must read as clear evidence, never as three conflicting numbers.
```

## S18 `/rewards` รางวัลและตรา

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky bottom tab bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, reward gold #EAB532, warm cream #FDF9F1, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, grey #B8B5C6. Radii: chips 8px, cards 24px, panels 32px. Soft layered shadows at 8 percent navy. Style: friendly Thai vocational-school learning game, cartoon flat illustration, rounded, bold rounded Thai-style typography, cream background with confetti.
SCREEN — the badge collection. Content: a 3x3 grid of circular badge slots on a sunken-cream panel with 32px radius. Four badges are earned — full colour with gold rims and simple cartoon glyphs inside, a star, a shop, a lightbulb, a handshake — and five are unearned, shown as dashed grey circles with a faint padlock. Under the grid: a slim gold progress bar with a small count chip on its right. Bottom: sticky four-tab navigation bar. FEEL: collectible and motivating, the empty slots should read as invitations, never as failure.
```

## S19 `/reflect` สะท้อนคิด

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky bottom action bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, warm cream #FDF9F1, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, inputs 12px, cards 24px, speech bubbles 40px, buttons 20px. Soft layered shadows at 8 percent navy. Style: friendly Thai vocational-school learning game, cartoon flat illustration, rounded, generous whitespace, bold rounded Thai-style typography, cream background with pale purple blobs.
SCREEN — end-of-lesson reflection. Top: a soft pale purple panel holding a small cartoon dome mascot illustration and a gentle question inside a white speech bubble with 40px radius and a tail pointing at the mascot. Content: a tall rounded text area in white with a subtle muted placeholder and a character-count chip in the bottom-right corner. Below it: a row of five circular face-rating buttons going from unsure to confident, the fourth selected with a 2px purple ring and scaled up slightly. Bottom sticky bar: a full-width purple submit button. FEEL: quiet and unhurried, a safe space to be honest, no score anywhere on screen.
```

## S20 `/posttest` แบบทดสอบหลังเรียน

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky top bar and sticky bottom action bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, pale green #CBF3DE, spark orange #ED7A2D, warm cream #FDF9F1, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, cards 24px, buttons 20px. Soft layered shadows at 8 percent navy. Style: friendly Thai vocational-school learning game, cartoon flat, rounded, bold rounded Thai-style typography, cream background with faint confetti.
SCREEN — post-lesson test, deliberately identical in rhythm to the pre-test. Sticky top: a green progress bar filled to 60 percent, a counter chip reading question three of five, and a small timer chip in pale orange on the right. Content: a white question card with a bold two-line question, then four white answer cards each with a circular radio on the left, the first one selected in pale purple with a filled radio. Bottom sticky bar: a full-width purple next button, fully opaque because an answer is chosen. FEEL: wearing the same clothes as the pre-test on purpose, so the before-and-after comparison feels fair.
```

## S21 `/survey` แบบสอบถามความเห็น

```
High-fidelity mobile app UI screenshot, straight-on, no device frame. iPhone 390x844 portrait, whole screen fits with no scrolling, sticky bottom action bar. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, warm cream #FDF9F1, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, cards 24px, panels 32px, buttons 20px. Soft layered shadows at 8 percent navy. Style: friendly Thai vocational-school learning game, cartoon flat, rounded, bold rounded Thai-style typography, cream background.
SCREEN — a short opinion survey. Content: one white panel with 32px radius holding six statement rows separated by 1px hairlines; each row has a short text line on the left and a five-dot Likert scale on the right, with the selected dot filled brand purple and the rest hollow grey. Bottom sticky bar: a full-width purple submit button with a small muted note above it saying this does not affect the grade. FEEL: light and quick to finish, visibly low-stakes.
```

---

# ฝั่งครู — 9 หน้า (16:9)

## T01 `/teacher` แผงคุมคาบ

```
High-fidelity desktop dashboard UI screenshot, 1440x900 landscape, straight-on, no browser chrome, no mouse cursor. Layout: a 240px left sidebar in deep purple #7651D3 with white icon-and-label rows and one active row highlighted in pale purple #EAE5FF with purple text; a 56px white top bar with the page title on the left, a rounded search field in the middle, and a notification bell with a red count badge plus a circular account avatar on the right; the content area on warm cream #FDF9F1 using a 12-column grid with 24px gaps. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, pale green #CBF3DE, spark orange #ED7A2D, reward gold #EAB532, alert red #E23A3D, white cards #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, inputs 12px, buttons 16px, cards 24px. Soft layered shadows at 8 percent navy only. Style: calm professional admin console, data-dense but never cramped, clear typographic hierarchy, Thai-style typography.
PAGE — live class cockpit, the teacher's home. Row one: four KPI stat cards, each white with 24px radius, a large bold number, a muted label underneath, and a 4px coloured accent bar on the left — green, purple, gold, and red; the red card also carries a small count badge. Row two, left two-thirds: a live student table with a sticky header row on sunken cream and eight body rows, each holding a small avatar, a nickname, a current-stage chip, a slim progress bar, a minutes-idle number, and a right-aligned outline action button; two rows are tinted pale red. Row two, right third: a sticky alert rail of four stacked cards in pale orange and pale red, each with a reason line and one short action button. Top bar extra: a large session timer chip in pale green with play and pause glyphs. FEEL: air-traffic control — the teacher must see who needs help within three seconds.
```

## T02 `/teacher/board` กระดานห้องสด

```
High-fidelity desktop dashboard UI screenshot, 1440x900 landscape, straight-on, no browser chrome. Layout: 240px deep purple #7651D3 left sidebar with white icon-and-label rows and one active row in pale purple; 56px white top bar with page title, search field, notification bell with red badge and account avatar; content area on warm cream #FDF9F1. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, spark orange #ED7A2D, alert red #E23A3D, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, tiles 20px, cards 24px. Soft layered shadows at 8 percent navy. Style: calm professional admin console, Thai-style typography.
PAGE — the live room board. Toolbar above the grid: four dropdown filter chips and a segmented control switching between grid and list view. Content: a six-column grid of twenty-four student tiles, each white with 20px radius, holding a cartoon avatar, a nickname, a small circular progress ring, and a status dot in the top-right — green for moving, orange for idle, red for stuck. The four stuck tiles carry a soft red glow ring and are sorted to the front of the grid. Right edge: a slim white legend card explaining the three dot colours. FEEL: a seating chart at a glance, colour does all the talking, no reading required.
```

## T03 `/teacher/review` ยืนยันคะแนน

```
High-fidelity desktop dashboard UI screenshot, 1440x900 landscape, straight-on, no browser chrome. Layout: 240px deep purple #7651D3 left sidebar with white rows and one active row in pale purple; 56px white top bar with title, search, bell with red badge, account avatar; content area on warm cream #FDF9F1. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, pale green #CBF3DE, reward gold #EAB532, alert red #E23A3D, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, inputs 12px, buttons 16px, cards 24px. Soft layered shadows at 8 percent navy. Style: calm professional admin console, generous line height in reading areas, Thai-style typography.
PAGE — confirming scores, a two-pane workspace. Left pane 360px wide: a scrollable list of eight submission rows, each with a checkbox, a small avatar, a nickname, a shop name, an AI-score chip in pale purple, and a status chip; the third row is selected with a pale purple fill and a 4px purple bar on its left edge. Right pane: a detail panel holding the learner's submitted text inside a sunken-cream reading block with generous line height, and under it a rubric table of four criteria rows, each with a criterion label, the AI suggestion shown as a ghosted grey number, and a stepper control with round minus and plus buttons; a running total chip in gold sits at the table's bottom-right. Panel footer: a wide quest green primary button reading confirm and an outline secondary button reading send back for revision. FEEL: the confirm button must be impossible to miss; the AI number is clearly a suggestion, the teacher clearly decides.
```

## T04 `/teacher/requests` คำขอเปลี่ยนแผน

```
High-fidelity desktop dashboard UI screenshot, 1440x900 landscape, straight-on, no browser chrome. Layout: 240px deep purple #7651D3 left sidebar with white rows and one active row in pale purple; 56px white top bar with title, search, bell with red badge, account avatar; content area on warm cream #FDF9F1. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, spark orange #ED7A2D, alert red #E23A3D, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, buttons 16px, cards 24px. Soft layered shadows at 8 percent navy. Style: calm professional admin console, Thai-style typography.
PAGE — plan-change requests from learners. Top of the content area: a segmented control with three segments — waiting, approved, declined — the first segment active and carrying a small count badge. Content: a single centred column, 880px wide, of six request cards. Each card is white with 24px radius and holds a cartoon avatar, the learner's nickname, a reason line in muted ink, a requested-level chip in pale orange, a relative timestamp, a small level stepper so the teacher can grant a different level than requested, and two right-aligned buttons — a filled quest green approve and an outline decline. FEEL: an inbox that can be emptied fast, every card decidable in one glance.
```

## T05 `/teacher/report` รายงานรายห้อง

```
High-fidelity desktop dashboard UI screenshot, 1440x900 landscape, straight-on, no browser chrome. Layout: 240px deep purple #7651D3 left sidebar with white rows and one active row in pale purple; 56px white top bar with title, search, bell with red badge, account avatar, plus a deep purple export button with a download glyph on the far right; content area on warm cream #FDF9F1 in a 12-column grid with 24px gaps. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, pale green #CBF3DE, reward gold #EAB532, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, buttons 16px, cards 24px. Soft layered shadows at 8 percent navy. Style: calm professional admin console, charts flat with soft gridlines and no 3D, Thai-style typography.
PAGE — the whole-class report. Row one: three summary cards — average score before, average after, and gain — each with a big bold number, a muted label, and a small green upward trend chip. Row two, left two-thirds: a grouped bar chart comparing before and after per topic, purple bars for before and green bars for after, light gridlines and a small legend. Row two, right third: a donut chart of learners by level with a large centred total number. Row three, full width: a statistics table with a sunken-cream header row and columns for t, degrees of freedom, p, Cohen's d and Hedges' g, each value followed by a small copy-to-clipboard glyph button. FEEL: something a teacher can screenshot straight into a report; the numbers must look authoritative and unambiguous.
```

## T06 `/teacher/student` รายงานรายคน

```
High-fidelity desktop dashboard UI screenshot, 1440x900 landscape, straight-on, no browser chrome. Layout: 240px deep purple #7651D3 left sidebar with white rows and one active row in pale purple; 56px white top bar with title, search, bell with red badge, account avatar; content area on warm cream #FDF9F1. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, pale green #CBF3DE, reward gold #EAB532, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, buttons 16px, cards 24px. Soft layered shadows at 8 percent navy. Style: calm professional admin console, charts flat with soft gridlines, Thai-style typography.
PAGE — the report for one learner. Header card: a 72px cartoon avatar, the nickname, a shop-name chip, and four inline stat pills — time spent, total stars, hints requested, wrong answers. Below it: a horizontal journey timeline, a straight line with eight milestone dots, the completed ones in quest green with white ticks, the current one in brand purple and larger with a ring, each dot labelled underneath with a short time. Below that: a white card holding a line chart of score over the period with a soft purple area fill. Bottom: a table of six mission rows with gold star glyphs, an attempts count, a duration, and a small outline note button on each row. FEEL: the story of one learner, readable straight down the page.
```

## T07 `/teacher/showcase` ผนังผลงานฝั่งครู

```
High-fidelity desktop dashboard UI screenshot, 1440x900 landscape, straight-on, no browser chrome. Layout: 240px deep purple #7651D3 left sidebar with white rows and one active row in pale purple; 56px white top bar with title, search, bell with red badge, account avatar; content area on warm cream #FDF9F1. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, reward gold #EAB532, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, buttons 16px, cards 24px. Soft layered shadows at 8 percent navy. Style: calm professional admin console with a warmer gallery feel, Thai-style typography.
PAGE — the work wall as the teacher sees it. Toolbar: a rounded search field, three filter chips, and a sort dropdown aligned right. Content: a four-column grid of twelve work cards, each white with 24px radius holding a flat cartoon shop illustration, a bold shop name, a muted owner nickname, and a score chip in pale purple; one card shows a hover state with two circular glyph buttons floating over it, a pin and an open-in-new. Two cards are already pinned, wearing a gold ribbon folded over the top-right corner, and they sit first in the grid. FEEL: a curation tool — pinning is clearly the point of the page.
```

## T08 `/teacher/settings` ตั้งค่า

```
High-fidelity desktop dashboard UI screenshot, 1440x900 landscape, straight-on, no browser chrome. Layout: 240px deep purple #7651D3 left sidebar with white rows and one active row in pale purple; 56px white top bar with title, search, bell with red badge, account avatar; content area on warm cream #FDF9F1 holding a single centred 720px column. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, spark orange #ED7A2D, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, inputs 12px, buttons 16px, cards 24px. Soft layered shadows at 8 percent navy. Style: calm professional admin console, deliberately plain, every control explains itself, Thai-style typography.
PAGE — class settings. The centred column holds three grouped white cards. Group one, AI: three rows, each with a bold label, a muted one-line explanation of what happens when it is off, and a large pill toggle on the right; the master AI toggle is on and shown in quest green. Group two, time and deadlines: two rows with time-picker fields on sunken cream. Group three, privacy: two more toggle rows. A sticky footer strip inside the column holds a muted unsaved-changes hint on the left and a deep purple save button on the right. FEEL: boring on purpose; every switch states its consequence in one line so nothing is switched by accident.
```

## T09 `/teacher/demo` โหมดสาธิต

```
High-fidelity desktop dashboard UI screenshot, 1440x900 landscape, straight-on, no browser chrome. Layout: 240px deep purple #7651D3 left sidebar with white rows and one active row in pale purple; 56px white top bar with title, search, bell with red badge, account avatar; content area on warm cream #FDF9F1. Palette: brand purple #8A69E8, deep purple #7651D3, pale purple #EAE5FF, quest green #009D6B, spark orange #ED7A2D, deep orange #C3500B, alert red #E23A3D, white #FFFFFF, sunken cream #F5F0E4, ink navy #2C2644, muted ink #5B5770, hairline #DEDCEB. Radii: chips 8px, buttons 16px, cards 24px. Soft layered shadows at 8 percent navy. Style: calm professional admin console, the one dangerous page, Thai-style typography.
PAGE — demo mode and demo-data reset. Top of the content area: a full-width warning banner in pale orange with a triangle glyph, a bold headline, and one explanatory line stating that only demo data is affected. Below, side by side: a primary white card with three explanation lines and a large deep orange #C3500B button, and a secondary white card listing five demo-data rows, each with a label, a count chip, and a small outline trash glyph button. At the bottom: a red-outlined note card stating that real classrooms are never touched. FEEL: a dangerous action made to look obviously safe and obviously limited in scope.
```

---

## หมายเหตุ

- ยิงหน้าละ 2-3 ใบแล้วเลือก แต่ละใบต่างกันเสมอ
- ถ้าภาพออกมาเหมือน wireframe เกินไป ให้เติมท้าย prompt ว่า `rich colour, finished product design, not a wireframe`
- ถ้าตัวหนังสือรกเกินไป ให้เติม `minimal legible text, short labels only`
- **ถ้าต้องตรงกับระบบจริง 100%** อย่าใช้ AI — `npx tsx scripts/capture-screenshots.ts` ถ่ายหน้าจริงครบทุกหน้า
