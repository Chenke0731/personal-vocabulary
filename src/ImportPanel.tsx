import { useRef, useState } from "react";
import { parseWordPack, mergePoints } from "./content";
import { saveSetting } from "./store";
import type { Point } from "./model";
export default function ImportPanel({
  points,
  onImported,
}: {
  points: Point[];
  onImported: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Point[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function read(file?: File) {
    if (!file) return;
    setMessage("");
    setPreview(null);
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("词包超过20MB，请拆分后导入。");
      const pack = parseWordPack(JSON.parse(await file.text()));
      mergePoints(points, pack);
      setPreview(pack);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "文件无法解析。");
    }
    if (input.current) input.current.value = "";
  }
  async function previewAcademicPack() {
    setBusy(true);
    setMessage("");
    setPreview(null);
    try {
      const response = await fetch("/wordpacks/core-academic-01.json");
      if (!response.ok) throw new Error("词包读取失败");
      await read(new File([await response.blob()], "core-academic-01.json", { type: "application/json" }));
    } catch {
      setMessage("无法读取练习词包，请联网后重试。");
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!preview) return;
    setBusy(true);
    try {
      const merged = mergePoints(points, preview);
      await saveSetting({ key: "points", value: merged });
      await onImported();
      setMessage(`已合并 ${preview.length} 个知识点，共 ${merged.length} 个。`);
      setPreview(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "导入失败，原词库仍在。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-section">
      <h2>导入个人词包</h2>
      <p>
        支持版本1的JSON词包，按稳定知识点ID合并。修改释义保留记录，新义项使用新ID。
      </p>
      <p className="muted">
        当前不支持直接导入PDF或社区原始JSON。格式示例见项目
        public/example-wordpack.json。
      </p>
      <p>
        <button className="secondary" disabled={busy} onClick={previewAcademicPack}>预览原创学术词汇练习包</button>
      </p>
      <p>
        <a href="/wordpacks/core-academic-01.json" download>下载原创学术词汇练习包（6个知识点）</a>
      </p>
      <button className="secondary" onClick={() => input.current?.click()}>
        选择词包文件
      </button>
      <input
        hidden
        ref={input}
        type="file"
        accept="application/json,.json"
        aria-label="选择词包文件"
        onChange={(e) => read(e.target.files?.[0])}
      />
      {preview && (
        <div className="import-preview">
          <p>
            有效知识点 {preview.length} 个；已校对{" "}
            {preview.filter((p) => p.reviewed).length} 个；待校对{" "}
            {preview.filter((p) => !p.reviewed).length} 个。
          </p>
          <p>
            {preview
              .slice(0, 3)
              .map((p) => p.word)
              .join(" / ")}
          </p>
          <div className="button-row">
            <button className="primary" disabled={busy} onClick={confirm}>
              确认合并
            </button>
            <button className="secondary" onClick={() => setPreview(null)}>
              取消
            </button>
          </div>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
