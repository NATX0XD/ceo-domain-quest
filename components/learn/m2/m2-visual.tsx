"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";
import { KIT, M2Button, M2Screen, Nail, placeUnique, useDragBoard } from "./m2-kit";

type Chrome = { onBack: () => void; soundOn: boolean; onSound: () => void };

/* Storyboard "การ์ดเว็บปลิวลม" — 12 shots, 56 s, 3 stops (boards 22–23) */
type Shot = {
  from: number;
  to: number;
  bg: "beach" | "bakery" | "bakery2" | "bakery3";
  props: string;
  line: string;
  who: string;
};

export const SHOTS: Shot[] = [
  { from: 0, to: 4, bg: "beach", props: "dome-peek", who: "โดม", line: "เช้านี้ร้านขนมบ้านยาย เปิดรับสั่งขนมออนไลน์เป็นวันแรกครับ" },
  { from: 4, to: 8, bg: "bakery2", props: "card-full", who: "ยาย", line: "สั่งขนมผ่านเว็บนี้ได้เลยนะหลาน" },
  { from: 8, to: 12, bg: "beach", props: "cards-fly", who: "มะลิ", line: "อ๊ะ! ลมพัดการ์ดฉีกเป็น 3 ชิ้น" },
  { from: 12, to: 18, bg: "bakery", props: "phone-error", who: "มะลิ", line: "ต่อครบสามชิ้นแล้วนะ ทำไมเข้าไม่ได้ล่ะ" },
  { from: 18, to: 21, bg: "beach", props: "dome-pop", who: "โดม", line: "ชื่อเว็บก็เหมือนที่อยู่ส่งพัสดุนะ มาดูกัน!" },
  { from: 21, to: 27, bg: "beach", props: "boxes-nest", who: "โดม", line: "กล่องใหญ่สุด com บอกประเภทธุรกิจ กล่องกลางคือร้าน kanombanyai กล่องเล็กสุดคือห้อง shop" },
  { from: 27, to: 31, bg: "beach", props: "boxes-row", who: "โดม", line: "พอเขียนเป็นชื่อเว็บ เราเรียงจากเล็กไปใหญ่ และคั่นด้วยจุด" },
  { from: 31, to: 36, bg: "beach", props: "boxes-scan", who: "โดม", line: "แต่คอมพิวเตอร์อ่านกลับกัน เริ่มจากขวาสุดที่ใหญ่ที่สุด แล้วค่อย ๆ หาเข้าไปทางซ้าย" },
  { from: 36, to: 40, bg: "bakery", props: "cards-table", who: "มะลิ", line: "งั้นต้องเรียงยังไงนะ" },
  { from: 40, to: 44, bg: "bakery", props: "phone-cake", who: "มะลิ", line: "เข้าได้แล้ว! สั่งขนมเลย" },
  { from: 44, to: 50, bg: "bakery3", props: "phone-booking", who: "แพร", line: "ยายอยากมีหน้าจองเค้กวันเกิดด้วย ชื่อเว็บต้องเปลี่ยนตรงไหนนะ" },
  { from: 50, to: 56, bg: "bakery2", props: "boxes-booking", who: "โดม", line: "จำไว้นะครับ ชื่อเว็บมีสามส่วน คั่นด้วยจุด และคอมพิวเตอร์อ่านจากขวาไปซ้าย" },
];
export const CLIP_END = 56;
/** shot index that ends at each stop */
export const STOP_AFTER = [3, 8, 10] as const;
const STOP_T = STOP_AFTER.map((i) => SHOTS[i]!.to);
/** rewatch range per stop (shot indexes) */
export const REWATCH_FROM = [2, 5, 9] as const;

const BG: Record<Shot["bg"], { src: string; pos: string }> = {
  beach: { src: KIT("bg-scene"), pos: "50% 52%" },
  bakery: { src: "/learn/m2/watch-s1.webp", pos: "50% 28%" },
  bakery2: { src: "/learn/m2/watch-s7.webp", pos: "50% 34%" },
  bakery3: { src: "/learn/m2/watch-s6.webp", pos: "50% 34%" },
};

