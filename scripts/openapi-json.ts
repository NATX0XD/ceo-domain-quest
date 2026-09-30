/**
 * พิมพ์เอกสาร OpenAPI 3.1 เป็น JSON ออก stdout
 *
 * รัน: `npm run openapi:json > /tmp/openapi.json`
 *
 * **ไม่เขียนไฟล์ลง repo โดยเจตนา** — ของจริงอยู่ที่ `lib/openapi/spec.ts` ไฟล์เดียว
 * ถ้า commit `.json` ไว้ด้วยจะมีของสองใบให้หลุดกัน แล้วไม่มีใครรู้ว่าใบไหนจริง
 * (หน้า `/api-docs` ก็อ่านจากโมดูลตรง ๆ ไม่ได้อ่านไฟล์นี้)
 *
 * เอาไปทำอะไรได้: เปิดใน Swagger Editor · import เข้า Postman/Insomnia · gen client
 */
import { openApiSpec } from '../lib/openapi/spec'

process.stdout.write(`${JSON.stringify(openApiSpec, null, 2)}\n`)
