import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LiveBoardClient } from './board/live-board-client'
import { AiSwitch } from './ai-switch'
import { TeacherCockpit } from './_ux/cockpit'
import { Dialog, DangerButton } from './_ux/dialog'
import { DemoModeBanner } from './demo-mode'
import { PlanRequests } from './board/plan-requests'
import { ClassReportClient, toPlainText } from './report/class-report-client'
import { StudentReportClient } from './student/student-report-client'

/**
 * เทสต์ว่าสามหน้าจอใหม่ของครู "แสดงตัวเลขจริงที่ API ส่งมา" ไม่ใช่จอว่าง
 *
 * ข้อมูลตัวอย่างในไฟล์นี้คัดมาจากผลจริงของห้อง UAT777 ตอนตรวจ (ดู result-t56.md)
 * ไม่ยิงเครือข่ายและไม่แตะฐานข้อมูล — ใส่ผ่าน prop `initial*` ที่มีไว้เพื่อการนี้
 */

const boardFixture = {
  students: 6,
  flagged: 3,
  needsHelp: 1,
  shouldTalk: 0,
  shouldPraise: 1,
  pendingReview: 1,
  board: [
    {
      studentId: 'stu-tonkla',
      nickname: 'ต้นกล้า',
      businessName: 'ต้นกล้าซ่อมมือถือ',
      learningRoute: 'card',
      scaffoldLevel: 3,
      goalStatus: 'เป้า 6 ดาว',
      earnedStars: 1,
      currentMission: {
        missionId: 'm2',
        title: 'แยกชิ้นส่วนชื่อเว็บ',
        attempts: 2,
        hintsUsed: 3,
        maxHints: 3,
        solved: false,
      },
      idleSeconds: 628,
      skippedMissions: ['m1'],
      pendingReview: false,
      askedForHelp: true,
      helpMissionId: 'm2',
      calibration: [],
      flag: {
        flagged: true,
        level: 'red' as const,
        label: 'กดขอครูเอง ให้ความสำคัญก่อน',
        reasonName: 'กดปุ่มขอให้ครูช่วย',
        teacherNote: 'เดินไปหาก่อนคนอื่น',
      },
      coachCard: {
        question: 'ลองอ่านชื่อเว็บนี้ให้ครูฟังทีละส่วนได้ไหม',
        followUpQuestion: 'ส่วนไหนที่บอกว่าเป็นเว็บของใคร',
        watchFor: 'เด็กแยกจุดไม่ออก',
        avoidSaying: 'มันง่ายจะตาย',
        encouragement: 'กล้าขอความช่วยเหลือเป็นเรื่องดี',
      },
    },
    {
      studentId: 'stu-arm',
      nickname: 'อาร์ม',
      businessName: 'อาร์มเกมเซ็นเตอร์',
      learningRoute: 'game',
      scaffoldLevel: 1,
      goalStatus: 'เป้า 14 ดาว',
      earnedStars: 11,
      currentMission: null,
      idleSeconds: 628,
      skippedMissions: [],
      pendingReview: false,
      askedForHelp: false,
      helpMissionId: null,
      calibration: [],
      flag: { flagged: false, level: null, label: null, reasonName: null, teacherNote: null },
      coachCard: null,
    },
  ],
}

