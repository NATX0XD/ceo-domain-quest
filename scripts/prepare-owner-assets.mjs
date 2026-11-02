import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const owner = '/private/tmp/claude-501/-Users-nattakit-Desktop-Project-TCT-KMUTNB-Computer-Assisted-Instruction-digital-biz-quest/dd1bd986-1731-45c7-98b3-0299de527455/scratchpad/owner-assets'
const outRoot = path.join(root, 'public/ui/kit')

async function removeConnectedWhite(input, output, extract, blurPatch) {
  let image = sharp(input).extract(extract)
  if (blurPatch) {
    const blurred = await image.clone().extract(blurPatch).blur(18).toBuffer()
    image = image.composite([{ input: blurred, left: blurPatch.left, top: blurPatch.top }])
  }
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const seen = new Uint8Array(width * height)
  const queue = []
  const nearWhite = (offset) => {
    const r = data[offset]
    const g = data[offset + 1]
    const b = data[offset + 2]
    const a = data[offset + 3]
    return a > 0 && r > 205 && g > 205 && b > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 42
  }
  const enqueue = (x, y) => {
    const i = y * width + x
    if (!seen[i]) {
      seen[i] = 1
      if (nearWhite(i * channels)) queue.push(i)
    }
  }
  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0)
    enqueue(x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y)
    enqueue(width - 1, y)
  }
  while (queue.length) {
    const i = queue.pop()
    const x = i % width
    const y = Math.floor(i / width)
    data[i * channels + 3] = 0
    if (x > 0) enqueue(x - 1, y)
    if (x + 1 < width) enqueue(x + 1, y)
    if (y > 0) enqueue(x, y - 1)
    if (y + 1 < height) enqueue(x, y + 1)
  }
  await sharp(data, { raw: { width, height, channels } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toFile(output)
}

const jobs = [
  ['98.png', 'buttons/orange-generic.webp', { left: 0, top: 0, width: 1247, height: 1261 }],
  ['99.png', 'signs/welcome-subtitle.webp', { left: 80, top: 40, width: 1400, height: 360 }],
  ['99.png', 'signs/welcome-title.webp', { left: 80, top: 370, width: 1400, height: 300 }],
  ['99.png', 'buttons/green-start.webp', { left: 80, top: 600, width: 1400, height: 420 }],
  ['101.png', 'signs/welcome-logo.webp', { left: 0, top: 0, width: 1717, height: 916 }],
  ['103.png', 'frames/dome-board.webp', { left: 0, top: 0, width: 1086, height: 1448 }],
  ['102.png', 'buttons/orange-primary.webp', { left: 110, top: 0, width: 870, height: 390 }, { left: 170, top: 190, width: 570, height: 150 }],
  ['102.png', 'buttons/orange-next.webp', { left: 1000, top: 0, width: 900, height: 390 }, { left: 160, top: 190, width: 560, height: 150 }],
  ['102.png', 'buttons/green.webp', { left: 30, top: 400, width: 680, height: 220 }, { left: 210, top: 55, width: 300, height: 115 }],
  ['102.png', 'buttons/blue.webp', { left: 665, top: 400, width: 680, height: 220 }, { left: 220, top: 55, width: 330, height: 115 }],
  ['102.png', 'buttons/purple.webp', { left: 1280, top: 400, width: 700, height: 220 }, { left: 220, top: 55, width: 350, height: 115 }],
  ['102.png', 'buttons/cream-back.webp', { left: 100, top: 610, width: 500, height: 140 }, { left: 165, top: 42, width: 260, height: 82 }],
  ['102.png', 'buttons/red-cancel.webp', { left: 560, top: 610, width: 500, height: 140 }, { left: 165, top: 42, width: 260, height: 82 }],
  ['102.png', 'buttons/grey-disabled.webp', { left: 1020, top: 610, width: 500, height: 140 }, { left: 165, top: 42, width: 260, height: 82 }],
  ['102.png', 'buttons/cream-home.webp', { left: 1460, top: 610, width: 540, height: 140 }, { left: 160, top: 42, width: 290, height: 82 }],
  ['102.png', 'buttons/orange-primary-left.webp', { left: 110, top: 0, width: 190, height: 390 }],
  ['102.png', 'buttons/orange-primary-right.webp', { left: 845, top: 0, width: 135, height: 390 }],
  ['102.png', 'buttons/orange-next-left.webp', { left: 1000, top: 0, width: 190, height: 390 }],
  ['102.png', 'buttons/orange-next-right.webp', { left: 1745, top: 0, width: 155, height: 390 }],
  ['102.png', 'buttons/green-left.webp', { left: 30, top: 400, width: 205, height: 220 }],
  ['102.png', 'buttons/green-right.webp', { left: 590, top: 400, width: 120, height: 220 }],
  ['102.png', 'buttons/blue-left.webp', { left: 665, top: 400, width: 205, height: 220 }],
  ['102.png', 'buttons/blue-right.webp', { left: 1230, top: 400, width: 115, height: 220 }],
  ['102.png', 'buttons/purple-left.webp', { left: 1280, top: 400, width: 220, height: 220 }],
  ['102.png', 'buttons/purple-right.webp', { left: 1870, top: 400, width: 110, height: 220 }],
  ['102.png', 'buttons/cream-back-left.webp', { left: 100, top: 610, width: 145, height: 140 }],
  ['102.png', 'buttons/cream-back-right.webp', { left: 480, top: 610, width: 120, height: 140 }],
  ['102.png', 'buttons/red-cancel-left.webp', { left: 560, top: 610, width: 145, height: 140 }],
  ['102.png', 'buttons/red-cancel-right.webp', { left: 940, top: 610, width: 120, height: 140 }],
  ['102.png', 'buttons/grey-disabled-left.webp', { left: 1020, top: 610, width: 145, height: 140 }],
  ['102.png', 'buttons/grey-disabled-right.webp', { left: 1400, top: 610, width: 120, height: 140 }],
  ['102.png', 'buttons/cream-home-left.webp', { left: 1460, top: 610, width: 165, height: 140 }],
  ['102.png', 'buttons/cream-home-right.webp', { left: 1880, top: 610, width: 120, height: 140 }],
  ['100.png', 'fx/light-rays.webp', { left: 0, top: 0, width: 390, height: 610 }],
  ['100.png', 'fx/leaves.webp', { left: 330, top: 20, width: 560, height: 610 }],
  ['100.png', 'fx/sparkles.webp', { left: 860, top: 0, width: 660, height: 430 }],
  ['100.png', 'fx/orbit-ring.webp', { left: 1130, top: 0, width: 406, height: 430 }],
  ['100.png', 'fx/glow-ring.webp', { left: 0, top: 420, width: 430, height: 380 }],
  ['100.png', 'fx/petals.webp', { left: 610, top: 420, width: 500, height: 330 }],
  ['100.png', 'fx/cloud-left.webp', { left: 0, top: 690, width: 430, height: 330 }],
  ['100.png', 'fx/cloud.webp', { left: 350, top: 680, width: 560, height: 344 }],
  ['100.png', 'fx/dust-burst.webp', { left: 780, top: 680, width: 450, height: 344 }],
  ['100.png', 'fx/glow-ring-tall.webp', { left: 1180, top: 620, width: 356, height: 404 }],
]

await Promise.all([...new Set(jobs.map(([, rel]) => path.dirname(path.join(outRoot, rel))))].map((dir) => fs.mkdir(dir, { recursive: true })))
await Promise.all(jobs.map(([source, rel, extract, blurPatch]) => removeConnectedWhite(path.join(owner, source), path.join(outRoot, rel), extract, blurPatch)))
console.log(`prepared ${jobs.length} owner assets in ${outRoot}`)
