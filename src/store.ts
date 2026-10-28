import Dexie, { type Table } from "dexie";
import { isPoint, type Review, type Setting, type Point } from "./model";
import { mergePoints } from "./content";
import { effectiveReviews } from "./reviewHistory";
import {
  putSetting,
  isMetadataChange,
  restoreMetadataOutbox,
  type MetadataChange,
} from "./metadata";
export class VocabularyDB extends Dexie {
  reviews!: Table<Review, string>;
  settings!: Table<Setting, string>;
  changes!: Table<MetadataChange, string>;
  constructor(name = "cijian-v1") {
    super(name);
    this.version(1).stores({
      reviews: "id,pointId,day,owner",
      settings: "key",
    });
    this.version(2).stores({
      reviews: "id,pointId,day,owner",
      settings: "key",
      changes: "id,ordinal,kind,key,owner",
    });
  }
}
export const db = new VocabularyDB();
export async function saveSetting(setting: Setting) {
  await putSetting(db, setting);
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("vocabulary-metadata-changed"));
}
export function isReview(x: unknown): x is Review {
  if (!x || typeof x !== "object") return false;
  const e = x as Review;
  return (
    typeof e.id === "string" &&
    e.id.length > 0 &&
    typeof e.pointId === "string" &&
    e.pointId.length > 0 &&
    [1, 2, 3, 4].includes(e.rating) &&
    typeof e.at === "string" &&
    Number.isFinite(Date.parse(e.at)) &&
    typeof e.base === "string" &&
    typeof e.day === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.day) &&
    (e.activeMs === undefined ||
      (typeof e.activeMs === "number" &&
        Number.isFinite(e.activeMs) &&
        e.activeMs >= 0))
  );
}
function isSetting(x: unknown): x is Setting {
  if (!x || typeof x !== "object") return false;
  const s = x as Setting;
  if (s.key === "assessment") {
    const a = s.value as { items?: unknown; answers?: unknown };
    return (
      !!a &&
      Array.isArray(a.items) &&
      a.items.every(isPoint) &&
      Array.isArray(a.answers) &&
      a.answers.length <= a.items.length &&
      a.answers.every(
        (x) =>
          !!x &&
          typeof x === "object" &&
          typeof x.pointId === "string" &&
          ["meaning", "listening", "spelling", "context"].includes(x.ability) &&
          typeof x.correct === "boolean" &&
          typeof x.at === "string" &&
          Number.isFinite(Date.parse(x.at)),
      )
    );
  }
  if (/^session:\d{4}-\d{2}-\d{2}$/.test(s.key))
    return (
      typeof s.value === "number" && Number.isFinite(s.value) && s.value >= 0
    );
  if (s.key === "budget") return s.value === 15 || s.value === 30;
  if (s.key === "points")
    return Array.isArray(s.value) && s.value.every(isPoint);
  if (s.key === "favorites" || /^allocated:\d{4}-\d{2}-\d{2}$/.test(s.key))
    return (
      Array.isArray(s.value) && s.value.every((v) => typeof v === "string")
    );
  return false;
}
export async function saveReview(review: Review) {
  if (!isReview(review)) throw new Error("作答格式不正确。");
  await db.transaction("rw", db.reviews, async () => {
    if (!(await db.reviews.get(review.id)))
      await db.reviews.add({ ...review, pending: true });
  });
}
export async function exportBackup() {
  return db.transaction("r", db.reviews, db.settings, db.changes, async () => ({
    format: "vocabulary-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    reviews: await db.reviews.toArray(),
    metadata: (await db.changes.orderBy("ordinal").toArray()).filter(
      (c) => c.pending,
    ),
    settings: (await db.settings.toArray()).filter(isSetting),
  }));
}
export async function restoreBackup(input: unknown) {
  const b = input as {
    format?: unknown;
    version?: unknown;
    reviews?: unknown;
    settings?: unknown;
    metadata?: unknown;
  };
  if (
    !b ||
    b.format !== "vocabulary-backup" ||
    b.version !== 1 ||
    !Array.isArray(b.reviews) ||
    !b.reviews.every(isReview) ||
    !Array.isArray(b.settings) ||
    !b.settings.every(isSetting) ||
    (b.metadata !== undefined &&
      (!Array.isArray(b.metadata) || !b.metadata.every(isMetadataChange)))
  )
    throw new Error("备份格式或内容无效，本机记录未改变。");
  const reviews = b.reviews as Review[],
    settings = b.settings as Setting[];
  await db.transaction("rw", db.reviews, db.settings, db.changes, async () => {
    const existingBudget = await db.settings.get("budget");
    const existingFavorites = (await db.settings.get("favorites"))?.value;
    const retainedFavorites = new Set(
      Array.isArray(existingFavorites) ? (existingFavorites as string[]) : [],
    );
    // Backup restore preserves the current budget and unions favorites. Do not
    // reintroduce contrary old intent into the next cloud upload.
    const restoredChanges = ((b.metadata ?? []) as MetadataChange[]).filter(
      (c) =>
        !(c.kind === "budget" && existingBudget) &&
        !(
          c.kind === "favorite" &&
          c.value === false &&
          retainedFavorites.has(c.key)
        ),
    );
    await restoreMetadataOutbox(db, restoredChanges);
    effectiveReviews([...(await db.reviews.toArray()), ...reviews]);
    for (const review of reviews)
      if (!(await db.reviews.get(review.id)))
        await db.reviews.add({ ...review, pending: true, owner: undefined });
    for (const setting of settings) {
      const old = await db.settings.get(setting.key);
      if (setting.key.startsWith("allocated:") || setting.key === "favorites")
        await putSetting(db, {
          key: setting.key,
          value: [
            ...new Set([
              ...(Array.isArray(old?.value) ? old.value : []),
              ...(setting.value as string[]),
            ]),
          ],
        });
      else if (setting.key === "points")
        await putSetting(db, {
          key: "points",
          value: mergePoints(
            Array.isArray(old?.value) ? (old.value as Point[]) : [],
            setting.value as Point[],
          ),
        });
      else if (!old) await putSetting(db, setting);
    }
  });
}
