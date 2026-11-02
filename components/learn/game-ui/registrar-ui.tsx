"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertIcon, CheckIcon, cn } from "@/components/ui";
import { useExitConfirm } from "@/components/student-navigation";
import { GameHeader } from "../game-header";
import { GameButton, buzz, useGameMotion } from "./index";
import { useM3Sound } from "./counter-shell";

/** ชิ้นส่วนร่วมของเกมด่านบอส m4 แบบ "Pixel Boss" (docs/design-ref/pixel/m4-*.png):
 *  ฉากพิกเซลเต็มจอ · HUD แถวเดียว (ด่านบอส / ขั้น / เหรียญ / เวลา) · แผงกระดาษขอบม่วงมีคลิปหนีบ ·
 *  ปุ่มม่วง · โดมพิกเซลกับกล่องคำพูด ทุกตัวอักษรเป็น HTML ภาพเป็นแค่ฉาก */

export const BG_FALLBACK =
  "bg-gradient-to-b from-[#fff8e6] via-[#f1e2c3] to-[#c98948]";
/** cn ไม่ merge คลาสที่ชนกัน จึงแยกชุดสีไว้ค่าเดียว ห้ามต่อสีทับกัน */
const INPUT_BASE =
  "min-h-12 w-full rounded-md border-2 px-3 text-body font-semibold focus-visible:outline-3 focus-visible:outline-focus disabled:opacity-70";
export const INPUT = `${INPUT_BASE} border-[#9d8ae6] bg-[#f3efff] text-[#24164f] placeholder:text-[#7d72a8]`;
export const INPUT_LIGHT = INPUT;
/** ข้อความที่ต้องลอยบนฉาก: วางบนพื้นทึบเสมอ ห้ามวางบนภาพพื้นหลังตรง ๆ */
export const SCENE_NOTE =
  "rounded-md border-2 border-[#6b4fd8] bg-[#fbf8ef]/95 px-3 py-2 text-label font-bold text-pretty text-[#24164f]";

export const M4_ASSET = (name: string) => `/learn/m2/kit/${name}.webp`;

/* ───────────── ภาพพิกเซล: ใช้ไฟล์ใน public/learn/pixel/ ถ้ามี ไม่มีใช้ภาพเดิม ───────────── */

export const PX = (name: string) => `/learn/pixel/${name}.webp`;
const probed = new Map<string, boolean>();
const waiting = new Map<string, Promise<boolean>>();

function probe(src: string): Promise<boolean> {
  const known = probed.get(src);
  if (known !== undefined) return Promise.resolve(known);
  let p = waiting.get(src);
  if (!p) {
    p = new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    }).then((ok) => {
      probed.set(src, ok);
      waiting.delete(src);
      return ok;
    });
    waiting.set(src, p);
  }
  return p;
}

/** คืน path ภาพพิกเซลถ้าโหลดได้ ไม่งั้นคืนภาพสำรอง (ตรวจฝั่งเบราว์เซอร์ครั้งเดียวต่อไฟล์) */
export function usePixelSrc(name: string, fallback: string): string {
  const src = PX(name);
  const [ok, setOk] = useState(() => probed.get(src) === true);
  useEffect(() => {
    let live = true;
    void probe(src).then((v) => live && setOk(v));
    return () => {
      live = false;
    };
  }, [src]);
  return ok ? src : fallback;
}

export function PixelImg({
  name,
  fallback,
  className,
  style,
  alt = "",
}: {
  name: string;
  fallback: string;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  const src = usePixelSrc(name, fallback);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ภาพสถิตใน public
    <img src={src} alt={alt} aria-hidden={alt ? undefined : true} draggable={false} className={cn("m4-px", className)} style={style} />
  );
}