function fmt(t: number) {
  const s = Math.floor(t);
  return `0:${String(s).padStart(2, "0")}`;
}

function ShotProps({ props }: { props: string }) {
  switch (props) {
    case "dome-peek":
      return <img className="vp vp-dome-peek" src={KIT("dome_cheer")} alt="" />;
    case "card-full":
      return <img className="vp vp-card-full" src={KIT("paper_card_full")} alt="" />;
    case "cards-fly":
      return (
        <>
          <img className="vp vp-fly f1" src={KIT("paper_card_shop")} alt="" />
          <img className="vp vp-fly f2" src={KIT("paper_card_kanombanyai")} alt="" />
          <img className="vp vp-fly f3" src={KIT("paper_card_com")} alt="" />
        </>
      );
    case "phone-error":
      return <img className="vp vp-phone" src={KIT("phone_error")} alt="" />;
    case "dome-pop":
      return (
        <>
          <span className="vp vp-burst" />
          <img className="vp vp-dome-pop" src={KIT("dome_cheer")} alt="" />
        </>
      );
    case "boxes-nest":
      return (
        <>
          <img className="vp vp-nest n3" src={KIT("box_com")} alt="" />
          <img className="vp vp-nest n2" src={KIT("box_kanombanyai")} alt="" />
          <img className="vp vp-nest n1" src={KIT("box_shop")} alt="" />
          <img className="vp vp-dome-side" src={KIT("dome_cheer")} alt="" />
        </>
      );
    case "boxes-row":
    case "boxes-scan":
      return (
        <>
          <div className={cn("vp vp-row", props === "boxes-scan" && "is-scan")}>
            <img src={KIT("box_shop")} alt="" />
            <i />
            <img src={KIT("box_kanombanyai")} alt="" />
            <i />
            <img src={KIT("box_com")} alt="" />
          </div>
          {props === "boxes-scan" ? (
            <div className="vp vp-scanbar">
              <span className="m2g-arrow-head" />
              <span className="m2g-arrow-bar">
                <i className="dot-green" />
                <i className="dot-blue" />
                <i className="dot-orange" />
              </span>
            </div>
          ) : (
            <img className="vp vp-dome-corner" src={KIT("dome_cheer")} alt="" />
          )}
        </>
      );
    case "cards-table":
      return (
        <>
          <div className="vp vp-table">
            <img src={KIT("paper_card_com")} alt="" />
            <img src={KIT("paper_card_shop")} alt="" />
            <img src={KIT("paper_card_kanombanyai")} alt="" />
          </div>
          <img className="vp vp-phone" src={KIT("phone_error")} alt="" />
        </>
      );
    case "phone-cake":
      return (
        <>
          <span className="vp vp-confetti" />
          <img className="vp vp-phone" src={KIT("phone_cake")} alt="" />
        </>
      );
    case "phone-booking":
      return <img className="vp vp-phone" src={KIT("phone_booking")} alt="" />;
    case "boxes-booking":
      return (
        <>
          <div className="vp vp-top-boxes">
            <img src={KIT("box_booking")} alt="" />
            <img src={KIT("box_kanombanyai")} alt="" />
            <img src={KIT("box_com")} alt="" />
          </div>
          <img className="vp vp-dome-corner" src={KIT("dome_cheer")} alt="" />
        </>
      );
    default:
      return null;
  }
}

