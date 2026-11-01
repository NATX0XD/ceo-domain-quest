import { z } from 'zod'
import bigMissionJson from '../../content/big-mission.json' with { type: 'json' }
import rubricJson from '../../content/rubric.json' with { type: 'json' }
import reflectionJson from '../../content/reflection.json' with { type: 'json' }
import selfProfileJson from '../../content/self-profile.json' with { type: 'json' }

/**
 * โหลดไฟล์เนื้อหาของขั้นที่ 2 (รู้จักตัวเอง) ขั้นที่ 4 (ภารกิจใหญ่) และขั้นที่ 6 (ทบทวนตัวเอง)
 *
 * ⚠️ ฝั่งเซิร์ฟเวอร์เท่านั้น
 * `preferenceQuestions` มีน้ำหนักคะแนน (weightClip/weightCard/...) อยู่ในไฟล์
 * ถ้าส่งทั้งก้อนไปให้เบราว์เซอร์ นักเรียนจะย้อนสูตรได้ว่าต้องตอบข้อไหนเพื่อให้ระบบเสนอเส้นทางที่ตัวเองอยากได้
 * จึงมี `preferenceQuestionsForClient()` ไว้ตัดน้ำหนักทิ้งก่อนส่งออก
 */
const ChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  talentId: z.string().min(1).optional(),
})

const PreferenceQuestionSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  question: z.string().min(1),
  helper: z.string().min(1),
  choices: z.array(ChoiceSchema).min(2),
})

const ChannelSchema = z.object({
  id: z.enum(['clip', 'card', 'game', 'buddy']),
  name: z.string().min(1),
  shortName: z.string().min(1),
  description: z.string().min(1),
  goodFor: z.string().min(1),
})

const TalentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cardLine: z.string().min(1),
})

const GoalOptionSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  name: z.string().min(1),
  starTarget: z.number().int().positive(),
  starLabel: z.string().min(1),
  description: z.string().min(1),
  forWho: z.string().min(1),
  chooseButtonLabel: z.string().min(1),
})

const SelfProfileSchema = z.object({
  meta: z.object({
    stepNumber: z.number().int(),
    stepName: z.string().min(1),
    minuteFrom: z.number().int(),
    minuteTo: z.number().int(),
    headline: z.string().min(1),
    subHeadline: z.string().min(1),
    maxStars: z.number().int(),
    finishButtonLabel: z.string().min(1),
    ownershipNote: z.string().min(1),
  }),
  channels: z.array(ChannelSchema).length(4),
  talents: z.array(TalentSchema).min(1),
  objectives: z
    .array(
      z.object({
        id: z.string().min(1),
        shortName: z.string().min(1),
        missionTitle: z.string().min(1),
        missionId: z.string().min(1),
      }),
    )
    .min(1),
  preferenceQuestions: z.array(PreferenceQuestionSchema).min(1),
  starBudget: z.object({ maxStars: z.number().int().positive(), perMissionMax: z.number().int().positive() }),
  confidenceScale: z.object({
    question: z.string().min(1),
    helper: z.string().min(1),
    levels: z
      .array(
        z.object({
          id: z.string().min(1),
          value: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          label: z.string().min(1),
          studentText: z.string().min(1),
        }),
      )
      .length(3),
  }),
  goalOptions: z.array(GoalOptionSchema).min(1),
  goalPolicy: z.object({
    defaultGoalId: z.string().min(1),
    lockedNote: z.string().min(1),
    explainerForStudent: z.string().min(1),
    upgradeButtonLabel: z.string().min(1),
  }),
  identityCard: z.object({
    title: z.string().min(1),
    subtitle: z.string().min(1),
    talentLabel: z.string().min(1),
    channelLabel: z.string().min(1),
    channelSuggestionNote: z.string().min(1),
    confirmChannelLabel: z.string().min(1),
    pickAnotherChannelLabel: z.string().min(1),
    pickAnotherChannelHelper: z.string().min(1),
    goalLabel: z.string().min(1),
    focusLabel: z.string().min(1),
    focusEmptyText: z.string().min(1),
    switchChannelHelper: z.string().min(1),
    encouragement: z.string().min(1),
    startButtonLabel: z.string().min(1),
  }),
})

export const selfProfile = SelfProfileSchema.parse(selfProfileJson)

export type LessonChannel = z.infer<typeof ChannelSchema>
export type GoalOption = z.infer<typeof GoalOptionSchema>

