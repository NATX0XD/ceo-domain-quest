/**
 * ชนิดของเอกสาร OpenAPI 3.1 เท่าที่โปรเจกต์นี้ใช้จริง
 *
 * **ทำไมไม่ลง `openapi-types` หรือ `zod-to-openapi`**
 * เอกสารนี้ใช้ช่องของ OpenAPI อยู่ราวสิบกว่าช่อง การลง dependency เพิ่มเพื่อได้ type
 * ที่ครอบทั้งสเปกจึงไม่คุ้ม และ type ที่กว้างเกินจริงทำให้พิมพ์ผิดหลุดง่ายกว่าเดิม
 * (เช่น `security?: unknown[]` จะไม่จับว่าลืมบอกบทบาทของ endpoint)
 *
 * ⚠️ `security` กับ `description` ที่นี่เป็น **ช่องบังคับ** ต่างจากสเปกจริงที่เป็น optional
 *    เพราะกติกาของโปรเจกต์คือทุกเส้นต้องบอกได้ว่าใครเรียกได้และคืนอะไร
 *    ลืมใส่แล้ว `tsc` ตกทันที ไม่ต้องรอ reviewer
 */

/** JSON Schema ของ OpenAPI 3.1 (เป็น JSON Schema 2020-12 เต็มตัว ไม่ใช่ subset เหมือน 3.0) */
export interface JsonSchema {
  type?: string | readonly string[]
  format?: string
  description?: string
  enum?: readonly (string | number | boolean | null)[]
  items?: JsonSchema
  properties?: Record<string, JsonSchema>
  required?: readonly string[]
  additionalProperties?: boolean | JsonSchema
  oneOf?: readonly JsonSchema[]
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  default?: unknown
  examples?: readonly unknown[]
  $ref?: string
}

export interface ParameterObject {
  name: string
  in: 'query' | 'path' | 'header'
  required?: boolean
  description: string
  schema: JsonSchema
  example?: unknown
}

export interface MediaTypeObject {
  schema: JsonSchema
  example?: unknown
}

export interface RequestBodyObject {
  description?: string
  required?: boolean
  content: Record<string, MediaTypeObject>
}

export interface HeaderObject {
  description: string
  schema: JsonSchema
}

export interface ResponseObject {
  description: string
  headers?: Record<string, HeaderObject>
  content?: Record<string, MediaTypeObject>
}

/** ข้อกำหนดความปลอดภัยแบบ OR — `[{ a: [] }, { b: [] }]` = มี a **หรือ** b ก็พอ */
export type SecurityRequirement = Record<string, readonly string[]>

export interface OperationObject {
  operationId: string
  summary: string
  description: string
  tags: readonly string[]
  security: readonly SecurityRequirement[]
  parameters?: readonly ParameterObject[]
  requestBody?: RequestBodyObject
  responses: Record<string, ResponseObject>
}

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

export type PathItemObject = Partial<Record<HttpMethod, OperationObject>>

export interface SecuritySchemeObject {
  type: 'apiKey'
  in: 'cookie' | 'header'
  name: string
  description: string
}

export interface OpenApiDocument {
  openapi: string
  info: {
    title: string
    version: string
    summary: string
    description: string
    license: { name: string }
  }
  servers: readonly { url: string; description: string }[]
  tags: readonly { name: string; description: string }[]
  components: {
    securitySchemes: Record<string, SecuritySchemeObject>
    schemas: Record<string, JsonSchema>
  }
  paths: Record<string, PathItemObject>
}
