# Pixel Counter / Pixel Boss asset manifest (m3 + m4)

Design refs: m3-*.png (Pixel Counter), m4-*.png (Pixel Boss). Style: pixel-art (16-bit, crisp, warm office light), purple UI accents (#6b4fd8), THNIC-like registry office (use generic sign text "สำนักทะเบียนโดเมน" / globe logo, no real THNIC logo).
Mascot: design shows a robot; we use OUR Dome (purple fluffy monster, horns, teal tie, brown satchel — public/dome/mascot/*.webp) drawn in the same pixel style.

All files under public/learn/pixel/. Code must work with fallbacks when a file is missing (use existing art) so art can drop in later.

## Backgrounds (1080x1920 webp, no baked text except small signs)
- bg-counter.webp       counter view: desk front, queue area, office behind (m3 main + m4 office)
- bg-left-manual.webp   turned left: bookshelf with labeled shelves area + desk space for open manual (UI overlays the manual)
- bg-right-dome.webp    turned right: Dome's desk with laptop, empty space top for speech bubble
- bg-boss-door.webp     m4 opening: office with big BOSS door glowing purple
- bg-boss-office.webp   m4 boss desk scene (CEO behind desk area left empty for sprite)
- bg-calendar.webp      m4 time-skip: desk with big tear-off calendar (date drawn by UI)

## Sprites (transparent webp, 768x1024 half/three-quarter body, facing viewer, consistent scale)
Customers (name/gender fixed — matches m3 script content/learn-counter.json; male = ครับ, female = ค่ะ):
- c1 น้องมายด์       female teen ~17, messy bun, cream sweater with purple stripes, tote bag, holds phone  (sells phone cases online alone at home; asks mindcase.go.th) — speaks ค่ะ
- c2 พี่ต้น          male late 20s, short hair, green/khaki shirt + gardening apron, holds company papers (บริษัท ต้นกล้าเทรดดิ้ง จำกัด, plants & garden tools; asks tonkla.co.th) — speaks ครับ
- c3 ลุงชัย          male ~60, grey hair, glasses, simple button shirt, carpenter / wood-carver vibe (holds a wooden ladle) (ร้านเหลาไม้ทำของใช้ในบ้าน, one-man shop; asks ลุงชัย.ไทย) — speaks ครับ (calls player หลาน)
- c4 คุณนิดา         female 30s, neat office blouse + company lanyard, holds a snack box + documents (ตัวแทนบริษัท สุขใจฟู้ด จำกัด, boxed Thai snacks; asks sukjai.co.th) — speaks ค่ะ
- c5 ครูแอน          female 30s teacher, polite, holds school letter (spare, not in the current 4-customer shift; low priority)
- c6 ป้าส้ม          female 50s, som-tam stall owner, apron, friendly (tutorial customer, ร้านส้มตำ; asks somtam.co.th) — speaks จ้า/ค่ะ
Each: c{n}-neutral.webp, c{n}-happy.webp, c{n}-confused.webp, c{n}-upset.webp
Also c{n}-walk.webp (side/three-quarter walking pose for walk-in animation)
Dome pixel: dome-neutral, dome-happy, dome-thinking, dome-cheer (.webp)
Boss: boss-neutral.webp, boss-smile.webp (bearded CEO, glasses, dark suit)
Staff (optional): clerk.webp (counter clerk, back/side view)

## UI bits
- stamp-approve.webp, stamp-new.webp, stamp-more.webp, stamp-reject.webp (rubber stamps green/purple/orange/red, top view)
- queue-board.webp (digital queue number board, number drawn by UI)

## m4 extra (Pixel Boss — optional, code already falls back when missing)
All transparent webp, same pixel style and purple accent, no baked text. Code path in brackets is the fallback used until the file exists.
- dome-worried.webp      Dome worried/sweating, hands together (time-skip "จะหมดอายุในอีก 30 วัน") [dome-thinking → /dome/mascot/dome-think.webp]
- dome-hold-sign.webp    Dome holding a BLANK white placard in front of chest, UI writes ".th จ่ายหลังอนุมัติ" on it (fee screen) [dome-happy]
- doc-idcard.webp, doc-company.webp, doc-trade.webp   256x256 document icons: Thai ID card (blue), company certificate (paper + building + seal), trade registration (paper + red Garuda-like seal, keep generic) [inline SVG]
- step icons 128x128 for the route board / explain list:
  icon-account.webp (user card), icon-menu.webp (monitor with list), icon-search.webp (magnifier), icon-form.webp (form lines + pencil),
  icon-docs.webp (stack of papers), icon-review.webp (officer eye/magnifier on paper), icon-mail.webp (envelope),
  icon-pay.webp (coin stack), icon-confirm.webp (envelope with green check), icon-dns.webp (server rack / gear) [/icons/3d/*]
- icon-globe.webp, icon-shop.webp (shop front, purple awning), icon-server.webp (DNS server) for the DNS diagram [/icons/3d/*]
- badge-ceo.webp         200x220 purple ribbon medal with gold crown (clear screen "ฉายา CEO ตัวจริง") [CSS medal]
- coin.webp              64x64 gold pixel coin (HUD + pay button) [CSS coin]
