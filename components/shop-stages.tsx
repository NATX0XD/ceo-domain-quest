import type { ReactElement } from 'react'
import { ProgressBar, cn } from '@/components/ui'
import {
  SHOP_STAGE_MAX,
  STAGE_REVEAL,
  businessKindFrom,
  shopPhotoSrc,
  shopStageFromCleared,
  type BusinessKindId,
  type ShopStageLevel,
} from './shop-art'

/**
 * ฉากร้านของผู้เรียน — 6 ขั้นการก่อสร้าง × 8 ประเภทธุรกิจ
 *
 * ## ทางหลัก: ภาพต้นฉบับ 1 ใบต่อประเภท แล้วเผยทีละส่วน
 *
 * `ShopPhotoScene` เอาภาพ AI ของประเภทนั้น (ร้านที่เสร็จแล้ว) มาเผยจากล่างขึ้นบน
 * ตาม `STAGE_REVEAL` แล้ววางนั่งร้าน/ผ้าคลุม/กรวยเป็น SVG ทับ จึงเป็นร้านหลังเดียวกันทุกขั้น
 * เหตุผลที่ไม่ยิง AI 48 ใบอยู่ในหัวไฟล์ `shop-art.ts`
 *
 * ## ทางสำรอง: ฉาก SVG ทั้งฉาก (ส่วนที่เหลือของไฟล์นี้)
 *
 * ใช้เมื่อประเภทนั้นยังไม่มีภาพต้นฉบับ วาดทั้งฉากเองโดยแยกเป็น 2 ชั้นแล้วประกอบกัน
 *
 *   ชั้นที่ 1 **โครงอาคารตามขั้น** (เหมือนกันทุกประเภท) — ที่ดิน → ฐาน → เสา → ผนัง → หลังคา → เปิดร้าน
 *   ชั้นที่ 2 **ชุดประจำประเภท** (`KIT`) — สีผนัง/หลังคา · ทรงกันสาด · ทรงป้าย · ของที่วางหน้าร้าน · ของประดับหลังคา
 *
 * เพิ่มประเภทใหม่ = เพิ่มหนึ่งรายการใน `KIT` ไม่ต้องแตะเรขาคณิตเลย
 *
 * ## ขั้นไหนเห็นอะไร
 *
 * | ขั้น | โครงอาคาร | นั่งร้าน/กรวย | ของประจำประเภท |
 * |:---:|---|---|---|
 * | 0 | ที่ดินเปล่า ปักผัง | กรวย 2 | — |
 * | 1 | ฐานคอนกรีต + กองวัสดุ | กรวย + ลังไม้ | — |
 * | 2 | เสาไม้ตั้งครบ | นั่งร้านเต็ม | — |
 * | 3 | ผนังปิด + ประตู | นั่งร้านครึ่งเดียว | สีผนังของประเภทเริ่มเห็น |
 * | 4 | หลังคา + ป้ายเปล่า + หน้าต่าง | เก็บนั่งร้านแล้ว | ของหน้าร้าน 1 ชิ้น |
 * | 5 | เปิดร้าน + กันสาด + ธง + ต้นไม้ | — | ของหน้าร้านครบ + ของประดับหลังคา |
 *
 * ขั้นแรก ๆ ทุกประเภทหน้าตาเหมือนกันโดยตั้งใจ — ตอนกำลังเทฐานยังไม่รู้ว่าจะเป็นร้านอะไร
 * ของประจำประเภทค่อย ๆ โผล่ตอนขั้นท้าย จึงรู้สึกว่า "ร้านของเรา" กำลังเป็นรูปเป็นร่าง
 *
 * ## กติกาที่ไฟล์นี้ต้องไม่ผิด
 *
 * - **ห้ามมีชื่อร้านอยู่ในภาพ** ป้ายทุกใบเป็นป้ายเปล่า ชื่อร้านเป็นข้อความ HTML นอกภาพ
 *   (คำสั่งเจ้าของ · และสระไทยบน/ล่างล้นกรอบป้ายอยู่แล้วเมื่อชื่อยาว)
 * - สีทุกสีมาจากโทเคนผ่านคลาส `fill-*` / `stroke-*` ไม่มีเลขสีเขียนตรง ๆ
 * - ไม่มีข้อมูลผู้เรียนฝังอยู่ ทุกค่ามาจาก props
 * - ไม่มี animation ในภาพ จึงไม่มีอะไรต้องปิดในโหมดลดการเคลื่อนไหว
 */

export {
  SHOP_STAGE_MAX,
  BUSINESS_KIND_IDS,
  SHOP_PHOTO_KINDS,
  STAGE_REVEAL,
  businessKindFrom,
  shopPhotoSrc,
  shopStageFromCleared,
  type BusinessKindId,
  type ShopStageLevel,
} from './shop-art'

/* ── เรขาคณิตร่วม ─────────────────────────────────────────────────────────────
   มุมมองกึ่ง isometric: ผนังหน้าเป็นสี่เหลี่ยม ผนังข้างกับหลังคาเฉือนตามเวกเตอร์ความลึก
   เก็บเป็นตัวเลขชุดเดียวแล้วคำนวณทุกชิ้นจากมัน เพื่อให้เพิ่มขั้น/เพิ่มประเภทไม่ต้องขยับมือ  */

const VIEW_W = 320
const VIEW_H = 240
/** เส้นพื้นของผนังหน้า */
const BASE = 196
/** กึ่งกลางผนังหน้า — เยื้องซ้ายครึ่งหนึ่งของความลึก เพราะผนังข้างยื่นไปทางขวา */
const CX = 142
const DX = 34
const DY = -16
/** ขอบฟ้า — ท้องฟ้าอยู่เหนือเส้นนี้ */
const HORIZON = 150
/** จุดยืนของของหน้าร้าน 3 ชิ้น — ยึดกับที่ดิน จึงไม่ขยับตามความกว้างอาคาร */
const PROP_SPOTS: readonly [number, number][] = [
  [62, 214],
  [258, 196],
  [176, 226],
]

type StageFrame = {
  /** ความกว้างผนังหน้า */
  w: number
  /** ความสูงตัวอาคาร (0 = ยังไม่มีผนัง) */
  h: number
  /** ความสูงเสา เมื่อยังไม่มีผนัง */
  postH?: number
  slab?: boolean
  walls?: boolean
  roof?: boolean
  door?: boolean
  sign?: boolean
  windows?: number
  awning?: boolean
  /** นั่งร้าน: 0 ไม่มี · 1 ครึ่งเดียว · 2 เต็ม */
  scaffold?: 0 | 1 | 2
  cones?: number
  crates?: number
  /** ของประจำประเภทที่โผล่หน้าร้าน (นับจากต้นรายการของชุดนั้น) */
  props?: number
  roofDecor?: boolean
  plants?: number
  bunting?: boolean
}

