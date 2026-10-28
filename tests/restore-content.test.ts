import "fake-indexeddb/auto";
import { db, restoreBackup } from "../src/store";

import { it, expect } from "vitest";
it("merges a restored personal pack with existing content without orphaning reviews", async () => {
  const point = {
    id: "local",
    word: "local",
    meaning: "本地的",
    example: "A local file.",
    translation: "本地文件。",
    books: ["cet6"],
    ability: "meaning",
    reviewed: true,
  };
  await db.settings.put({ key: "points", value: [point] });
  const other = { ...point, id: "remote", word: "remote" };
  await restoreBackup({
    format: "vocabulary-backup",
    version: 1,
    reviews: [],
    settings: [{ key: "points", value: [other] }],
  });
  expect((await db.settings.get("points"))?.value).toEqual([point, other]);
  await db.settings.clear();
});

it("rejects point ID collisions during restored content merge atomically", async () => {
  const p = {
    id: "same",
    word: "first",
    meaning: "第一",
    example: "",
    translation: "",
    books: ["cet6"],
    ability: "meaning",
    reviewed: true,
  };
  await db.settings.put({ key: "points", value: [p] });
  await expect(
    restoreBackup({
      format: "vocabulary-backup",
      version: 1,
      reviews: [],
      settings: [{ key: "points", value: [{ ...p, word: "second" }] }],
    }),
  ).rejects.toThrow("ID冲突");
  expect((await db.settings.get("points"))?.value).toEqual([p]);
  await db.settings.clear();
});