const classReportFixture = {
  classroomId: 'room-uat777',
  headcount: 6,
  efficiency: {
    e1: { sum: 40, n: 9, mean: 4.4444, max: 27, percent: 22.22, meetsStandard: false, reason: null },
    e2: { sum: 70, n: 9, mean: 7.7778, max: 10, percent: 77.78, meetsStandard: false, reason: null },
    label: '22.22/77.78',
    standardLabel: '80/80',
    meetsStandard: false,
    summary: 'ยังไม่ถึงเกณฑ์ 80/80',
  },
  tests: {
    quizMax: 10,
    pre: { n: 9, mean: 4.8889, sd: 2.2608, min: 2, max: 8 },
    post: { n: 9, mean: 7.7778, sd: 1.8559, min: 5, max: 10 },
    pairedTTest: {
      n: 9,
      df: 8,
      meanDiff: 2.8889,
      sdDiff: 0.7817,
      t: 11.0864,
      p: 0.000004,
      alpha: 0.05,
      significant: true,
      direction: 'higher',
      reason: null,
    },
    // Hedges' g < Cohen's d เสมอ (คูณตัวแก้อคติกลุ่มเล็ก) และคนละค่ากับ Hake's <g> ข้างล่าง
    effectSize: {
      d: 3.6955,
      level: 'ใหญ่',
      reason: null,
      hedgesG: 3.3675,
      hedgesLevel: 'ใหญ่',
      hedgesReason: null,
    },
    normalizedGain: {
      g: 0.5652,
      hakeG: 0.5652,
      prePercent: 48.89,
      postPercent: 77.78,
      level: 'ปานกลาง',
      meetsTarget: true,
      reason: null,
    },
    agreement: {
      aiVsTeacher: { pairCount: 12, exactCount: 9, withinOneCount: 12, exactPercent: 75, withinOnePercent: 100 },
      selfVsTeacher: { pairCount: 6, exactCount: 3, withinOneCount: 5, exactPercent: 50, withinOnePercent: 83.33 },
    },
  },
  objectives: { 'obj-1': 6, 'obj-2': 6, 'obj-3': 3, 'obj-4': 3, 'obj-5': 2, 'obj-6': 3 },
  avgStars: 6,
  avgGain: 2.89,
  objectiveGaps: [
    {
      objectiveId: 'obj-3',
      passedCount: 3,
      headcount: 6,
      passRate: 0.5,
      advice: 'ทบทวนเรื่องประเภทของนามสกุลโดเมนซ้ำ',
      // บทสอนซ่อม 3 นาที + คำถามชวนคิด — API ส่งมาตลอด จอเพิ่งเอามาใช้ที่ T78
      miniLesson: { id: 'lesson-obj-3', minutes: ['จัดการ์ดนามสกุลเป็น 4 กลุ่ม', 'เทียบหมวด .th กับเจ้าของเว็บ', 'ถามว่าร้านตัวเองจดนามสกุลไหนได้'] },
      coachQuestions: [{ misconception: 'คิดว่า .shop เป็นโดเมนประเทศ', question: 'มีประเทศชื่อ shop ไหม' }],
    },
  ],
  hardestMissions: [
    { missionId: 'm3', title: 'เลือกนามสกุลให้ถูกประเภท', played: 5, passed: 3, passRate: 0.6, attemptsMean: 1.8 },
  ],
  helperEffectiveness: [
    { route: 'game', used: 4, passed: 4, passRate: 1, hintsPerMission: 0.75 },
    { route: 'buddy', used: 2, passed: 1, passRate: 0.5, hintsPerMission: 1.5 },
  ],
  personalized: {
    chosenDifferentFromSuggestion: 1,
    switchedRoute: 6,
    raisedOwnGoal: 0,
    teacherOverrides: 0,
  },
  buddy: { requests: 1, helped: 1, passedAfterHelp: 1 },
  survey: {
    responses: 6,
    completed: 6,
    overallMean: 4.04,
    items: {
      q1: { n: 6, mean: 4.17, sd: 0.75, distribution: { '1': 0, '2': 0, '3': 1, '4': 3, '5': 2 } },
      q4: { n: 6, mean: 3.17, sd: 0.75, distribution: { '1': 0, '2': 1, '3': 3, '4': 2, '5': 0 } },
    },
    itemLabels: { q1: 'สื่อนี้ใช้งานง่าย (การใช้งาน)', q4: 'ความยากของภารกิจพอดีกับฉัน (การปรับตามผู้เรียน)' },
    openEnded: { like: ['ชอบตอนได้ตั้งชื่อร้านตัวเอง'], improve: ['ตัวหนังสือเล็กไปหน่อย'] },
  },
}