/** โครงร่วมของทุกประเภท — เปลี่ยนที่นี่ที่เดียวแล้วครบทั้ง 8 ประเภท */
const FRAME: Record<ShopStageLevel, StageFrame> = {
  0: { w: 0, h: 0, cones: 2 },
  1: { w: 92, h: 0, slab: true, cones: 2, crates: 2 },
  2: { w: 92, h: 0, slab: true, postH: 54, scaffold: 2, cones: 1, crates: 1 },
  3: { w: 96, h: 62, slab: true, walls: true, door: true, scaffold: 1, cones: 1 },
  4: { w: 106, h: 78, slab: true, walls: true, roof: true, door: true, sign: true, windows: 2, props: 1, plants: 1 },
  5: {
    w: 116,
    h: 94,
    slab: true,
    walls: true,
    roof: true,
    door: true,
    sign: true,
    windows: 3,
    awning: true,
    props: 3,
    roofDecor: true,
    plants: 2,
    bunting: true,
  },
}

/** ของที่วางหน้าร้าน วาดจากจุดยืน (x, y) โดย y คือระดับพื้น */
type PropDrawer = (x: number, y: number, key: string) => ReactElement

type ShopKit = {
  /** ชื่อประเภทสำหรับข้อความอ่านออกเสียง */
  name: string
  /** สีผนังหน้า / ผนังข้าง / หลังคา */
  wall: string
  wallSide: string
  roof: string
  /** สีกันสาด (ลายทางใช้ 2 สีสลับ) */
  awning: [string, string]
  /** ทรงป้ายเปล่าเหนือประตู */
  signShape: 'rect' | 'oval' | 'hang' | 'pennant'
  /** ของประดับบนหลังคาตอนขั้น 5 */
  roofDecor: (x: number, y: number) => ReactElement
  /** ของหน้าร้าน เรียงตามลำดับที่จะโผล่ */
  props: PropDrawer[]
}

/* ── ชิ้นส่วนย่อยที่หลายประเภทใช้ร่วมกัน ─────────────────────────────────── */

function crate(x: number, y: number, key: string, tone = 'fill-spark-600') {
  return (
    <g key={key}>
      <rect x={x} y={y - 16} width={22} height={16} rx={2} className={tone} />
      <rect x={x + 2} y={y - 14} width={18} height={4} rx={1.5} className="fill-spark-300" />
      <rect x={x + 2} y={y - 8} width={18} height={4} rx={1.5} className="fill-spark-300" />
    </g>
  )
}

function bottle(x: number, y: number, key: string, body: string) {
  return (
    <g key={key}>
      <rect x={x - 4} y={y - 20} width={8} height={7} rx={2} className="fill-surface-raised" />
      <rect x={x - 7} y={y - 14} width={14} height={14} rx={4} className={body} />
    </g>
  )
}

function board(x: number, y: number, key: string) {
  return (
    <g key={key}>
      <rect x={x - 12} y={y - 26} width={24} height={22} rx={3} className="fill-ink-muted" />
      <rect x={x - 9} y={y - 23} width={18} height={16} rx={2} className="fill-surface-raised" />
      <rect x={x - 3} y={y - 4} width={6} height={4} rx={1.5} className="fill-ink-muted" />
    </g>
  )
}

/* ── ชุดประจำประเภท 8 แบบ ───────────────────────────────────────────────── */

