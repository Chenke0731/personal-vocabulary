import "fake-indexeddb/auto";
import { it, expect, afterEach } from "vitest";
import { db, saveSetting, exportBackup, restoreBackup } from "../src/store";
import {
  exchangeMetadata,
  type MetadataChange,
  type RemoteMetadata,
} from "../src/metadata";
afterEach(async () => {
  await db.settings.clear();
  await db.reviews.clear();
  await db.changes.clear();
});
it("restores a pending favorite cancellation and does not duplicate it on retry", async () => {
  await saveSetting({ key: "favorites", value: ["p"] });
  await saveSetting({ key: "favorites", value: [] });
  const backup = await exportBackup();
  await db.settings.clear();
  await db.changes.clear();
  await restoreBackup(backup);
  await restoreBackup(backup);
  expect(await db.changes.count()).toBe(2);
  const rows: MetadataChange[] = [];
  const remote: RemoteMetadata = {
    push: async (changes) => {
      for (const c of changes)
        if (!rows.some((r) => r.id === c.id))
          rows.push({ ...c, sequence: rows.length + 1 });
    },
    pull: async () => rows,
  };
  await exchangeMetadata(db, "u", remote);
  expect((await db.settings.get("favorites"))?.value).toEqual([]);
});
it("rejects malformed outbox data before changing any existing settings", async () => {
  await saveSetting({ key: "budget", value: 30 });
  await expect(
    restoreBackup({
      format: "vocabulary-backup",
      version: 1,
      reviews: [],
      settings: [],
      metadata: [{ id: "bad" }],
    }),
  ).rejects.toThrow();
  expect((await db.settings.get("budget"))?.value).toBe(30);
});
function memoryRemote() {
  const rows: MetadataChange[] = [];
  return {
    push: async (changes: MetadataChange[]) => {
      for (const c of changes)
        if (!rows.some((r) => r.id === c.id))
          rows.push({ ...c, sequence: rows.length + 1 });
    },
    pull: async () => rows,
  };
}
it("keeps an existing budget after restoring an older pending backup and syncing", async () => {
  await saveSetting({ key: "budget", value: 30 });
  const backup = await exportBackup();
  await db.settings.clear();
  await db.changes.clear();
  await saveSetting({ key: "budget", value: 15 });
  await restoreBackup(backup);
  expect((await db.settings.get("budget"))?.value).toBe(15);
  await exchangeMetadata(db, "u", memoryRemote());
  expect((await db.settings.get("budget"))?.value).toBe(15);
});
it("keeps favorite union semantics after restored pending cancellation syncs", async () => {
  await saveSetting({ key: "favorites", value: ["p"] });
  await saveSetting({ key: "favorites", value: [] });
  const backup = await exportBackup();
  await db.settings.clear();
  await db.changes.clear();
  await saveSetting({ key: "favorites", value: ["p"] });
  await restoreBackup(backup);
  await exchangeMetadata(db, "u", memoryRemote());
  expect((await db.settings.get("favorites"))?.value).toEqual(["p"]);
});
