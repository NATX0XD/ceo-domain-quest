"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertIcon,
  CheckIcon,
  DomeAvatar,
  cn,
} from "@/components/ui";
import { useExitConfirm } from "@/components/student-navigation";
import { GameButton, buzz, useGameMotion } from "./index";

/** ชิ้นส่วนร่วมของเกมด่านบอส m4 (R01-R11) สไตล์เดียวกับ storyboard ภารกิจที่ 2:
 *  ฉากเต็มจอ · ป้ายไม้ชื่อภารกิจ · ปุ่มกลมย้อนกลับ/เสียง · บอร์ดครีม · โดมพร้อมกล่องคำพูดสีขาว */

export const BG_FALLBACK =
  "bg-gradient-to-b from-[#fff8e6] via-[#f1e2c3] to-[#c98948]";
/** cn ไม่ merge คลาสที่ชนกัน จึงแยกชุดสีเข้ม/สว่างไว้คนละค่า ห้ามต่อสีทับกัน */
const INPUT_BASE =
  "min-h-12 w-full rounded-xl border-2 px-3 text-body font-semibold focus-visible:outline-3 focus-visible:outline-focus disabled:opacity-70";
export const INPUT = `${INPUT_BASE} border-[#b58a5c] bg-white text-[#3a2a18] placeholder:text-[#8a7a63]`;
export const INPUT_LIGHT = INPUT;
/** ข้อความที่ต้องลอยบนฉาก: วางบนพื้นทึบเสมอ ห้ามวางบนภาพพื้นหลังตรง ๆ */
export const SCENE_NOTE =
  "rounded-xl border-2 border-[#b58a5c] bg-[#fffbf0]/95 px-3 py-2 text-label font-bold text-pretty text-[#3a2a18]";

export const M4_ASSET = (name: string) => `/learn/m2/kit/${name}.webp`;

export function BossShell({
  children,
  stage = "ด่านบอส",
}: {
  children: ReactNode;
  stage?: string;
}) {
  const [soundOn, setSoundOn] = useState(true);
  const exit = useExitConfirm({
    href: "/map",
    note: "ความคืบหน้าในด่านนี้ยังไม่ถูกบันทึก ถ้าออกตอนนี้ต้องเริ่มด่านใหม่",
  });
  return (
    <div className="registrar-game-shell m4-stage">
      <div className="m4-stage-inner">
        <div className="m4-wood-header">
          <button type="button" className="m4-round-button" onClick={exit.request} aria-label="ออกจากด่าน กลับแผนที่">
            {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอนสถิตใน public */}
            <img src={M4_ASSET("icon_back")} alt="" draggable={false} />
          </button>
          <div className="m4-sign-wrap">
            <div className="m4-sign">
              <span className="m4-leaf m4-leaf-left" aria-hidden />
              <span className="m4-leaf m4-leaf-right" aria-hidden />
              <strong>ภารกิจที่ 4</strong>
            </div>
            <span className="m4-subtitle-pill">{stage}</span>
          </div>
          <button
            type="button"
            className={cn("m4-round-button", !soundOn && "is-muted")}
            onClick={() => setSoundOn((v) => !v)}
            aria-label={soundOn ? "ปิดเสียง" : "เปิดเสียง"}
            aria-pressed={!soundOn}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอนสถิตใน public */}
            <img src={M4_ASSET("icon_sound")} alt="" draggable={false} />
          </button>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
      {exit.dialog}
    </div>
  );
}