const studentReportFixture = {
  student: { id: 'stu-mali', nickname: 'มะลิ', classroomId: 'room-uat777', joinedAt: '2026-09-30T01:09:09Z' },
  profile: {
    business_name: 'มะลิเบเกอรี่',
    domain_name: 'malibakery',
    channel_suggested: 'clip',
    learning_route: 'game',
    channel_chosen_by: 'student',
    scaffold_level: 2,
    hints_toggled_by: 'student',
    goal_raised_count: 0,
  },
  tests: { pre: 5, post: 8, gain: 3 },
  stars: { earned: 5, goalStars: 10, goalLevel: 2 },
  missions: [
    { missionId: 'm1', channelUsed: 'clip', attempts: 1, hintsUsed: 1, stars: 3, passedAt: '2026-09-30T01:20:00Z', startedAt: null, secondsSpent: 150 },
    { missionId: 'm3', channelUsed: 'clip', attempts: 2, hintsUsed: 1, stars: 0, passedAt: null, startedAt: null, secondsSpent: null },
  ],
  skips: [],
  routeChanges: {
    count: 2,
    items: [
      { missionId: null, from: null, to: 'clip', changedBy: 'system', changedAt: '2026-09-30T01:10:00Z' },
      { missionId: 'm2', from: 'clip', to: 'game', changedBy: 'student', changedAt: '2026-09-30T01:15:00Z' },
    ],
  },
  boss: [],
  reflections: [{ questionId: 'r1', answer: 'วันนี้ได้ลองตั้งชื่อร้านตัวเอง', createdAt: '2026-09-30T01:30:00Z' }],
  peerFeedback: { given: 0, received: 0 },
  buddy: { helpedOthers: 0, askedForHelp: 1, passedAfterHelp: 1 },
  confidence: { 'obj-1': 2, 'obj-4': 1 },
}

/**
 * คัดมาจากผลจริงของ GET /api/teacher/report/items ห้อง UAT777 ตอนตรวจ T59
 * (8 คนทำแบบทดสอบจริงผ่าน /api/pretest กับ /api/posttest — ดู result-t59.md)
 */
const itemAnalysisFixture = {
  classroomId: 'room-uat777',
  criteria: { difficultyMin: 0.2, difficultyMax: 0.8, discriminationMin: 0.2 },
  sets: [
    {
      set: 'pre' as const,
      label: 'ชุด A — ก่อนเรียน',
      responders: 8,
      groupSize: 2,
      itemCount: 10,
      usableCount: 8,
      needsReviewCount: 2,
      items: [
        {
          itemId: 'pre-1',
          question: 'ชื่อโดเมน (domain name) คืออะไร',
          objectiveIds: ['obj-1'],
          correctCount: 5,
          responseCount: 8,
          difficulty: 0.625,
          discrimination: 1,
          difficultyOk: true,
          discriminationOk: true,
          usable: true,
          difficultyNote: 'ความยากกำลังดี',
          discriminationNote: 'แยกคนเก่งกับคนอ่อนได้ดี',
          verdict: 'ใช้ข้อนี้ต่อได้',
        },
        {
          itemId: 'pre-8',
          question: 'ข้อใดคือขั้นตอนแรกของการจดทะเบียนชื่อโดเมน',
          objectiveIds: ['obj-4'],
          correctCount: 3,
          responseCount: 8,
          difficulty: 0.375,
          discrimination: 0,
          difficultyOk: true,
          discriminationOk: false,
          usable: false,
          difficultyNote: 'ความยากกำลังดี',
          discriminationNote: 'แยกคนเก่งกับคนอ่อนไม่ออก',
          verdict: 'ควรปรับตัวลวง ตัวเลือกที่ผิดอาจดูผิดชัดเกินไป',
        },
      ],
    },
    {
      set: 'post' as const,
      label: 'ชุด B — หลังเรียน',
      responders: 0,
      groupSize: 0,
      itemCount: 10,
      usableCount: 0,
      needsReviewCount: 0,
      items: [],
    },
  ],
}

describe('T-05 แผงห้องเรียนสด', () => {
  const html = renderToStaticMarkup(
    <LiveBoardClient classroomId="room-uat777" initialData={boardFixture} />,
  )

  it('เห็นทุกคนในห้องพร้อมกัน ไม่ใช่จอว่าง', () => {
    expect(html).toContain('ต้นกล้า')
    expect(html).toContain('อาร์ม')
  })

  it('คนที่กดขอครูขึ้นสถานะต้องช่วยด่วน และมาก่อนคนอื่น', () => {
    expect(html).toContain('ต้องช่วยด่วน')
    expect(html.indexOf('ต้นกล้า')).toBeLessThan(html.indexOf('อาร์ม'))
  })

  it('คนที่ไม่ติดอะไรขึ้นสถานะปกติ', () => {
    expect(html).toContain('ปกติ')
  })

  it('สรุปหัวจอบอกจำนวนจริง', () => {
    expect(html).toContain('อยู่ในห้อง')
    expect(html).toContain('>6<')
    expect(html).toContain('กดขอครู')
  })
})

