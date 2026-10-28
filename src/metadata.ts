import { isPoint, type Point, type Setting } from "./model";
import type { VocabularyDB } from "./store";
export interface MetadataChange {
  id: string;
  kind: "point" | "favorite" | "budget" | "allocation";
  key: string;
  value: unknown;
  at: string;
  ordinal?: number;
  sequence?: number;
  pending?: boolean;
  owner?: string;
}
export interface RemoteMetadata {
  push: (changes: MetadataChange[], owner: string) => Promise<void>;
  pull: (owner: string) => Promise<MetadataChange[]>;
}
export function isMetadataChange(value: unknown): value is MetadataChange {
  if (!value || typeof value !== "object") return false;
  const c = value as MetadataChange;
  if (
    typeof c.id !== "string" ||
    !c.id ||
    typeof c.key !== "string" ||
    !c.key ||
    typeof c.at !== "string" ||
    !Number.isFinite(Date.parse(c.at))
  )
    return false;
  if (
    c.sequence !== undefined &&
    (!Number.isSafeInteger(c.sequence) || c.sequence < 1)
  )
    return false;
  if (
    c.ordinal !== undefined &&
    (!Number.isSafeInteger(c.ordinal) || c.ordinal < 1)
  )
    return false;
  if (c.owner !== undefined && typeof c.owner !== "string") return false;
  if (c.kind === "point") return isPoint(c.value) && c.value.id === c.key;
  if (c.kind === "favorite") return typeof c.value === "boolean";
  if (c.kind === "budget")
    return c.key === "budget" && (c.value === 15 || c.value === 30);
  if (c.kind === "allocation")
    return (
      /^allocated:\d{4}-\d{2}-\d{2}$/.test(c.key) &&
      Array.isArray(c.value) &&
      c.value.every((id) => typeof id === "string")
    );
  return false;
}
export async function putSetting(
  database: VocabularyDB,
  setting: Setting,
  baseline = false,
) {
  await database.transaction(
    "rw",
    database.settings,
    database.changes,
    async () => {
      const previous = (await database.settings.get(setting.key))?.value;
      const old = baseline ? undefined : previous;
      const edits: Pick<MetadataChange, "kind" | "key" | "value">[] = [];
      if (setting.key === "points") {
        if (!Array.isArray(setting.value) || !setting.value.every(isPoint))
          throw Error("词包格式无效。");
        const prior = new Map(
          (Array.isArray(old) ? (old as Point[]) : []).map((p) => [p.id, p]),
        );
        for (const p of setting.value) {
          const before = prior.get(p.id);
          if (
            before &&
            (before.word !== p.word || before.ability !== p.ability)
          )
            throw Error("知识点ID冲突。");
          if (JSON.stringify(before) !== JSON.stringify(p))
            edits.push({ kind: "point", key: p.id, value: p });
        }
      } else if (setting.key === "favorites") {
        if (
          !Array.isArray(setting.value) ||
          !setting.value.every((id) => typeof id === "string")
        )
          throw Error("收藏格式无效。");
        const before = new Set(Array.isArray(old) ? (old as string[]) : []),
          after = new Set(setting.value as string[]);
        for (const id of new Set([...before, ...after]))
          if (before.has(id) !== after.has(id))
            edits.push({ kind: "favorite", key: id, value: after.has(id) });
      } else if (setting.key === "budget") {
        if (setting.value !== 15 && setting.value !== 30)
          throw Error("学习预算无效。");
        if (old !== setting.value)
          edits.push({ kind: "budget", key: "budget", value: setting.value });
      } else if (setting.key.startsWith("allocated:")) {
        const edit = {
          kind: "allocation" as const,
          key: setting.key,
          value: setting.value,
        };
        if (
          !isMetadataChange({
            ...edit,
            id: "validate",
            at: new Date().toISOString(),
          })
        )
          throw Error("每日分配格式无效。");
        if (JSON.stringify(old) !== JSON.stringify(setting.value))
          edits.push(edit);
      }
      let ordinal =
        (await database.changes.orderBy("ordinal").last())?.ordinal ?? 0;
      const owner = (await database.settings.get("cloud-owner"))?.value as
        string | undefined;
      for (const edit of edits)
        await database.changes.add({
          ...edit,
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          ordinal: ++ordinal,
          pending: true,
          owner,
        });
      await database.settings.put(setting);
    },
  );
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
function identity(c: MetadataChange) {
  return JSON.stringify(canonical([c.id, c.kind, c.key, c.value, c.at]));
}
export async function exchangeMetadata(
  database: VocabularyDB,
  owner: string,
  remote: RemoteMetadata,
) {
  const binding = await database.settings.get("cloud-owner");
  if (binding && binding.value !== owner) throw Error("本机已关联其他账号。");
  const pending = (await database.changes.toArray())
    .filter((c) => c.pending)
    .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
  if (pending.some((c) => c.owner && c.owner !== owner))
    throw Error("待同步内容属于其他账号。");
  await remote.push(pending, owner);
  const received = await remote.pull(owner);
  if (
    !received.every(
      (c) =>
        isMetadataChange(c) &&
        c.sequence !== undefined &&
        (!c.owner || c.owner === owner),
    )
  )
    throw Error("云端词包或设置数据无效。");
  const remoteIds = new Set(received.map((c) => c.id));
  if (pending.some((c) => !remoteIds.has(c.id)))
    throw Error("云端尚未确认全部内容，本机仍保留待同步记录。");
  await database.transaction(
    "rw",
    database.changes,
    database.settings,
    async () => {
      const live = await database.changes.toArray();
      const history = new Map(live.map((c) => [c.id, c]));
      let ordinal = live.reduce((n, c) => Math.max(n, c.ordinal ?? 0), 0);
      for (const c of received) {
        const old = history.get(c.id);
        if (old && identity(old) !== identity(c))
          throw Error("不可变的同步记录发生冲突。");
        history.set(c.id, {
          ...c,
          ordinal: old?.ordinal ?? ++ordinal,
          pending: false,
          owner,
        });
      }
      const all = [...history.values()];
      const ordered = [
        ...all
          .filter((c) => !c.pending)
          .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
        ...all
          .filter((c) => c.pending)
          .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0)),
      ];
      const currentPoints = (await database.settings.get("points"))?.value;
      const points = new Map(
        (Array.isArray(currentPoints) ? (currentPoints as Point[]) : []).map(
          (p) => [p.id, p],
        ),
      );
      const favorites = new Set<string>();
      const allocations = new Map<string, Set<string>>();
      let budget: 15 | 30 | undefined;
      for (const c of ordered) {
        if (c.kind === "point") {
          const p = c.value as Point;
          const old = points.get(c.key);
          if (old && (old.word !== p.word || old.ability !== p.ability))
            throw Error("云端知识点ID与本机内容冲突。");
          points.set(c.key, p);
        }
        if (c.kind === "favorite") {
          if (c.value) favorites.add(c.key);
          else favorites.delete(c.key);
        }
        if (c.kind === "budget") budget = c.value as 15 | 30;
        if (c.kind === "allocation") {
          const ids = allocations.get(c.key) ?? new Set<string>();
          for (const id of c.value as string[]) ids.add(id);
          allocations.set(c.key, ids);
        }
      }
      await database.changes.bulkPut(all);
      if (ordered.some((c) => c.kind === "point"))
        await database.settings.put({
          key: "points",
          value: [...points.values()].sort((a, b) => a.id.localeCompare(b.id)),
        });
      if (ordered.some((c) => c.kind === "favorite"))
        await database.settings.put({
          key: "favorites",
          value: [...favorites].sort(),
        });
      if (budget !== undefined)
        await database.settings.put({ key: "budget", value: budget });
      for (const [key, ids] of allocations)
        await database.settings.put({ key, value: [...ids].sort() });
      await database.settings.put({ key: "cloud-owner", value: owner });
    },
  );
  return pending.length;
}

export async function seedMetadata(database: VocabularyDB) {
  await database.transaction(
    "rw",
    database.settings,
    database.changes,
    async () => {
      if (await database.settings.get("metadata-seeded")) return;
      const settings = await database.settings.toArray();
      for (const setting of settings)
        if (
          ["points", "favorites", "budget"].includes(setting.key) ||
          setting.key.startsWith("allocated:")
        )
          await putSetting(database, setting, true);
      await database.settings.put({ key: "metadata-seeded", value: true });
    },
  );
}
export async function restoreMetadataOutbox(
  database: VocabularyDB,
  changes: MetadataChange[],
) {
  let ordinal =
    (await database.changes.orderBy("ordinal").last())?.ordinal ?? 0;
  const owner = (await database.settings.get("cloud-owner"))?.value as
    string | undefined;
  for (const change of [...changes].sort(
    (a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0),
  )) {
    const old = await database.changes.get(change.id);
    if (old) {
      if (identity(old) !== identity(change))
        throw Error("备份中的变更ID与本机内容冲突。");
      continue;
    }
    await database.changes.add({
      ...change,
      ordinal: ++ordinal,
      sequence: undefined,
      pending: true,
      owner,
    });
  }
}