export type DomeMood = "neutral" | "happy" | "thinking" | "cheer" | "worried" | "sign";
const DOME_FALLBACK: Record<DomeMood, string> = {
  neutral: "/dome/mascot/dome-greet.webp",
  happy: "/dome/mascot/dome-happy.webp",
  thinking: "/dome/mascot/dome-think.webp",
  cheer: "/dome/mascot/dome-cheer.webp",
  worried: "/dome/mascot/dome-surprised.webp",
  sign: "/dome/mascot/dome-explain.webp",
};
const DOME_FILE: Record<DomeMood, string> = {
  neutral: "dome-neutral",
  happy: "dome-happy",
  thinking: "dome-thinking",
  cheer: "dome-cheer",
  worried: "dome-worried",
  sign: "dome-hold-sign",
};

/** โดมพิกเซล (ไฟล์ใหม่ใน public/learn/pixel) สำรองด้วยโดมเดิม */
export function PixelDome({ mood = "neutral", size = 96, className, float = true }: { mood?: DomeMood; size?: number; className?: string; float?: boolean }) {
  const { reduce } = useGameMotion();
  return (
    <motion.div
      className={cn("m4-dome", className)}
      style={{ width: size, height: size }}
      animate={reduce || !float ? undefined : { y: [0, -5, 0] }}
      transition={reduce ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <PixelImg name={DOME_FILE[mood]} fallback={DOME_FALLBACK[mood]} style={{ width: size, height: size }} />
    </motion.div>
  );
}

/** ไอคอนพิกเซลเล็ก (SVG) ใช้ใน HUD */
function PxIcon({ kind }: { kind: "crown" | "people" | "clock" }) {
  if (kind === "crown")
    return (
      <svg viewBox="0 0 12 10" width={20} height={17} aria-hidden="true" shapeRendering="crispEdges">
        <path d="M0 2h2v1h1v1h1V1h1V0h2v1h1v3h1V3h1V2h2v8H0z" fill="#6b4fd8" />
        <path d="M1 7h10v2H1z" fill="#ffcf4a" />
        <path d="M3 5h1v1H3zM8 5h1v1H8z" fill="#fff" />
      </svg>
    );
  if (kind === "clock")
    return (
      <svg viewBox="0 0 10 10" width={16} height={16} aria-hidden="true" shapeRendering="crispEdges">
        <path d="M3 0h4v1h1v1h1v1h1v4H9v1H8v1H7v1H3V9H2V8H1V7H0V3h1V2h1V1h1z" fill="#fff" />
        <path d="M5 2h1v3h2v1H5z" fill="#2c1a6b" />
      </svg>
    );
  return (
    <svg viewBox="0 0 8 10" width={11} height={14} aria-hidden="true" shapeRendering="crispEdges">
      <path d="M2 0h4v1h1v3H6v1H2V4H1V1h1zM1 6h6v1h1v3H0V7h1z" fill="currentColor" />
    </svg>
  );
}

export type SceneKind = "office" | "door" | "boss" | "calendar";

export function BossShell({
  children,
  scene = "office",
  stage = "ด่านบอส",
}: {
  children: ReactNode;
  scene?: SceneKind;
  /** ป้ายม่วงใต้ป้ายไม้ (ชื่อขั้นที่กำลังเล่น) */
  stage?: string;
}) {
  const [soundOn, toggleSound] = useM3Sound();
  const exit = useExitConfirm({
    href: "/map",
    note: "ขั้นที่ทำไว้ยังไม่ถูกบันทึก ถ้าออกตอนนี้ต้องเริ่มด่านใหม่ตั้งแต่ขั้นแรก",
  });
  return (
    <div className={cn("registrar-game-shell m4-stage", `m4-scene-${scene}`)}>
      <div className="m4-stage-inner">
        <GameHeader
          title="ภารกิจที่ 4"
          subtitle={stage}
          onBack={exit.request}
          backLabel="ออกจากด่าน กลับแผนที่"
          soundOn={soundOn}
          onSound={toggleSound}
        />
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
      {exit.dialog}
    </div>
  );
}

/** HUD แถวเดียว: ด่านบอส · ขั้น x/10 (คน 3 ตัว) · เหรียญ · เวลา */
export function BossHud({
  step,
  total,
  coins,
  coinNode,
  timer,
  urgent = false,
}: {
  stage?: string;
  step: number;
  total: number;
  coins: number;
  coinNode: ReactNode;
  timer?: string;
  /** 10 วินาทีสุดท้าย: ชิปเวลาแดงสั่น */
  urgent?: boolean;
}) {
  const shown = Math.min(step, total);
  const people = Math.round((shown / Math.max(1, total)) * 3);
  return (
    <div className="m4-hud shrink-0">
      <span className="m4-chip m4-chip-boss">
        <PxIcon kind="crown" />
        <b>ด่านบอส</b>
      </span>
      <span className="m4-chip m4-chip-step">
        <span className="m4-people" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn(i < people && "is-on")}>
              <PxIcon kind="people" />
            </span>
          ))}
        </span>
        <span className="m4-step-text">
          <small>ขั้น</small>
          <b className="tabular-nums">
            {shown}/{total}
          </b>
        </span>
      </span>
      <span className="m4-chip m4-chip-coin">
        <span aria-hidden="true" className="m4-coin" />
        <b className="tabular-nums" aria-label={`เหรียญ ${coins}`}>
          {coinNode}
        </b>
      </span>
      {timer ? (
        <span className={cn("m4-chip m4-chip-time", urgent && "is-urgent")}>
          <PxIcon kind="clock" />
          <span className="sr-only">เวลา</span>
          <b className="tabular-nums">{timer}</b>
        </span>
      ) : null}
    </div>
  );
}

