import { useState } from "react";
import type { Point } from "./model";
import { db } from "./store";
import { mergePoints } from "./content";
export default function WordEditor({
  point,
  points,
  onSaved,
  onClose,
}: {
  point: Point;
  points: Point[];
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [meaning, setMeaning] = useState(point.reviewed ? point.meaning : "");
  const [example, setExample] = useState(point.example);
  const [translation, setTranslation] = useState(point.translation);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(newSense: boolean) {
    if (!meaning.trim() || !confirmed) return;
    setBusy(true);
    try {
      const updated: Point = {
        ...point,
        id: newSense
          ? "personal:" + crypto.randomUUID() + ":meaning"
          : point.id,
        meaning: meaning.trim(),
        example: example.trim(),
        translation: translation.trim(),
        reviewed: true,
        source: (point.source ?? "个人添加") + "；义项由用户校对",
      };
      await db.settings.put({
        key: "points",
        value: mergePoints(points, [updated]),
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "未能保存。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        className="word-editor"
      >
        <div className="section-top">
          <h2 id="editor-title">校对 {point.word}</h2>
          <button className="text-button" onClick={onClose}>
            关闭
          </button>
        </div>
        <p className="content-note">
          修正已有释义会保留原学习记录；补充不同义项请选择“另存新义项”。
        </p>
        <label>
          核心义项
          <input
            aria-label="核心义项"
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
          />
        </label>
        <label>
          例句（可选）
          <textarea
            aria-label="校对例句"
            value={example}
            onChange={(e) => setExample(e.target.value)}
          />
        </label>
        <label>
          例句译文（可选）
          <textarea
            aria-label="例句译文"
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          我已核对这一义项，允许进入学习任务
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="button-row">
          <button
            className="primary"
            disabled={busy || !meaning.trim() || !confirmed}
            onClick={() => save(false)}
          >
            保存校对
          </button>
          <button
            className="secondary"
            disabled={busy || !meaning.trim() || !confirmed}
            onClick={() => save(true)}
          >
            另存新义项
          </button>
        </div>
      </section>
    </div>
  );
}
