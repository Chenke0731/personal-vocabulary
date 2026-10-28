import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
// Only factual word strings and provenance are retained; original definitions/examples/audio are not copied.
const sources = [
  {
    key: "hongbaoshu2026",
    book: "postgraduate",
    title: "红宝书2026社区候选词表",
    url: "https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts/hongbaoshu-2026.json",
  },
  {
    key: "cet6",
    book: "cet6",
    title: "CET6社区候选词表",
    url: "https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts/CET6_T.json",
  },
  {
    key: "ielts-liu",
    book: "ielts",
    title: "刘洪波雅思词汇真经社区候选词表",
    url: "https://raw.githubusercontent.com/hefengxian/my-ielts/master/src/pages/vocabulary/vocabulary.js",
  },
];
await mkdir(".local-wordpacks", { recursive: true });
const manifest = [];
for (const source of sources) {
  const response = await fetch(source.url, {
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw Error(`${source.key}: HTTP ${response.status}`);
  const text = await response.text();
  const sha = createHash("sha256").update(text).digest("hex");
  let words;
  if (source.key === "ielts-liu") {
    const data = JSON.parse(
      text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1),
    );
    words = Object.values(data)
      .flatMap((chapter) => chapter.words.flat())
      .flatMap((row) => row.word);
  } else words = JSON.parse(text).map((row) => row.name);
  if (!words.every((word) => typeof word === "string" && word.trim().length))
    throw Error("Invalid source word list");
  const unique = [...new Set(words.map((w) => w.trim()))];
  const points = unique.map((word) => ({
    id: `candidate:${source.key}:${encodeURIComponent(word)}`,
    word,
    meaning: "待补充并核对义项",
    example: "",
    translation: "",
    books: [source.book],
    ability: "meaning",
    reviewed: false,
    source: `${source.title}；仅提取拼写，未核实原书完整覆盖；${source.url}`,
  }));
  const pack = {
    format: "cijian-wordpack",
    version: 1,
    manifest: {
      ...source,
      fetchedAt: new Date().toISOString(),
      sha256: sha,
      sourceStrings: words.length,
      uniqueStrings: unique.length,
      status: "unreviewed-word-strings",
    },
    points,
  };
  const path = `.local-wordpacks/${source.key}.json`;
  await writeFile(path, JSON.stringify(pack, null, 2));
  manifest.push({ ...pack.manifest, path });
  console.log(`${source.key}: ${unique.length} candidate spellings → ${path}`);
}
await writeFile(
  ".local-wordpacks/sources.json",
  JSON.stringify(manifest, null, 2),
);
