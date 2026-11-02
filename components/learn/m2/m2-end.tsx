"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui";
import { GameRoundButton } from "../game-header";
import { Dome, Domain, KIT, M2Button, M2Screen, Stars, useDragBoard } from "./m2-kit";

type Chrome = { onBack: () => void; soundOn: boolean; onSound: () => void };

/* ── 45 Exit Check (ทุกเส้นทาง) ───────────────────────────────────────── */

export const EXIT_QUESTIONS = [
  { domain: "news.islandtimes.org", ask: "ส่วนใดคือชื่อเว็บ (SLD)?", choices: ["news", "islandtimes", "org"] },
  { domain: "shop.kanombanyai.com", ask: "คอมพิวเตอร์อ่านชื่อเว็บนี้จากทางไหน?", choices: ["ซ้ายไปขวา", "ขวาไปซ้าย", "เริ่มตรงกลาง"] },
  { domain: "booking.kanombanyai.com", ask: "ส่วนใดคือบริการย่อย (Subdomain)?", choices: ["booking", "kanombanyai", "com"] },
] as const;

export function ExitCheck({
  chrome,
  busy,
  onSubmit,
}: {
  chrome: Chrome;
  busy: boolean;
  onSubmit: (answers: number[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const question = EXIT_QUESTIONS[index]!;
  function pick(choice: number) {
    if (picked !== null || busy) return;
    setPicked(choice);
    const next = [...answers, choice];
    window.setTimeout(() => {
      if (next.length >= EXIT_QUESTIONS.length) onSubmit(next);
      else {
        setAnswers(next);
        setIndex((value) => value + 1);
        setPicked(null);
      }
    }, 550);
  }
  return (
    <M2Screen {...chrome} title="เช็กความเข้าใจ" subtitle={`ข้อ ${index + 1}/3`} className="m2g-exit">
      <div className="m2g-exit-q">
        <img className="m2g-exit-dome" src={KIT("dome_cheer")} alt="โดม" draggable={false} />
        <div className="m2g-exit-bubble" key={index}>
          <span>ใน</span>
          <Domain name={question.domain} />
          <span>{question.ask}</span>
        </div>
      </div>
      <div className="m2g-choices exit">
        {question.choices.map((choice, i) => (
          <button
            key={`${index}-${choice}`}
            type="button"
            className={cn("m2g-choice", picked === i && "is-picked")}
            onClick={() => pick(i)}
            disabled={busy || (picked !== null && picked !== i)}
            aria-pressed={picked === i}
          >
            <span className="m2g-choice-letter">{"ABC"[i]}</span>
            <span className="m2g-choice-text">{choice}</span>
          </button>
        ))}
      </div>
      <p className="m2g-note">{busy ? "กำลังสรุปผล…" : "ตอบได้ครั้งเดียว ไม่มีคำใบ้"}</p>
    </M2Screen>
  );
}

/* ── 46/47/48 ตอนจบ A / B / C ─────────────────────────────────────────── */

export function Ending({
  chrome,
  grade,
  stars,
  score,
  onNext,
  onMap,
  onRepair,
  onChangeMode,
}: {
  chrome: Chrome;
  grade: "A" | "B" | "C";
  stars: number;
  score: number;
  onNext: () => void;
  onMap: () => void;
  onRepair: () => void;
  onChangeMode: () => void;
}) {
  const title = grade === "A" ? "ภารกิจที่ 2 สำเร็จ!" : grade === "B" ? "ผ่านภารกิจที่ 2" : "เกือบแล้ว!";
  return (
    <div className={cn("m2g-screen m2g-ending", `grade-${grade}`)}>
      <div className="m2g-bg" aria-hidden />
      {grade === "A" ? <div className="m2g-confetti" aria-hidden /> : null}
      <GameRoundButton kind="back" className="m2g-ending-back" onClick={chrome.onBack} label="กลับแผนที่" />
      <div className="m2g-ending-top">
        <Stars count={grade === "C" ? 0 : stars} />
        <h1 className="m2g-sign is-wide">{title}</h1>
      </div>
      <div className="m2g-ending-stage">
        <img className="m2g-ending-dome" src={KIT("dome_cheer")} alt="โดม" draggable={false} />
        {grade === "A" ? (
          <img className="m2g-ending-medal" src={KIT("badge_domain_architect")} alt="เหรียญสถาปนิกโดเมน" draggable={false} />
        ) : null}
      </div>
      <div className="m2g-ending-bubble">
        {grade === "A"
          ? "สุดยอด CEO! ได้เหรียญสถาปนิกโดเมนไปเลย!"
          : grade === "B"
            ? "เก่งมาก! อีกนิดเดียวได้ 3 ดาว ไปต่อกันเลยครับ"
            : "ไม่เป็นไรนะ CEO ป้ายบางชิ้นยังสลับกันอยู่ ไปซ่อมจุดอ่อนกันสั้น ๆ ก่อนนะ"}
        <small>คะแนน {score}/100</small>
      </div>
      {grade !== "C" ? (
        <div className="m2g-progress">
          <span>ความคืบหน้าการสร้างร้าน</span>
          <b>50%</b>
          <i>
            <em style={{ width: "50%" }} />
          </i>
        </div>
      ) : null}
      <div className="m2g-ending-actions">
        {grade === "C" ? (
          <>
            <M2Button color="red" onClick={onRepair}>
              ไปซ่อมจุดอ่อน
            </M2Button>
            <M2Button color="blue" size="md" onClick={onChangeMode}>
              เปลี่ยนวิธีเรียน
            </M2Button>
          </>
        ) : (
          <>
            <M2Button onClick={onNext}>ไปต่อภารกิจหลัก</M2Button>
            <M2Button color="cream" size="md" onClick={onMap}>
              กลับแผนที่
            </M2Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 49 ซ่อมจุดอ่อน 30 วินาที ─────────────────────────────────────────── */

const DRILL = [
  { parts: ["shop", "kanombanyai", "com"], hi: 0, crate: "sub" },
  { parts: ["parts", "forcespeed", "com"], hi: 1, crate: "sld" },
  { parts: ["order", "ittimbeach", "com"], hi: 2, crate: "tld" },
  { parts: ["www", "ployflower", "com"], hi: 1, crate: "sld" },
  { parts: ["menu", "kafaethai", "co", "th"], hi: 0, crate: "sub" },
] as const;

const CRATES = [
  ["sub", "crate_sub", "Subdomain"],
  ["sld", "crate_sld", "SLD"],
  ["tld", "crate_tld", "TLD"],
] as const;

export function RepairDrill({ chrome, onDone }: { chrome: Chrome; onDone: (hits: number) => void }) {
  const [seconds, setSeconds] = useState(30);
  const [index, setIndex] = useState(0);
  const [hits, setHits] = useState(0);
  const [fx, setFx] = useState<{ crate: string; ok: boolean } | null>(null);
  const [say, setSay] = useState<string | null>(null);
  const over = seconds <= 0 || index >= DRILL.length;
  useEffect(() => {
    if (over) return;
    const id = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [over]);
  const item = DRILL[Math.min(index, DRILL.length - 1)]!;
  const board = useDragBoard((_bar, crate) => {
    if (over || crate === "tray") return;
    const ok = crate === item.crate;
    setFx({ crate, ok });
    if (ok) setHits((value) => value + 1);
    setSay(
      ok
        ? "ลงถังถูกเลย! ต่อชิ้นถัดไป"
        : `ยังไม่ใช่ครับ "${item.parts[item.hi]}" เป็น ${CRATES.find((c) => c[0] === item.crate)![2]}`,
    );
    window.setTimeout(() => setFx(null), 520);
    setIndex((value) => value + 1);
  });
  return (
    <M2Screen
      {...chrome}
      title="ซ่อมจุดอ่อน"
      subtitle={`30 วินาที · ข้อ ${Math.min(index + 1, DRILL.length)}/${DRILL.length}`}
      className="m2g-repair"
      footer={over ? <M2Button onClick={() => onDone(hits)}>กลับไปเช็กความเข้าใจ</M2Button> : null}
    >
      <div className="m2g-hud">
        <span className="m2g-hud-pill" aria-label={`เหลือเวลา ${seconds} วินาที`}>
          <i className="m2g-clock" />
          00:{String(seconds).padStart(2, "0")}
        </span>
        <span className="m2g-hud-pill">
          ★ {hits}/{DRILL.length}
        </span>
      </div>
      <div className="m2g-bar-slot">
        {!over ? (
          <div key={index} className="m2g-bar-wrap">
            <div {...board.itemProps(`bar-${index}`)} aria-label={`แถบชื่อเว็บ ${item.parts.join(".")} ไฮไลต์ ${item.parts[item.hi]}`}>
              <div className="m2g-domain-bar">
                {item.parts.map((part, i) => (
                  <span key={part + i} className="m2g-domain-part">
                    {i > 0 ? <i>.</i> : null}
                    <b className={cn(i === item.hi && "is-hi")}>{part}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="m2g-drill-result">
            ซ่อมได้ <b>{hits}</b> จาก {DRILL.length} ชิ้น
          </div>
        )}
      </div>
      <Dome className="m2g-dome-mid">
        {over
          ? seconds <= 0
            ? "หมดเวลาแล้ว! กลับไปลองเช็กความเข้าใจอีกรอบนะครับ"
            : "ซ่อมครบแล้ว! กลับไปลองเช็กความเข้าใจอีกรอบนะครับ"
          : (say ?? "ชิ้นที่ไฮไลต์อยู่ เป็นส่วนไหน? โยนลงถังเลย!")}
      </Dome>
      <div className="m2g-crates">
        {CRATES.map(([id, asset, label]) => (
          <div
            key={id}
            {...board.zoneProps(id)}
            className={cn("m2g-crate", fx?.crate === id && (fx.ok ? "is-bounce" : "is-shake"))}
            aria-label={`ถัง ${label}`}
          >
            <img src={KIT(asset)} alt={label} draggable={false} />
          </div>
        ))}
      </div>
    </M2Screen>
  );
}
