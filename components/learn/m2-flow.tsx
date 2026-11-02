"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MotionConfig } from "motion/react";
import { useExitConfirm } from "@/components/student-navigation";
import { ModePopup } from "@/components/learn/mode-popup";
import { postLearn, type LearnModeId } from "@/components/learn/learn-path-api";
import type { LearnPath, LearnState } from "@/components/server/learn-path";
import { Dome, KIT, M2Button, M2Screen, Panel } from "./m2/m2-kit";
import { SimFinale, SimStage1, SimStage2, SimStage3, SimStage4, SimStorm, SimTutorial, type SimResult } from "./m2/m2-sim";
import {
  ChoiceCards,
  ClipPlayer,
  CLIP_END,
  REWATCH_FROM,
  RulesCard,
  SHOTS,
  STOP_AFTER,
  StopDrag,
  VisualRules,
  useClip,
} from "./m2/m2-visual";
import { TextChat, type TextGrade, type TextQuestion } from "./m2/m2-text";
import { Ending, ExitCheck, RepairDrill } from "./m2/m2-end";
import "./m2/m2-game.css";

type Step =
  | "choose"
  | "rules"
  | "v-clip"
  | "v-stop"
  | "v-post1"
  | "v-post2"
  | "t-chat"
  | "s-storm"
  | "s-tutorial"
  | "s-stage1"
  | "s-stage2"
  | "s-stage3"
  | "s-stage4"
  | "s-finale"
  | "exit"
  | "end"
  | "repair";

type Final = { score: number; exitScore: number; grade: "A" | "B" | "C"; passed: boolean; stars: number };
type StopResult = { correct: boolean; phase: "hint" | "rewatch" | "explain"; hint?: string; explanation?: string };

const STOP_QUESTIONS = [
  {
    title: "การ์ดเว็บปลิวลม",
    ask: (
      <>
        มะลิต่อชิ้นการ์ดเป็น
        <br />
        <b>com.kanombanyai.shop</b>
        <br />
        ชิ้นไหนควรอยู่ขวาสุด?
      </>
    ),
    choices: [
      { id: "subdomain", label: "shop" },
      { id: "sld", label: "kanombanyai" },
      { id: "tld", label: "com" },
    ],
  },
  {
    title: "ช่วยมะลิเรียงใหม่",
    ask: (
      <>
        ลากชิ้นการ์ดเรียงให้ถูก
        <br />
        มะลิจะได้เข้าเว็บร้านยายได้
      </>
    ),
    choices: [],
  },
  {
    title: "หน้าจองเค้กวันเกิด",
    ask: (
      <>
        ยายอยากมีหน้า &quot;จองเค้ก&quot; (booking)
        <br />
        ชื่อเว็บใหม่ควรเป็นข้อไหน?
      </>
    ),
    choices: [
      { id: "a", label: "shop.booking.com" },
      { id: "subdomain", label: "booking.kanombanyai.com" },
      { id: "c", label: "kanombanyai.booking" },
    ],
  },
] as const;