describe('T-11 รายงานรายห้อง', () => {
  const html = renderToStaticMarkup(
    <ClassReportClient
      classroomId="room-uat777"
      roomCode="UAT777"
      initialReport={classReportFixture}
      initialItemAnalysis={itemAnalysisFixture}
    />,
  )

  it('เห็น E1/E2 พร้อมเกณฑ์', () => {
    expect(html).toContain('22.22/77.78')
    expect(html).toContain('80/80')
  })

  it("เห็น t-test · Cohen's d · คะแนนพัฒนาการ", () => {
    expect(html).toContain('11.0864')
    expect(html).toContain('3.6955')
    expect(html).toContain('0.5652')
    expect(html).toContain('df = 8')
  })

  it('บอกว่าจุดประสงค์ข้อไหนห้องนี้ยังอ่อน', () => {
    expect(html).toContain('ห้องนี้ยังอ่อนเรื่องไหน')
    expect(html).toContain('ประเภทของนามสกุลโดเมน')
  })

  it('มีปุ่มพิมพ์และปุ่มคัดลอกตัวเลข', () => {
    expect(html).toContain('พิมพ์ / บันทึกเป็น PDF')
    expect(html).toContain('คัดลอกตัวเลขทั้งชุด')
  })

  it('เห็นค่าความยาก p กับอำนาจจำแนก r รายข้อ แยกชุด A กับ B', () => {
    expect(html).toContain('ค่าความยาก (p) และอำนาจจำแนก (r) รายข้อ')
    expect(html).toContain('ชุด A — ก่อนเรียน')
    expect(html).toContain('ชุด B — หลังเรียน')
    expect(html).toContain('0.63') // p ของ pre-1 = 0.625
    expect(html).toContain('pre-8')
  })

  it('อธิบายเป็นภาษาที่ครูอ่านแล้วตัดสินใจได้ ไม่ใช่ตัวเลขเปล่า', () => {
    expect(html).toContain('แยกคนเก่งกับคนอ่อนไม่ออก')
    expect(html).toContain('ควรปรับตัวลวง')
    expect(html).toContain('ความยากกำลังดี')
    expect(html).toContain('กลุ่มละ 2 คน')
  })

  it('บอกชัดว่าตารางนี้ไม่เปิดเฉลย', () => {
    expect(html).toContain('ไม่บอกว่าข้อไหนเฉลยตัวเลือกใด')
    // ไม่มีคำว่า answerIndex หรือเลขตัวเลือกที่เด็กกดหลุดมาในหน้าเดียวกัน
    expect(html).not.toContain('answerIndex')
    expect(html).not.toContain('choiceIndex')
  })

  it('ชุดที่ยังไม่มีใครทำ บอกว่ารอข้อมูล ไม่ใช่โชว์ 0 ให้เข้าใจผิด', () => {
    expect(html).toContain('ยังไม่มีใครทำชุดนี้')
  })
})

describe('T-10 รายงานรายคน', () => {
  const html = renderToStaticMarkup(
    <StudentReportClient
      classroomId="room-uat777"
      studentId="stu-mali"
      initialRoster={[{ studentId: 'stu-mali', nickname: 'มะลิ', earnedStars: 5, pendingReview: false }]}
      initialReport={studentReportFixture}
    />,
  )

  it('เห็นดาวและเป้าหมายที่ผู้เรียนตั้งเอง', () => {
    expect(html).toContain('มะลิ')
    expect(html).toContain('5 ดวง')
    expect(html).toContain('10 ดวง')
  })

  it('เห็นจุดประสงค์ที่ผ่านและที่ยังไม่ผ่าน', () => {
    expect(html).toContain('ความหมายและประโยชน์ของชื่อโดเมน')
    expect(html).toContain('ผ่าน')
    expect(html).toContain('ยังไม่ผ่าน')
  })

  it('เห็นร่องรอยการปรับเหมาะ: ระบบเสนออะไร ผู้เรียนเลือกอะไร', () => {
    expect(html).toContain('ระบบเสนอช่องทาง')
    expect(html).toContain('เลือกต่างจากที่ระบบเสนอ')
    expect(html).toContain('ดูคลิป')
    expect(html).toContain('เล่นเกม')
    expect(html).toContain('ผู้เรียนเปลี่ยนเอง')
  })

  it('มีปุ่มพิมพ์', () => {
    expect(html).toContain('พิมพ์ / บันทึกเป็น PDF')
  })
})