/** คำถามความถนัดแบบที่ส่งให้เบราว์เซอร์ได้ — ตัดน้ำหนักคะแนนออกแล้ว */
export function preferenceQuestionsForClient() {
  return selfProfile.preferenceQuestions.map((q) => ({
    id: q.id,
    question: q.question,
    helper: q.helper,
    choices: q.choices.map((c) => ({ id: c.id, text: c.text })),
  }))
}

/** คำถามความมั่นใจสำหรับหน้าจอ — ข้อความทั้งหมดมาจากไฟล์เนื้อหา */
export function confidenceScaleForClient() {
  return {
    question: selfProfile.confidenceScale.question,
    helper: selfProfile.confidenceScale.helper,
    levels: selfProfile.confidenceScale.levels.map((l) => ({
      value: l.value,
      label: l.label,
      studentText: l.studentText,
    })),
  }
}

/**
 * แปลงรหัสภารกิจ (m1-m4, big-ceo) เป็นรหัสวัตถุประสงค์ (obj-1..obj-6)
 * ชั้น DB เก็บความมั่นใจและผลถูก/ผิดเป็นรายวัตถุประสงค์ ไม่ใช่รายภารกิจ
 */
export function objectiveIdForMission(missionId: string): string | null {
  return selfProfile.objectives.find((o) => o.missionId === missionId)?.id ?? null
}

/** ทางกลับ: รหัสวัตถุประสงค์ -> ภารกิจ ใช้ตอนแผงครูอยากโชว์ชื่อภารกิจ */
export function missionIdForObjective(objectiveId: string): string | null {
  return selfProfile.objectives.find((o) => o.id === objectiveId)?.missionId ?? null
}

export function talentOfChoice(choiceId: string): string | null {
  for (const question of selfProfile.preferenceQuestions) {
    const choice = question.choices.find((c) => c.id === choiceId)
    if (choice?.talentId) return choice.talentId
  }
  return null
}

export function findGoal(goalId: string): GoalOption | undefined {
  return selfProfile.goalOptions.find((g) => g.id === goalId)
}

export function findChannel(routeId: string): LessonChannel | undefined {
  return selfProfile.channels.find((c) => c.id === routeId)
}

/* ---------- ภารกิจใหญ่ CEO (ขั้นที่ 4) ---------- */

const BigMissionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  minutes: z.number().int().positive(),
  startMinute: z.number().int(),
  endMinute: z.number().int(),
  objective: z.string().min(1),
  scenario: z.string().min(1),
  fields: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        type: z.enum(['text', 'textarea', 'choice']),
        placeholder: z.string().optional(),
        /** ตัวเลือกของช่องแบบ choice — ไฟล์เนื้อหาใช้ { value, label } */
        options: z
          .array(z.object({ value: z.string().min(1), label: z.string().min(1) }))
          .optional(),
        help: z.string().min(1),
        required: z.boolean(),
      }),
    )
    .min(1),
  guidingQuestions: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).min(1),
  submitModes: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        icon: z.string().min(1),
        instruction: z.string().min(1),
      }),
    )
    .min(1),
  rubric: z
    .array(
      z.object({
        id: z.string().min(1),
        dimension: z.string().min(1),
        levels: z
          .array(
            z.object({
              score: z.number().int(),
              label: z.string().min(1),
              descriptor: z.string().min(1),
            }),
          )
          .min(1),
      }),
    )
    .length(4),
  selfAssessment: z
    .array(z.object({ id: z.string().min(1), question: z.string().min(1), type: z.string().min(1) }))
    .min(1),
})

export const bigMission = BigMissionSchema.parse(bigMissionJson)

const RubricFileSchema = z.object({
  dimensions: z
    .array(
      z.object({
        id: z.string().min(1),
        /** รหัสเดิมในบล็อก rubric ของ big-mission.json เอาไว้แม็ปของเก่า */
        sourceId: z.string().min(1).optional(),
        order: z.number().int().positive(),
        name: z.string().min(1),
        /** ชื่อสั้นไว้พูดถึงด้านนี้ในประโยคเดียว เช่น "เหลืออีก 2 ด้านคือ เหตุผล และ โยงกับร้าน" */
        shortName: z.string().min(1),
        question: z.string().min(1),
        levels: z
          .array(
            z.object({
              score: z.number().int(),
              label: z.string().min(1),
              descriptor: z.string().min(1),
            }),
          )
          .min(1),
      }),
    )
    .length(4),
  emphasis: z.object({
    options: z
      .array(z.object({ id: z.string().min(1), dimensionId: z.string().min(1) }))
      .min(1),
  }),
})