export function ClipPlayer({
  t,
  playing,
  stopNo,
  onToggle,
  onSkip,
}: {
  t: number;
  playing: boolean;
  stopNo: number | null;
  onToggle?: () => void;
  onSkip?: () => void;
}) {
  const index = Math.max(0, SHOTS.findIndex((shot) => t < shot.to || shot === SHOTS[SHOTS.length - 1]));
  const shot = SHOTS[Math.min(index, SHOTS.length - 1)]!;
  const bg = BG[shot.bg];
  return (
    <div className="m2g-player">
      <div className="m2g-player-screen" key={index}>
        <img className="m2g-player-bg" src={bg.src} alt="" style={{ objectPosition: bg.pos }} draggable={false} />
        <div className={cn("m2g-player-props", !playing && stopNo === null && "is-paused")} aria-hidden>
          <ShotProps props={shot.props} />
        </div>
        {stopNo !== null ? (
          <>
            <img className="m2g-pause-badge" src={KIT(`pause_badge_${stopNo + 1}`)} alt={`หยุดถาม ${stopNo + 1}`} draggable={false} />
            <span className="m2g-pause-big" aria-hidden>
              <i />
              <i />
            </span>
          </>
        ) : (
          <p className="m2g-sub">
            <b>{shot.who}:</b> {shot.line}
          </p>
        )}
      </div>
      <div className="m2g-player-bar">
        <button
          type="button"
          className="m2g-play"
          onClick={(event) => {
            event.stopPropagation();
            onToggle?.();
          }}
          aria-label={playing ? "หยุดชั่วคราว" : "เล่นต่อ"}
          disabled={!onToggle}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <div className="m2g-track">
          <span className="m2g-track-fill" style={{ width: `${(t / CLIP_END) * 100}%` }} />
          {STOP_T.map((stop) => (
            <i key={stop} className={cn("m2g-stop-dot", t >= stop && "is-past")} style={{ left: `${(stop / CLIP_END) * 100}%` }} />
          ))}
          <span className="m2g-track-knob" style={{ left: `${(t / CLIP_END) * 100}%` }} />
        </div>
        <span className="m2g-time">
          {fmt(t)} / {fmt(CLIP_END)}
        </span>
        {onSkip ? (
          <button
            type="button"
            className="m2g-skip"
            onClick={(event) => {
              event.stopPropagation();
              onSkip();
            }}
            aria-label="ข้ามไปช่วงถัดไป"
          >
            ⏭
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** plays the clip from `startAt` until `until` (a stop or the end) */
export function useClip(startAt: number, until: number, onReach: () => void, active: boolean, run = 0) {
  const [t, setT] = useState(startAt);
  const [playing, setPlaying] = useState(true);
  const reached = useRef(false);
  const resetting = useRef(false);
  const cb = useRef(onReach);
  cb.current = onReach;
  useEffect(() => {
    setT(startAt);
    setPlaying(true);
    reached.current = false;
    resetting.current = true;
  }, [startAt, until, run]);
  useEffect(() => {
    if (!active || !playing) return;
    const id = window.setInterval(() => {
      setT((value) => Math.min(until, value + 0.1));
    }, 100);
    return () => window.clearInterval(id);
  }, [active, playing, until]);
  useEffect(() => {
    if (resetting.current) {
      resetting.current = t !== startAt;
      if (resetting.current) return;
    }
    if (active && t >= until && !reached.current) {
      reached.current = true;
      window.setTimeout(() => cb.current(), 250);
    }
  }, [t, until, active, startAt]);
  return {
    t,
    playing,
    toggle: () => setPlaying((value) => !value),
    skip: () => {
      const next = SHOTS.find((shot) => shot.from > t + 0.05);
      setT(next ? Math.min(until, next.from) : until);
    },
  };
}

export function VisualRules({ chrome, onStart }: { chrome: Chrome; onStart: () => void }) {
  const steps = [
    "ดูคลิปสถานการณ์สั้น ๆ ไม่ถึง 1 นาที",
    "คลิปจะหยุดเอง 3 ครั้ง ที่จุดสีทอง",
    "ตอบคำถามของโดม แล้วคลิปเล่นต่อ",
    "ตอบผิดได้ โดมจะพาย้อนดูช่วงที่สำคัญ",
    "ดูจบแล้วตอบคำถามท้ายคลิปอีก 2 ข้อ",
  ];
  return (
    <M2Screen
      {...chrome}
      title="ดูคลิปสถานการณ์"
      subtitle="Visual · ภารกิจที่ 2"
      footer={<M2Button onClick={onStart}>เริ่มดูคลิป</M2Button>}
    >
      <RulesCard heading="วิธีเรียนแบบดูคลิป" steps={steps} />
    </M2Screen>
  );
}

export function RulesCard({ heading, steps, art }: { heading: string; steps: string[]; art?: React.ReactNode }) {
  return (
    <section className="m2g-panel m2g-rules">
      <h2>{heading}</h2>
      <ol>
        {steps.map((step, index) => (
          <li key={step}>
            <span className="m2g-num">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {art ? <div className="m2g-rules-art">{art}</div> : null}
      <img className="m2g-rules-dome" src={KIT("dome_cheer")} alt="" aria-hidden draggable={false} />
    </section>
  );
}

export function ChoiceCards({
  choices,
  picked,
  verdict,
  onPick,
  disabled,
}: {
  choices: { id: string; label: string }[];
  picked: string | null;
  verdict: "good" | "bad" | null;
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="m2g-choices">
      {choices.map((choice, index) => {
        const state = picked === choice.id ? verdict ?? "picked" : null;
        return (
          <button
            key={choice.id}
            type="button"
            disabled={disabled}
            className={cn("m2g-choice", state && `is-${state}`)}
            onClick={(event) => {
              event.stopPropagation();
              onPick(choice.id);
            }}
            aria-pressed={picked === choice.id}
          >
            <span className="m2g-choice-letter">{"ABCD"[index]}</span>
            <span className="m2g-choice-text">{choice.label}</span>
            {state === "good" ? <img src={KIT("icon_check")} alt="ถูก" /> : null}
            {state === "bad" ? <img src={KIT("icon_cross")} alt="ผิด" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/* stop 2 — ลากชิ้นการ์ดเรียงใหม่ (board 28) */
const STOP2_ITEMS: Record<string, string> = { shop: "l1_shop", kanombanyai: "tut_kanombanyai", com: "l1_com" };

export function StopDrag({ onSubmit, busy }: { onSubmit: (answer: string) => void; busy: boolean }) {
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const board = useDragBoard((item, zone) => setPlaced((current) => placeUnique(current, zone, item)));
  const order = ["kanombanyai", "com", "shop"];
  const inTray = order.filter((id) => !Object.values(placed).includes(id));
  const slots = ["slot1", "slot2", "slot3"];
  const full = slots.every((slot) => placed[slot]);
  return (
    <div className="m2g-stopdrag">
      <div className="m2g-slots three bare">
        {slots.map((slot, index) => (
          <div key={slot} className="m2g-slot-cell">
            {index > 0 ? <Nail /> : null}
            <div {...board.zoneProps(slot)} className={cn("m2g-slot", placed[slot] && "is-filled")} aria-label={`ช่องที่ ${index + 1}`}>
              <span className="m2g-slot-label tone-q">?</span>
              {placed[slot] ? (
                <div {...board.itemProps(placed[slot]!)}>
                  <img className="m2g-wood" src={KIT(STOP2_ITEMS[placed[slot]!]!)} alt={placed[slot]} draggable={false} />
                </div>
              ) : (
                <span className="m2g-plus">+</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div {...board.zoneProps("tray")} className="m2g-tray-row loose">
        {inTray.map((id) => (
          <div key={id} className="m2g-tray-item">
            <div {...board.itemProps(id)} aria-label={`ชิ้นการ์ด ${id}`}>
              <img className="m2g-wood" src={KIT(STOP2_ITEMS[id]!)} alt={id} draggable={false} />
            </div>
          </div>
        ))}
      </div>
      <M2Button disabled={!full || busy} onClick={() => onSubmit(slots.map((slot) => placed[slot]).join("."))}>
        {busy ? "กำลังตรวจ" : "ตรวจคำตอบ"}
      </M2Button>
    </div>
  );
}
