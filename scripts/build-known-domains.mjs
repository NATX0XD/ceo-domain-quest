// สร้าง content/known-domains.json — รายชื่อโดเมนที่ตรวจกับ RDAP จริงแล้ว ใช้เป็นข้อมูลสำรองของเกม m4
// ตอนค้นออนไลน์ไม่ได้ (registry จำกัดการเรียก หรือนักเรียนค้นถี่เกิน)
// รัน: node scripts/build-known-domains.mjs   (ช้าโดยตั้งใจ เว้นช่วงต่อ registry)
import { writeFileSync } from 'node:fs'

const LABELS = [
  // แบรนด์ที่นักเรียนน่าจะลองพิมพ์
  'google', 'facebook', 'youtube', 'line', 'tiktok', 'instagram', 'shopee', 'lazada', 'grab', 'lineman',
  'apple', 'samsung', 'amazon', 'microsoft', 'netflix', 'starbucks', 'mcdonalds', 'kfc', 'pizzahut', 'cpall',
  'central', 'bigc', 'lotus', 'makro', 'tops', 'ais', 'true', 'dtac', 'kbank', 'scb', 'krungthai', 'bangkokbank',
  'thaiairways', 'airasia', 'agoda', 'booking', 'wongnai', 'pantip', 'sanook', 'kapook', 'thairath', 'mthai',
  'thaipost', 'kerry', 'flash', 'jdcentral', 'uniqlo', 'nike', 'adidas', 'ikea', 'homepro', 'powerbuy',
  'mk', 'swensens', 'afteryou', 'bar-b-q', 'cafeamazon', 'blackcanyon', 'chester', 'oishi', 'nestle', 'pepsi',
  // คำทั่วไปที่ร้านเล็กชอบตั้ง
  'coffee', 'cafe', 'bakery', 'cake', 'shop', 'store', 'food', 'tea', 'milktea', 'flower', 'fashion', 'pet',
  'toy', 'book', 'phone', 'mobile', 'computer', 'game', 'beauty', 'spa', 'salon', 'clothes', 'shoes', 'bag',
  'thaifood', 'noodle', 'somtam', 'mookata', 'icecream', 'dessert', 'fruit', 'organic', 'handmade', 'craft',
  'repair', 'fixphone', 'printshop', 'stationery', 'tshirt', 'sneaker', 'bike', 'car', 'travel', 'tour',
]
const TLDS = ['com', 'shop', 'in.th', 'co.th']
const BASE = {
  com: 'https://rdap.verisign.com/com/v1/',
  'in.th': 'https://rdap.thains.co.th/',
  'co.th': 'https://rdap.thains.co.th/',
  shop: 'https://rdap.gmoregistry.net/rdap/',
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function check(domain, tld) {
  for (let tries = 0; tries < 3; tries++) {
    try {
      const res = await fetch(`${BASE[tld]}domain/${domain}`, {
        headers: { accept: 'application/rdap+json', 'user-agent': 'digital-biz-quest-cai/1.0' },
        signal: AbortSignal.timeout(8000),
      })
      if (res.status === 200) return 'registered'
      if (res.status === 404) return 'not-found'
      await sleep(3000 * (tries + 1))
    } catch {
      await sleep(2000)
    }
  }
  return null
}

const registered = []
const notFound = []
let skipped = 0
for (const label of LABELS) {
  for (const tld of TLDS) {
    const domain = `${label}.${tld}`
    const status = await check(domain, tld)
    if (status === 'registered') registered.push(domain)
    else if (status === 'not-found') notFound.push(domain)
    else skipped++
    await sleep(tld === 'shop' ? 900 : 350)
  }
  process.stdout.write('.')
}
const out = {
  checkedAt: new Date().toISOString().slice(0, 10),
  note: 'ตรวจกับ RDAP จริงตามวันที่ checkedAt ใช้เมื่อค้นออนไลน์ไม่ได้เท่านั้น สถานะอาจเปลี่ยนหลังวันนั้น',
  registered: registered.sort(),
  notFound: notFound.sort(),
}
writeFileSync(new URL('../content/known-domains.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
console.log(`\nregistered ${registered.length} · not-found ${notFound.length} · skipped ${skipped}`)
