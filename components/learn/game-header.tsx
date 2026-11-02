"use client";

/* eslint-disable @next/next/no-img-element -- ปุ่มเกมเป็นภาพสถิตโปร่งใสใน public/ui/kit2 */
import type { MouseEvent } from "react";
import { cn } from "@/components/ui";
import "./game-header.css";

/**
 * หัวจอในเกมแบบเดียวกันทุกภารกิจ (ต้นแบบจากภารกิจ 2):
 * ปุ่มไม้กลมย้อนกลับ · ป้ายไม้ชื่อภารกิจ + ป้ายม่วงย่อย · ปุ่มไม้กลมเสียง
 */

export const GAME_ROUND_ICON = {
  back: "/ui/kit2/back-button.webp",
  sound: "/ui/kit2/sound-button.webp",
  soundOff: "/ui/kit2/sound-off-button.webp",
} as const;

export function GameRoundButton({
  kind,
  onClick,
  label,
  soundOn = true,
  className,
}: {
  kind: "back" | "sound";
  onClick: () => void;
  /** aria-label; default "ย้อนกลับ" / "ปิดเสียง|เปิดเสียง" */
  label?: string;
  soundOn?: boolean;
  className?: string;
}) {
  const isSound = kind === "sound";
  const src = isSound ? (soundOn ? GAME_ROUND_ICON.sound : GAME_ROUND_ICON.soundOff) : GAME_ROUND_ICON.back;
  return (
    <button
      type="button"
      className={cn("game-round", isSound && !soundOn && "is-muted", className)}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label ?? (isSound ? (soundOn ? "ปิดเสียง" : "เปิดเสียง") : "ย้อนกลับ")}
      aria-pressed={isSound ? soundOn : undefined}
    >
      <img src={src} alt="" draggable={false} />
    </button>
  );
}

export type GameHeaderProps = {
  /** ข้อความบนป้ายไม้ เช่น "ภารกิจที่ 2" */
  title: string;
  /** ป้ายม่วงใต้ป้ายไม้ (ไม่ใส่ก็ได้) */
  subtitle?: string;
  /** ไม่ส่ง = ไม่มีปุ่มย้อนกลับ (เว้นที่ไว้ให้ป้ายอยู่กลาง) */
  onBack?: () => void;
  backLabel?: string;
  soundOn?: boolean;
  /** ไม่ส่ง = ไม่มีปุ่มเสียง (เว้นที่ไว้) */
  onSound?: () => void;
  className?: string;
};

export function GameHeader({ title, subtitle, onBack, backLabel, soundOn = true, onSound, className }: GameHeaderProps) {
  return (
    <header className={cn("game-header", className)}>
      {onBack ? <GameRoundButton kind="back" onClick={onBack} label={backLabel} /> : <span className="game-round-spacer" aria-hidden />}
      <div className="game-header-sign-col">
        <h1 className="game-header-sign">{title}</h1>
        {subtitle ? <span className="game-header-pill">{subtitle}</span> : null}
      </div>
      {onSound ? <GameRoundButton kind="sound" onClick={onSound} soundOn={soundOn} /> : <span className="game-round-spacer" aria-hidden />}
    </header>
  );
}