const KIT: Record<BusinessKindId, ShopKit> = {
  bakery: {
    name: 'ร้านเบเกอรี่',
    wall: 'fill-spark-300',
    wallSide: 'fill-spark-600',
    roof: 'fill-spark-500',
    awning: ['fill-danger-500', 'fill-surface-raised'],
    signShape: 'oval',
    roofDecor: (x, y) => (
      // ก้อนแป้ง/คัพเค้กบนหลังคา
      <g>
        <rect x={x - 9} y={y - 8} width={18} height={9} rx={2} className="fill-reward-500" />
        <circle cx={x} cy={y - 12} r={7} className="fill-danger-300" />
      </g>
    ),
    props: [
      // ตู้กระจกวางเค้ก
      (x, y, k) => (
        <g key={k}>
          <rect x={x - 17} y={y - 30} width={34} height={30} rx={3} className="fill-surface-raised stroke-ink-muted" strokeWidth={2} />
          <line x1={x - 17} y1={y - 16} x2={x + 17} y2={y - 16} className="stroke-ink-muted" strokeWidth={2} />
          <circle cx={x - 8} cy={y - 23} r={5} className="fill-danger-300" />
          <circle cx={x + 7} cy={y - 23} r={5} className="fill-reward-500" />
          <rect x={x - 13} y={y - 12} width={11} height={7} rx={2} className="fill-spark-500" />
          <rect x={x + 2} y={y - 12} width={11} height={7} rx={2} className="fill-danger-500" />
        </g>
      ),
      (x, y, k) => crate(x, y, k, 'fill-spark-700'),
      (x, y, k) => (
        <g key={k}>
          {/* ขนมปังวางบนถาด */}
          <rect x={x - 12} y={y - 6} width={24} height={6} rx={3} className="fill-ink-muted" />
          <ellipse cx={x - 5} cy={y - 10} rx={7} ry={5} className="fill-reward-600" />
          <ellipse cx={x + 6} cy={y - 10} rx={6} ry={4} className="fill-reward-500" />
        </g>
      ),
    ],
  },

  clothes: {
    name: 'ร้านเสื้อผ้า',
    wall: 'fill-brand-300',
    wallSide: 'fill-brand-700',
    roof: 'fill-brand-500',
    awning: ['fill-brand-600', 'fill-brand-200'],
    signShape: 'hang',
    roofDecor: (x, y) => (
      <g>
        {/* ไม้แขวนเสื้อ */}
        <path d={`M${x} ${y - 14} v6`} className="stroke-ink-muted" strokeWidth={2.5} fill="none" />
        <path d={`M${x - 12} ${y - 2} L${x} ${y - 8} L${x + 12} ${y - 2} Z`} className="fill-none stroke-ink-muted" strokeWidth={2.5} />
      </g>
    ),
    props: [
      // ราวแขวนเสื้อ
      (x, y, k) => (
        <g key={k}>
          <rect x={x - 20} y={y - 34} width={40} height={3} rx={1.5} className="fill-ink-muted" />
          <rect x={x - 18} y={y - 31} width={3} height={31} rx={1.5} className="fill-ink-muted" />
          <rect x={x + 15} y={y - 31} width={3} height={31} rx={1.5} className="fill-ink-muted" />
          <path d={`M${x - 11} ${y - 31} l-6 12 h12 z`} className="fill-quest-500" />
          <path d={`M${x + 1} ${y - 31} l-6 14 h12 z`} className="fill-danger-300" />
          <path d={`M${x + 12} ${y - 31} l-5 11 h10 z`} className="fill-brand-400" />
        </g>
      ),
      (x, y, k) => board(x, y, k),
      (x, y, k) => crate(x, y, k, 'fill-brand-600'),
    ],
  },

  coffee: {
    name: 'ร้านกาแฟ',
    wall: 'fill-reward-500',
    wallSide: 'fill-reward-700',
    roof: 'fill-reward-600',
    awning: ['fill-quest-700', 'fill-reward-300'],
    signShape: 'rect',
    roofDecor: (x, y) => (
      <g>
        {/* ถ้วยกาแฟบนหลังคา */}
        <path d={`M${x - 9} ${y - 10} h18 l-2 11 h-14 z`} className="fill-surface-raised stroke-ink-muted" strokeWidth={2} />
        <path d={`M${x + 9} ${y - 7} q7 3 0 7`} className="fill-none stroke-ink-muted" strokeWidth={2} />
      </g>
    ),
    props: [
      // ถ้วยกาแฟใบใหญ่หน้าร้าน
      (x, y, k) => (
        <g key={k}>
          <path d={`M${x - 14} ${y - 26} h28 l-4 26 h-20 z`} className="fill-surface-raised stroke-reward-700" strokeWidth={2.5} />
          <rect x={x - 12} y={y - 24} width={24} height={7} rx={2} className="fill-reward-700" />
          <path d={`M${x + 14} ${y - 22} q10 6 0 12`} className="fill-none stroke-reward-700" strokeWidth={2.5} />
        </g>
      ),
      // ถุงเมล็ดกาแฟ
      (x, y, k) => (
        <g key={k}>
          <path d={`M${x - 11} ${y} v-20 q11 -6 22 0 v20 z`} className="fill-quest-700" />
          <rect x={x - 7} y={y - 14} width={14} height={8} rx={2} className="fill-reward-300" />
        </g>
      ),
      (x, y, k) => bottle(x, y, k, 'fill-quest-600'),
    ],
  },

  secondhand: {
    name: 'ร้านของมือสอง',
    wall: 'fill-quest-300',
    wallSide: 'fill-quest-700',
    roof: 'fill-quest-600',
    awning: ['fill-spark-600', 'fill-quest-200'],
    signShape: 'pennant',
    roofDecor: (x, y) => (
      <g>
        {/* ป้ายลดราคา */}
        <path d={`M${x - 11} ${y - 12} h22 v14 l-11 6 l-11 -6 z`} className="fill-spark-500 stroke-spark-800" strokeWidth={2} />
        <rect x={x - 6} y={y - 5} width={12} height={3} rx={1.5} className="fill-spark-800" />
      </g>
    ),
    props: [
      // ลังของเก่าซ้อนกัน
      (x, y, k) => (
        <g key={k}>
          {crate(x - 12, y, `${k}-a`, 'fill-spark-600')}
          {crate(x + 11, y, `${k}-b`, 'fill-spark-700')}
          {crate(x - 1, y - 16, `${k}-c`, 'fill-reward-600')}
        </g>
      ),
      (x, y, k) => (
        <g key={k}>
          {/* วิทยุเก่า */}
          <rect x={x - 14} y={y - 18} width={28} height={18} rx={3} className="fill-ink-muted" />
          <circle cx={x - 5} cy={y - 9} r={5} className="fill-surface-sunken" />
          <rect x={x + 3} y={y - 14} width={9} height={10} rx={2} className="fill-surface-sunken" />
        </g>
      ),
      (x, y, k) => bottle(x, y, k, 'fill-brand-400'),
    ],
  },

  'phone-repair': {
    name: 'ร้านซ่อมมือถือ',
    wall: 'fill-brand-200',
    wallSide: 'fill-brand-600',
    roof: 'fill-ink-muted',
    awning: ['fill-brand-600', 'fill-surface-raised'],
    signShape: 'rect',
    roofDecor: (x, y) => (
      <g>
        {/* สัญญาณ */}
        <rect x={x - 10} y={y - 2} width={5} height={4} rx={1.5} className="fill-brand-600" />
        <rect x={x - 2} y={y - 7} width={5} height={9} rx={1.5} className="fill-brand-600" />
        <rect x={x + 6} y={y - 13} width={5} height={15} rx={1.5} className="fill-brand-600" />
      </g>
    ),
    props: [
      // โต๊ะช่างกับมือถือ
      (x, y, k) => (
        <g key={k}>
          <rect x={x - 20} y={y - 16} width={40} height={5} rx={2} className="fill-spark-700" />
          <rect x={x - 17} y={y - 11} width={4} height={11} rx={2} className="fill-spark-700" />
          <rect x={x + 13} y={y - 11} width={4} height={11} rx={2} className="fill-spark-700" />
          <rect x={x - 12} y={y - 30} width={15} height={24} rx={3} className="fill-ink stroke-brand-600" strokeWidth={2} />
          <rect x={x - 9} y={y - 27} width={9} height={15} rx={1.5} className="fill-brand-300" />
          {/* ไขควง */}
          <rect x={x + 7} y={y - 26} width={3} height={13} rx={1.5} className="fill-line-strong" />
          <rect x={x + 5.5} y={y - 32} width={6} height={7} rx={2} className="fill-danger-500" />
        </g>
      ),
      (x, y, k) => board(x, y, k),
      (x, y, k) => crate(x, y, k, 'fill-brand-600'),
    ],
  },

  flower: {
    name: 'ร้านดอกไม้',
    wall: 'fill-danger-100',
    wallSide: 'fill-danger-600',
    roof: 'fill-danger-500',
    awning: ['fill-quest-600', 'fill-danger-300'],
    signShape: 'oval',
    roofDecor: (x, y) => (
      <g>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
          return (
            <circle key={i} cx={x + Math.cos(a) * 7} cy={y - 6 + Math.sin(a) * 7} r={5} className="fill-danger-300" />
          )
        })}
        <circle cx={x} cy={y - 6} r={4} className="fill-reward-500" />
      </g>
    ),
    props: [
      // ถังดอกไม้ 2 ใบ
      (x, y, k) => (
        <g key={k}>
          <path d={`M${x - 20} ${y - 16} h18 l-3 16 h-12 z`} className="fill-quest-600" />
          <circle cx={x - 15} cy={y - 22} r={5} className="fill-danger-300" />
          <circle cx={x - 7} cy={y - 25} r={5} className="fill-reward-500" />
          <circle cx={x - 11} cy={y - 30} r={5} className="fill-brand-400" />
          <path d={`M${x + 4} ${y - 14} h16 l-3 14 h-10 z`} className="fill-quest-700" />
          <circle cx={x + 9} cy={y - 20} r={4.5} className="fill-danger-500" />
          <circle cx={x + 16} cy={y - 22} r={4.5} className="fill-danger-300" />
        </g>
      ),
      (x, y, k) => (
        <g key={k}>
          {/* ช่อห่อกระดาษ */}
          <path d={`M${x - 10} ${y} l6 -18 h8 l6 18 z`} className="fill-surface-raised stroke-quest-600" strokeWidth={2} />
          <circle cx={x} cy={y - 22} r={6} className="fill-danger-300" />
        </g>
      ),
      (x, y, k) => bottle(x, y, k, 'fill-quest-500'),
    ],
  },

  food: {
    name: 'ร้านอาหาร',
    wall: 'fill-spark-400',
    wallSide: 'fill-spark-700',
    roof: 'fill-danger-500',
    awning: ['fill-danger-500', 'fill-spark-100'],
    signShape: 'rect',
    roofDecor: (x, y) => (
      <g>
        {/* ช้อนส้อมไขว้ */}
        <rect x={x - 8} y={y - 14} width={3} height={16} rx={1.5} className="fill-line-strong" transform={`rotate(-18 ${x - 7} ${y - 6})`} />
        <rect x={x + 5} y={y - 14} width={3} height={16} rx={1.5} className="fill-line-strong" transform={`rotate(18 ${x + 6} ${y - 6})`} />
        <circle cx={x - 8} cy={y - 15} r={4} className="fill-line-strong" />
      </g>
    ),
    props: [
      // เตากับหม้อ
      (x, y, k) => (
        <g key={k}>
          <rect x={x - 18} y={y - 14} width={36} height={14} rx={3} className="fill-ink-muted" />
          <rect x={x - 14} y={y - 26} width={28} height={13} rx={3} className="fill-line-strong" />
          <rect x={x - 17} y={y - 29} width={34} height={4} rx={2} className="fill-line-strong" />
          <path d={`M${x - 6} ${y - 34} q4 -5 0 -9`} className="fill-none stroke-line" strokeWidth={2.5} />
          <path d={`M${x + 4} ${y - 34} q4 -5 0 -9`} className="fill-none stroke-line" strokeWidth={2.5} />
        </g>
      ),
      // กล่องข้าววางซ้อน
      (x, y, k) => (
        <g key={k}>
          <rect x={x - 13} y={y - 9} width={26} height={9} rx={2} className="fill-surface-raised stroke-ink-muted" strokeWidth={2} />
          <rect x={x - 11} y={y - 18} width={22} height={9} rx={2} className="fill-surface-raised stroke-ink-muted" strokeWidth={2} />
          <rect x={x - 6} y={y - 15} width={12} height={3} rx={1.5} className="fill-danger-300" />
        </g>
      ),
      (x, y, k) => bottle(x, y, k, 'fill-danger-500'),
    ],
  },

  game: {
    name: 'ร้านอุปกรณ์เกม',
    wall: 'fill-brand-500',
    wallSide: 'fill-brand-800',
    roof: 'fill-brand-700',
    awning: ['fill-quest-600', 'fill-brand-300'],
    signShape: 'pennant',
    roofDecor: (x, y) => (
      <g>
        {/* จอยเกม */}
        <rect x={x - 13} y={y - 11} width={26} height={13} rx={6} className="fill-ink" />
        <circle cx={x - 6} cy={y - 4} r={2.5} className="fill-quest-400" />
        <circle cx={x + 6} cy={y - 4} r={2.5} className="fill-danger-300" />
      </g>
    ),
    props: [
      // จอเกม
      (x, y, k) => (
        <g key={k}>
          <rect x={x - 20} y={y - 32} width={40} height={26} rx={3} className="fill-ink stroke-brand-800" strokeWidth={2.5} />
          <rect x={x - 16} y={y - 28} width={32} height={18} rx={2} className="fill-brand-300" />
          <rect x={x - 5} y={y - 22} width={10} height={6} rx={1.5} className="fill-quest-400" />
          <rect x={x - 4} y={y - 6} width={8} height={6} rx={2} className="fill-brand-800" />
        </g>
      ),
      // จอยเกมวางพื้น
      (x, y, k) => (
        <g key={k}>
          <rect x={x - 14} y={y - 12} width={28} height={12} rx={6} className="fill-brand-700" />
          <circle cx={x - 6} cy={y - 6} r={2.5} className="fill-quest-400" />
          <circle cx={x + 6} cy={y - 6} r={2.5} className="fill-reward-500" />
        </g>
      ),
      (x, y, k) => crate(x, y, k, 'fill-brand-600'),
    ],
  },
}