/** แผงกระดาษขอบม่วง มีคลิปหนีบด้านบน และหัวเรื่องขีดเส้นใต้ */
export function ClipPanel({
  title,
  children,
  className,
  pop = true,
  tone = "paper",
  ...rest
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  pop?: boolean;
  tone?: "paper" | "lilac";
} & Omit<React.ComponentProps<typeof motion.section>, "children" | "className" | "title">) {
  const { reduce } = useGameMotion();
  return (
    <motion.section
      initial={reduce || !pop ? false : { y: 26, scale: 0.94, opacity: 0 }}
      animate={{ y: 0, scale: 1, opacity: 1 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 22 }}
      {...rest}
      className={cn("m4-panel", tone === "lilac" && "is-lilac", className)}
    >
      <span className="m4-clip" aria-hidden="true" />
      {title ? <h2 className="m4-panel-title">{title}</h2> : null}
      {children}
    </motion.section>
  );
}

/** ป้าย BOSS เด้งเข้า (คงไว้ให้ผู้เรียกเดิม) */
export function BossSign({ className }: { className?: string }) {
  const { reduce } = useGameMotion();
  return (
    <motion.div
      initial={reduce ? false : { scale: 2.2, opacity: 0, rotate: -8 }}
      animate={{ scale: 1, opacity: 1, rotate: -3 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 14 }}
      className={cn("m4-boss-sign", className)}
    >
      BOSS
    </motion.div>
  );
}

/** บอส CEO พิกเซล (boss-neutral / boss-smile) สำรองด้วยภาพบอสเดิม */
export function BossSprite({ mood = "neutral", size = 150, className }: { mood?: "neutral" | "smile"; size?: number; className?: string }) {
  const { reduce } = useGameMotion();
  return (
    <motion.div
      className={cn("m4-boss-sprite", className)}
      style={{ width: size, height: size }}
      initial={reduce ? false : { y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20 }}
    >
      <PixelImg name={mood === "smile" ? "boss-smile" : "boss-neutral"} fallback="/learn/m4/boss.png" style={{ width: size, height: size }} />
    </motion.div>
  );
}

