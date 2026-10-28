import { useEffect, useState } from "react";
import { speakWord } from "./speech";
import type { Point } from "./model";
import { abilityNames } from "./model";
import { db } from "./store";
import {
  assessmentItems,
  assessmentSummary,
  type AssessmentState,
} from "./assessment";
import { checkSpelling } from "./exercises";
export default function Assessment({
  points,
  onClose,
}: {
  points: Point[];
  onClose: () => void;
}) {
  const [state, setState] = useState<AssessmentState | null>(null);
  const [reveal, setReveal] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    db.settings
      .get("assessment")
      .then(async (record) => {
        const value = record?.value as AssessmentState | undefined;
        if (value) {
          setState(value);
          return;
        }
        const next = { items: assessmentItems(points), answers: [] };
        await db.settings.put({ key: "assessment", value: next });
        setState(next);
      })
      .catch(() => setError("无法读取抽查进度，请返回后重试。"));
  }, []);
  async function record(correct: boolean) {
    if (!state || busy) return;
    setBusy(true);
    try {
      const p = state.items[state.answers.length];
      const next = {
        ...state,
        answers: [
          ...state.answers,
          {
            pointId: p.id,
            ability: p.ability,
            correct,
            at: new Date().toISOString(),
          },
        ],
      };
      await db.settings.put({ key: "assessment", value: next });
      setState(next);
      setReveal(false);
      setAnswer("");
    } catch {
      setError("未能保存，请重试。");
    } finally {
      setBusy(false);
    }
  }
  const p = state?.items[state.answers.length];
  const summary = assessmentSummary(state?.answers ?? []);
  function speak() {
    if (!p) return;
    speakWord(p.word, () => setError("当前设备无法朗读，可跳过听辨，此项不计分。"));
  }
  async function skip() {
    if (!state || !p) return;
    try {
      const next = {
        ...state,
        items: state.items.filter((_, i) => i !== state.answers.length),
      };
      await db.settings.put({ key: "assessment", value: next });
      setState(next);
    } catch {
      setError("未能保存跳过操作。");
    }
  }
  return (
    <section className="assessment">
      <div className="study-top">
        <button className="text-button" onClick={onClose}>
          保存并返回
        </button>
        <span>
          起点抽查 · {state?.answers.length ?? 0} / {state?.items.length ?? 24}
        </span>
      </div>
      <div className="page-title">
        <h1>{p ? "先看看，你记得多少。" : "你的词汇起点"}</h1>
        <p>抽样了解认义、听辨和拼写，不换算考试分数或精确词汇量。</p>
      </div>
      {error && <p role="alert">{error}</p>}
      {!state ? (
        <p>正在准备…</p>
      ) : p ? (
        <div className="study-card">
          <span className="section-label">{abilityNames[p.ability]}</span>
          <h1 lang={p.ability === "meaning" ? "en" : "zh-CN"}>
            {p.ability === "meaning"
              ? p.word
              : p.ability === "listening"
                ? "听音识词"
                : "看义拼写"}
          </h1>
          {p.ability === "listening" && (
            <>
              <button className="pronounce" onClick={speak}>
                听单词发音
              </button>
              <button className="text-button" onClick={skip}>
                无法听音，跳过
              </button>
            </>
          )}
          {p.ability === "spelling" && <p>{p.meaning}</p>}
          {p.ability !== "meaning" && !reveal && (
            <label className="exercise-input">
              你的答案
              <input
                aria-label="抽查答案"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            </label>
          )}
          {!reveal ? (
            <button className="reveal" onClick={() => setReveal(true)}>
              核对抽查答案
            </button>
          ) : (
            <div className="answer">
              <h2>
                {p.word} · {p.meaning}
              </h2>
              {p.ability === "meaning" ? (
                <div className="button-row">
                  <button
                    disabled={busy}
                    className="secondary"
                    onClick={() => record(false)}
                  >
                    没想起来
                  </button>
                  <button
                    disabled={busy}
                    className="primary"
                    onClick={() => record(true)}
                  >
                    正确想起
                  </button>
                </div>
              ) : (
                <>
                  <p>
                    {checkSpelling(answer, p.word)
                      ? "拼写匹配。"
                      : "拼写未匹配。"}
                  </p>
                  <div className="button-row">
                    <button
                      disabled={busy}
                      className="primary"
                      onClick={() => record(checkSpelling(answer, p.word))}
                    >
                      记录并继续
                    </button>
                    <button
                      disabled={busy}
                      className="text-button"
                      onClick={() => record(!checkSpelling(answer, p.word))}
                    >
                      纠正判分并继续
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="assessment-report">
            {(["meaning", "listening", "spelling"] as const).map((a) => (
              <div key={a}>
                <span>{abilityNames[a]}</span>
                <strong>
                  {summary[a]
                    ? `${summary[a]!.correct} / ${summary[a]!.total}`
                    : "尚未测试"}
                </strong>
              </div>
            ))}
          </div>
          <p className="content-note">
            这是当前样本中的作答表现。抽查与正式复习分开保存，做过抽查不会自动标记为掌握。
          </p>
          <button className="primary" onClick={onClose}>
            进入日常学习
          </button>
        </>
      )}
    </section>
  );
}