/** คำบรรยายภาพ — ประกอบจากขั้น + ประเภท จึงไม่ต้องเขียน 48 ประโยค */
const STAGE_WORDS: Record<ShopStageLevel, string> = {
  0: 'ลานเปล่า เทฐานไว้แล้ว มีกองไม้กับกรวยรอเริ่มสร้าง',
  1: 'ขึ้นโครงส่วนล่างของร้านแล้ว ยังมีนั่งร้านกับผ้าคลุม',
  2: 'สร้างถึงแนวผนังแล้ว นั่งร้านยังล้อมอยู่',
  3: 'สร้างถึงหลังคาแล้ว เหลือเก็บงานด้านบน',
  4: 'ตัวร้านเสร็จแล้ว กำลังเก็บนั่งร้านกับกรวยออก',
  5: 'เปิดร้านเรียบร้อย มีธงประดับ ไฟสว่างและประกาย',
}

function altOf(level: ShopStageLevel, kind: BusinessKindId): string {
  return `${KIT[kind].name} ขั้นที่ ${level} จาก ${SHOP_STAGE_MAX}: ${STAGE_WORDS[level]}`
}

/* ── ตัวช่วยวาดหน้า/ข้าง/หลังคา ─────────────────────────────────────────── */

function frontFace(l: number, w: number, h: number): string {
  const r = l + w
  const t = BASE - h
  return `${l},${BASE} ${r},${BASE} ${r},${t} ${l},${t}`
}
function sideFace(l: number, w: number, h: number): string {
  const r = l + w
  const t = BASE - h
  return `${r},${BASE} ${r + DX},${BASE + DY} ${r + DX},${t + DY} ${r},${t}`
}
function roofFace(l: number, w: number, h: number): string {
  const r = l + w
  const t = BASE - h
  return `${l},${t} ${r},${t} ${r + DX},${t + DY} ${l + DX},${t + DY}`
}

/* ── ฉากจากภาพต้นฉบับ: เผยจากล่างขึ้นบน + วางของก่อสร้างทับ ──────────────────

   ทุกอย่างอยู่ในระบบพิกัดเดียว 0-100 ของตัวภาพ (ภาพต้นฉบับเป็นจัตุรัส 512×512)
   ใช้ `<image>` ใน SVG แทน `<img>` + CSS mask เพราะ SVG กำหนดกรอบเดียวกันให้
   ทั้งภาพและของที่วางทับ ไม่ว่ากล่องข้างนอกจะสัดส่วนไหน ของก่อสร้างจึงไม่มีทางเลื่อนหลุดจากตัวร้าน

   ตัวเลขด้านล่างวัดจากภาพชุดนี้จริง (ร้านอยู่กลางภาพ ลานเป็นสี่เหลี่ยมข้าวหลามตัด)    */

/** เส้นพื้นหน้าร้านในภาพ */
const P_GROUND = 80
/** ขอบซ้าย/ขวาของตัวอาคารในภาพ */
const P_L = 18
const P_R = 82
/** ลานร้าน — สี่เหลี่ยมข้าวหลามตัด (ซ้าย บน ขวา ล่าง) */
const P_PLOT = '8,74 50,60 92,74 50,88'
/** ความกว้างแถบไล่จางตรงรอยเผย — กว้างพอที่จะไม่เห็นเป็นเส้นตัด */
const REVEAL_FADE = 0.12

/** ดาวประกาย 4 แฉก ใช้ตอนขั้นเปิดร้าน */
function sparkle(x: number, y: number, r: number, key: string) {
  return (
    <path
      key={key}
      d={`M${x} ${y - r} Q${x + r * 0.22} ${y - r * 0.22} ${x + r} ${y} Q${x + r * 0.22} ${y + r * 0.22} ${x} ${y + r} Q${x - r * 0.22} ${y + r * 0.22} ${x - r} ${y} Q${x - r * 0.22} ${y - r * 0.22} ${x} ${y - r} Z`}
      className="fill-reward-500"
    />
  )
}