/** รูปบอสกรอบเล็ก (ใช้ในกล่องคำพูด) */
export function BossPortrait({ size = 52 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size }} className="m4-boss-portrait">
      <PixelImg name="boss-neutral" fallback="/learn/m4/boss.png" style={{ width: size, height: size }} />
    </div>
  );
}

/** บทพูดโดมหรือบอส: ตัวละครซ้าย + กล่องคำพูด */
export function Say({
  who = "dome",
  mood,
  children,
  className,
  bare = false,
}: {
  bare?: boolean;
  who?: "dome" | "boss";
  mood?: DomeMood | "greet";
  children: ReactNode;
  className?: string;
}) {
  const { reduce } = useGameMotion();
  const domeMood: DomeMood = mood === "greet" || !mood ? "neutral" : mood;
  return (
    <motion.div
      className={cn("m4-say", className)}
      initial={reduce ? false : { y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 24 }}
    >
      {bare ? null : who === "boss" ? <BossPortrait size={52} /> : <PixelDome mood={domeMood} size={62} float={false} />}
      <div className="m4-say-bubble">
        <span>{who === "boss" ? "บอส" : "โดม"}</span>
        <div>{children}</div>
      </div>
    </motion.div>
  );
}

export type QuizCheck = (choice: number) => Promise<{ correct: boolean; explanation: string } | null>;

/** ตัวเลือกปุ่มม่วงแบบในภาพอ้างอิง + ผลตรวจจากเซิร์ฟเวอร์ (ใช้ได้ทั้งในแผงและในแผ่นเด้ง) */
export function QuizBody({
  question,
  choices,
  check,
  onDone,
  doneLabel = "ไปต่อ",
  retry = false,
  showQuestion = true,
}: {
  question: string;
  choices: string[];
  check: QuizCheck;
  onDone: (choice: number, correct: boolean) => void;
  doneLabel?: string;
  retry?: boolean;
  showQuestion?: boolean;
}) {
  const { reduce } = useGameMotion();
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);
  const fbRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (fb) fbRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [fb, reduce]);

  async function choose(i: number) {
    if (busy || fb) return;
    buzz();
    setPicked(i);
    setBusy(true);
    setErr(null);
    const r = await check(i);
    setBusy(false);
    if (!r) setErr("ตรวจไม่ได้ตอนนี้ ลองกดอีกครั้ง");
    else setFb(r);
  }

  return (
    <div className="m4-quiz">
      {showQuestion ? <p className="m4-quiz-q">{question}</p> : null}
      <div role="radiogroup" aria-label={question} className="m4-quiz-choices">
        {choices.map((c, i) => {
          const on = picked === i;
          const state = fb && on ? (fb.correct ? "is-right" : "is-wrong") : on ? "is-on" : "";
          return (
            <motion.button
              key={i}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={fb !== null || busy}
              whileTap={reduce || fb ? undefined : { scale: 0.97 }}
              animate={fb && on && !fb.correct && !reduce ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
              onClick={() => void choose(i)}
              className={cn("m4-choice", state)}
            >
              <span aria-hidden="true" className="m4-choice-mark">
                {fb && on ? fb.correct ? <CheckIcon width={18} height={18} /> : <AlertIcon width={18} height={18} /> : ["ก", "ข", "ค", "ง", "จ"][i]}
              </span>
              <span className="min-w-0 flex-1 text-pretty">{c}</span>
              {busy && on ? <span aria-hidden="true" className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
            </motion.button>
          );
        })}
      </div>
      {err ? (
        <p role="alert" className="flex items-center gap-2 text-label font-bold text-spark-700">
          <AlertIcon width={18} height={18} aria-hidden /> {err}
        </p>
      ) : null}
      {fb ? (
        <motion.div
          role="status"
          ref={fbRef}
          initial={reduce ? false : { y: 12, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          className={cn("m4-feedback", fb.correct ? "is-right" : "is-wrong")}
        >
          <p className="m4-feedback-head">
            {fb.correct ? <CheckIcon width={20} height={20} aria-hidden /> : <AlertIcon width={20} height={20} aria-hidden />}
            {fb.correct ? "รับมือถูกแล้ว" : "ยังไม่ใช่ ดูเหตุผลก่อนไปต่อ"}
          </p>
          <p className="mt-1 text-body text-pretty">{fb.explanation}</p>
        </motion.div>
      ) : null}
      {fb ? (
        fb && retry && !fb.correct && !retried ? (
          <GameButton
            className="w-full"
            onClick={() => {
              setRetried(true);
              setFb(null);
              setPicked(null);
            }}
          >
            ลองตอบอีกครั้ง
          </GameButton>
        ) : (
          <GameButton className="w-full" onClick={() => onDone(picked ?? 0, fb.correct)}>
            {doneLabel}
          </GameButton>
        )
      ) : null}
    </div>
  );
}

/** แผ่นเหตุการณ์เด้งกลางจอ (เช่น เพื่อนถามเรื่องจ่ายเงิน) */
export function QuizSheet({
  title,
  kicker = "เหตุการณ์ใหม่",
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
  icon?: string;
  facts?: { icon: string; label: string; value: string }[];
  question: string;
  choices: string[];
  check: QuizCheck;
  onDone: (choice: number, correct: boolean) => void;
  doneLabel?: string;
  retry?: boolean;
}) {
  const { reduce } = useGameMotion();
  return (
    <motion.div className="m4-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={reduce ? false : { y: 60, scale: 0.9, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={reduce ? undefined : { y: 60, opacity: 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 24 }}
        className="m4-panel m4-modal-card"
      >
        <span className="m4-clip" aria-hidden="true" />
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอนสถิตใน public */}
          <img src={icon} alt="" aria-hidden className="m4-modal-icon" />
          <div className="min-w-0">
            <p className="text-label font-bold text-[#6b4fd8]">{kicker}</p>
            <p className="text-body font-extrabold text-balance text-[#24164f]">{title}</p>
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
          <p className="m4-story">{story}</p>
        )}
        <QuizBody question={question} choices={choices} check={check} onDone={onDone} doneLabel={doneLabel} retry={retry} />
      </motion.div>
    </motion.div>
  );
}