/**
 * S-08 คำขอเปลี่ยนแผน — ฝั่งครู (T65)
 * ข้อมูลตัวอย่างคัดจากคำขอจริงของห้อง UAT777 ตอนตรวจ (ดู result-t65.md)
 */
const planRequestFixture = {
  ok: true,
  role: 'teacher',
  pendingCount: 1,
  requests: [
    {
      id: 'req-1',
      studentId: 'stu-test',
      nickname: 'ทดสอบครูยืนยัน',
      kind: 'level' as const,
      missionId: 'm4',
      requestedValue: '3',
      reason: 'ข้อนี้ยากกว่าที่คิด ขอตัวช่วยเยอะขึ้นหน่อยครับ',
      status: 'pending',
      grantedValue: null,
      teacherResponse: null,
      respondedAt: null,
      createdAt: '2026-09-30T02:00:00Z',
      summary: 'ขอเปลี่ยนระดับความยาก เป็น ระดับ 3 (ภารกิจที่ 4)',
    },
  ],
}

describe('S-08 คำขอเปลี่ยนแผน ฝั่งครู', () => {
  const html = renderToStaticMarkup(
    <PlanRequests classroomId="room-uat777" initialData={planRequestFixture} />,
  )

  it('เห็นว่าใครขอ ขออะไร และขอกับภารกิจไหน', () => {
    expect(html).toContain('ทดสอบครูยืนยัน')
    expect(html).toContain('ขอเปลี่ยนระดับความยาก เป็น ระดับ 3 (ภารกิจที่ 4)')
    expect(html).toContain('รอตอบ 1')
  })

  it('เหตุผลที่ผู้เรียนพิมพ์เองขึ้นเต็ม ไม่ถูกตัด', () => {
    expect(html).toContain('ข้อนี้ยากกว่าที่คิด ขอตัวช่วยเยอะขึ้นหน่อยครับ')
  })

  it('มีปุ่มให้ครูตัดสินครบ 3 ทาง', () => {
    expect(html).toContain('ให้ตามที่ขอ')
    expect(html).toContain('ให้แบบอื่นแทน')
    expect(html).toContain('ยังไม่ให้รอบนี้')
  })

  it('ให้แบบอื่นแทนต้องเลือกค่าได้ก่อน จะได้เก็บทั้งที่ขอและที่ได้จริง', () => {
    expect(html).toContain('ถ้าจะให้แบบอื่นแทน เลือกสิ่งที่ให้จริง')
    expect(html).toContain('ระดับ 1')
    expect(html).toContain('ระดับ 2')
  })

  it('ห้องที่ยังไม่มีคำขอ บอกครูว่าคำขอจะเด้งขึ้นเอง ไม่ใช่จอว่าง', () => {
    const empty = renderToStaticMarkup(
      <PlanRequests
        classroomId="room-uat777"
        initialData={{ ok: true, role: 'teacher', pendingCount: 0, requests: [] }}
      />,
    )
    expect(empty).toContain('ยังไม่มีคำขอที่รอตอบ')
  })
})

/**
 * E-16 โหมดสาธิต — ป้ายกับปุ่มล้าง
 *
 * สิ่งที่ล็อกไว้ที่นี่คือ "ห้องเรียนจริงต้องไม่มีป้ายและไม่มีปุ่ม" กับ "ปุ่มล้างไม่ยิงทันทีที่กด"
 * ด่านจริงที่กันห้องเรียนจริงอยู่ใน SQL (`reset_demo_classroom`) เทสต์นี้กันแค่ชั้นหน้าจอ
 */
