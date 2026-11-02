import { z } from 'zod'

/** Shared account rules: keep self-service validation aligned with signup/join. */
export const studentNicknameSchema = z.string().trim().min(1).max(40)
export const studentPinSchema = z.string().regex(/^\d{4}$/, 'รหัสต้องเป็นตัวเลข 4 หลักเท่านั้น')
export const teacherPasswordSchema = z.string().min(10).max(128)