const rubricFile = RubricFileSchema.parse(rubricJson)
export const rubricDimensions = rubricFile.dimensions

/**
 * ตัวเลือก "ด้านที่อยากให้ประเมินหนักเป็นพิเศษ" — id เป็น emphasis-* ชี้ไปที่ dim-*
 * เก็บไว้ที่นี่ที่เดียว เพื่อไม่ให้ที่อื่นสร้างตารางแม็ปของตัวเองขึ้นมาอีก
 */
const emphasisOptions = rubricFile.emphasis.options

/**
 * **ตัวแปลงรหัสด้านของรูบริก — มีที่เดียวในโปรเจกต์ ห้ามเขียนตารางแม็ปซ้ำที่อื่น**
 *
 * ในระบบมีรหัสของด้านเดียวกันอยู่ 3 ชุด เพราะไฟล์เนื้อหาคนละไฟล์เกิดคนละเวลา:
 *
 * | ชุด | ตัวอย่าง | มาจาก | ใครใช้ |
 * |---|---|---|---|
 * | `dim-*` | `dim-tld-fit` | `content/rubric.json` `dimensions[].id` | **รหัสมาตรฐาน** ที่ทุกที่ควรเก็บ |
 * | `bm-r*` | `bm-r2` | `content/big-mission.json` (`sourceId` ของ dim นั้น) | `focusRubricId` ที่หน้าด่านบอสส่งมา |
 * | `emphasis-*` | `emphasis-tld-fit` | `content/rubric.json` `emphasis.options[].id` | ตัวเลือกบนหน้าจอครู |
 *
 * ฟังก์ชันนี้รับได้ทั้ง 3 ชุด แล้วคืน `dim-*` เสมอ · ไม่รู้จัก = `null`
 * จับคู่จากไฟล์เนื้อหาโดยตรง (ผ่าน `sourceId` → `emphasis.options` → ชื่อด้าน) ไม่ผูกคู่ไอดีไว้ในโค้ด
 * ถ้าเพิ่มด้านใหม่ใน `content/rubric.json` ตัวแปลงนี้รู้เองโดยไม่ต้องแก้โค้ด
 */
export function toRubricDimensionId(rubricId: string): string | null {
  // ส่ง dim-* มาอยู่แล้วก็ใช้ได้เลย
  if (rubricDimensions.some((d) => d.id === rubricId)) return rubricId
  // ของเก่าที่ยังส่ง bm-r* มา แม็ปด้วย sourceId ก่อน
  const bySource = rubricDimensions.find((d) => d.sourceId === rubricId)
  if (bySource) return bySource.id
  // ตัวเลือกบนหน้าจอครูเป็น emphasis-* ชี้ไปที่ dim-* อยู่แล้ว
  const byEmphasis = emphasisOptions.find((o) => o.id === rubricId)?.dimensionId
  if (byEmphasis && rubricDimensions.some((d) => d.id === byEmphasis)) return byEmphasis
  // ท้ายสุดค่อยแม็ปด้วยชื่อด้านที่เขียนตรงกันในสองไฟล์
  const dimension = bigMission.rubric.find((r) => r.id === rubricId)?.dimension
  return dimension ? (rubricDimensions.find((d) => d.name === dimension)?.id ?? null) : null
}

/**
 * แปลงกลับเป็นรหัสตัวเลือกบนหน้าจอครู (`emphasis-*`) — คู่กับ `toRubricDimensionId`
 * ใช้ตอนต้องเติมค่าตั้งต้นให้ช่อง "ด้านที่ถ่วง 2 เท่า" จากสิ่งที่นักเรียนเลือกไว้ (`focusRubricId`)
 * ไม่รู้จัก = `null`
 */
export function toEmphasisOptionId(rubricId: string): string | null {
  const dimensionId = toRubricDimensionId(rubricId)
  if (!dimensionId) return null
  return emphasisOptions.find((o) => o.dimensionId === dimensionId)?.id ?? null
}

export function isRubricId(id: string): boolean {
  return toRubricDimensionId(id) !== null
}

/** รูบริกสำหรับหน้าจอ — อ่านจาก content/rubric.json แหล่งเดียว (id เป็น dim-*) */
export function rubricForClient() {
  return [...rubricDimensions]
    .sort((a, b) => a.order - b.order)
    .map((d) => ({
      id: d.id,
      dimension: d.name,
      question: d.question,
      levels: d.levels.map((l) => ({ score: l.score, label: l.label, descriptor: l.descriptor })),
    }))
}