describe('โหมดสาธิต (E-16)', () => {
  it('ห้องเรียนจริงไม่ขึ้นป้ายและไม่มีปุ่มล้าง', () => {
    const html = renderToStaticMarkup(
      <DemoModeBanner classroomId="room-uat777" roomCode="UAT777" isDemo={false} showReset />,
    )
    expect(html).toBe('')
  })

  it('ห้องสาธิตขึ้นป้ายบอกว่าไม่ใช่ข้อมูลเด็กจริง', () => {
    const html = renderToStaticMarkup(
      <DemoModeBanner classroomId="room-quest9" roomCode="QUEST9" isDemo />,
    )
    expect(html).toContain('โหมดสาธิต')
    expect(html).toContain('QUEST9')
    expect(html).toContain('นักเรียนหุ่น')
    expect(html).toContain('ห้ามนำตัวเลขจากห้องนี้ไปอ้างเป็นผลการทดลอง')
  })

  it('ป้ายอย่างเดียวไม่มีปุ่มล้าง เมื่อไม่ได้ขอ showReset', () => {
    const html = renderToStaticMarkup(
      <DemoModeBanner classroomId="room-quest9" roomCode="QUEST9" isDemo />,
    )
    expect(html).not.toContain('ล้างห้องสาธิตกลับค่าเริ่มต้น')
  })

  it('ปุ่มล้างขึ้นได้ แต่จังหวะแรกยังไม่ถามยืนยัน (ต้องกดก่อนถึงจะขึ้น)', () => {
    const html = renderToStaticMarkup(
      <DemoModeBanner classroomId="room-quest9" roomCode="QUEST9" isDemo showReset />,
    )
    expect(html).toContain('ล้างห้องสาธิตกลับค่าเริ่มต้น')
    // คำถามยืนยันยังไม่อยู่บนจอ = กดปุ่มเดียวแล้วลบเลยไม่ได้
    expect(html).not.toContain('กลับค่าเริ่มต้นใช่ไหม')
    expect(html).not.toContain('ใช่ ล้างเลย')
  })
})

/** E-16 ข้อความที่ครูก๊อปไปแปะสไลด์ต้องติดป้ายมาด้วยเมื่อมาจากห้องสาธิต */
describe('รายงานรายห้องจากห้องสาธิต', () => {
  it('ขึ้นป้ายเตือนบนหน้าจอ', () => {
    const html = renderToStaticMarkup(
      <ClassReportClient
        classroomId="room-quest9"
        roomCode="QUEST9"
        initialReport={{ ...classReportFixture, isDemo: true }}
      />,
    )
    expect(html).toContain('ห้องสาธิต')
  })
})

/**
 * T76 — สองสถิติที่คนเรียกว่า "g" ต้องแยกกันชัดทั้งบนจอและในข้อความที่คัดลอก
 *
 * เดิมจอเขียนว่า `คะแนนพัฒนาการ <g>` เฉย ๆ ซึ่งเป็นของ Hake แต่คนอ่านนึกว่า Hedges' g ได้ทันที
 * ถ้าใครก๊อปไปใส่สไลด์ = รายงานตัวเลขผิดให้กรรมการฟัง เทสต์ชุดนี้ล็อกไม่ให้กลับไปกำกวมอีก
 */
describe('รายงานรายห้อง — สถิติครบ 6 ตัวและไม่กำกวม (สเปกข้อ 9.4)', () => {
  const html = renderToStaticMarkup(
    <ClassReportClient classroomId="room-uat777" roomCode="UAT777" initialReport={classReportFixture} />,
  )

  it('โชว์ Hedges’ g ที่ API ส่งมาให้แล้ว ไม่ใช่ทิ้งไว้เฉย ๆ', () => {
    expect(html).toContain('3.3675')
    expect(html).toContain('Hedges')
  })

  it('ป้ายของคะแนนพัฒนาการต้องมีคำว่า Hake กำกับ ห้ามเป็น g เปล่า ๆ', () => {
    expect(html).toContain('Hake')
    // ป้ายเดิมที่กำกวมต้องไม่เหลืออยู่
    expect(html).not.toContain('คะแนนพัฒนาการ &lt;g&gt;')
    expect(html).not.toContain('คะแนนพัฒนาการ <g>')
  })

  it('บอกบนจอว่าสองตัวนี้คนละสถิติกัน', () => {
    expect(html).toContain('เป็นคนละสถิติ')
  })

  it('มีสถิติตัวที่ 6 ร้อยละความตรงกัน พร้อมจำนวนคู่ที่ใช้นับ', () => {
    expect(html).toContain('ร้อยละความตรงกันของคะแนนรายด้าน')
    expect(html).toContain('ตรงกันพอดี 75.00%')
    expect(html).toContain('12 คู่รายเกณฑ์')
    expect(html).toContain('ผู้เรียนประเมินตนเอง')
  })

  it('ครบ 6 สถิติของสเปกข้อ 9.4 บนจอเดียว', () => {
    for (const mark of [
      'S.D.',                       // 1 ค่าเฉลี่ยและส่วนเบี่ยงเบนมาตรฐาน
      't-test แบบจับคู่',            // 2 ค่าทีแบบไม่อิสระ
      'Cohen',                      // 3 ขนาดอิทธิพล (HTML หนี ' เป็น &#x27; จึงเทียบแค่ชื่อ)
      'Hake',                       // 4 คะแนนพัฒนาการแบบปรับมาตรฐาน
      'ร้อยละความตรงกัน',            // 6 ร้อยละความตรงกัน
    ]) {
      expect(html).toContain(mark)
    }
    // 5 ความยาก/อำนาจจำแนก มาจาก /api/teacher/report/items คนละคำขอ — เทสต์อยู่ชุดด้านบน
  })

  it('ข้อความที่คัดลอกไม่กำกวม — ทั้งสองตัวมีชื่อเจ้าของสูตรกำกับ', () => {
    const text = toPlainText(classReportFixture)
    expect(text).toContain("ขนาดอิทธิพล Cohen's d = 3.6955")
    expect(text).toContain("ขนาดอิทธิพลแก้อคติกลุ่มเล็ก Hedges' g = 3.3675")
    expect(text).toContain("คะแนนพัฒนาการแบบปรับมาตรฐาน Hake's <g> = 0.5652")
    expect(text).toContain('เป็นคนละสถิติ')
    expect(text).toContain('ตรงกันพอดี 75.00%')
    // บรรทัดเก่าที่อ่านแล้วนึกว่าเป็น Hedges' g ต้องไม่เหลือ
    expect(text).not.toMatch(/คะแนนพัฒนาการ <g>=/)
  })
})

