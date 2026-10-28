import { useEffect, useState, useRef } from "react";
import type { Point, Review, Book, Rating } from "./model";
import { bookNames } from "./model";
import StudyCard from "./StudyCard";
import { mergePoints } from "./content";
import type { Ability } from "./model";
import { makeExercise } from "./exercises";
import { demoPoints } from "./demo";
import CloudPanel from "./CloudPanel";
import Assessment from "./AssessmentView";
import { useSessionClock } from "./useSessionClock";
import { newPointTarget } from "./budget";
import ImportPanel from "./ImportPanel";
import WordEditor from "./WordEditor";
import { cloud, synchronizeCloud } from "./cloud";
import {
  db,
  saveReview,
  exportBackup,
  restoreBackup,
  saveSetting,
} from "./store";
import { makeQueue, deriveCard, learningDay } from "./scheduler";

type Page = "today" | "library" | "weak" | "settings";
const nav: [Page, string, string][] = [
  ["today", "◉", "今日"],
  ["library", "▤", "词库"],
  ["weak", "◇", "薄弱项"],
  ["settings", "⚙", "我的"],
];
export default function App() {
  const [page, setPage] = useState<Page>("today");
  const [assessing, setAssessing] = useState(false);
  const [points, setPoints] = useState<Point[]>(demoPoints);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ready, setReady] = useState(false);
  const [budget, setBudget] = useState(15);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<Point[] | null>(null);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [book, setBook] = useState<Book | "all">("all");
  const [editing, setEditing] = useState<Point | null>(null);
  const [listLimit, setListLimit] = useState(60);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [finished, setFinished] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({ state: "local", message: "" });
  const clock = useSessionClock(!!queue?.length);
  const answerStart = useRef(0);
  const submitId = useRef(crypto.randomUUID());
  const importRef = useRef<HTMLInputElement>(null);
  async function refresh() {
    const r = await db.reviews.toArray();
    const s = await db.settings.toArray();
    setReviews(r);
    const value = (key: string) => s.find((x) => x.key === key)?.value;
    if (Array.isArray(value("points")))
      setPoints(mergePoints(demoPoints, value("points") as Point[]));
    if (value("budget") === 30 || value("budget") === 15)
      setBudget(value("budget") as number);
    if (Array.isArray(value("favorites")))
      setFavorites(value("favorites") as string[]);
    setReady(true);
  }
  useEffect(() => {
    const observe = (event: Event) =>
      setSyncStatus(
        (event as CustomEvent<{ state: string; message: string }>).detail,
      );
    window.addEventListener("vocabulary-sync-state", observe);
    return () => window.removeEventListener("vocabulary-sync-state", observe);
  }, []);
  useEffect(() => {
    const sync = () => {
      if (cloud && document.visibilityState === "visible")
        void synchronizeCloud()
          .then(refresh)
          .catch(() => {});
    };
    window.addEventListener("online", sync);
    window.addEventListener("vocabulary-metadata-changed", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("vocabulary-metadata-changed", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  useEffect(() => {
    refresh().catch(() =>
      setError("本机存储不可用，请检查浏览器设置或存储空间。"),
    );
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  async function begin() {
    setError("");
    setBusy(true);
    try {
      const day = learningDay(new Date().toISOString());
      const allocation = await db.settings.get(`allocated:${day}`);
      const done = Array.isArray(allocation?.value)
        ? (allocation.value as string[])
        : [];
      const remaining = Math.max(0, budget - clock.elapsed / 60);
      if (remaining <= 0) {
        setQueue([]);
        setMessage("今天的时间预算已完成。可以调整到30分钟，或下次继续。");
        return;
      }
      const plans = (await db.settings.toArray())
        .filter((s) => s.key.startsWith("allocated:"))
        .map((s) => ({
          day: s.key.slice(10),
          ids: Array.isArray(s.value) ? (s.value as string[]) : [],
        }));
      const next = makeQueue(
        points,
        reviews,
        new Date().toISOString(),
        remaining,
        done,
        newPointTarget(reviews, plans),
      );
      const newIds = next
        .filter((p) => !reviews.some((r) => r.pointId === p.id))
        .map((p) => p.id);
      await saveSetting({
        key: `allocated:${day}`,
        value: [...new Set([...done, ...newIds])],
      });
      setQueue(next);
      setFinished(0);
      setReveal(false);
      answerStart.current = clock.elapsed;
      submitId.current = crypto.randomUUID();
    } catch {
      setError("无法开始学习，记录尚未改变，请重试。");
    } finally {
      setBusy(false);
    }
  }
  async function rate(rating: Rating) {
    if (!queue?.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const p = queue[0];
      const previous = reviews
        .filter((r) => r.pointId === p.id)
        .sort((a, b) => a.at.localeCompare(b.at))
        .at(-1);
      const at = new Date().toISOString();
      const event: Review = {
        id: submitId.current,
        pointId: p.id,
        rating,
        at,
        base: previous?.id ?? "new",
        day: learningDay(at),
        activeMs: Math.max(0, clock.elapsed - answerStart.current) * 1000,
      };
      await saveReview(event);
      await refresh();
      if (cloud) void synchronizeCloud().catch(() => {});
      setQueue(clock.elapsed >= budget * 60 ? [] : queue.slice(1));
      setReveal(false);
      setFinished((v) => v + 1);
      submitId.current = crypto.randomUUID();
      answerStart.current = clock.elapsed;
    } catch {
      setError("这次作答尚未保存。请重试，成功保存后才会进入下一题。");
    } finally {
      setBusy(false);
    }
  }
  async function favorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((x) => x !== id)
      : [...favorites, id];
    try {
      await saveSetting({ key: "favorites", value: next });
      setFavorites(next);
    } catch {
      setError("收藏未能保存，请重试。");
    }
  }
  async function practice(p: Point, ability: Ability) {
    if (!p.reviewed) {
      setError("请先校对该义项，再开始练习。");
      return;
    }
    if (ability === "context" && !p.example.trim()) {
      setError("请先添加例句，再进行语境练习。");
      return;
    }
    try {
      const selected = makeExercise(p, ability);
      const existing = points.find((x) => x.id === selected.id);
      if (
        existing &&
        (existing.word !== selected.word ||
          existing.ability !== selected.ability)
      )
        throw new Error("练习ID冲突");
      const merged = existing ? points : [...points, selected];
      await saveSetting({ key: "points", value: merged });
      setPoints(merged);
      setQueue([selected]);
      setFinished(0);
      setReveal(false);
      setPage("today");
      answerStart.current = clock.elapsed;
      submitId.current = crypto.randomUUID();
    } catch {
      setError("练习未能保存，请重试。");
    }
  }
  function speak(word: string) {
    if (!("speechSynthesis" in window)) {
      setError("当前浏览器不支持朗读。");
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-GB";
    utterance.rate = 0.85;
    speechSynthesis.speak(utterance);
  }
  async function backup() {
    try {
      const data = await exportBackup();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `词间备份-${learningDay(new Date().toISOString())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("备份已生成，请保存在安全的位置。");
    } catch {
      setError("备份生成失败，请重试。");
    }
  }
  async function restore(file?: File) {
    if (!file) return;
    setError("");
    try {
      const value = JSON.parse(await file.text());
      await restoreBackup(value);
      window.dispatchEvent(new Event("vocabulary-metadata-changed"));
      await refresh();
      setQueue(null);
      setMessage("备份已合并，重复记录不会重复计数。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法读取备份文件。");
    }
    if (importRef.current) importRef.current.value = "";
  }
  const day = learningDay(new Date().toISOString());
  const today = reviews.filter((r) => r.day === day);
  const learned = new Set(reviews.map((r) => r.pointId));
  const due = points.filter((p) => {
    const events = reviews.filter((r) => r.pointId === p.id);
    return events.length && deriveCard(events).due <= new Date();
  });
  const weakIds = new Set(
    reviews.filter((r) => r.rating <= 2).map((r) => r.pointId),
  );
  const visible = points.filter(
    (p) =>
      (book === "all" || p.books.includes(book)) &&
      `${p.word} ${p.meaning}`.toLowerCase().includes(search.toLowerCase()) &&
      (page !== "weak" || weakIds.has(p.id)) &&
      (!onlyFavorites || favorites.includes(p.id)),
  );
  useEffect(() => setListLimit(60), [search, book, page, onlyFavorites]);
  const current = queue?.[0];
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("today");
          }}
        >
          <span className="brand-mark">词</span>
          <span>
            词间<small>让记忆慢慢扎根</small>
          </span>
        </a>
        <nav aria-label="主导航">
          {nav.map(([id, icon, label]) => (
            <button
              key={id}
              aria-current={page === id ? "page" : undefined}
              onClick={() => {
                setPage(id);
                setQueue(null);
              }}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          每天一点，
          <br />
          把眼熟变成记得。
        </div>
        <span className="version">个人学习版 · 0.1</span>
      </aside>
      <main>
        <header>
          <div>
            <span className="date">
              {new Date().toLocaleDateString("zh-CN", {
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </span>
            <p>六级提分 / 考研强化 / 雅思补充</p>
          </div>
          <span
            className={`status ${online && syncStatus.state !== "error" ? "" : "offline"}`}
            title={syncStatus.message}
          >
            <i />
            {!online
              ? "离线可学"
              : syncStatus.state === "syncing"
                ? "正在同步"
                : syncStatus.state === "synced"
                  ? "已同步"
                  : syncStatus.state === "error"
                    ? "同步需处理"
                    : "本地保存"}
          </span>
        </header>
        {error && (
          <div className="notice error" role="alert">
            {error}
            <button aria-label="关闭错误" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        {message && (
          <div className="notice" role="status">
            {message}
            <button aria-label="关闭提示" onClick={() => setMessage("")}>
              ×
            </button>
          </div>
        )}
        {assessing ? (
          <Assessment points={points} onClose={() => setAssessing(false)} />
        ) : !ready ? (
          <p role="status">正在读取本机学习记录…</p>
        ) : page === "today" ? (
          <>
            {!queue ? (
              <>
                <section className="welcome">
                  <div className="intro">
                    <span className="section-label">今天，从几个词开始</span>
                    <h1>给英语留一点时间。</h1>
                    <p>
                      先巩固，再向前。
                      <br />
                      今天的每一次回忆，都算数。
                    </p>
                    <div className="budget" aria-label="学习时间">
                      {[15, 30].map((n) => (
                        <button
                          key={n}
                          aria-pressed={budget === n}
                          onClick={async () => {
                            try {
                              await saveSetting({
                                key: "budget",
                                value: n,
                              });
                              setBudget(n);
                            } catch {
                              setError("时间设置保存失败。");
                            }
                          }}
                        >
                          {n}分钟
                        </button>
                      ))}
                    </div>
                    <button
                      className="primary start"
                      disabled={busy}
                      onClick={begin}
                    >
                      开始今日学习 <span aria-hidden="true">↗</span>
                    </button>
                    <small>到期复习优先 · 默认每天6个新知识点</small>
                  </div>
                  <div className="word-art" aria-hidden="true">
                    <span className="art-note">a little, every day.</span>
                    <span className="art-word">retain</span>
                    <span className="art-line" />
                    <span className="art-meaning">留住 · 记得</span>
                    <span className="art-leaf">❧</span>
                  </div>
                </section>
                <button
                  className="assessment-entry"
                  onClick={() => setAssessing(true)}
                >
                  <span>
                    <strong>词汇起点抽查</strong>
                    <small>了解认义、听辨和拼写，可随时暂停</small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </button>
                <section className="metrics" aria-label="学习概览">
                  <div>
                    <span>今日已练</span>
                    <strong>
                      {today.length}
                      <small>次</small>
                    </strong>
                  </div>
                  <div>
                    <span>到期复习</span>
                    <strong>
                      {due.length}
                      <small>项</small>
                    </strong>
                  </div>
                  <div>
                    <span>已接触</span>
                    <strong>
                      {learned.size}
                      <small>个知识点</small>
                    </strong>
                  </div>
                </section>
                <section className="route">
                  <div className="section-top">
                    <h2>你的学习路线</h2>
                    <span>共同词汇，共享进度</span>
                  </div>
                  {(Object.keys(bookNames) as Book[]).map((b, i) => {
                    const all = points.filter((p) => p.books.includes(b));
                    const count = all.filter((p) => learned.has(p.id)).length;
                    return (
                      <button
                        className="route-row"
                        key={b}
                        onClick={() => {
                          setBook(b);
                          setPage("library");
                        }}
                      >
                        <span className={`book-icon book-${i}`}>
                          {["六", "研", "雅"][i]}
                        </span>
                        <span className="route-name">
                          <strong>{bookNames[b]}</strong>
                          <small>
                            {
                              [
                                "认准词义，听得出来",
                                "补充新义，放进语境",
                                "主题关联，拓展表达",
                              ][i]
                            }
                          </small>
                        </span>
                        <span className="route-count">
                          {count} / {all.length}
                          <small>已载入知识点</small>
                        </span>
                      </button>
                    );
                  })}
                </section>
                <p className="content-note">
                  内置24条原创演示内容，考试方向仅作练习标签；个人词包可在“我的”中导入。完整书籍覆盖仍待核对。
                </p>
              </>
            ) : current ? (
              <section className="study">
                <div className="study-top">
                  <button
                    className="text-button"
                    onClick={() => setQueue(null)}
                  >
                    结束本次
                  </button>
                  <span>
                    已用 {clock.display} / {budget}分钟 · 已完成 {finished} 项 ·{" "}
                    {current.ability === "meaning" ? "主动回忆" : "专项练习"}
                  </span>
                </div>
                <StudyCard
                  key={current.id}
                  point={current}
                  reveal={reveal}
                  onReveal={() => setReveal(true)}
                  favorite={favorites.includes(current.id)}
                  onFavorite={() => favorite(current.id)}
                  speak={() => speak(current.word)}
                />
                {reveal && (
                  <div className="ratings">
                    {(
                      [
                        [1, "忘记", "需要重学"],
                        [2, "困难", "想起但吃力"],
                        [3, "记得", "回忆正确"],
                        [4, "轻松", "很快想起"],
                      ] as const
                    ).map(([r, label, hint]) => (
                      <button
                        disabled={busy}
                        key={r}
                        className={`rating rating-${r}`}
                        onClick={() => rate(r)}
                      >
                        {label}
                        <small>{hint}</small>
                      </button>
                    ))}
                  </div>
                )}
                <p className="content-note">
                  系统朗读依赖设备语音服务；未保证离线发音可用。
                </p>
              </section>
            ) : (
              <section className="complete">
                <span className="complete-icon">✓</span>
                <h1>
                  {finished ? "今天，又记牢了一点。" : "这段学习暂时没有待办。"}
                </h1>
                <p>
                  {finished
                    ? `本次完成 ${finished} 项，作答已保存在本机。`
                    : "今日新增额度已安排，或已学内容尚未到期。"}
                </p>
                <button className="primary" onClick={() => setQueue(null)}>
                  回到今日
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setPage("library");
                    setQueue(null);
                  }}
                >
                  去词库看看
                </button>
              </section>
            )}
          </>
        ) : page === "library" || page === "weak" ? (
          <section>
            <div className="page-title">
              <h1>
                {page === "weak"
                  ? "把薄弱的，再记一次。"
                  : "你的词汇，慢慢积累。"}
              </h1>
              <p>
                {page === "weak"
                  ? "出现过困难或遗忘的知识点，可随时针对性练习。"
                  : "演示内容不代表完整书籍词表。"}
              </p>
            </div>
            <label className="search">
              <span>⌕</span>
              <input
                aria-label="搜索单词或释义"
                placeholder="搜索单词或释义"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button
              className="text-button"
              aria-pressed={onlyFavorites}
              onClick={() => setOnlyFavorites(!onlyFavorites)}
            >
              {onlyFavorites ? "显示全部" : "只看收藏"}
            </button>
            <div className="filters">
              {(["all", "cet6", "postgraduate", "ielts"] as const).map((b) => (
                <button
                  key={b}
                  aria-pressed={book === b}
                  onClick={() => setBook(b)}
                >
                  {b === "all" ? "全部" : bookNames[b]}
                </button>
              ))}
            </div>
            <div className="word-list">
              {visible.slice(0, listLimit).map((p) => (
                <article key={p.id}>
                  <div>
                    <h2 lang="en">{p.word}</h2>
                    <p>{p.meaning}</p>
                    <div className="tags">
                      {p.books.map((b) => (
                        <span key={b}>{bookNames[b]}</span>
                      ))}
                    </div>
                  </div>
                  <div className="word-actions">
                    <button
                      className="text-button"
                      onClick={() => setEditing(p)}
                    >
                      {p.reviewed ? "校对" : "待校对"}
                    </button>
                    <select
                      disabled={!p.reviewed}
                      aria-label={`练习方式 ${p.word}`}
                      value=""
                      onChange={(e) => {
                        if (e.target.value)
                          void practice(p, e.target.value as Ability);
                      }}
                    >
                      <option value="">练习</option>
                      <option value="meaning">认义</option>
                      <option value="listening">听辨</option>
                      <option value="spelling">拼写</option>
                      <option value="context">语境</option>
                    </select>
                    <button
                      aria-label={`收藏 ${p.word}`}
                      onClick={() => favorite(p.id)}
                    >
                      {favorites.includes(p.id) ? "★" : "☆"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {visible.length > listLimit && (
              <button
                className="secondary"
                onClick={() => setListLimit((n) => n + 60)}
              >
                再显示60项（共{visible.length}项）
              </button>
            )}
            {!visible.length && (
              <p className="empty">
                {page === "weak"
                  ? "暂时没有符合条件的薄弱词。"
                  : "没有找到，试试其他单词或筛选条件。"}
              </p>
            )}
          </section>
        ) : (
          <section>
            <div className="page-title">
              <h1>为自己，留住进步。</h1>
              <p>管理学习记录与数据备份。</p>
            </div>
            <CloudPanel onSynced={refresh} />
            <ImportPanel points={points} onImported={refresh} />
            <section className="settings-section">
              <h2>备份与恢复</h2>
              <p>
                导出学习记录、设置及词包。恢复时合并记录，重复文件不会重复计数。
              </p>
              <div className="button-row">
                <button className="primary" onClick={backup}>
                  导出备份
                </button>
                <button
                  className="secondary"
                  onClick={() => importRef.current?.click()}
                >
                  恢复备份
                </button>
                <input
                  hidden
                  ref={importRef}
                  type="file"
                  accept="application/json,.json"
                  aria-label="选择备份文件"
                  onChange={(e) => restore(e.target.files?.[0])}
                />
              </div>
            </section>
            <section className="settings-section">
              <h2>学习说明</h2>
              <p>
                “困难”表示正确回忆但比较吃力；没有想起来请选择“忘记”。已接触数量不等于掌握数量。
              </p>
              <p className="muted">
                演示词条由本项目原创整理。词库来源与完整覆盖情况会分别标注。
              </p>
            </section>
          </section>
        )}
        {editing && (
          <WordEditor
            point={editing}
            points={points}
            onSaved={refresh}
            onClose={() => setEditing(null)}
          />
        )}
        <footer>词间 · 留住每一次主动回忆</footer>
      </main>
      <nav className="mobile-nav" aria-label="手机导航">
        {nav.map(([id, icon, label]) => (
          <button
            key={id}
            aria-current={page === id ? "page" : undefined}
            onClick={() => {
              setPage(id);
              setQueue(null);
            }}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
