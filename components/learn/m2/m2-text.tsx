"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui";
import { KIT, M2Button, M2Screen, ScanArrow } from "./m2-kit";

type Chrome = { onBack: () => void; soundOn: boolean; onSound: () => void };

export type TextQuestion = { id: string; prompt: string; placeholder?: string; hint?: string };
export type TextGrade = { correct?: boolean; score?: number; feedback?: string; hint?: string; reveal?: string };

type Msg = { id: number; who: "dome" | "me" | "card"; tone?: "ok" | "warn"; body: ReactNode };

function LessonCard({ title, children, foot }: { title: string; children: ReactNode; foot?: string }) {
  return (
    <div className="m2g-lesson">
      <p className="m2g-lesson-head">{title}</p>
      <div className="m2g-lesson-body">{children}</div>
      {foot ? <p className="m2g-lesson-foot">{foot}</p> : null}
    </div>
  );
}

const PART_ROWS = [
  ["TLD", "orange", "com", "ขวาสุด บอกประเภทเว็บ"],
  ["SLD", "blue", "forcespeed", "ชื่อร้านที่จดไว้"],
  ["Subdomain", "green", "parts", "ห้องย่อย/บริการ"],
] as const;

const LESSONS: { title: string; body: ReactNode; foot: string }[] = [
  {
    title: "บทอ่าน 1 : ชื่อเว็บแบ่งด้วยจุด",
    body: (
      <>
        <p>ชื่อเว็บ = หลายคำต่อกัน มีจุด ( . ) คั่น</p>
        <p className="m2g-lesson-domain">parts . forcespeed . com</p>
        <p>จุดแต่ละจุดคือรอยต่อระหว่างส่วน</p>
      </>
    ),
    foot: "อ่านจบแล้ว ไปบทอ่านที่ 2 กัน",
  },
  {
    title: "บทอ่าน 2 : 3 ส่วนของชื่อเว็บ",
    body: (
      <div className="m2g-part-rows">
        {PART_ROWS.map(([name, tone, word, text]) => (
          <p key={name}>
            <span className={cn("m2g-part-pill", `tone-${tone}`)}>{name}</span>
            <span>
              <b>{word}</b> {text}
            </span>
          </p>
        ))}
      </div>
    ),
    foot: "เจ้าของร้านตั้ง Subdomain เองได้",
  },
  {
    title: "บทอ่าน 3 : คอมพิวเตอร์อ่านจากขวาไปซ้าย",
    body: (
      <>
        <p>เหมือนส่งพัสดุ : หาประเทศ › เมือง › บ้าน</p>
        <p className="m2g-lesson-domain">com › forcespeed › parts</p>
        <p className="m2g-lesson-split">
          <span>ใหญ่สุด</span>
          <span>เล็กสุด</span>
        </p>
      </>
    ),
    foot: "คนอ่านซ้ายไปขวา แต่คอมพิวเตอร์ค้นจากขวาไปซ้าย",
  },
];

/* step plan (6 dots): L1 · L2 · Q1 · L3 · Q2 · Q3 */
type Phase =
  | { kind: "intro" }
  | { kind: "lesson"; n: 0 | 1 | 2 }
  | { kind: "question"; q: 0 | 1 | 2 }
  | { kind: "done" };