/**
 * T78 — ของที่ API ส่งมาแล้วจอต้องเอามาใช้จริง
 *
 * แบบเดียวกับที่ Hedges' g เกือบตกหล่นที่ T76: ข้อมูลมาถึงจอตั้งนานแล้วแต่ไม่มีใครวาดออกมา
 * เทสต์ชุดนี้ตรึงไว้ว่าของ 4 ชิ้นนี้ต้องอยู่บนจอ ไม่ใช่ค้างอยู่ใน payload
 */
describe('จอครูใช้ข้อมูลที่ API ส่งมาครบ (T78)', () => {
  const boardHtml = renderToStaticMarkup(
    <LiveBoardClient classroomId="room-uat777" initialData={{ ...boardFixture, coachRules: [
      { id: 'rule-ask-first', text: 'ถามก่อนบอกเสมอ' },
      { id: 'rule-wait', text: 'ถามแล้วรออย่างน้อย 10 วินาที' },
    ] }} />,
  )
  const reportHtml = renderToStaticMarkup(
    <ClassReportClient classroomId="room-uat777" roomCode="UAT777" initialReport={classReportFixture} />,
  )

  it('แผงสดโชว์ "ควรชม" คู่กับ "ควรคุย" ไม่ใช่ด้านลบอย่างเดียว', () => {
    expect(boardHtml).toContain('ควรคุย')
    expect(boardHtml).toContain('ควรชม')
  })

  it('แผงสดมีกติกาการโค้ชให้ครูเปิดอ่าน', () => {
    expect(boardHtml).toContain('กติกาการโค้ช')
    expect(boardHtml).toContain('ถามก่อนบอกเสมอ')
  })

  it('รายงานมีบทสอนซ่อมท้ายคาบ + คำถามชวนคิด ไม่ใช่แค่บอกว่าห้องอ่อนเรื่องไหน', () => {
    expect(reportHtml).toContain('สอนซ่อมท้ายคาบ')
    expect(reportHtml).toContain('จัดการ์ดนามสกุลเป็น 4 กลุ่ม')
    expect(reportHtml).toContain('มีประเทศชื่อ shop ไหม')
    // คำถามชวนคิดต้องเป็นคำถามล้วน ไม่มีเฉลยติดมา
    expect(reportHtml).toContain('ไม่มีเฉลย')
  })

  it('รายงานมีความพึงพอใจรายข้อพร้อมค่าเฉลี่ย/S.D. และข้อความปลายเปิด', () => {
    expect(reportHtml).toContain('ความพึงพอใจรายข้อ')
    expect(reportHtml).toContain('สื่อนี้ใช้งานง่าย')
    expect(reportHtml).toContain('3.17')
    expect(reportHtml).toContain('ตัวหนังสือเล็กไปหน่อย')
  })
})