export function M2Flow({
  missionTitle,
  path,
  state,
  recommendedMode = null,
}: {
  missionTitle: string;
  path: LearnPath;
  state: LearnState;
  recommendedMode?: LearnModeId | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<LearnModeId | null>(state.chosen);
  const [pickedMode, setPickedMode] = useState<LearnModeId>(state.chosen ?? recommendedMode ?? "do");
  const [step, setStep] = useState<Step>(state.chosen ? "rules" : "choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [stageScore, setStageScore] = useState(0);
  const [final, setFinal] = useState<Final | null>(null);
  const [repairHits, setRepairHits] = useState(0);
  // visual
  const [clipFrom, setClipFrom] = useState(0);
  const [clipRun, setClipRun] = useState(0);
  const [rewatching, setRewatching] = useState(false);
  const [stop, setStop] = useState(0);
  const [stopAttempts, setStopAttempts] = useState<number[]>([0, 0, 0]);
  const [stopPick, setStopPick] = useState<string | null>(null);
  const [stopResult, setStopResult] = useState<StopResult | null>(null);
  const [postPick, setPostPick] = useState<string | null>(null);
  const [postResult, setPostResult] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [postText, setPostText] = useState("");
  const [postFeedback, setPostFeedback] = useState<TextGrade | null>(null);

  useEffect(() => {
    // warm the kit so pieces never pop in mid-stage
    const names =
      mode === "watch"
        ? ["paper_card_full", "paper_card_shop", "paper_card_kanombanyai", "paper_card_com", "phone_error", "phone_cake", "phone_booking", "box_shop", "box_kanombanyai", "box_com", "box_booking", "pause_badge_1", "pause_badge_2", "pause_badge_3", "l1_shop", "tut_kanombanyai", "l1_com"]
        : mode === "do"
          ? ["tut_www", "tut_kanombanyai", "tut_com", "l1_ployflower", "l1_shop", "l1_com", "l2_parts", "l2_forcespeed", "l2_com", "tag_sub", "tag_sld", "tag_tld", "l3_order", "l3_ittimbeach", "l3_com", "badge_1", "badge_2", "badge_3", "badge_1_correct", "badge_2_correct", "badge_3_correct", "l4_menu", "l4_kafaethai", "l4_co", "l4_th", "l4_decoy_www", "l4_decoy_com", "l4_menu_placed", "l4_kafaethai_placed", "l4_co_placed", "l4_th_placed", "icon_check", "icon_cross"]
          : [];
    for (const name of [...names, "crate_sub", "crate_sld", "crate_tld", "stars_0", "stars_2", "stars_3", "badge_domain_architect"]) {
      const img = new Image();
      img.src = KIT(name);
    }
  }, [mode]);

  const exit = useExitConfirm({ href: "/map", note: "คำตอบที่ยังไม่ส่งจะยังไม่ถูกบันทึก" });
  const chrome = { onBack: exit.request, soundOn, onSound: () => setSoundOn((value) => !value) };

  async function send<T>(payload: unknown): Promise<T | null> {
    setBusy(true);
    setError(null);
    const response = await postLearn<T>("m2", { action: "m2", payload });
    setBusy(false);
    if (!response.ok) {
      setError(response.message);
      return null;
    }
    return response.data;
  }

  async function chooseMode() {
    setBusy(true);
    const response = await postLearn<{ ok: true }>("m2", { action: "choose", mode: pickedMode });
    setBusy(false);
    if (!response.ok) return setError(response.message);
    setMode(pickedMode);
    setStep("rules");
  }

  function begin() {
    if (mode === "watch") {
      setClipFrom(0);
      setStop(0);
      setStep("v-clip");
    } else if (mode === "read") setStep("t-chat");
    else setStep("s-storm");
  }

  const simCheck = (stage: number) => (placements: Record<string, string>) =>
    send<SimResult>({ kind: "sim", stage, placements });

  /* ── visual helpers ── */
  const clipUntil = stop < STOP_AFTER.length ? SHOTS[STOP_AFTER[stop]!]!.to : CLIP_END;
  const clip = useClip(clipFrom, clipUntil, () => {
    if (stop < STOP_AFTER.length) {
      setStopPick(null);
      setStopResult(null);
      setStep("v-stop");
    } else setStep("v-post1");
  }, step === "v-clip", clipRun);

  async function answerStop(answer: string) {
    const attempt = (stopAttempts[stop] ?? 0) + 1;
    const result = await send<StopResult>({ kind: "stop", stop, answer, attempt });
    if (!result) return;
    setStopAttempts((all) => all.map((value, index) => (index === stop ? attempt : value)));
    setStopResult(result);
  }
  function afterStop() {
    if (stopResult?.phase === "rewatch") {
      setClipFrom(SHOTS[REWATCH_FROM[stop]!]!.from);
      setClipRun((value) => value + 1);
      setRewatching(true);
      setStopResult(null);
      setStopPick(null);
      setStep("v-clip");
      return;
    }
    const next = stop + 1;
    setRewatching(false);
    setClipRun((value) => value + 1);
    setClipFrom(SHOTS[STOP_AFTER[stop]!]!.to);
    setStop(next);
    setStopPick(null);
    setStopResult(null);
    setStep("v-clip");
  }
  async function answerPost1(id: string) {
    if (postResult) return;
    setPostPick(id);
    const result = await send<{ correct: boolean; explanation: string }>({ kind: "post", q: 0, answer: id });
    if (result) setPostResult(result);
  }
  async function answerPost2() {
    const question = path.watch.questions[0];
    if (!question || !postText.trim()) return;
    const attempt = postFeedback ? 2 : 1;
    const result = await send<TextGrade>({ kind: "text", mode: "watch", questionId: question.id, answer: postText, attempt });
    if (!result) return;
    setPostFeedback(result);
    if (result.correct || attempt >= 2) {
      const stopPenalty = stopAttempts.reduce((sum, value) => sum + Math.max(0, value - 1), 0) * 3;
      setStageScore(Math.max(40, (result.correct ? 70 : 55) - stopPenalty + (postResult?.correct ? 0 : -5)));
    }
  }

  async function submitExit(answers: number[]) {
    const result = await send<Final>({ kind: "exit", answers, stageScore, repair: repairHits > 0 });
    if (!result) return;
    setFinal(result);
    setStep("end");
  }

  const stage = (() => {
    switch (step) {
      case "choose":
        return (
          <M2Screen {...chrome} onBack={() => router.push("/map")} title="ภารกิจที่ 2" subtitle="แยกชิ้นส่วนชื่อเว็บ">
            <Dome className="m2g-dome-bottom">เลือกวิธีเรียนที่ถนัด แล้วไปลุยภารกิจที่ 2 กันเลย!</Dome>
            <ModePopup
              missionNo="2"
              title={missionTitle}
              recommended={recommendedMode ?? "do"}
              reason={recommendedMode ? undefined : "เลือกวิธีที่ถนัดได้เลย"}
              picked={pickedMode}
              busy={busy}
              error={error}
              onPick={setPickedMode}
              onStart={() => void chooseMode()}
              onClose={() => router.push("/map")}
              presentation="drawer"
            />
          </M2Screen>
        );
      case "rules":
        if (mode === "watch") return <VisualRules chrome={chrome} onStart={begin} />;
        return (
          <M2Screen
            {...chrome}
            title={mode === "read" ? "แชทติวกับโดม" : "ซ่อมป้ายหลังพายุ"}
            subtitle={mode === "read" ? "Text · ภารกิจที่ 2" : "Sim · ภารกิจที่ 2"}
            footer={<M2Button onClick={begin}>{mode === "read" ? "เริ่มแชทกับโดม" : "เริ่มซ่อมป้าย"}</M2Button>}
          >
            <RulesCard
              heading={mode === "read" ? "วิธีเรียนแบบแชทกับโดม" : "วิธีเล่นแบบลากวาง"}
              steps={
                mode === "read"
                  ? [
                      "อ่านบทอ่านสั้น ๆ ในแชท 3 บท",
                      "โดมถามคำถาม 3 ข้อ พิมพ์ตอบด้วยคำของตัวเอง",
                      "ตอบยังไม่ครบ โดมให้คำใบ้ แล้วลองใหม่ได้",
                      "กดหลอดไฟเมื่ออยากได้คำใบ้",
                      "จบแล้วได้การ์ดสรุปลงสมุดโน้ต",
                    ]
                  : [
                      "ลากชิ้นป้ายไม้ไปวางในช่อง (หรือแตะชิ้น แล้วแตะช่อง)",
                      "ทำ Tutorial 1 ครั้ง แล้วลุย 4 ด่าน",
                      "ติดป้ายชื่อส่วน และเลขลำดับการอ่าน",
                      "ด่านสุดท้ายมีชิ้นหลอก ระวังให้ดี",
                      "กดหลอดไฟเมื่ออยากได้คำใบ้",
                    ]
              }
              art={
                mode === "read" ? (
                  <div className="m2g-rules-parts">
                    <span className="m2g-part-pill tone-green">parts</span>
                    <i>.</i>
                    <span className="m2g-part-pill tone-blue">forcespeed</span>
                    <i>.</i>
                    <span className="m2g-part-pill tone-orange">com</span>
                  </div>
                ) : (
                  <div className="m2g-rules-woods">
                    <img src={KIT("l1_shop")} alt="" />
                    <img src={KIT("l1_ployflower")} alt="" />
                    <img src={KIT("l1_com")} alt="" />
                  </div>
                )
              }
            />
          </M2Screen>
        );
      case "v-clip":
        return (
          <M2Screen {...chrome} title="ดูคลิปสถานการณ์" subtitle="การ์ดเว็บปลิวลม" className="m2g-visual">
            <ClipPlayer t={clip.t} playing={clip.playing} stopNo={null} onToggle={clip.toggle} onSkip={clip.skip} />
            <Dome className="m2g-dome-row">
              {rewatching
                ? "ย้อนดูช่วงสำคัญอีกครั้งนะครับ แล้วกลับไปตอบข้อเดิม"
                : "ดูดี ๆ นะครับ CEO เดี๋ยวคลิปจะหยุดถามที่จุดสีทอง"}
            </Dome>
          </M2Screen>
        );
      case "v-stop": {
        const q = STOP_QUESTIONS[stop]!;
        const verdict = stopResult ? (stopResult.correct ? "good" : "bad") : null;
        return (
          <M2Screen
            {...chrome}
            title={`หยุดถาม ${stop + 1}/3`}
            subtitle={q.title}
            className="m2g-visual"
            footer={
              stopResult && (stopResult.correct || stopResult.phase !== "hint") ? (
                <M2Button onClick={afterStop}>
                  {stopResult.phase === "rewatch" ? "ย้อนดูช่วงสำคัญ" : "ดูคลิปต่อ"}
                </M2Button>
              ) : null
            }
          >
            <ClipPlayer t={SHOTS[STOP_AFTER[stop]!]!.to - 0.1} playing={false} stopNo={stop} />
            <Dome
              className="m2g-dome-row"
              tag={stopResult ? (stopResult.correct ? "ถูกต้อง!" : stopResult.phase === "explain" ? "เฉลย" : "คำใบ้") : "คำถามจากโดม"}
              tagTone={stopResult ? (stopResult.correct ? "green" : "yellow") : "yellow"}
            >
              {stopResult ? (stopResult.explanation ?? stopResult.hint) : q.ask}
            </Dome>
            {stop === 1 ? (
              stopResult && (stopResult.correct || stopResult.phase !== "hint") ? null : (
                <StopDrag key={stopAttempts[1]} busy={busy} onSubmit={(answer) => void answerStop(answer)} />
              )
            ) : (
              <ChoiceCards
                choices={[...q.choices]}
                picked={stopPick}
                verdict={verdict}
                disabled={busy || Boolean(stopResult?.correct) || stopResult?.phase === "explain" || stopResult?.phase === "rewatch"}
                onPick={(id) => {
                  setStopPick(id);
                  setStopResult(null);
                  void answerStop(id);
                }}
              />
            )}
          </M2Screen>
        );
      }
      case "v-post1":
        return (
          <M2Screen
            {...chrome}
            title="คำถามท้ายคลิป"
            subtitle="ข้อ 1/2"
            footer={postResult ? <M2Button onClick={() => setStep("v-post2")}>ข้อถัดไป</M2Button> : null}
          >
            <Dome tag="สถานการณ์ใหม่" className="m2g-dome-row top">
              มีคนส่งลิงก์มาให้มะลิว่า
              <br />
              <b>kanombanyai.net</b>
              <br />
              เป็นเว็บร้านยายใช่ไหม?
            </Dome>
            <ChoiceCards
              choices={[
                { id: "same", label: "ใช่ ชื่อร้านเหมือนกัน" },
                { id: "different", label: "ไม่แน่ ส่วนขวาสุดต่างกัน" },
              ]}
              picked={postPick}
              verdict={postResult ? (postResult.correct ? "good" : "bad") : null}
              disabled={busy || Boolean(postResult)}
              onPick={(id) => void answerPost1(id)}
            />
            {postResult ? (
              <Panel className="m2g-reveal" title="เฉลย">
                <p>{postResult.explanation}</p>
              </Panel>
            ) : null}
          </M2Screen>
        );
      case "v-post2": {
        const question = path.watch.questions[0];
        const done = Boolean(postFeedback && (postFeedback.correct || stageScore > 0));
        return (
          <M2Screen
            {...chrome}
            title="คำถามท้ายคลิป"
            subtitle="ข้อ 2/2"
            footer={
              done ? (
                <M2Button onClick={() => setStep("exit")}>ไปเช็กความเข้าใจ</M2Button>
              ) : (
                <M2Button disabled={busy || !postText.trim()} onClick={() => void answerPost2()}>
                  {busy ? "โดมกำลังอ่าน" : "ส่งคำตอบ"}
                </M2Button>
              )
            }
          >
            <Dome tag="ตอบด้วยคำของตัวเอง" className="m2g-dome-row top">
              {question?.prompt}
            </Dome>
            <Panel className="m2g-answer">
              <textarea
                value={postText}
                onChange={(event) => setPostText(event.target.value)}
                placeholder={question?.placeholder}
                maxLength={600}
                disabled={done}
                aria-label="พิมพ์คำตอบ"
              />
            </Panel>
            {postFeedback ? (
              <Panel className={postFeedback.correct ? "m2g-reveal is-good" : "m2g-reveal"} title={postFeedback.correct ? "คำตอบนี้ใช้ได้" : done ? "สรุปจากโดม" : "ลองเพิ่มอีกนิด"}>
                <p>{postFeedback.feedback}</p>
                {!postFeedback.correct && !done ? <p>คำใบ้: {postFeedback.hint ?? question?.hint}</p> : null}
              </Panel>
            ) : null}
          </M2Screen>
        );
      }
      case "t-chat":
        return (
          <TextChat
            chrome={chrome}
            questions={path.read.questions as TextQuestion[]}
            grade={(question, answer, attempt) =>
              send<TextGrade>({ kind: "text", mode: "read", questionId: question.id, answer, attempt })
            }
            saveNotebook={async () =>
              Boolean(
                await send({
                  kind: "notebook",
                  text: "TLD อยู่ขวาสุด · SLD อยู่ตรงกลาง · Subdomain อยู่ซ้ายสุด · อ่านจากขวาไปซ้าย",
                }),
              )
            }
            onFinish={(scores) => {
              const avg = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
              setStageScore(Math.round(avg * 0.7));
              setStep("exit");
            }}
          />
        );
      case "s-storm":
        return <SimStorm chrome={chrome} onNext={() => setStep("s-tutorial")} />;
      case "s-tutorial":
        return <SimTutorial chrome={chrome} onDone={() => setStep("s-stage1")} />;
      case "s-stage1":
        return <SimStage1 chrome={chrome} check={simCheck(1)} onPass={() => setStep("s-stage2")} />;
      case "s-stage2":
        return <SimStage2 chrome={chrome} check={simCheck(2)} onPass={() => setStep("s-stage3")} />;
      case "s-stage3":
        return (
          <SimStage3
            chrome={chrome}
            check={(order) => send<SimResult>({ kind: "sim", stage: 3, order })}
            onPass={() => setStep("s-stage4")}
          />
        );
      case "s-stage4":
        return (
          <SimStage4
            chrome={chrome}
            check={simCheck(4)}
            onPass={() => {
              setStageScore(70);
              setStep("s-finale");
            }}
          />
        );
      case "s-finale":
        return <SimFinale chrome={chrome} onNext={() => setStep("exit")} />;
      case "exit":
        return <ExitCheck key={repairHits} chrome={chrome} busy={busy} onSubmit={(answers) => void submitExit(answers)} />;
      case "end":
        return final ? (
          <Ending
            chrome={{ ...chrome, onBack: () => router.push("/map") }}
            grade={final.grade}
            stars={final.stars}
            score={final.score}
            onNext={() => router.push("/mission/m2")}
            onMap={() => router.push("/map")}
            onRepair={() => setStep("repair")}
            onChangeMode={() => {
              setFinal(null);
              setStep("choose");
            }}
          />
        ) : null;
      case "repair":
        return (
          <RepairDrill
            chrome={chrome}
            onDone={(hits) => {
              setRepairHits((value) => value + Math.max(1, hits));
              setStageScore((value) => Math.min(70, Math.max(value, 35 + hits * 7)));
              setFinal(null);
              setStep("exit");
            }}
          />
        );
    }
  })();

  return (
    <MotionConfig reducedMotion="user">
      <div className="m2g-root" data-step={step}>
        <div className="m2g-stage">{stage}</div>
        {error && step !== "choose" ? (
          <div className="m2g-error" role="alert">
            {error}
            <button type="button" onClick={() => setError(null)} aria-label="ปิด">
              ×
            </button>
          </div>
        ) : null}
      </div>
      {exit.dialog}
    </MotionConfig>
  );
}
