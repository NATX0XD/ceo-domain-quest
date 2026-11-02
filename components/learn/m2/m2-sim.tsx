"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/components/ui";
import {
  Dome,
  KIT,
  M2Button,
  M2Screen,
  Nail,
  Panel,
  ScanArrow,
  Stars,
  placeUnique,
  useDragBoard,
} from "./m2-kit";

export type SimResult = { correct?: boolean; reason?: string; wrong?: string[] };

type Chrome = {
  onBack: () => void;
  soundOn: boolean;
  onSound: () => void;
};

const PIECE_ASSET: Record<string, string> = {
  kanombanyai: "tut_kanombanyai",
  www: "tut_www",
  "tut-com": "tut_com",
  ployflower: "l1_ployflower",
  shop: "l1_shop",
  "l1-com": "l1_com",
  parts: "l2_parts",
  forcespeed: "l2_forcespeed",
  "l2-com": "l2_com",
  order: "l3_order",
  ittimbeach: "l3_ittimbeach",
  "l3-com": "l3_com",
  menu: "l4_menu",
  kafaethai: "l4_kafaethai",
  co: "l4_co",
  th: "l4_th",
  "l4-www": "l4_decoy_www",
  "l4-com": "l4_decoy_com",
};

const PIECE_VALUE: Record<string, string> = {
  "tut-com": "com",
  "l1-com": "com",
  "l2-com": "com",
  "l3-com": "com",
  "l4-www": "www",
  "l4-com": "com",
};
const valueOf = (id: string) => PIECE_VALUE[id] ?? id;

function WoodPiece({ id, placed = false }: { id: string; placed?: boolean }) {
  const asset = PIECE_ASSET[id] ?? "l1_com";
  return (
    <img
      className="m2g-wood"
      src={KIT(placed ? `${asset}_placed` : asset)}
      alt={valueOf(id)}
      draggable={false}
    />
  );
}

/* ── 38 ฉากเปิดพายุ ─────────────────────────────────────────────────── */

const STORM_PIECES = [
  { id: "kanombanyai", x: 10, y: 34, r: -14 },
  { id: "l1-com", x: 64, y: 31, r: 18 },
  { id: "www", x: 40, y: 46, r: -6 },
  { id: "th", x: 74, y: 47, r: -38, asset: "l4_th" },
  { id: "ployflower", x: 56, y: 56, r: 10 },
  { id: "order", x: 16, y: 61, r: -24 },
];

export function SimStorm({ chrome, onNext }: { chrome: Chrome; onNext: () => void }) {
  return (
    <M2Screen
      {...chrome}
      title="ภารกิจที่ 2"
      subtitle="Simulator : ซ่อมป้ายหลังพายุ"
      tone="storm"
      className="m2g-storm"
      onTap={onNext}
      footer={<span className="m2g-tap-hint">แตะที่ไหนก็ได้เพื่อเริ่มซ่อมป้าย</span>}
    >
      <div className="m2g-storm-pieces" aria-hidden>
        {STORM_PIECES.map((piece, index) => (
          <img
            key={piece.id}
            src={KIT(piece.asset ?? PIECE_ASSET[piece.id]!)}
            alt=""
            draggable={false}
            style={
              {
                left: `${piece.x}%`,
                top: `${piece.y}%`,
                "--r": `${piece.r}deg`,
                "--i": index,
              } as React.CSSProperties
            }
          />
        ))}
        <span className="m2g-leaf l1" />
        <span className="m2g-leaf l2" />
      </div>
      <Dome className="m2g-dome-bottom">
        แย่แล้ว CEO! พายุเมื่อคืน
        <br />
        พัดป้ายชื่อเว็บของร้านในเมือง
        <br />
        แตกกระจายหมดเลย
        <br />
        ช่วยโดมประกอบคืนหน่อยครับ
      </Dome>
    </M2Screen>
  );
}

/* ── 39 Tutorial ─────────────────────────────────────────────────────── */

