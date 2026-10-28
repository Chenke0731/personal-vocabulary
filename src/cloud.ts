import { createClient } from "@supabase/supabase-js";
import { db, isReview } from "./store";
import { syncEvents, type RemoteEvents } from "./sync";
import type { Review } from "./model";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const cloud = url && key ? createClient(url, key) : null;
const remote: RemoteEvents = {
  async push(events, owner) {
    if (!cloud) throw new Error("尚未配置云服务。");
    for (let i = 0; i < events.length; i += 200) {
      const rows = events
        .slice(i, i + 200)
        .map(({ pending: _, owner: __, ...e }) => ({
          user_id: owner,
          id: e.id,
          payload: e,
        }));
      const { error } = await cloud
        .from("review_events")
        .upsert(rows, { onConflict: "user_id,id", ignoreDuplicates: true });
      if (error) throw new Error("上传失败，记录仍保存在本机。");
    }
  },
  async pull(owner) {
    if (!cloud) throw new Error("尚未配置云服务。");
    const result: Review[] = [];
    let cursor = 0;
    while (true) {
      const { data, error } = await cloud
        .from("review_events")
        .select("sequence,payload")
        .eq("user_id", owner)
        .gt("sequence", cursor)
        .order("sequence")
        .limit(500);
      if (error) throw new Error("读取云端失败，请稍后重试。");
      for (const row of data ?? []) {
        if (!isReview(row.payload))
          throw new Error("云端存在无效记录，已停止同步。");
        result.push(row.payload);
        cursor = row.sequence;
      }
      if (!data || data.length < 500) break;
    }
    return result;
  },
};
let running: Promise<number> | null = null;
export function synchronizeCloud(): Promise<number> {
  if (running) return running;
  running = performSync().finally(() => {
    running = null;
  });
  return running;
}
async function performSync() {
  if (!cloud) throw new Error("尚未配置云服务。");
  const {
    data: { user },
    error,
  } = await cloud.auth.getUser();
  if (error || !user) throw new Error("请先登录后再同步。");
  const binding = await db.settings.get("cloud-owner");
  if (binding && binding.value !== user.id)
    throw new Error("本机已关联其他账号，请登录原账号。");
  await db.transaction("rw", db.reviews, db.settings, async () => {
    await db.settings.put({ key: "cloud-owner", value: user.id });
    const unbound = await db.reviews.toArray();
    for (const e of unbound) {
      if (e.owner && e.owner !== user.id)
        throw new Error("本机记录关联的账号不同。");
      if (!e.owner) await db.reviews.update(e.id, { owner: user.id });
    }
  });
  const local = await db.reviews.toArray();
  const result = await syncEvents(local, user.id, remote);
  await db.transaction("rw", db.reviews, db.settings, async () => {
    for (const event of result.received) {
      const existing = await db.reviews.get(event.id);
      if (!existing) await db.reviews.add(event);
    }
    for (const id of result.acknowledged)
      await db.reviews.update(id, { pending: false, owner: user.id });
    await db.settings.put({ key: "cloud-owner", value: user.id });
  });
  return result.acknowledged.length;
}