/** กรวยจราจรบนลาน */
function photoCone(x: number, y: number, key: string) {
  return (
    <g key={key}>
      <polygon points={`${x - 2.6},${y} ${x + 2.6},${y} ${x + 0.9},${y - 6.4} ${x - 0.9},${y - 6.4}`} className="fill-spark-500" />
      <rect x={x - 2} y={y - 4.2} width={4} height={1.4} rx={0.6} className="fill-surface-raised" />
      <rect x={x - 3.4} y={y - 1.2} width={6.8} height={1.6} rx={0.7} className="fill-spark-700" />
    </g>
  )
}

/** กองไม้ที่วางรอสร้าง */
function lumber(x: number, y: number, key: string) {
  return (
    <g key={key}>
      <rect x={x - 8} y={y - 3} width={16} height={3} rx={1} className="fill-spark-600" />
      <rect x={x - 7} y={y - 6} width={14} height={3} rx={1} className="fill-spark-700" />
      <rect x={x - 5.5} y={y - 9} width={11} height={3} rx={1} className="fill-spark-600" />
    </g>
  )
}

/**
 * นั่งร้านเหล็ก — ตั้งจากพื้นขึ้นไปถึงระดับ `topY`
 * `half` = เหลือด้านเดียว ใช้ตอนงานใกล้เสร็จ
 */
function scaffoldRig(topY: number, half: boolean, key: string) {
  const left = half ? P_R - 18 : P_L - 4
  const right = half ? P_R + 4 : P_R + 4
  const rows = Math.max(2, Math.round((P_GROUND - topY) / 18))
  const cell = (P_GROUND - topY) / (rows - 1 || 1)
  return (
    <g key={key} className="stroke-spark-600" strokeWidth={0.8} strokeLinecap="round" fill="none">
      <line x1={left} y1={P_GROUND + 2} x2={left} y2={topY} />
      <line x1={right} y1={P_GROUND + 2} x2={right} y2={topY} />
      {Array.from({ length: rows }, (_, i) => {
        const y = P_GROUND - cell * i
        return <line key={`${key}-r${i}`} x1={left} y1={y} x2={right} y2={y} />
      })}
      {/* ค้ำทแยงเฉพาะช่องล่างสุด — ลากยาวทั้งด้านจะบังหน้าร้านจนอ่านไม่ออก */}
      <line x1={left} y1={P_GROUND} x2={left + (right - left) * 0.45} y2={P_GROUND - cell} strokeWidth={0.6} />
    </g>
  )
}

/**
 * ผ้าใบคลุมพาดตรงรอยเผย — บังรอยต่อไม่ให้อ่านเป็น "ภาพถูกครอบ"
 * วาดเป็นผ้าหย่อนเป็นลอน ไม่ใช่แถบตรง จึงดูเหมือนงานก่อสร้างจริง
 */
function tarp(seamY: number, key: string) {
  const w = P_R - P_L + 10
  const x0 = P_L - 5
  return (
    <g key={key}>
      <path
        d={`M${x0} ${seamY - 2} Q${x0 + w * 0.25} ${seamY + 3} ${x0 + w * 0.5} ${seamY - 1} Q${x0 + w * 0.75} ${seamY - 5} ${x0 + w} ${seamY - 1} L${x0 + w} ${seamY + 6} Q${x0 + w * 0.75} ${seamY + 2} ${x0 + w * 0.5} ${seamY + 6} Q${x0 + w * 0.25} ${seamY + 10} ${x0} ${seamY + 5} Z`}
        className="fill-spark-200"
      />
      <path
        d={`M${x0} ${seamY - 2} Q${x0 + w * 0.25} ${seamY + 3} ${x0 + w * 0.5} ${seamY - 1} Q${x0 + w * 0.75} ${seamY - 5} ${x0 + w} ${seamY - 1}`}
        className="fill-none stroke-spark-400"
        strokeWidth={0.8}
      />
    </g>
  )
}

/** ของก่อสร้างที่วางทับในแต่ละขั้น — ขั้น 5 เป็นของฉลองแทน */
function photoOverlay(level: ShopStageLevel) {
  const seam = (1 - STAGE_REVEAL[level]) * 100

  if (level === 0) {
    return (
      <>
        {/* ลานเปล่า: ฐานคอนกรีต + ผังเส้นประ */}
        <polygon points="26,74 50,66 74,74 50,82" className="fill-line-strong" />
        <polygon points="26,74 50,82 50,84 26,76" className="fill-line-contrast" />
        <polygon points="74,74 50,82 50,84 74,76" className="fill-line-contrast" />
        <polygon
          points="22,74 50,64 78,74 50,84"
          className="fill-none stroke-line-contrast"
          strokeWidth={0.8}
          strokeDasharray="3 2.5"
        />
        {lumber(31, 80, 'lum-0')}
        {photoCone(66, 80, 'cone-a')}
        {photoCone(76, 76, 'cone-b')}
      </>
    )
  }

  if (level === 5) {
    return (
      <>
        {/* ธงราวพาดเหนือร้าน */}
        <path d={`M6 22 Q50 10 94 22`} className="fill-none stroke-line-strong" strokeWidth={0.7} />
        {Array.from({ length: 11 }, (_, i) => {
          const t = (i + 0.5) / 11
          const bx = 6 + 88 * t
          const by = 22 - 12 * Math.sin(Math.PI * t)
          const tones = ['fill-danger-300', 'fill-reward-500', 'fill-quest-500', 'fill-brand-400']
          return (
            <polygon
              key={`bt-${i}`}
              points={`${bx - 2.4},${by} ${bx + 2.4},${by} ${bx},${by + 5}`}
              className={tones[i % tones.length]}
            />
          )
        })}
        {/* แสงอุ่นจากโคมหน้าร้าน — ไล่จางจากกลางออก ไม่ใช่วงทึบ ไม่งั้นเป็นรอยเปื้อนบนภาพ */}
        <circle cx={31} cy={34} r={7} fill="url(#dbq-shop-glow)" />
        <circle cx={69} cy={34} r={7} fill="url(#dbq-shop-glow)" />
        {sparkle(20, 40, 3.2, 'sp-0')}
        {sparkle(82, 34, 2.6, 'sp-1')}
        {sparkle(72, 52, 2, 'sp-2')}
        {sparkle(28, 58, 2.2, 'sp-3')}
      </>
    )
  }

  return (
    <>
      {level <= 2 ? lumber(24, 81, 'lum-1') : null}
      {/* ขั้น 3-4 เหลือนั่งร้านด้านเดียว — งานใกล้เสร็จแล้ว และล้อมทั้งหลังจะบังหน้าร้าน */}
      {scaffoldRig(Math.max(8, seam - 4), level >= 3, `sc-${level}`)}
      {level < 4 ? tarp(seam, `tp-${level}`) : null}
      {photoCone(70, 81, 'cone-c')}
      {level <= 3 ? photoCone(30, 83, 'cone-d') : null}
    </>
  )
}

type ShopPhotoSceneProps = {
  src: string
  level: ShopStageLevel
  /** ใช้ทำ id ของ mask ให้ไม่ชนกันเมื่อวางหลายฉากในหน้าเดียว */
  kind: BusinessKindId
  label: string
  decorative: boolean
  className?: string
}