export function SimTutorial({ chrome, onDone }: { chrome: Chrome; onDone: () => void }) {
  const [placed, setPlaced] = useState(false);
  const [miss, setMiss] = useState(false);
  const board = useDragBoard((item, zone) => {
    if (item === "tut-com" && zone === "tld") {
      setPlaced(true);
      window.setTimeout(onDone, 900);
    } else {
      setMiss(true);
    }
  });
  return (
    <M2Screen
      {...chrome}
      title="Tutorial"
      subtitle="ป้ายร้านขนมบ้านยาย"
      className="m2g-tutorial"
      footer={
        <M2Button color="grey" size="md" onClick={onDone}>
          ข้ามสอนเล่น
        </M2Button>
      }
    >
      <div className="m2g-dim" aria-hidden />
      <Panel title="ลากชิ้นป้ายไปวางในช่องให้ถูกต้อง" className="m2g-work">
        <div className="m2g-slots three">
          {(
            [
              ["sub", "Subdomain", "green"],
              ["sld", "SLD", "blue"],
              ["tld", "TLD", "orange"],
            ] as const
          ).map(([id, label, tone], index) => (
            <div key={id} className="m2g-slot-cell">
              {index > 0 ? <Nail /> : null}
              <div
                {...(id === "tld" ? board.zoneProps("tld") : {})}
                className={cn(
                  "m2g-slot",
                  `tone-${tone}`,
                  id === "tld" ? "is-target" : "is-dimmed",
                  placed && id === "tld" && "is-filled",
                )}
                aria-label={`ช่อง ${label}`}
              >
                <span className="m2g-slot-label">{label}</span>
                {placed && id === "tld" ? <WoodPiece id="tut-com" /> : <span className="m2g-plus">+</span>}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="ชิ้นป้ายที่เก็บได้" className="m2g-tray m2g-tray-dim">
        <div className="m2g-tray-row">
          <div className="m2g-tray-item is-dimmed">
            <WoodPiece id="www" />
          </div>
          <div className="m2g-tray-item is-dimmed">
            <WoodPiece id="kanombanyai" />
          </div>
          {!placed ? (
            <div className="m2g-tray-item is-lit">
              <div {...board.itemProps("tut-com")} aria-label="ชิ้นป้าย com">
                <WoodPiece id="tut-com" />
              </div>
              <img className="m2g-hand is-drag-demo" src="/ui/map/pointer-hand.webp" alt="" aria-hidden draggable={false} />
            </div>
          ) : (
            <div className="m2g-tray-item" />
          )}
        </div>
      </Panel>
      <Dome tag="Tutorial" className="m2g-dome-row">
        {placed
          ? "เยี่ยมเลย! com คือส่วนที่ใหญ่ที่สุด อยู่ขวาสุดเสมอครับ"
          : miss
            ? "ลองลาก com ไปช่องสีส้มที่กำลังเรืองแสงนะครับ"
            : "ขั้นที่ 1: เริ่มจากส่วนที่ใหญ่ที่สุด ลาก com ไปช่องขวาสุดก่อนเลย!"}
      </Dome>
    </M2Screen>
  );
}

/* ── 40–43 ด่าน 1–4 ───────────────────────────────────────────────────── */

type StageDef = {
  pill: string;
  prompt: string;
  slots: string[];
  locked: Record<string, string>;
  tray: string[];
  dome: string;
  hint: string;
};

const STAGES: Record<1 | 4, StageDef> = {
  1: {
    pill: "ประกอบป้าย · ร้านดอกไม้ป้าพลอย",
    prompt: "ป้าพลอยอยากเปิดหน้า ร้านค้าออนไลน์ (shop)",
    slots: ["slot1", "slot2", "slot3"],
    locked: { slot3: "l1-com" },
    tray: ["ployflower", "shop"],
    dome: "ลากชิ้นป้ายลงช่องให้ครบ แล้วกดตรวจคำตอบนะครับ",
    hint: "ชื่อร้านอยู่ตรงกลางติดกับ com ส่วนหน้าร้านค้า (shop) เป็นห้องย่อยอยู่ซ้ายสุดครับ",
  },
  4: {
    pill: "ออเดอร์ป้าย · ร้านกาแฟไทย",
    prompt: "บริษัทในไทยใช้ .co.th อยากมีหน้า เมนู (menu)",
    slots: ["slot1", "slot2", "slot3", "slot4"],
    locked: {},
    tray: ["kafaethai", "menu", "l4-com", "l4-www", "co", "th"],
    dome: "ป้ายไทยมี 4 ชิ้น ระวังชิ้นหลอกด้วยนะครับ",
    hint: "อ่านจากขวา: th (ประเทศไทย) → co (บริษัท) → ชื่อร้าน → หน้า menu",
  },
};

function SlotStage({
  stage,
  chrome,
  check,
  onPass,
}: {
  stage: 1 | 4;
  chrome: Chrome;
  check: (placements: Record<string, string>) => Promise<SimResult | null>;
  onPass: () => void;
}) {
  const def = STAGES[stage];
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [marks, setMarks] = useState<Record<string, "ok" | "bad">>({});
  const [say, setSay] = useState<{ text: string; tag?: string; tone?: "red" | "green" | "yellow" } | null>(null);
  const [busy, setBusy] = useState(false);
  const board = useDragBoard((item, zone) => {
    if (def.locked[zone]) return;
    setMarks({});
    setPlaced((current) => placeUnique(current, zone, item));
  });
  const all = { ...placed, ...def.locked };
  const inTray = def.tray.filter((id) => !Object.values(placed).includes(id));
  const full = def.slots.every((slot) => all[slot]);

  async function submit() {
    if (!full || busy) return;
    setBusy(true);
    const values = Object.fromEntries(def.slots.map((slot) => [slot, valueOf(all[slot]!)]));
    const result = await check(values);
    setBusy(false);
    if (!result) return;
    const wrong = result.correct ? [] : (result.wrong ?? []);
    setMarks(
      Object.fromEntries(
        def.slots.filter((slot) => !def.locked[slot]).map((slot) => [slot, wrong.includes(slot) ? "bad" : "ok"]),
      ),
    );
    if (result.correct) {
      setSay({ text: "ถูกต้องครับ! ป้ายกลับมาเป็นชื่อเว็บแล้ว", tag: "เยี่ยม!", tone: "green" });
      window.setTimeout(onPass, 1100);
    } else {
      const decoy = Object.values(values).some((value) => value === "www" || value === "com") && stage === 4;
      setSay(
        decoy
          ? {
              tag: "ชิ้นหลอก!",
              tone: "yellow",
              text: "www เป็นหน้าหลักของเว็บ แต่ร้านต้องการหน้า \"เมนู\" นะครับ แล้ว com ก็เป็นชิ้นหลอก ระวังด้วย!",
            }
          : { tag: "ลองอีกนิด", tone: "red", text: result.reason ?? "ยังไม่ตรง ลองย้ายชิ้นป้ายแล้วตรวจอีกครั้ง" },
      );
    }
  }

  return (
    <M2Screen
      {...chrome}
      title={`ด่าน ${stage}/4`}
      subtitle={def.pill}
      footer={
        <M2Button disabled={!full || busy} onClick={() => void submit()}>
          {busy ? "กำลังตรวจ" : "ตรวจคำตอบ"}
        </M2Button>
      }
    >
      <Panel title={def.prompt} className="m2g-work">
        <div className={cn("m2g-slots", stage === 4 ? "four" : "three")}>
          {def.slots.map((slot, index) => {
            const item = all[slot];
            const locked = Boolean(def.locked[slot]);
            return (
              <div key={slot} className="m2g-slot-cell">
                {index > 0 ? <Nail /> : null}
                <div
                  {...board.zoneProps(slot)}
                  className={cn("m2g-slot", item && "is-filled", locked && "is-locked")}
                  aria-label={`ช่องที่ ${index + 1}${item ? `: ${valueOf(item)}` : ""}`}
                >
                  <span className="m2g-slot-label tone-q">?</span>
                  {item ? (
                    locked ? (
                      <WoodPiece id={item} />
                    ) : (
                      <div {...board.itemProps(item)} aria-label={`ชิ้นป้าย ${valueOf(item)} (ลากออกได้)`}>
                        <WoodPiece id={item} />
                      </div>
                    )
                  ) : (
                    <span className="m2g-plus">+</span>
                  )}
                  {marks[slot] ? (
                    <img
                      className="m2g-mark"
                      src={KIT(marks[slot] === "ok" ? "icon_check" : "icon_cross")}
                      alt={marks[slot] === "ok" ? "ถูก" : "ผิด"}
                      draggable={false}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="ชิ้นป้ายที่เก็บได้" className="m2g-tray">
        <div {...board.zoneProps("tray")} className={cn("m2g-tray-row", stage === 4 && "wrap")}>
          {inTray.map((id) => (
            <div key={id} className="m2g-tray-item">
              <div {...board.itemProps(id)} aria-label={`ชิ้นป้าย ${valueOf(id)}`}>
                <WoodPiece id={id} />
              </div>
            </div>
          ))}
          {inTray.length === 0 ? <span className="m2g-tray-empty">วางครบแล้ว กดตรวจคำตอบได้เลย</span> : null}
        </div>
      </Panel>
      <div className="m2g-dome-line">
        <Dome tag={say?.tag} tagTone={say?.tone}>
          {say?.text ?? def.dome}
        </Dome>
        <button
          type="button"
          className="m2g-hint"
          aria-label="คำใบ้"
          onClick={() => setSay({ tag: "คำใบ้", tone: "yellow", text: def.hint })}
        >
          <img src={KIT("icon_hint")} alt="" draggable={false} />
        </button>
      </div>
    </M2Screen>
  );
}

export function SimStage1(props: { chrome: Chrome; check: (p: Record<string, string>) => Promise<SimResult | null>; onPass: () => void }) {
  return <SlotStage stage={1} {...props} />;
}
export function SimStage4(props: { chrome: Chrome; check: (p: Record<string, string>) => Promise<SimResult | null>; onPass: () => void }) {
  return <SlotStage stage={4} {...props} />;
}

/* ── 41 ด่าน 2/4 ติดชื่อส่วน ─────────────────────────────────────────── */

const TAGS: Record<string, { asset: string; value: string }> = {
  "tag-sub": { asset: "tag_sub", value: "Subdomain" },
  "tag-sld": { asset: "tag_sld", value: "SLD" },
  "tag-tld": { asset: "tag_tld", value: "TLD" },
};

export function SimStage2({
  chrome,
  check,
  onPass,
}: {
  chrome: Chrome;
  check: (placements: Record<string, string>) => Promise<SimResult | null>;
  onPass: () => void;
}) {
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [say, setSay] = useState<{ text: string; tag?: string; tone?: "red" | "green" | "yellow" } | null>(null);
  const [marks, setMarks] = useState<Record<string, "ok" | "bad">>({});
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const board = useDragBoard((item, zone) => {
    if (zone === "slot3") return;
    setTouched(true);
    setMarks({});
    setPlaced((current) => placeUnique(current, zone, item));
  });
  const all: Record<string, string> = { ...placed, slot3: "tag-tld" };
  const inTray = ["tag-sub", "tag-sld"].filter((id) => !Object.values(placed).includes(id));
  const full = all.slot1 && all.slot2;

  async function submit() {
    if (!full || busy) return;
    setBusy(true);
    const values = {
      slot1: TAGS[all.slot1!]!.value,
      slot2: TAGS[all.slot2!]!.value,
      slot3: "TLD",
    };
    const result = await check(values);
    setBusy(false);
    if (!result) return;
    const wrong = result.correct ? [] : ["slot1", "slot2"].filter((slot) => (result.wrong ?? ["slot1", "slot2"]).includes(slot));
    setMarks(Object.fromEntries(["slot1", "slot2"].map((slot) => [slot, wrong.includes(slot) ? "bad" : "ok"])));
    if (result.correct) {
      setSay({ tag: "เยี่ยม!", tone: "green", text: "parts คือห้องย่อย forcespeed คือชื่อร้าน ถูกต้องครับ!" });
      window.setTimeout(onPass, 1100);
    } else setSay({ tag: "ลองอีกนิด", tone: "red", text: result.reason ?? "ชิ้นไหนคือชื่อร้าน ชิ้นไหนคือห้องย่อย ลองสลับดูครับ" });
  }

  return (
    <M2Screen
      {...chrome}
      title="ด่าน 2/4"
      subtitle="ติดป้ายชื่อส่วน · อู่ ForceSpeed"
      footer={
        <M2Button disabled={!full || busy} onClick={() => void submit()}>
          {busy ? "กำลังตรวจ" : "ตรวจคำตอบ"}
        </M2Button>
      }
    >
      <Panel title="ป้ายประกอบเสร็จแล้ว ลากป้ายชื่อไปติดใต้แต่ละชิ้น" className="m2g-work">
        <div className="m2g-slots three">
          {(["parts", "forcespeed", "l2-com"] as const).map((id, index) => (
            <div key={id} className="m2g-slot-cell">
              {index > 0 ? <Nail /> : null}
              <div className="m2g-stack">
                <WoodPiece id={id} />
                <div
                  {...(index < 2 ? board.zoneProps(`slot${index + 1}`) : {})}
                  className={cn("m2g-label-slot", all[`slot${index + 1}`] && "is-filled")}
                  aria-label={`ช่องป้ายชื่อใต้ ${valueOf(id)}`}
                >
                  {all[`slot${index + 1}`] ? (
                    index < 2 ? (
                      <div {...board.itemProps(all[`slot${index + 1}`]!)}>
                        <img className="m2g-tag" src={KIT(TAGS[all[`slot${index + 1}`]!]!.asset)} alt={TAGS[all[`slot${index + 1}`]!]!.value} draggable={false} />
                      </div>
                    ) : (
                      <img className="m2g-tag" src={KIT("tag_tld")} alt="TLD" draggable={false} />
                    )
                  ) : null}
                  {marks[`slot${index + 1}`] ? (
                    <img
                      className="m2g-mark"
                      src={KIT(marks[`slot${index + 1}`] === "ok" ? "icon_check" : "icon_cross")}
                      alt={marks[`slot${index + 1}`] === "ok" ? "ถูก" : "ผิด"}
                      draggable={false}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="ป้ายชื่อส่วน" className="m2g-tray">
        <div {...board.zoneProps("tray")} className="m2g-tray-row tags">
          {inTray.map((id) => (
            <div key={id} className="m2g-tray-item">
              <div {...board.itemProps(id)} aria-label={`ป้าย ${TAGS[id]!.value}`}>
                <img className="m2g-tag" src={KIT(TAGS[id]!.asset)} alt={TAGS[id]!.value} draggable={false} />
              </div>
              {id === "tag-sld" && !touched ? (
                <img className="m2g-hand is-tap" src="/ui/map/pointer-hand.webp" alt="" aria-hidden draggable={false} />
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
      <div className="m2g-dome-line">
        <Dome tag={say?.tag} tagTone={say?.tone}>
          {say?.text ?? "ชิ้นไหนคือชื่อร้าน ชิ้นไหนคือห้องย่อย? ติดป้ายให้ถูกนะครับ"}
        </Dome>
      </div>
    </M2Screen>
  );
}

/* ── 42 ด่าน 3/4 เลขลำดับการอ่าน + สแกน ───────────────────────────────── */

export function SimStage3({
  chrome,
  check,
  onPass,
}: {
  chrome: Chrome;
  check: (order: string[]) => Promise<SimResult | null>;
  onPass: () => void;
}) {
  // zone = piece id, item = badge id
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [scan, setScan] = useState<"idle" | "running" | "done">("idle");
  const [say, setSay] = useState<{ text: string; tag?: string; tone?: "red" | "green" | "yellow" } | null>(null);
  const [busy, setBusy] = useState(false);
  const board = useDragBoard((item, zone) => {
    if (scan !== "idle") return;
    setSay(null);
    setPlaced((current) => placeUnique(current, zone, item));
  });
  const pieces = ["order", "ittimbeach", "l3-com"] as const;
  const inTray = ["b1", "b2", "b3"].filter((id) => !Object.values(placed).includes(id));
  const full = pieces.every((piece) => placed[piece]);

  async function submit() {
    if (scan === "done") return onPass();
    if (!full || busy) return;
    setBusy(true);
    const order = [...pieces]
      .sort((a, b) => Number(placed[a]!.slice(1)) - Number(placed[b]!.slice(1)))
      .map((piece) => valueOf(piece));
    const result = await check(order);
    setBusy(false);
    if (!result) return;
    if (result.correct) {
      setScan("running");
      setSay({ tag: "ไฟสแกน", tone: "green", text: "บี๊บ บี๊บ บี๊บ! เครื่องอ่าน com → ittimbeach → order ถูกต้องครับ" });
      window.setTimeout(() => setScan("done"), 2100);
    } else {
      setSay({ tag: "ลองอีกนิด", tone: "red", text: result.reason ?? "เลข 1 ต้องอยู่กับส่วนที่ใหญ่ที่สุดทางขวาสุดนะครับ" });
    }
  }

  return (
    <M2Screen
      {...chrome}
      title="ด่าน 3/4"
      subtitle="เครื่องสแกนอ่านป้าย · ร้านไอติม"
      footer={
        <M2Button disabled={(!full && scan === "idle") || busy || scan === "running"} onClick={() => void submit()}>
          {scan === "done" ? "ไปด่าน 4/4" : busy ? "กำลังสแกน" : "สแกนเลย!"}
        </M2Button>
      }
    >
      <Panel title="คอมพิวเตอร์อ่านชิ้นไหนก่อน? ลากเลข 1-2-3 ไปติด" className={cn("m2g-work m2g-order", scan !== "idle" && "is-scanning")}>
        <div className="m2g-slots three">
          {pieces.map((piece, index) => (
            <div key={piece} className="m2g-slot-cell">
              {index > 0 ? <Nail /> : null}
              <div
                {...board.zoneProps(piece)}
                className={cn("m2g-order-zone", `lit-${2 - index}`)}
                aria-label={`ชิ้น ${valueOf(piece)}${placed[piece] ? ` ลำดับ ${placed[piece]!.slice(1)}` : ""}`}
              >
                <WoodPiece id={piece} />
                {placed[piece] ? (
                  <div className="m2g-badge-pin">
                    {scan === "idle" ? (
                      <div {...board.itemProps(placed[piece]!)}>
                        <img className="m2g-badge" src={KIT(`badge_${placed[piece]!.slice(1)}`)} alt={`ลำดับ ${placed[piece]!.slice(1)}`} draggable={false} />
                      </div>
                    ) : (
                      <img className="m2g-badge is-correct" src={KIT(`badge_${placed[piece]!.slice(1)}_correct`)} alt={`ลำดับ ${placed[piece]!.slice(1)} ถูก`} draggable={false} />
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="m2g-scanner" aria-hidden />
      </Panel>
      <Panel title="ป้ายลำดับ" className="m2g-tray">
        <div {...board.zoneProps("tray")} className="m2g-tray-row badges">
          {inTray.map((id) => (
            <div key={id} className="m2g-tray-item">
              <div {...board.itemProps(id)} aria-label={`ป้ายเลข ${id.slice(1)}`}>
                <img className="m2g-badge" src={KIT(`badge_${id.slice(1)}`)} alt={id.slice(1)} draggable={false} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <div className="m2g-dome-line">
        <Dome tag={say?.tag} tagTone={say?.tone}>
          {say?.text ?? "เครื่องสแกนของเมืองอ่านแบบคอมพิวเตอร์ เริ่มจากส่วนที่ใหญ่ที่สุดนะครับ"}
        </Dome>
      </div>
    </M2Screen>
  );
}

/* ── 44 ตอบถูก ไฟสแกน ───────────────────────────────────────────────── */

export function SimFinale({ chrome, onNext }: { chrome: Chrome; onNext: () => void }) {
  const [lit, setLit] = useState(0);
  useEffect(() => {
    if (lit >= 4) return;
    const id = window.setTimeout(() => setLit((value) => value + 1), lit === 0 ? 500 : 550);
    return () => window.clearTimeout(id);
  }, [lit]);
  const pieces = useMemo(() => ["menu", "kafaethai", "co", "th"], []);
  return (
    <M2Screen
      {...chrome}
      title="ด่าน 4/4"
      subtitle="ร้านกาแฟไทย"
      footer={
        <>
          <Stars count={lit >= 4 ? 3 : 0} />
          <M2Button onClick={onNext}>ไปเช็กความเข้าใจ</M2Button>
        </>
      }
    >
      <Panel className="m2g-work m2g-finale">
        <div className="m2g-slots four">
          {pieces.map((piece, index) => (
            <div key={piece} className="m2g-slot-cell">
              {index > 0 ? <Nail /> : null}
              <div className={cn("m2g-slot is-filled", 4 - index <= lit && "is-lit")}>
                <span className="m2g-slot-label tone-q">?</span>
                <WoodPiece id={piece} placed />
                <img className="m2g-mark" src={KIT("icon_check")} alt="ถูก" draggable={false} />
              </div>
            </div>
          ))}
        </div>
        <ScanArrow active />
      </Panel>
      <Dome size="lg" bubbleSide="top" className="m2g-dome-center">
        ป้ายติดไฟจากขวาไปซ้าย
        <br />
        <b>th › co › kafaethai › menu</b>
      </Dome>
    </M2Screen>
  );
}