/** แถบ HUD: ขั้นที่ · เวลา · เหรียญ + แถบความคืบหน้า 10 ช่อง */
export function BossHud({
  step,
  total,
  coins,
  coinNode,
  timer,
}: {
  stage?: string;
  step: number;
  total: number;
  coins: number;
  coinNode: ReactNode;
  timer?: string;
}) {
  const { reduce } = useGameMotion();
  return (
    <div className="m4-hud shrink-0">
      <div className="m4-hud-row">
        <span className="m4-chip">
          {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอนสถิตใน public */}
          <img src="/icons/3d/clipboard.webp" alt="" aria-hidden />
          <span className="sr-only">ขั้น </span>
          <b className="tabular-nums">{Math.min(step, total)}/{total}</b>
        </span>
        <span className="flex-1" />
        {timer ? (
          <span className="m4-chip">
            {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอนสถิตใน public */}
            <img src="/icons/3d/stopwatch.webp" alt="" aria-hidden />
            <span className="sr-only">เวลา</span>
            <b className="tabular-nums">{timer}</b>
          </span>
        ) : null}
        <span className="m4-chip m4-chip-coin">
          <span aria-hidden="true" className="m4-coin" />
          <b className="tabular-nums" aria-label={`เหรียญ ${coins}`}>{coinNode}</b>
        </span>
      </div>
      <div className="m4-progress" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <motion.span
            key={i}
            animate={{ backgroundColor: i < step ? "#67bd59" : "rgba(255,255,255,0.55)" }}
            transition={reduce ? { duration: 0 } : { duration: 0.35, delay: i < step ? 0.04 * i : 0 }}
          />
        ))}
      </div>
    </div>
  );
}

/** ป้าย BOSS เด้งเข้า */
export function BossSign({ className }: { className?: string }) {
  const { reduce } = useGameMotion();
  return (
    <motion.div
      initial={reduce ? false : { scale: 2.2, opacity: 0, rotate: -8 }}
      animate={{ scale: 1, opacity: 1, rotate: -3 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", stiffness: 260, damping: 14 }
      }
      className={cn(
        "rounded-xl border-4 border-[#7a3a00] bg-[#ff8a3d] px-6 py-1.5 text-center text-title leading-tight font-black tracking-widest text-[#2e1500] shadow-[0_6px_0_#5c4228]",
        className,
      )}
    >
      BOSS
    </motion.div>
  );
}

/** รูปบอส (กรอบครีม) หรือโดมสำรองถ้าไม่มีภาพ */
export function BossPortrait({ size = 104 }: { size?: number }) {
  const { reduce } = useGameMotion();
  const [failed, setFailed] = useState(false);
  return (
    <motion.div
      animate={reduce ? undefined : { y: [0, -4, 0] }}
      transition={
        reduce
          ? undefined
          : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
      }
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center overflow-hidden rounded-2xl border-[3px] border-[#ffcf4a] bg-[#f5efe0] shadow-[0_4px_0_#0e0720]"
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- ภาพบอสสถิตใน public
        <img
          src="/learn/m4/boss.png"
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <DomeAvatar mood="greet" size={size - 16} decorative />
      )}
    </motion.div>
  );
}

/** บทพูดโดมหรือบอส: ตัวละครซ้าย + กล่องคำพูดสีขาว (แบบ m2) */
export function Say({
  who = "dome",
  children,
  className,
  bare = false,
}: {
  bare?: boolean;
  who?: "dome" | "boss";
  mood?: "happy" | "greet" | "cheer";
  children: ReactNode;
  className?: string;
}) {
  const { reduce } = useGameMotion();
  return (
    <motion.div
      className={cn("m4-say", className)}
      initial={reduce ? false : { y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 24 }}
    >
      {bare ? null : who === "boss" ? (
        <BossPortrait size={52} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- ภาพโดมสถิตใน public
        <img className="m4-say-dome" src={M4_ASSET("dome_cheer")} alt="" draggable={false} />
      )}
      <div className="m4-say-bubble">
        <span>{who === "boss" ? "บอส" : "โดม"}</span>
        <div>{children}</div>
      </div>
    </motion.div>
  );
}

export type QuizCheck = (
  choice: number,
) => Promise<{ correct: boolean; explanation: string } | null>;

