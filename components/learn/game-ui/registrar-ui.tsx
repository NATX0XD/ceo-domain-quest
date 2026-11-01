"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertIcon,
  CheckIcon,
  CrownIcon,
  DomeAvatar,
  cn,
} from "@/components/ui";
import { GameButton, HudPill, SceneBg, buzz, useGameMotion } from "./index";

/** ชิ้นส่วนร่วมของเกมด่านบอส m4 (R01-R11) ธีม pixel เคาน์เตอร์ครีม/ไม้ */

export const BG_FALLBACK =
  "bg-gradient-to-b from-[#fff8e6] via-[#f1e2c3] to-[#c98948]";
/** cn ไม่ merge คลาสที่ชนกัน จึงแยกชุดสีเข้ม/สว่างไว้คนละค่า ห้ามต่อสีทับกัน */
const INPUT_BASE =
  "min-h-12 w-full rounded-xl border-2 px-3 text-body font-semibold focus-visible:outline-3 focus-visible:outline-focus disabled:opacity-70";
export const INPUT = `${INPUT_BASE} border-[#7a5a3a] bg-white text-[#3a2a18] placeholder:text-[#8a7a63]`;
export const INPUT_LIGHT = `${INPUT_BASE} border-[#7a5a3a] bg-white text-[#3a2a18] placeholder:text-[#8a7a63]`;
/** ข้อความที่ต้องลอยบนฉาก: วางบนพื้นทึบเสมอ ห้ามวางบนภาพพื้นหลังตรง ๆ */
export const SCENE_NOTE =
  "rounded-xl border-2 border-[#7a5a3a] bg-[#fff8e6]/95 px-3 py-2 text-label font-bold text-pretty text-[#3a2a18]";

export function BossShell({
  children,
  blur = 3,
  src = "",
  dim = 0.08,
}: {
  children: ReactNode;
  blur?: number;
  src?: string;
  dim?: number;
}) {
  return (
    <div className="registrar-game-shell relative flex h-full min-h-[max(32rem,calc(100dvh-7.5rem))] w-full flex-1 flex-col overflow-clip rounded-3xl bg-[#f3e4c4] text-[#3a2a18]">
      {src ? <SceneBg src={src} fallback={BG_FALLBACK} blur={blur} dim={dim} /> : <div className="absolute inset-0 bg-[#f3e4c4]" aria-hidden />}
      {/* overflow-clip (ไม่ใช่ hidden) เพื่อไม่ให้กรอบนี้เป็นตัวเลื่อน ถาดการ์ดแบบ sticky จึงติดล่างจอได้ */}
      {/* flex-1 ให้กล่องนี้สูงเต็มกรอบ แผ่นอีเมล (absolute inset-0) จึงไม่ถูกตัดตามความสูงเนื้อหา */}
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/** แถบ HUD บนสุด: ด่านบอส · ขั้นที่ · เหรียญ */
export function BossHud({
  stage,
  step,
  total,
  coins,
  coinNode,
  timer,
}: {
  stage: string;
  step: number;
  total: number;
  coins: number;
  coinNode: ReactNode;
  timer?: string;
}) {
  const { reduce } = useGameMotion();
  return (
    <div className="shrink-0 px-2 pt-3 pb-2">
      <div className="flex items-center gap-1">
        <HudPill
          tone="dark"
          className="shrink-0 whitespace-nowrap px-2 py-1 leading-tight max-[359px]:px-1.5"
        >
          <CrownIcon
            width={16}
            height={16}
            aria-hidden
            className="shrink-0 text-[#ffcf4a] max-[359px]:hidden"
          />
          {stage}
        </HudPill>
        <HudPill
          tone="dark"
          className="shrink-0 whitespace-nowrap px-2 py-1 leading-tight max-[359px]:px-1.5 tabular-nums"
        >
          {/* จอแคบ 360px: ป้าย "ขั้น" เหลือไว้ให้โปรแกรมอ่านจอ ตัวเลขยังใหญ่ 15px */}
          <span className="sr-only">ขั้น </span>
          {Math.min(step, total)}/{total}
        </HudPill>
        <div className="flex-1" />
        {timer ? (
          <HudPill
            tone="dark"
            className="shrink-0 whitespace-nowrap px-2 py-1 leading-tight max-[359px]:px-1.5 tabular-nums"
          >
            <span className="sr-only">เวลา</span>
            {timer}
          </HudPill>
        ) : null}
        <HudPill
          tone="gold"
          className="shrink-0 whitespace-nowrap px-2 py-1 leading-tight max-[359px]:px-1.5 tabular-nums"
        >
          <span
            aria-hidden="true"
            className="size-4 shrink-0 rounded-full border-2 border-[#b8860b] bg-[#ffe27a] max-[359px]:hidden"
          />
          <span aria-label={`เหรียญ ${coins}`}>{coinNode}</span>
        </HudPill>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <motion.span
            key={i}
            className="h-1.5 flex-1 rounded-sm"
            animate={{ backgroundColor: i < step ? "#ffcf4a" : "#3a2a63" }}
            transition={reduce ? { duration: 0 } : { duration: 0.35 }}
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

/** บทพูดโดมหรือบอส ในกรอบม่วงเข้ม */
export function Say({
  who = "dome",
  mood = "happy",
  children,
  className,
}: {
  who?: "dome" | "boss";
  mood?: "happy" | "greet" | "cheer";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border-2 border-[#6d4bd1] bg-[#2a1748]/95 p-2 pr-3",
        className,
      )}
    >
      {who === "boss" ? (
        <BossPortrait size={56} />
      ) : (
        <DomeAvatar mood={mood} size={52} decorative />
      )}
      <div className="min-w-0 flex-1 text-label font-semibold text-pretty text-[#efe6ff]">
        {children}
      </div>
    </div>
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
}: {
  title: string;
  kicker?: string;
  story: string;
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
      className="absolute inset-0 z-40 flex items-end bg-black/55"
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
        className="flex max-h-[min(96%,calc(100dvh-4.75rem))] w-full flex-col overflow-hidden rounded-t-3xl border-[3px] border-b-0 border-[#7a5a3a] bg-[#fff8e6] text-[#3a2a18]"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#7c4dff] text-white"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-label font-bold text-[#7a5a2c]">{kicker}</p>
              <p className="text-body font-extrabold text-balance">{title}</p>
            </div>
          </div>
          <p className="rounded-xl bg-[#f1e6c8] px-3 py-2 text-body leading-snug text-pretty">
            {story}
          </p>
          <p className="text-body font-extrabold">{question}</p>
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
        <div className="shrink-0 border-t-2 border-[#d9c7a0] bg-[#fff8e6] px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
export const PIXEL_BOX =
  "rounded-md border-4 border-[#0e0720] bg-[#241446]/95 text-[#efe6ff] shadow-[0_0_0_2px_#6d4bd1,0_6px_0_2px_#0e0720]";