export function Sheets({ children }: { children: ReactNode }) {
  return <AnimatePresence>{children}</AnimatePresence>;
}

/** ตรายาง: กระแทกลงจากใหญ่ไปเล็ก ใช้ภาพ stamp-*.webp ถ้ามี ไม่มีวาดด้วย CSS */
export function Stamp({
  kind,
  label,
  delay = 0.25,
  className,
}: {
  kind: "approve" | "new" | "more" | "reject" | "paid";
  label: string;
  delay?: number;
  className?: string;
}) {
  const { reduce } = useGameMotion();
  const file = kind === "paid" ? "stamp-approve" : `stamp-${kind}`;
  const src = usePixelSrc(file, "");
  return (
    <motion.span
      className={cn("m4-stamp", `is-${kind}`, src && "has-art", className)}
      initial={reduce ? false : { scale: 2.6, opacity: 0, rotate: -24 }}
      animate={{ scale: 1, opacity: 1, rotate: -8 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 16, delay }}
      onAnimationStart={() => !reduce && window.setTimeout(() => buzz(25), delay * 1000 + 120)}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- ภาพตรายางสถิตใน public
        <img src={src} alt="" aria-hidden draggable={false} />
      ) : (
        <CheckIcon width={18} height={18} aria-hidden />
      )}
      <span>{label}</span>
    </motion.span>
  );
}