export function isSubmitModeId(id: string): boolean {
  return bigMission.submitModes.some((m) => m.id === id)
}

/* ---------- ทบทวนตัวเอง (ขั้นที่ 6) ---------- */

const ReflectionSchema = z.object({
  meta: z.object({
    stepNumber: z.number().int(),
    stepName: z.string().min(1),
    minuteFrom: z.number().int(),
    minuteTo: z.number().int(),
    headline: z.string().min(1),
    subHeadline: z.string().min(1),
    submitButtonLabel: z.string().min(1),
    skipNote: z.string().min(1),
    savedMessage: z.string().min(1),
  }),
  questions: z
    .array(
      z.object({
        id: z.string().min(1),
        order: z.number().int().positive(),
        question: z.string().min(1),
        helper: z.string().min(1),
        placeholder: z.string().min(1),
        starterPhrases: z.array(z.string().min(1)).min(1),
        minLength: z.number().int().nonnegative(),
        maxLength: z.number().int().positive(),
      }),
    )
    .min(1),
  /** คำถามแตะเลือกสั้น ๆ (ความรู้สึก/ความมั่นใจ) — ไม่บังคับ ไม่นับใน TOTAL_REFLECTION_COUNT */
  extras: z.array(
    z.object({
      id: z.string().min(1),
      kind: z.enum(['feeling', 'stars']),
      question: z.string().min(1),
      options: z.array(z.string().min(1)).optional(),
      max: z.number().int().positive().optional(),
    }),
  ),
  promptShort: z.record(z.string(), z.string().min(1)),
  goalCompare: z
    .array(
      z.object({
        /** id ผูกกับค่าที่ goalOutcome() ของ core คืน: below | met | exceeded */
        id: z.enum(['compare-below', 'compare-met', 'compare-exceeded']),
        badgeLabel: z.string().min(1),
        headline: z.string().min(1),
        /** ข้อความหลัก บังคับทุกการ์ด ส่วนเวอร์ชันใกล้เป้า/ห่างเป้าเป็นของเสริม */
        message: z.string().min(1),
        messageWhenClose: z.string().min(1).optional(),
        messageWhenFar: z.string().min(1).optional(),
        focusLabel: z.string().min(1),
        focusTemplate: z.string().min(1),
        nextStepLabel: z.string().min(1),
        nextStepText: z.string().min(1),
      }),
    )
    .length(3),
  closing: z.object({
    title: z.string().min(1),
    messageAll: z.string().min(1),
    messageThanks: z.string().min(1),
    certificateButtonLabel: z.string().min(1),
    certificateNote: z.string().min(1),
    backToMapLabel: z.string().min(1),
  }),
})

export const reflection = ReflectionSchema.parse(reflectionJson)

/**
 * เลือกการ์ดเปรียบเทียบเป้าหมายตามผลจริง
 * ชื่อ id ในไฟล์เนื้อหาตรงกับค่าที่ goalOutcome() คืนแบบหนึ่งต่อหนึ่ง จึงต่อสตริงได้ตรง ๆ
 */
export function goalCompareCard(outcome: 'below' | 'met' | 'exceeded') {
  const id = `compare-${outcome}` as const
  const card = reflection.goalCompare.find((c) => c.id === id)
  // สคีมาบังคับให้มีครบ 3 ใบและ id ครบทุกค่าอยู่แล้ว ถึงตรงนี้จึงไม่มีทางเป็น undefined
  if (!card) throw new Error(`content/reflection.json ไม่มีการ์ด ${id}`)
  return card
}

/**
 * ข้อความของการ์ด — เลือกเวอร์ชันที่ตรงสถานการณ์ที่สุดก่อนเสมอ
 * ขาดไม่เกิน 2 ดาวใช้ messageWhenClose · ขาดตั้งแต่ 3 ดาวใช้ messageWhenFar ซึ่งไม่พูดถึงจำนวนที่ขาด
 * การ์ดที่ไม่ได้แยกเวอร์ชันไว้จะตกมาที่ message ซึ่งไฟล์เนื้อหาบังคับให้มีทุกใบ
 */
export function goalCompareMessage(
  card: (typeof reflection.goalCompare)[number],
  missingStars: number,
): string {
  if (missingStars <= 2 && card.messageWhenClose) return card.messageWhenClose
  if (missingStars > 2 && card.messageWhenFar) return card.messageWhenFar
  return card.message
}

/** แทนค่าตัวแปรในข้อความเนื้อหา เช่น {nickname} {goalStars} */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  )
}
