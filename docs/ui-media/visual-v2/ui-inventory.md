# UI/ inventory

Reviewed the supplied `UI/` directory before student-side changes. The files
below are grouped only where the numbered sequence is one visual set; every
source file remains named so extraction and reuse are traceable.

| File | What it is | Screen/component | Status |
|---|---|---|---|
| `Welcome/bg.png` | Bright island/sea background | `/`, `/intro` scene | used as reference; extract |
| `Welcome/Dome.png` | Official Dome cutout | welcome/intro hero | extract |
| `Welcome/effect.png` | Sparkle/light overlay | welcome/intro decoration | extract |
| `Welcome/logo.png` | Product logo artwork | `/` hero | extract |
| `Welcome/option.png` | Welcome option artwork | `/` CTA/choice | to-build |
| `02 — เข้าสู่ห้องเรียน/bg.png` | Join background | `/join` scene | extract |
| `02 — เข้าสู่ห้องเรียน/กรอบ.png` | Join frame/panel | `/join` form | extract |
| `02 — เข้าสู่ห้องเรียน/ปุ่ม.png` | Glossy button art | `/join` footer action | extract |
| `02 — เข้าสู่ห้องเรียน/ป้าย.png` | Wood title plaque | `/join` title | extract |
| `03 คุยกับโดม/bg.png` | Mission-map background | `/dome`, `/map` | used as reference; extract |
| `03 คุยกับโดม/1.png` | Map state, unlocked mission 1 | `/map` | used as reference |
| `03 คุยกับโดม/2.png` | Map state variant | `/map` | used as reference |
| `03 คุยกับโดม/3.png` | Map state variant | `/map` | used as reference |
| `03 คุยกับโดม/4.png` | Map state variant | `/map` | used as reference |
| `03 คุยกับโดม/ปุ่ม.png` | Map/action button art | `/map` | extract |
| `03 คุยกับโดม/แชท.png` | Dome chat bubble art | `/dome`, mission result | extract |
| `ภารกิจที่ 1/map.png` | Approved mission map composition | `/map` | used as visual source |
| `ภารกิจที่ 1/popup.png` | Three-mode selection popup | mission mode choice | extract; rebuild text HTML |
| `mascot/dome-sheet-official.jpg` | Official Dome pose sheet | all student screens | crop/extract poses |
| `messageImage_1793467941503.jpg` | Supporting scene/reference | intro/setup | used as reference |
| `messageImage_1793526248996.jpg` | Supporting scene/reference | intro/setup | used as reference |
| `LINE_ALBUM_กราฟิก_261101_1.jpg` | Wide button/banner reference | shared student UI | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_2.jpg` | Wide plaque/panel reference | shared student UI | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_3.jpg` | Portrait frame reference | join/profile | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_4.jpg` | Portrait scene reference | intro/setup | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_5.jpg` | Mascot/popup reference | Dome dialog | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_6.jpg` | Landscape scene reference | mission scenes | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_7.jpg` | Portrait scene reference | intro/setup | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_8.jpg` | Portrait scene reference | intro/setup | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_9.jpg` | Portrait scene reference | intro/setup | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_10.jpg` | Portrait scene reference | intro/setup | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_11.jpg` | Portrait scene reference | intro/setup | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_12.jpg` | Mascot sheet/reference | Dome | crop/extract |
| `LINE_ALBUM_กราฟิก_261101_13.jpg` | Portrait scene reference | intro/setup | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_14.jpg` | Landscape scene reference | mission scenes | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_15.jpg` | Landscape scene reference | mission scenes | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_16.jpg` | Landscape scene reference | mission scenes | extract if needed |
| `LINE_ALBUM_กราฟิก_261101_17.jpg` | Mascot/character reference | Dome | crop/extract |
| `LINE_ALBUM_กราฟิก_261101_18.jpg` | Portrait scene reference | intro/setup | extract if needed |
| `ภารกิจที่ 2/LINE_ALBUM_กราฟิก 2 งงๆ_261101_1.jpg` through `_38.jpg` | Mission 2 storyboard, portrait lesson frames, and UI references | `/mission/m2` modes | to-build; preserve sequence |
| `ภารกิจที่ 2/example use flow/LINE_ALBUM_กราฟิก 2 งงๆ_261101_39.jpg` through `_61.jpg` | Mission 2 example flow, wide scene frames, and result/chat references | `/mission/m2` flow/result | to-build; preserve sequence |
| `1015.mp4` | Source motion reference | intro/mission motion | inspect; not yet extracted |
| `.DS_Store` files | Finder metadata | none | ignore |

The first batch reuses the existing world tokens and moves the supplied Dome
and plaque language into the profile/join composition without baking new Thai
copy into images.
