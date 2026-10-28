import { describe, it, expect } from "vitest";
import { parseWordPack, mergePoints, mergePointsWithReport } from "../src/content";
import { readFileSync } from "node:fs";
describe("word pack import", () => {
  it("rejects malformed points instead of partially importing", () =>
    expect(() =>
      parseWordPack({
        format: "cijian-wordpack",
        version: 1,
        points: [{ word: "address" }],
      }),
    ).toThrow());
  it("requires unique stable identities", () => {
    const p = {
      id: "x",
      word: "x",
      meaning: "示例",
      example: "An example.",
      translation: "一个例子。",
      books: ["cet6"],
      ability: "meaning",
      reviewed: true,
    };
    expect(() =>
      parseWordPack({ format: "cijian-wordpack", version: 1, points: [p, p] }),
    ).toThrow();
  });
  it("preserves different senses of the same word", () => {
    const p = {
      word: "address",
      meaning: "处理",
      example: "Address it.",
      translation: "处理它。",
      books: ["cet6"],
      ability: "meaning",
      reviewed: true,
    };
    expect(
      parseWordPack({
        format: "cijian-wordpack",
        version: 1,
        points: [
          { ...p, id: "a" },
          { ...p, id: "b" },
        ],
      }),
    ).toHaveLength(2);
  });
});
describe("third original academic pack", () => {
  it("parses as six reviewed original practice points, not a textbook copy", () => {
    const pack = parseWordPack(
      JSON.parse(readFileSync("public/wordpacks/core-academic-03.json", "utf-8")),
    );
    expect(pack).toHaveLength(6);
    expect(pack.map((p) => p.word)).toEqual([
      "anticipate",
      "component",
      "conduct",
      "consistent",
      "contrast",
      "potential",
    ]);
    expect(pack.every((p) => p.reviewed)).toBe(true);
    expect(pack.every((p) => p.source?.includes("考试标签不代表原书收录确认"))).toBe(true);
    expect(new Set(pack.map((p) => p.id)).size).toBe(6);
  });
});
describe("fourth original academic pack", () => {
  it("parses as six reviewed original practice points, not a textbook copy", () => {
    const pack = parseWordPack(
      JSON.parse(readFileSync("public/wordpacks/core-academic-04.json", "utf-8")),
    );
    expect(pack).toHaveLength(6);
    expect(pack.map((p) => p.word)).toEqual([
      "accurate",
      "adequate",
      "arrange",
      "aspect",
      "concern",
      "conclude",
    ]);
    expect(pack.every((p) => p.reviewed)).toBe(true);
    expect(pack.every((p) => p.source?.includes("考试标签不代表原书收录确认"))).toBe(true);
    expect(new Set(pack.map((p) => p.id)).size).toBe(6);
  });
});
describe("re-import preserves user-edited definitions", () => {
  const userEdited = {
    id: "assess-meaning",
    word: "assess",
    meaning: "用户修改后的义项",
    example: "用户例句。",
    translation: "用户译文。",
    books: ["postgraduate"] as import("../src/model").Book[],
    ability: "meaning" as const,
    reviewed: true,
    source: "原创练习义项；义项由用户校对",
  };
  const defaultPack = {
    ...userEdited,
    meaning: "评估；评价",
    example: "默认例句。",
    translation: "默认译文。",
    source: "原创练习义项及例句；候选拼写交叉核对，考试标签不代表原书收录确认",
  };
  it("does not silently overwrite a user-edited definition on re-import", () => {
    const merged = mergePoints([userEdited], [defaultPack]);
    expect(merged).toHaveLength(1);
    expect(merged[0].meaning).toBe("用户修改后的义项");
    expect(merged[0].example).toBe("用户例句。");
  });
  it("reports the preserved user-edited id as a conflict", () => {
    const report = mergePointsWithReport([userEdited], [defaultPack]);
    expect(report.points[0].meaning).toBe("用户修改后的义项");
    expect(report.conflicts).toEqual([{ id: "assess-meaning", word: "assess" }]);
  });
  it("allows a newer user-edited save to overwrite an older user-edited one", () => {
    const newer = { ...userEdited, meaning: "用户第二次修改" };
    expect(mergePoints([userEdited], [newer])[0].meaning).toBe("用户第二次修改");
  });
  it("still allows a pack update to overwrite a non-user-edited definition", () => {
    const original = { ...defaultPack };
    const updated = { ...defaultPack, meaning: "新版默认义项" };
    expect(mergePoints([original], [updated])[0].meaning).toBe("新版默认义项");
  });
  it("does not report a conflict when re-importing identical content", () => {
    const report = mergePointsWithReport([userEdited], [userEdited]);
    expect(report.conflicts).toEqual([]);
  });
});
import { isPoint } from "../src/model";
it("rejects nontext optional metadata before it can reach React", () => {
  const p = {
    id: "a",
    word: "a",
    meaning: "一个",
    example: "A test.",
    translation: "一个测试。",
    books: ["cet6"],
    ability: "meaning",
    reviewed: true,
    source: { url: "https://example.com" },
  };
  expect(isPoint(p)).toBe(false);
});
import { independentSense } from "../src/content";
import { makeExercise } from "../src/exercises";
it("new senses copied from a derived exercise have independent history", () => {
  const p = {
    id: "original::spelling",
    originId: "original",
    originAbility: "meaning" as const,
    word: "address",
    meaning: "地址",
    example: "",
    translation: "",
    books: ["cet6"] as import("../src/model").Book[],
    ability: "spelling" as const,
    reviewed: true,
  };
  const fresh = independentSense(p, "personal-new");
  expect(makeExercise(fresh, "meaning").id).toBe("personal-new");
  expect(makeExercise(fresh, "spelling").id).not.toBe(p.id);
});