function ShopPhotoScene({ src, level, kind, label, decorative, className }: ShopPhotoSceneProps) {
  const reveal = STAGE_REVEAL[level]
  const maskId = `dbq-shop-mask-${kind}-${level}`

  return (
    <svg
      viewBox="0 0 100 100"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      className={cn('block h-full w-full select-none', className)}
    >
      <defs>
        {/* โทนอุ่นใกล้เคียงพื้นหลังครีมในภาพต้นฉบับ รอยต่อจึงกลืนกัน ไม่เห็นเป็นขอบ */}
        <linearGradient id="dbq-photo-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="[stop-color:var(--color-spark-100)]" />
          <stop offset="60%" className="[stop-color:var(--color-spark-50)]" />
          <stop offset="100%" className="[stop-color:var(--color-quest-50)]" />
        </linearGradient>
        <radialGradient id="dbq-shop-glow">
          <stop offset="0%" className="[stop-color:var(--color-reward-300)]" stopOpacity={0.55} />
          <stop offset="100%" className="[stop-color:var(--color-reward-300)]" stopOpacity={0} />
        </radialGradient>
        {reveal > 0 && reveal < 1 ? (
          <>
            {/* ไล่จางจากล่าง (offset 0) ขึ้นบน — ขาว = เห็น ดำ = ไม่เห็น */}
            <linearGradient id={`${maskId}-g`} gradientUnits="userSpaceOnUse" x1="0" y1="100" x2="0" y2="0">
              <stop offset={0} stopColor="#fff" />
              <stop offset={Math.max(0, reveal - REVEAL_FADE)} stopColor="#fff" />
              <stop offset={reveal} stopColor="#000" />
              <stop offset={1} stopColor="#000" />
            </linearGradient>
            <mask id={maskId}>
              <rect x={0} y={0} width={100} height={100} fill={`url(#${maskId}-g)`} />
            </mask>
          </>
        ) : null}
      </defs>

      {/* ฉากพื้นหลัง — วาดไว้ใต้ภาพเสมอ ทำหน้าที่ 2 อย่าง
          1. เป็นท้องฟ้าของส่วนที่ยังไม่เผย (ขั้นแรก ๆ)
          2. เป็นตัวรับกรณีไฟล์ภาพโหลดไม่ขึ้น — จะได้เห็นลานร้านกับของก่อสร้าง ไม่ใช่กล่องว่าง */}
      <rect x={0} y={0} width={100} height={100} fill="url(#dbq-photo-sky)" />
      <g className="fill-surface-raised opacity-70">
        <ellipse cx={16} cy={16} rx={7} ry={3.6} />
        <ellipse cx={23} cy={17} rx={5} ry={3} />
        <ellipse cx={84} cy={12} rx={6} ry={3.2} />
      </g>
      <polygon points={P_PLOT} className="fill-quest-200" />
      <polygon points="8,74 50,88 50,91 8,77" className="fill-quest-300" />
      <polygon points="92,74 50,88 50,91 92,77" className="fill-quest-300" />

      {reveal > 0 ? (
        <image
          href={src}
          x={0}
          y={0}
          width={100}
          height={100}
          preserveAspectRatio="xMidYMid slice"
          mask={reveal < 1 ? `url(#${maskId})` : undefined}
        />
      ) : null}

      {photoOverlay(level)}
    </svg>
  )
}

export type ShopStagesProps = {
  level: ShopStageLevel
  /** ประเภทธุรกิจของผู้เรียน — ไม่ส่งมาก็ใช้ร้านกลาง ๆ */
  kind?: BusinessKindId
  /** ซ่อนจากโปรแกรมอ่านหน้าจอ เมื่อมีข้อความบอกความคืบหน้าอยู่ข้าง ๆ แล้ว */
  decorative?: boolean
  className?: string
}

/**
 * ฉากร้านเปล่า ๆ ไม่มีการ์ดครอบ ไม่มีข้อความ
 *
 * มีภาพวาดจริงของคู่นี้ = ใช้ภาพ · ยังไม่มี = วาดฉาก SVG ให้แทน
 * ตัดสินตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์จากตาราง `SHOP_PHOTO_STAGES` ไม่ได้ลองโหลดแล้วค่อยรู้
 * จึงไม่มีจังหวะที่ผู้เรียนเห็นรูปแตกหรือกล่องว่าง
 */