/** คอนเฟตตีสี่เหลี่ยมพิกเซล ยิงครั้งเดียวเมื่อ fire เปลี่ยน */
export function PixelConfetti({ fire, count = 30 }: { fire: number; count?: number }) {
  const { reduce } = useGameMotion();
  if (!fire || reduce) return null;
  const colors = ["#6b4fd8", "#ffcf4a", "#34c38f", "#ff7aa8", "#5ab0ff"];
  return (
    <div key={fire} className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const x = ((i * 53) % 100) - 50;
        return (
          <motion.span
            key={i}
            className="absolute top-[-12px] block size-2.5"
            style={{ left: `${50 + x * 0.98}%`, background: colors[i % colors.length] }}
            initial={{ y: -20, rotate: 0, opacity: 1 }}
            animate={{ y: ["0vh", `${70 + (i % 5) * 7}vh`], x: [0, (i % 2 ? 1 : -1) * (20 + (i % 7) * 6)], rotate: 360 + i * 30, opacity: [1, 1, 0] }}
            transition={{ duration: 1.8 + (i % 4) * 0.25, delay: (i % 6) * 0.05, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

export function thaiDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

/** คงชื่อเดิมไว้ให้ผู้เรียกเดิม: แผงแบบเกม */
export const PIXEL_BOX = "m4-board";

export type GlyphKind = "globe" | "mail" | "server" | "shop" | "list" | "shield" | "book" | "calendar" | "clock" | "building" | "check" | "cross" | "warn" | "search";

/** ไอคอนพิกเซลวาดด้วย SVG (สี currentColor) แทนไอคอนที่ยังไม่มีภาพ */
export function Glyph({ kind, size = 22, className }: { kind: GlyphKind; size?: number; className?: string }) {
  const body = (() => {
    switch (kind) {
      case "globe":
        return (
          <g shapeRendering="auto" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="8" cy="8" r="6.6" fill="#fff" />
            <ellipse cx="8" cy="8" rx="2.9" ry="6.6" />
            <path d="M1.6 8h12.8M2.8 4.6h10.4M2.8 11.4h10.4" />
          </g>
        );
      case "mail":
        return (
          <>
            <path d="M1 3h14v10H1z" fill="currentColor" />
            <path d="M2 4h1v1h1v1h1v1h1v1h4V7h1V6h1V5h1V4h1v1h-1v1h-1v1h-1v1h-1v1H6V8H5V7H4V6H3V5H2z" fill="#fff" />
          </>
        );
      case "server":
        return (
          <>
            <path d="M2 1h12v4H2zM2 6h12v4H2zM2 11h12v4H2z" fill="currentColor" />
            <path d="M4 2h2v2H4zM4 7h2v2H4zM4 12h2v2H4z" fill="#8cf0b0" />
            <path d="M8 3h4v1H8zM8 8h4v1H8zM8 13h4v1H8z" fill="#fff" />
          </>
        );
      case "shop":
        return (
          <>
            <path d="M1 2h14v4H1z" fill="currentColor" />
            <path d="M3 2h2v4H3zM7 2h2v4H7zM11 2h2v4h-2z" fill="#fff" />
            <path d="M2 6h12v9H2z" fill="#f4d7a1" />
            <path d="M4 8h3v7H4zM9 8h4v3H9z" fill="currentColor" />
          </>
        );
      case "list":
        return (
          <>
            <path d="M1 1h14v14H1z" fill="currentColor" />
            <path d="M3 3h2v2H3zM6 3h7v2H6zM3 7h2v2H3zM6 7h7v2H6zM3 11h2v2H3zM6 11h7v2H6z" fill="#fff" />
          </>
        );
      case "shield":
        return (
          <>
            <path d="M2 2h12v7h-1v2h-1v1h-1v1H9v1H7v-1H5v-1H4v-1H3V9H2z" fill="currentColor" />
            <path d="M5 5h6v3h-1v2H9v1H7v-1H6V8H5z" fill="#fff" opacity=".85" />
          </>
        );
      case "book":
        return (
          <>
            <path d="M1 3h6v1h2V3h6v11H9v1H7v-1H1z" fill="currentColor" />
            <path d="M3 5h3v1H3zM3 8h3v1H3zM10 5h3v1h-3zM10 8h3v1h-3z" fill="#fff" />
          </>
        );
      case "calendar":
        return (
          <>
            <path d="M1 3h14v12H1z" fill="currentColor" />
            <path d="M4 1h2v4H4zM10 1h2v4h-2z" fill="#24164f" />
            <path d="M2 6h12v8H2z" fill="#fff" />
            <path d="M4 8h2v2H4zM7 8h2v2H7zM10 8h2v2h-2zM4 11h2v2H4zM7 11h2v2H7z" fill="currentColor" />
          </>
        );
      case "clock":
        return (
          <>
            <path d="M5 1h6v1h2v2h1v2h1v4h-1v2h-1v2h-2v1H5v-1H3v-2H2v-2H1V6h1V4h1V2h2z" fill="currentColor" />
            <path d="M5 3h6v1h1v1h1v6h-1v1h-1v1H5v-1H4v-1H3V5h1V4h1z" fill="#fff" />
            <path d="M7 4h2v4h3v2H7z" fill="currentColor" />
          </>
        );
      case "building":
        return (
          <>
            <path d="M8 1h1v1h2v1h2v1h2v2H1V4h2V3h2V2h2V1z" fill="currentColor" />
            <path d="M2 7h2v6H2zM6 7h2v6H6zM10 7h2v6h-2zM13 7h1v6h-1z" fill="currentColor" />
            <path d="M1 14h14v1H1z" fill="currentColor" />
          </>
        );
      case "check":
        return (
          <>
            <path d="M3 1h10v2h2v10h-2v2H3v-2H1V3h2z" fill="currentColor" />
            <path d="M11 5h1v1h-1v1h-1v1H9v1H8v1H7v1H6v-1H5V9H4V8h1v1h1v1h1V9h1V8h1V7h1V6h1z" fill="#fff" stroke="#fff" strokeWidth=".6" />
          </>
        );
      case "cross":
        return (
          <>
            <path d="M3 1h10v2h2v10h-2v2H3v-2H1V3h2z" fill="currentColor" />
            <path d="M5 4h1v1h1v1h2V5h1V4h1v1h1v1h-1v1h-1v2h1v1h1v1h-1v1h-1v-1H9v-1H7v1H6v1H5v-1H4v-1h1V9h1V7H5V6H4V5h1z" fill="#fff" />
          </>
        );
      case "warn":
        return (
          <>
            <path d="M7 1h2v2h1v3h1v3h1v3h1v3H3v-3h1V9h1V6h1V3h1z" fill="currentColor" />
            <path d="M7 5h2v5H7zM7 11h2v2H7z" fill="#fff" />
          </>
        );
      case "search":
        return (
          <>
            <path d="M4 1h5v1h1v1h1v1h1v5h-1v1h-1v1H9v1H4v-1H3v-1H2V9H1V4h1V3h1V2h1z" fill="currentColor" />
            <path d="M4 3h5v1h1v5H9v1H4V9H3V4h1z" fill="#fff" />
            <path d="M10 11h2v1h1v1h1v1h1v1h-2v-1h-1v-1h-1v-1h-1z" fill="currentColor" />
          </>
        );
    }
  })();
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges" className={cn("m4-glyph", className)}>
      {body}
    </svg>
  );
}

/** ไอคอนภาพพิกเซล (public/learn/pixel/icon-*.webp) ถ้าไม่มีไฟล์ใช้ Glyph แทน */
export function ArtIcon({ px, glyph, size = 30, className }: { px: string; glyph: GlyphKind; size?: number; className?: string }) {
  const src = usePixelSrc(px, "");
  if (!src) return <Glyph kind={glyph} size={size} className={className} />;
  // eslint-disable-next-line @next/next/no-img-element -- ไอคอนสถิตใน public
  return <img src={src} alt="" aria-hidden draggable={false} className={cn("m4-px", className)} style={{ width: size, height: size }} />;
}