/** แผ่นอีเมลเด้งจากล่าง: อ่านเรื่อง ตอบ แล้วเห็นผลทันทีจากเซิร์ฟเวอร์ */
export function QuizSheet({
  title,
  kicker = "อีเมลใหม่เข้ากล่อง",
  story,
  question,
  choices,
  check,
  onDone,
  doneLabel = "ไปต่อ",
  retry = false,
  icon = "/icons/3d/bell.webp",
  facts,
}: {
  title: string;
  kicker?: string;
  story: string;
  /** ไอคอน 3D หัวการ์ด */
  icon?: string;
  /** ตารางข้อมูล (เช่น นักสืบโดเมน) แสดงแทนย่อหน้าเรื่อง */
  facts?: { icon: string; label: string; value: string }[];
  question: string;
  choices: string[];
  check: QuizCheck;
  onDone: (choice: number, correct: boolean) => void;
  doneLabel?: string;
  /** ตอบผิดแล้วลองอีกครั้งได้ 1 ครั้ง */
  retry?: boolean;
}) {
  const { reduce } = useGameMotion();
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<{
    correct: boolean;
    explanation: string;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);

  async function confirm() {
    if (picked === null) return;
    setBusy(true);
    setErr(null);
    const r = await check(picked);
    setBusy(false);
    if (!r) setErr("ตรวจไม่ได้ตอนนี้ ลองกดอีกครั้ง");
    else setFb(r);
  }

  const sheetRef = useRef<HTMLDivElement>(null)
  const fbRef = useRef<HTMLDivElement>(null)
  // ผลตรวจอยู่ใต้ตัวเลือก เลื่อนให้เห็นทันทีไม่ต้องเลื่อนหาเอง
  useEffect(() => {
    if (fb) fbRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [fb, reduce])
  useEffect(() => {
    sheetRef.current?.scrollIntoView({ block: 'end', behavior: reduce ? 'auto' : 'smooth' })
  }, [reduce])

  return (
    <motion.div
      className="m4-modal absolute inset-0 z-40 flex items-end bg-black/55"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={reduce ? false : { y: "100%" }}
        animate={{ y: 0 }}
        exit={reduce ? undefined : { y: "100%" }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: "spring", stiffness: 300, damping: 30 }
        }
        ref={sheetRef}
        className="m4-modal-card flex max-h-[min(96%,calc(100dvh-4.75rem))] w-full flex-col overflow-hidden rounded-t-3xl border-[3px] border-b-0 border-[#7a5a3a] bg-[#fff8e6] text-[#3a2a18]"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pt-3 pb-2">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอนสถิตใน public */}
            <img src={icon} alt="" aria-hidden className="m4-modal-icon" />
            <div className="min-w-0">
              <p className="text-label font-bold text-[#7a5a2c]">{kicker}</p>
              <p className="text-body font-extrabold text-balance">{title}</p>
            </div>
          </div>
          {facts ? (
            <dl className="m4-facts">
              {facts.map((f) => (
                <div key={f.label}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอนสถิตใน public */}
                  <img src={f.icon} alt="" aria-hidden />
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="rounded-xl bg-[#f1e6c8] px-3 py-2 text-body leading-snug text-pretty">
              {story}
            </p>
          )}
          {facts ? <Say className="m4-modal-say">{question}</Say> : null}
          {facts ? null : <p className="text-body font-extrabold">{question}</p>}
          <div
            role="radiogroup"
            aria-label={question}
            className="flex flex-col gap-1.5"
          >
            {choices.map((c, i) => {
              const on = picked === i;
              return (
                <motion.button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={fb !== null}
                  whileTap={reduce || fb ? undefined : { scale: 0.97 }}
                  onClick={() => {
                    buzz();
                    setPicked(i);
                  }}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-xl border-2 px-2.5 py-1.5 text-left text-body leading-snug font-semibold focus-visible:outline-3 focus-visible:outline-focus",
                    on
                      ? "border-[#3b1d8f] bg-[#ece4ff] shadow-[0_3px_0_#3b1d8f]"
                      : "border-[#c9b68c] bg-white",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-lg text-label font-extrabold",
                      on ? "bg-[#7c4dff] text-white" : "bg-[#f1e6c8]",
                    )}
                  >
                    {["ก", "ข", "ค", "ง", "จ"][i] ?? String(i + 1)}
                  </span>
                  <span className="min-w-0 flex-1 text-pretty">{c}</span>
                </motion.button>
              );
            })}
          </div>
          {err ? (
            <p
              role="alert"
              className="flex items-center gap-2 text-label font-bold text-spark-700"
            >
              <AlertIcon width={18} height={18} aria-hidden /> {err}
            </p>
          ) : null}
          {fb ? (
            <motion.div
              role="status"
              ref={fbRef}
              initial={reduce ? false : { y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={cn(
                "rounded-xl border-2 p-3",
                fb.correct
                  ? "border-quest-500 bg-quest-50"
                  : "border-[#d9a066] bg-[#fff0dc]",
              )}
            >
              <p
                className={cn(
                  "flex items-center gap-2 text-body font-extrabold",
                  fb.correct ? "text-quest-700" : "text-spark-700",
                )}
              >
                {fb.correct ? (
                  <CheckIcon width={20} height={20} aria-hidden />
                ) : (
                  <AlertIcon width={20} height={20} aria-hidden />
                )}
                {fb.correct ? "รับมือถูกแล้ว" : "ยังไม่ใช่ ดูเหตุผลก่อนไปต่อ"}
              </p>
              <p className="mt-1 text-body text-pretty">{fb.explanation}</p>
            </motion.div>
          ) : null}
        </div>
        <div className="m4-modal-dock shrink-0 border-t-2 border-[#d9c7a0] bg-[#fff8e6] px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {fb && retry && !fb.correct && !retried ? (
            <GameButton
              variant="primary"
              className="w-full"
              onClick={() => {
                setRetried(true);
                setFb(null);
                setPicked(null);
              }}
            >
              ลองตอบอีกครั้ง
            </GameButton>
          ) : fb ? (
            <GameButton
              variant="primary"
              className="w-full"
              onClick={() => onDone(picked ?? 0, fb.correct)}
            >
              {doneLabel}
            </GameButton>
          ) : (
            <GameButton
              variant="primary"
              className="w-full"
              disabled={picked === null}
              loading={busy}
              onClick={() => void confirm()}
            >
              เลือกคำตอบนี้
            </GameButton>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Sheets({ children }: { children: ReactNode }) {
  return <AnimatePresence>{children}</AnimatePresence>;
}

export function thaiDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** ประตูห้องบอส: ใช้ภาพ boss-door.webp ถ้ามี ไม่มีใช้ประตูพิกเซลสำรอง */
export function BossDoor() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative mx-auto flex h-full max-h-56 min-h-28 w-full max-w-[16rem] items-end justify-center">
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- ภาพประตูสถิตใน public
        <img
          src="/learn/m4/boss-door.webp"
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="size-full object-contain [image-rendering:pixelated]"
        />
      ) : (
        <div
          aria-hidden="true"
          className="relative h-full w-36 rounded-t-xl border-4 border-[#0e0720] bg-[#5a3a22] shadow-[0_6px_0_#0e0720]"
        >
          <div className="absolute inset-x-3 top-3 bottom-0 rounded-t-md border-4 border-[#3b2414] bg-[#7a4e2c]" />
          <span className="absolute top-1/2 right-5 size-3 rounded-full bg-[#ffcf4a]" />
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-md border-4 border-[#ffcf4a] bg-[#3b1d8f] px-3 text-label font-black tracking-widest text-[#ffcf4a]">
            BOSS
          </div>
        </div>
      )}
    </div>
  );
}

/** กรอบแผงแบบเกม 8 บิต: มุมเหลี่ยม ขอบหนาสองชั้น เงาเป็นขั้น */
export const PIXEL_BOX = "m4-board";