export function ShopStages({ level, kind = 'food', decorative = false, className }: ShopStagesProps) {
  const photo = shopPhotoSrc(kind)
  if (photo) {
    return (
      <ShopPhotoScene
        src={photo}
        level={level}
        kind={kind}
        label={altOf(level, kind)}
        decorative={decorative}
        className={className}
      />
    )
  }

  const f = FRAME[level]
  const kit = KIT[kind]
  const w = f.w
  const h = f.h
  const l = CX - w / 2
  const top = BASE - h
  const hasWalls = Boolean(f.walls)

  const signTop = top + 10
  const signH = 17
  const awningTop = signTop + signH + 5
  const awningH = 13
  const winTop = awningTop + awningH + 7

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : altOf(level, kind)}
      aria-hidden={decorative || undefined}
      className={cn('block h-auto w-full select-none', className)}
    >
      {/* ---------- ท้องฟ้า ---------- */}
      <defs>
        <linearGradient id="dbq-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="[stop-color:var(--color-brand-100)]" />
          <stop offset="70%" className="[stop-color:var(--color-surface-alt)]" />
          <stop offset="100%" className="[stop-color:var(--color-quest-50)]" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={VIEW_W} height={HORIZON + 20} fill="url(#dbq-sky)" />

      {/* เมฆ 3 ก้อน — วางไว้ไม่ให้ชนตัวอาคารที่ขั้นสูงสุด */}
      <g className="fill-surface-raised opacity-80">
        <ellipse cx={44} cy={34} rx={20} ry={11} />
        <ellipse cx={62} cy={36} rx={14} ry={9} />
        <ellipse cx={268} cy={26} rx={17} ry={10} />
        <ellipse cx={250} cy={30} rx={12} ry={8} />
        <ellipse cx={186} cy={16} rx={13} ry={7} />
      </g>

      {/* ---------- เนินหลังร้าน + ต้นไม้ไกล ---------- */}
      <ellipse cx={46} cy={HORIZON + 14} rx={78} ry={26} className="fill-quest-200" />
      <ellipse cx={286} cy={HORIZON + 16} rx={70} ry={24} className="fill-quest-200" />
      <g className="fill-quest-500">
        <circle cx={30} cy={HORIZON - 12} r={15} />
        <circle cx={46} cy={HORIZON - 6} r={11} />
        <circle cx={296} cy={HORIZON - 10} r={13} />
      </g>
      <rect x={27} y={HORIZON - 12} width={6} height={20} rx={3} className="fill-spark-700" />
      <rect x={293} y={HORIZON - 10} width={6} height={18} rx={3} className="fill-spark-700" />

      {/* ---------- ที่ดิน ---------- */}
      <polygon points={`22,178 160,132 298,178 160,224`} className="fill-quest-100" />
      <polygon points={`22,178 160,224 160,230 22,184`} className="fill-quest-300" />
      <polygon points={`298,178 160,224 160,230 298,184`} className="fill-quest-300" />

      {level === 0 ? (
        <>
          {/* ผังที่ดิน: เส้นประ + หมุดมุม */}
          <polygon
            points="64,178 160,146 256,178 160,210"
            className="fill-none stroke-line-contrast"
            strokeWidth={2.5}
            strokeDasharray="8 7"
          />
          {[
            [64, 178],
            [160, 146],
            [256, 178],
            [160, 210],
          ].map(([px, py]) => (
            <circle key={`${px}-${py}`} cx={px} cy={py} r={4} className="fill-spark-600" />
          ))}
        </>
      ) : null}

      {/* ---------- ฐานคอนกรีต ---------- */}
      {f.slab ? (
        <>
          <polygon
            points={`${l - 12},${BASE + 4} ${l + w + 12},${BASE + 4} ${l + w + 12 + DX},${BASE + 4 + DY} ${l - 12 + DX},${BASE + 4 + DY}`}
            className="fill-line-strong"
          />
          <polygon
            points={`${l - 12},${BASE + 4} ${l + w + 12},${BASE + 4} ${l + w + 12},${BASE + 10} ${l - 12},${BASE + 10}`}
            className="fill-line-contrast"
          />
        </>
      ) : null}

      {/* ตัวร้านทั้งก้อน — สคริปต์วัดจับ getBBox ตรงนี้เพื่อพิสูจน์ว่าโตขึ้นจริง */}
      <g data-shop-building="">
        {/* ---------- เสาไม้ (ขั้นที่ยังไม่มีผนัง) ---------- */}
        {!hasWalls && f.postH
          ? [l + 4, l + w / 2 - 3, l + w - 10, l + w + DX - 8].map((px, i) => (
              <rect
                key={`post-${i}`}
                x={px}
                y={BASE - (f.postH ?? 0) + (i === 3 ? DY : 0)}
                width={8}
                height={f.postH ?? 0}
                rx={2}
                className="fill-spark-700"
              />
            ))
          : null}
        {!hasWalls && f.postH ? (
          <rect x={l} y={BASE - f.postH - 6} width={w + DX} height={7} rx={3} className="fill-spark-600" />
        ) : null}

        {/* ---------- ผนัง + หลังคา ---------- */}
        {hasWalls ? (
          <>
            <polygon points={sideFace(l, w, h)} className={kit.wallSide} />
            <polygon points={roofFace(l, w, h)} className={f.roof ? kit.roof : 'fill-line-strong'} />
            <polygon points={frontFace(l, w, h)} className={kit.wall} />
            {/* คานไม้บนสุด ให้เห็นว่าเป็นอาคารไม้ */}
            <rect x={l - 3} y={top - 5} width={w + 6} height={7} rx={3} className="fill-spark-700" />
          </>
        ) : null}

        {/* ---------- ป้ายเปล่า (ไม่มีชื่อร้านในภาพตามคำสั่งเจ้าของ) ---------- */}
        {f.sign ? (
          <>
            {kit.signShape === 'oval' ? (
              <ellipse
                cx={CX}
                cy={signTop + signH / 2}
                rx={w / 2 - 10}
                ry={signH / 2 + 2}
                className="fill-surface-raised stroke-ink-muted"
                strokeWidth={2.5}
              />
            ) : null}
            {kit.signShape === 'rect' ? (
              <rect
                x={l + 10}
                y={signTop}
                width={w - 20}
                height={signH}
                rx={4}
                className="fill-surface-raised stroke-ink-muted"
                strokeWidth={2.5}
              />
            ) : null}
            {kit.signShape === 'hang' ? (
              <>
                <rect x={l + 14} y={signTop - 5} width={3} height={6} rx={1.5} className="fill-ink-muted" />
                <rect x={l + w - 17} y={signTop - 5} width={3} height={6} rx={1.5} className="fill-ink-muted" />
                <rect
                  x={l + 10}
                  y={signTop + 1}
                  width={w - 20}
                  height={signH}
                  rx={7}
                  className="fill-surface-raised stroke-ink-muted"
                  strokeWidth={2.5}
                />
              </>
            ) : null}
            {kit.signShape === 'pennant' ? (
              <polygon
                points={`${l + 10},${signTop} ${l + w - 10},${signTop} ${l + w - 10},${signTop + signH} ${CX},${signTop + signH + 6} ${l + 10},${signTop + signH}`}
                className="fill-surface-raised stroke-ink-muted"
                strokeWidth={2.5}
              />
            ) : null}
          </>
        ) : null}

        {/* ---------- กันสาด ---------- */}
        {f.awning ? (
          <>
            <polygon
              points={`${l + 1},${awningTop} ${l + w - 1},${awningTop} ${l + w - 10},${awningTop + awningH} ${l + 10},${awningTop + awningH}`}
              className={kit.awning[0]}
            />
            {[0.3, 0.62, 0.9].map((t) => (
              <polygon
                key={t}
                points={`${l + 1 + (w - 2) * t},${awningTop} ${l + 1 + (w - 2) * t + 7},${awningTop} ${l + 10 + (w - 20) * t + 4},${awningTop + awningH} ${l + 10 + (w - 20) * t},${awningTop + awningH}`}
                className={kit.awning[1]}
              />
            ))}
          </>
        ) : null}

        {/* ---------- หน้าต่าง ---------- */}
        {f.windows
          ? Array.from({ length: f.windows }, (_, i) => {
              const winW = 20
              const count = f.windows ?? 1
              const gap = (w - 24 - count * winW) / Math.max(1, count - 1)
              return (
                <rect
                  key={`win-${i}`}
                  x={l + 12 + i * (winW + gap)}
                  y={winTop}
                  width={winW}
                  height={17}
                  rx={4}
                  className="fill-brand-100 stroke-ink-muted"
                  strokeWidth={2.5}
                />
              )
            })
          : null}

        {/* ---------- ประตู ---------- */}
        {f.door ? (
          <>
            <rect
              x={CX - 13}
              y={BASE - Math.min(34, h - 4)}
              width={26}
              height={Math.min(34, h - 4)}
              rx={5}
              className="fill-spark-800"
            />
            <circle cx={CX + 7} cy={BASE - 16} r={2.5} className="fill-reward-500" />
          </>
        ) : null}

        {/* ---------- ของประดับบนหลังคา ---------- */}
        {f.roofDecor ? kit.roofDecor(CX + DX / 2, top + DY - 6) : null}
      </g>

      {/* ---------- นั่งร้าน ---------- */}
      {f.scaffold
        ? (() => {
            const sx = l - 10
            const sw = f.scaffold === 2 ? w + 20 : w / 2 + 6
            const sh = hasWalls ? h + 12 : (f.postH ?? 50) + 16
            const rows = Math.max(2, Math.round(sh / 26))
            return (
              <g className="stroke-spark-600" strokeWidth={4} strokeLinecap="round" fill="none">
                <line x1={sx} y1={BASE + 4} x2={sx} y2={BASE - sh} />
                <line x1={sx + sw} y1={BASE + 4} x2={sx + sw} y2={BASE - sh} />
                {Array.from({ length: rows }, (_, i) => {
                  const y = BASE - 6 - (i * sh) / rows
                  return <line key={`sc-${i}`} x1={sx} y1={y} x2={sx + sw} y2={y} />
                })}
                <line x1={sx} y1={BASE + 2} x2={sx + sw} y2={BASE - sh + 10} strokeWidth={3} />
              </g>
            )
          })()
        : null}

      {/* ---------- กรวยจราจร ---------- */}
      {f.cones
        ? Array.from({ length: f.cones }, (_, i) => {
            const cx2 = i === 0 ? 74 : 250
            const cy2 = i === 0 ? 198 : 190
            return (
              <g key={`cone-${i}`}>
                <polygon points={`${cx2 - 9},${cy2} ${cx2 + 9},${cy2} ${cx2 + 3},${cy2 - 22} ${cx2 - 3},${cy2 - 22}`} className="fill-spark-500" />
                <rect x={cx2 - 7} y={cy2 - 14} width={14} height={5} rx={2} className="fill-surface-raised" />
                <rect x={cx2 - 12} y={cy2 - 3} width={24} height={5} rx={2} className="fill-spark-700" />
              </g>
            )
          })
        : null}

      {/* ---------- กองวัสดุ ---------- */}
      {f.crates
        ? Array.from({ length: f.crates }, (_, i) =>
            crate(i === 0 ? 96 : 214, i === 0 ? 206 : 196, `mat-${i}`, i === 0 ? 'fill-spark-600' : 'fill-spark-700'),
          )
        : null}

      {/**
        * ---------- ของประจำประเภท ----------
        * ตำแหน่งยึดกับ "ที่ดิน" ไม่ใช่ขอบตัวอาคาร — ผูกกับขอบอาคารแล้วของจะเลื่อนตามความกว้าง
        * ของแต่ละขั้นจนหลุดขอบภาพ (เห็นจริงตอนเรนเดอร์ 48 ใบมาดู: ตู้เค้กโดนตัดครึ่งที่ขั้น 4)
        * ขยาย 1.35 เท่าเพราะของชิ้นเล็กอ่านไม่ออกเมื่อภาพถูกย่อลงบนจอ 390
        */}
      {f.props
        ? kit.props.slice(0, f.props).map((draw, i) => {
            const spot = PROP_SPOTS[i] ?? PROP_SPOTS[0]!
            return (
              <g key={`prop-${i}`} transform={`translate(${spot[0]} ${spot[1]}) scale(1.35)`}>
                {draw(0, 0, `prop-body-${i}`)}
              </g>
            )
          })
        : null}

      {/* ---------- ต้นไม้หน้าร้าน ---------- */}
      {f.plants
        ? Array.from({ length: f.plants }, (_, i) => {
            const px = i === 0 ? l + w + DX + 4 : l - 20
            const py = i === 0 ? BASE - 2 : BASE + 12
            return (
              <g key={`plant-${i}`}>
                <rect x={px} y={py - 12} width={7} height={14} rx={3} className="fill-spark-700" />
                <circle cx={px + 3} cy={py - 22} r={13} className="fill-quest-500" />
                <circle cx={px - 5} cy={py - 15} r={9} className="fill-quest-600" />
              </g>
            )
          })
        : null}

      {/* ---------- ธงราว (ขั้นเปิดร้าน) ---------- */}
      {f.bunting ? (
        <g>
          <path d="M10 44 Q160 16 310 44" className="fill-none stroke-line-strong" strokeWidth={2} />
          {Array.from({ length: 9 }, (_, i) => {
            const t = (i + 0.5) / 9
            const bx = 10 + 300 * t
            const by = 44 - 28 * Math.sin(Math.PI * t)
            const tones = ['fill-danger-300', 'fill-reward-500', 'fill-quest-500', 'fill-brand-400']
            return (
              <polygon
                key={`bt-${i}`}
                points={`${bx - 7},${by} ${bx + 7},${by} ${bx},${by + 14}`}
                className={tones[i % tones.length]}
              />
            )
          })}
        </g>
      ) : null}
    </svg>
  )
}

