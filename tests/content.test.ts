import { describe, it, expect } from "vitest";
import { parseWordPack } from "../src/content";
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
