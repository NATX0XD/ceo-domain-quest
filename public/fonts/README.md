# ฟอนต์ไทยสำหรับใบประกาศ PDF

| ไฟล์ | ที่มา | ขนาด |
|---|---|---|
| `Sarabun-Regular-subset.ttf` | Sarabun Regular v1.000 จาก [google/fonts/ofl/sarabun](https://github.com/google/fonts/tree/main/ofl/sarabun) | 38,192 ไบต์ (ไฟล์เต็ม 90,220 ไบต์) |
| `Sarabun-Bold-subset.ttf` | Sarabun Bold v1.000 จากแหล่งเดียวกัน | 37,824 ไบต์ (ไฟล์เต็ม 89,804 ไบต์) |
| `OFL.txt` | ใบอนุญาตต้นฉบับ SIL Open Font License 1.1 | 4,387 ไบต์ |

**ลิขสิทธิ์** Copyright 2018 The Sarabun Project Authors (https://github.com/cadsondemak/Sarabun)
ใช้และแจกจ่ายต่อได้ภายใต้ SIL Open Font License 1.1 ตามไฟล์ `OFL.txt` ในโฟลเดอร์นี้

**ห้ามใช้ฟอนต์ของระบบปฏิบัติการ** (เช่น Thonburi ของ macOS) เพราะแจกจ่ายต่อไม่ได้ และเครื่องที่รันอาจไม่มีฟอนต์นั้น

## คำสั่งที่ใช้ subset
ตัดเหลือเฉพาะอักขระที่ใบประกาศใช้จริง — ไทยทั้งบล็อก ละติน ตัวเลข และเครื่องหมายที่ใช้ในแบบ
เก็บตาราง GSUB/GPOS ไว้ครบด้วย `--layout-features='*'` เพราะสระบน สระล่าง และวรรณยุกต์ของไทยพึ่งตารางนี้ในการจัดตำแหน่ง
ถ้าตัดตารางนี้ทิ้ง สระกับวรรณยุกต์จะลอยผิดที่

```sh
pyftsubset Sarabun-Regular.ttf \
  --output-file=Sarabun-Regular-subset.ttf \
  --unicodes="U+0020-007E,U+00A0,U+00B7,U+2013,U+2014,U+2018-201D,U+2026,U+0E00-0E7F" \
  --layout-features='*' --notdef-outline --drop-tables+=DSIG
```