export function TextChat({
  chrome,
  questions,
  grade,
  saveNotebook,
  onFinish,
}: {
  chrome: Chrome;
  questions: TextQuestion[];
  grade: (question: TextQuestion, answer: string, attempt: number) => Promise<TextGrade | null>;
  saveNotebook: () => Promise<boolean>;
  onFinish: (scores: number[]) => void;
}) {
  const nextId = useRef(1);
  const mk = (who: Msg["who"], body: ReactNode, tone?: Msg["tone"]): Msg => ({ id: nextId.current++, who, body, tone });
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    mk("dome", "CEO ครับ! ช่างโอ๊ตเจ้าของอู่ ForceSpeed เปิดหน้าเว็บขายอะไหล่ parts.forcespeed.com"),
    mk("dome", "ลูกน้องในอู่อ่านชื่อเว็บไม่เป็น ช่างโอ๊ตเลยขอให้เราช่วยทำคู่มือ เรามาอ่านไปพร้อมกันนะ"),
  ]);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [draft, setDraft] = useState("");
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [scores, setScores] = useState<number[]>([]);
  const [typing, setTyping] = useState(false);
  const [saved, setSaved] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  const dot =
    phase.kind === "intro" ? 0 : phase.kind === "lesson" ? [0, 1, 3][phase.n]! : phase.kind === "question" ? [2, 4, 5][phase.q]! : 6;

  function push(...items: Msg[]) {
    setMsgs((current) => [...current, ...items]);
  }
  function showLesson(n: 0 | 1 | 2) {
    const lesson = LESSONS[n]!;
    push(
      mk(
        "card",
        <>
          <LessonCard title={lesson.title} foot={lesson.foot}>
            {lesson.body}
          </LessonCard>
          {n === 2 ? <ScanArrow active /> : null}
        </>,
      ),
    );
    setPhase({ kind: "lesson", n });
  }
  function ask(q: 0 | 1 | 2) {
    const question = questions[q];
    push(
      mk(
        "dome",
        <>
          <b>คำถามที่ {q + 1}</b>
          <br />
          {question?.prompt} พิมพ์ตอบได้เลย
        </>,
      ),
    );
    setPhase({ kind: "question", q });
  }
  function quick() {
    if (phase.kind === "intro") {
      push(mk("me", "ได้เลย เริ่มเลยครับ"));
      window.setTimeout(() => showLesson(0), 250);
    } else if (phase.kind === "lesson") {
      if (phase.n === 0) showLesson(1);
      else if (phase.n === 1) ask(0);
      else ask(1);
    }
  }
  async function finish(nextScores: number[]) {
    push(
      mk("dome", "สุดยอด! ครบทุกข้อแล้ว ช่างโอ๊ตได้คู่มือแล้ว", "ok"),
      mk(
        "card",
        <LessonCard title="สรุปคู่มืออ่านชื่อเว็บ">
          <div className="m2g-part-rows">
            {(
              [
                ["booking", "green", "Subdomain ห้องย่อย (ตั้งเอง)"],
                ["forcespeed", "blue", "SLD ชื่อร้าน"],
                ["com", "orange", "TLD ประเภทเว็บ"],
              ] as const
            ).map(([word, tone, text]) => (
              <p key={word}>
                <span className={cn("m2g-part-pill", `tone-${tone}`)}>{word}</span>
                <span>{text}</span>
              </p>
            ))}
            <p className="m2g-lesson-read">อ่าน : ขวา › ซ้าย · ใหญ่ › เล็ก</p>
          </div>
        </LessonCard>,
      ),
    );
    setPhase({ kind: "done" });
    setScores(nextScores);
    setSaved(await saveNotebook());
  }
  async function send() {
    if (phase.kind !== "question" || !draft.trim() || typing) return;
    const question = questions[phase.q];
    if (!question) return;
    const answer = draft.trim();
    const attempt = (attempts[question.id] ?? 0) + 1;
    push(mk("me", answer));
    setDraft("");
    setTyping(true);
    const result = await grade(question, answer, attempt);
    setTyping(false);
    if (!result) {
      push(mk("dome", "ส่งคำตอบไม่สำเร็จ ลองกดส่งอีกครั้งนะครับ", "warn"));
      return;
    }
    setAttempts((all) => ({ ...all, [question.id]: attempt }));
    if (result.correct || result.reveal) {
      push(
        mk(
          "dome",
          result.correct
            ? `ถูกต้องครับ! ${result.feedback ?? ""}`
            : `ไม่เป็นไรครับ เฉลยคือ ${result.reveal}`,
          result.correct ? "ok" : "warn",
        ),
      );
      const nextScores = [...scores, result.score ?? 0];
      setScores(nextScores);
      if (phase.q === 0) window.setTimeout(() => showLesson(2), 350);
      else if (phase.q === 1) window.setTimeout(() => ask(2), 350);
      else void finish(nextScores);
    } else {
      push(
        mk("dome", `เกือบแล้วครับ! ${result.feedback ?? ""}`, "warn"),
        mk("dome", `คำใบ้ ${attempt} : ${result.hint ?? question.hint ?? "ลองย้อนอ่านบทอ่านด้านบนอีกครั้งนะ"}`, "warn"),
      );
    }
  }
  function hint() {
    if (phase.kind !== "question") {
      push(mk("dome", "อ่านบทอ่านให้จบก่อน แล้วโดมจะถามคำถามนะครับ"));
      return;
    }
    const question = questions[phase.q];
    push(mk("dome", `คำใบ้ : ${question?.hint ?? "ลองย้อนอ่านบทอ่านด้านบน"}`, "warn"));
  }

  const quickLabel =
    phase.kind === "intro"
      ? "ได้เลย เริ่มเลยครับ"
      : phase.kind === "lesson"
        ? phase.n === 0
          ? "อ่านแล้ว ไปบทอ่าน 2"
          : "อ่านแล้ว พร้อมตอบ"
        : null;

  return (
    <M2Screen {...chrome} title="แชทติวกับโดม" subtitle="อู่ ForceSpeed" tone="chat" className="m2g-chat">
      <div className="m2g-dots" aria-label={`ความคืบหน้า ${Math.min(dot, 6)}/6`}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <i key={index} className={cn(index < dot && "is-done", index === dot && "is-now")} />
        ))}
      </div>
      <div className="m2g-chat-list" ref={listRef}>
        {msgs.map((msg) =>
          msg.who === "card" ? (
            <div key={msg.id} className="m2g-chat-card">
              {msg.body}
            </div>
          ) : (
            <div key={msg.id} className={cn("m2g-msg", `is-${msg.who}`, msg.tone && `tone-${msg.tone}`)}>
              {msg.who === "dome" ? <img src={KIT("dome_cheer")} alt="" aria-hidden /> : null}
              <p>{msg.body}</p>
            </div>
          ),
        )}
        {typing ? (
          <div className="m2g-msg is-dome is-typing">
            <img src={KIT("dome_cheer")} alt="" aria-hidden />
            <p>
              <i />
              <i />
              <i />
            </p>
          </div>
        ) : null}
        {quickLabel ? (
          <button type="button" className="m2g-quick" onClick={quick}>
            {quickLabel}
          </button>
        ) : null}
      </div>
      {phase.kind === "done" ? (
        <div className="m2g-chat-done">
          <span className="m2g-saved">{saved ? "บันทึกลงสมุดโน้ตแล้ว ✓" : "กำลังบันทึกสมุดโน้ต…"}</span>
          <M2Button color="orange" onClick={() => onFinish(scores)}>
            ไปเช็กความเข้าใจ
          </M2Button>
        </div>
      ) : (
        <form
          className="m2g-input"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <button type="button" className="m2g-input-hint" onClick={hint} aria-label="ขอคำใบ้">
            <img src={KIT("icon_hint")} alt="" />
          </button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={phase.kind === "question" ? "พิมพ์คำตอบได้อิสระ..." : "อ่านบทอ่านก่อน แล้วโดมจะถาม"}
            disabled={phase.kind !== "question" || typing}
            aria-label="พิมพ์คำตอบ"
            maxLength={600}
          />
          <button
            type="submit"
            className="m2g-send"
            disabled={phase.kind !== "question" || !draft.trim() || typing}
            aria-label="ส่งคำตอบ"
          >
            <img src="/ui/kit2/send-button.webp" alt="" />
          </button>
        </form>
      )}
    </M2Screen>
  );
}