/**
 * UX-3 — แผงคุมคาบของครู
 *
 * ล็อกไว้ 3 อย่างที่ถ้าหลุดแล้วครูใช้กลางคาบไม่ได้:
 * กล่อง popup ปิดอยู่ต้องไม่กินที่ · ปุ่มงานที่ย้อนไม่ได้ต้องถามก่อนเสมอ · ยังไม่มีห้องต้องบอกทางไปต่อ
 */
describe('แผงคุมคาบของครู (UX-3)', () => {
  it('popup ที่ยังไม่เปิด ไม่เรนเดอร์อะไรเลย', () => {
    const html = renderToStaticMarkup(
      <Dialog open={false} onClose={() => {}} title="ไม่ควรเห็น">
        <p>เนื้อใน</p>
      </Dialog>,
    )
    expect(html).toBe('')
  })

  it('popup ที่เปิดอยู่มีปุ่มปิดที่อ่านออกด้วยเครื่องอ่านหน้าจอ', () => {
    const html = renderToStaticMarkup(
      <Dialog open onClose={() => {}} title="งานที่รอตรวจ" description="ครูยืนยันเสมอ">
        <p>เนื้อใน</p>
      </Dialog>,
    )
    expect(html).toContain('aria-label="ปิดหน้าต่าง"')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('งานที่รอตรวจ')
  })

  it('ปุ่มงานที่ย้อนไม่ได้ ต้องกดสองจังหวะ', () => {
    const idle = renderToStaticMarkup(
      <DangerButton
        label="ปิดคาบ"
        confirmLabel="กดอีกครั้งเพื่อปิดคาบจริง"
        confirming={false}
        onArm={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(idle).toContain('ปิดคาบ')
    expect(idle).not.toContain('กดอีกครั้ง')

    const armed = renderToStaticMarkup(
      <DangerButton
        label="ปิดคาบ"
        confirmLabel="กดอีกครั้งเพื่อปิดคาบจริง"
        confirming
        onArm={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(armed).toContain('กดอีกครั้งเพื่อปิดคาบจริง')
  })

  it('ยังไม่มีห้องเรียน บอกทางไปต่อ ไม่ใช่จอว่าง', () => {
    const html = renderToStaticMarkup(
      <TeacherCockpit
        classroomId={null}
        roomCode={null}
        pendingCount={0}
        hasOpenSession={false}
        alertsSlot={null}
      />,
    )
    expect(html).toContain('ยังไม่มีห้องเรียน')
  })
})

/**
 * T79/H-3 — สวิตช์ปิด AI ต้องมีปุ่มจริงบนจอครู
 *
 * คำตอบกรรมการข้อ 37 บอกว่าครูปิด AI เองได้ระหว่างคาบ ก่อนหน้านี้คอลัมน์มี API รับค่าได้
 * แต่ไม่มีปุ่มให้กดเลย ถ้ากรรมการขอดูการกดปิดจะไม่มีอะไรให้ดู
 */
describe('สวิตช์ปิด AI ของครู (T79)', () => {
  it('ยังไม่เปิดคาบ = ไม่มีสวิตช์ให้กด (ไม่ใช่ปุ่มที่กดแล้วไม่มีผล)', () => {
    expect(renderToStaticMarkup(<AiSwitch sessionId={null} aiEnabled />)).toBe('')
  })

  it('เปิดอยู่ = ปุ่มชวนปิด และบอกว่ามีทางสำรองอยู่แล้ว', () => {
    const html = renderToStaticMarkup(<AiSwitch sessionId="sess-1" aiEnabled />)
    expect(html).toContain('ปิด AI ทั้งห้อง')
    expect(html).toContain('กฎในโค้ด')
  })

  it('ปิดอยู่ = บอกชัดว่าทั้งห้องใช้กฎล้วน และนักเรียนไม่เห็นข้อความผิดพลาด', () => {
    const html = renderToStaticMarkup(<AiSwitch sessionId="sess-1" aiEnabled={false} />)
    expect(html).toContain('ปิดอยู่')
    expect(html).toContain('เปิด AI อีกครั้ง')
    expect(html).toContain('ไม่เห็นข้อความผิดพลาด')
  })
})