export type ShopStageMeterProps = {
  level: ShopStageLevel
  className?: string
}

/**
 * จุดบอกขั้น 6 จุด — ตัวช่วยอ่านอีกชั้นหนึ่งนอกจากตัวภาพ
 * `aria-hidden` เพราะจำนวนด่านที่ผ่านถูกอ่านออกเสียงจาก ProgressBar อยู่แล้ว
 */
export function ShopStageMeter({ level, className }: ShopStageMeterProps) {
  return (
    <ul aria-hidden="true" className={cn('flex items-center justify-center gap-1.5', className)}>
      {Array.from({ length: SHOP_STAGE_MAX + 1 }, (_, i) => (
        <li
          key={i}
          className={cn(
            'h-2.5 rounded-full transition-[width,background-color] duration-300 ease-[var(--ease-soft)] motion-reduce:transition-none',
            i === level ? 'w-6 bg-brand-600' : i < level ? 'w-2.5 bg-quest-500' : 'w-2.5 bg-line-strong',
          )}
        />
      ))}
    </ul>
  )
}

export type ShopStageCardProps = {
  /** ด่านที่ผ่านจริง 0–5 (เซิร์ฟเวอร์คิดมาแล้วใน lessonSummary.stagesCleared) */
  stagesCleared: number
  stagesTotal: number
  /** เปอร์เซ็นต์ความคืบหน้าจากเซิร์ฟเวอร์ */
  percent: number
  /** ข้อความบอกความคืบหน้าจากเซิร์ฟเวอร์ */
  label: string
  /** ชื่อร้านของผู้เรียน — null เมื่อยังไม่ได้ตั้ง (แสดงเป็นข้อความ ไม่ได้อยู่ในภาพ) */
  shopName: string | null
  /** รหัสประเภทธุรกิจจาก loadShopProfile().businessTypeId */
  businessTypeId?: string | null
  /** ซ่อนแถบความคืบหน้ากับชื่อร้าน เหลือแต่ฉาก (ใช้เมื่อหน้ามีตัวเลขอยู่ที่อื่นแล้ว) */
  sceneOnly?: boolean
  className?: string
}

/** การ์ดฉากร้าน — ชื่อร้านอยู่นอกภาพเสมอ */
export function ShopStageCard({
  stagesCleared,
  stagesTotal,
  percent,
  label,
  shopName,
  businessTypeId,
  sceneOnly = false,
  className,
}: ShopStageCardProps) {
  const level = shopStageFromCleared(stagesCleared, stagesTotal)
  const kind = businessKindFrom(businessTypeId)
  const safePercent = Math.min(100, Math.max(0, Math.round(percent)))

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-3xl bg-quest-50 p-2 shadow-soft-2 ring-1 ring-quest-100 ring-inset',
        className,
      )}
    >
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl">
        <ShopStages level={level} kind={kind} decorative className="h-full object-cover" />
      </div>

      {sceneOnly ? null : (
        <>
          <ShopStageMeter level={level} className="mt-2 shrink-0" />
          <div className="mt-2 shrink-0 rounded-2xl bg-surface-raised p-3 shadow-soft-1">
            <p className="truncate text-body font-bold text-ink">
              {shopName ?? 'ยังไม่ได้ตั้งชื่อร้าน'}
            </p>
            <div className="mt-2">
              <ProgressBar
                value={stagesCleared}
                max={stagesTotal}
                label={
                  shopName
                    ? `ความคืบหน้าการสร้างร้าน ${shopName}: ${label}`
                    : `ความคืบหน้าการสร้างร้านของฉัน: ${label}`
                }
                hideLabel
              />
            </div>
            <p className="mt-1.5 text-note text-ink-muted">{`${label} (${safePercent}%)`}</p>
          </div>
        </>
      )}
    </div>
  )
}
