import "fake-indexeddb/auto";
import { afterEach, it, expect } from "vitest";
import { VocabularyDB } from "../src/store";
import {
  putSetting,
  exchangeMetadata,
  type MetadataChange,
  type RemoteMetadata,
} from "../src/metadata";
const databases: VocabularyDB[] = [];
function device() {
  const d = new VocabularyDB("metadata-test-" + crypto.randomUUID());
  databases.push(d);
  return d;
}
afterEach(async () => {
  await Promise.all(databases.splice(0).map((d) => d.delete()));
});
const point = (id: string) => ({
  id,
  word: id,
  meaning: "示例义项",
  example: "An example.",
  translation: "一个例子。",
  books: ["cet6"],
  ability: "meaning",
  reviewed: true,
});
function server() {
  const rows: MetadataChange[] = [];
  const remote: RemoteMetadata = {
    push: async (changes) => {
      for (const change of changes)
        if (!rows.some((r) => r.id === change.id))
          rows.push({ ...change, sequence: rows.length + 1 });
    },
    pull: async () => rows.map((r) => ({ ...r })),
  };
  return { rows, remote };
}
it("merges distinct points created on two devices", async () => {
  const a = device(),
    b = device(),
    s = server();
  await putSetting(a, { key: "points", value: [point("a")] });
  await putSetting(b, { key: "points", value: [point("b")] });
  await exchangeMetadata(a, "user", s.remote);
  await exchangeMetadata(b, "user", s.remote);
  await exchangeMetadata(a, "user", s.remote);
  expect(
    ((await a.settings.get("points"))?.value as { id: string }[])
      .map((p) => p.id)
      .sort(),
  ).toEqual(["a", "b"]);
  expect((await a.settings.get("points"))?.value).toEqual(
    (await b.settings.get("points"))?.value,
  );
});
it("propagates favorite removal, using server order for conflicts", async () => {
  const a = device(),
    b = device(),
    s = server();
  await putSetting(a, { key: "favorites", value: ["p"] });
  await exchangeMetadata(a, "user", s.remote);
  await exchangeMetadata(b, "user", s.remote);
  await putSetting(b, { key: "favorites", value: [] });
  await exchangeMetadata(b, "user", s.remote);
  await exchangeMetadata(a, "user", s.remote);
  expect((await a.settings.get("favorites"))?.value).toEqual([]);
});
it("unions daily allocation instead of overwriting the other device", async () => {
  const a = device(),
    b = device(),
    s = server();
  await putSetting(a, { key: "allocated:2026-10-28", value: ["p"] });
  await putSetting(b, { key: "allocated:2026-10-28", value: ["q"] });
  await exchangeMetadata(a, "user", s.remote);
  await exchangeMetadata(b, "user", s.remote);
  expect((await b.settings.get("allocated:2026-10-28"))?.value).toEqual([
    "p",
    "q",
  ]);
});
it("preserves an edit made during an upload as pending", async () => {
  const a = device(),
    s = server();
  await putSetting(a, { key: "budget", value: 15 });
  const remote = {
    ...s.remote,
    push: async (changes: MetadataChange[], owner: string) => {
      await s.remote.push(changes, owner);
      await putSetting(a, { key: "budget", value: 30 });
    },
  };
  await exchangeMetadata(a, "user", remote);
  expect((await a.settings.get("budget"))?.value).toBe(30);
  expect((await a.changes.toArray()).filter((c) => c.pending)).toHaveLength(1);
});
it("keeps the outbox after upload failure and retries idempotently", async () => {
  const a = device(),
    s = server();
  await putSetting(a, { key: "budget", value: 30 });
  await expect(
    exchangeMetadata(a, "user", {
      ...s.remote,
      push: async () => {
        throw Error("offline");
      },
    }),
  ).rejects.toThrow();
  expect((await a.changes.toArray())[0].pending).toBe(true);
  await exchangeMetadata(a, "user", s.remote);
  await exchangeMetadata(a, "user", s.remote);
  expect(s.rows).toHaveLength(1);
});
it("accepts JSON object key reordering by the server", async () => {
  const a = device(),
    s = server();
  await putSetting(a, { key: "points", value: [point("p")] });
  const remote = {
    ...s.remote,
    pull: async () => {
      const rows = await s.remote.pull("user");
      return rows.map((r) => ({
        ...r,
        value: Object.fromEntries(Object.entries(r.value as object).reverse()),
      }));
    },
  };
  await expect(exchangeMetadata(a, "user", remote)).resolves.toBe(1);
});
it("does not let an older concurrent edit replace a newer local edit", async () => {
  const a = device(),
    b = device(),
    s = server();
  await putSetting(a, { key: "budget", value: 15 });
  await exchangeMetadata(a, "user", s.remote);
  await exchangeMetadata(b, "user", s.remote);
  await putSetting(a, { key: "budget", value: 30 });
  await putSetting(b, { key: "budget", value: 15 });
  await exchangeMetadata(a, "user", s.remote);
  await exchangeMetadata(b, "user", s.remote);
  await exchangeMetadata(a, "user", s.remote);
  expect((await a.settings.get("budget"))?.value).toBe(30);
});
import Dexie from "dexie";
import { seedMetadata } from "../src/metadata";
it("upgrades a version1 database without dropping legacy data", async () => {
  const name = "upgrade-" + crypto.randomUUID();
  const legacy = new Dexie(name);
  legacy
    .version(1)
    .stores({ reviews: "id,pointId,day,owner", settings: "key" });
  await legacy.table("settings").put({ key: "favorites", value: ["legacy"] });
  await legacy.table("reviews").put({
    id: "old-review",
    pointId: "legacy",
    rating: 3,
    at: "2026-10-28T00:00:00Z",
    base: "new",
    day: "2026-10-28",
  });
  legacy.close();
  const upgraded = new VocabularyDB(name);
  databases.push(upgraded);
  await seedMetadata(upgraded);
  await seedMetadata(upgraded);
  expect(await upgraded.reviews.count()).toBe(1);
  expect((await upgraded.settings.get("favorites"))?.value).toEqual(["legacy"]);
  expect(await upgraded.changes.count()).toBe(1);
});
it("rejects corrupted server rows without acknowledging pending changes", async () => {
  const a = device(),
    s = server();
  await putSetting(a, { key: "budget", value: 30 });
  await expect(
    exchangeMetadata(a, "user", {
      ...s.remote,
      pull: async () => [{ id: "bad" } as MetadataChange],
    }),
  ).rejects.toThrow();
  expect((await a.changes.toArray())[0].pending).toBe(true);
  expect((await a.settings.get("budget"))?.value).toBe(30);
});
it("rejects a server point ID collision atomically", async () => {
  const a = device(),
    s = server();
  await putSetting(a, { key: "points", value: [point("p")] });
  await exchangeMetadata(a, "user", s.remote);
  s.rows.push({
    id: "collision",
    kind: "point",
    key: "p",
    value: { ...point("p"), word: "different" },
    at: "2026-10-28T00:00:00Z",
    sequence: s.rows.length + 1,
  });
  await expect(exchangeMetadata(a, "user", s.remote)).rejects.toThrow("ID");
  expect(
    ((await a.settings.get("points"))?.value as { word: string }[])[0].word,
  ).toBe("p");
});
it("rejects a different account before sending private content", async () => {
  const a = device();
  await a.settings.put({ key: "cloud-owner", value: "first" });
  await putSetting(a, { key: "budget", value: 30 });
  let sends = 0;
  await expect(
    exchangeMetadata(a, "second", {
      push: async () => {
        sends++;
      },
      pull: async () => [],
    }),
  ).rejects.toThrow("其他账号");
  expect(sends).toBe(0);
});
