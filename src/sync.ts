import type { Review } from "./model";
import { isReview } from "./store";
export interface RemoteEvents {
  push: (events: Review[], owner: string) => Promise<void>;
  pull: (owner: string) => Promise<Review[]>;
}
export async function syncEvents(
  local: Review[],
  owner: string,
  remote: RemoteEvents,
) {
  if (local.some((e) => e.owner && e.owner !== owner))
    throw new Error("本机记录属于另一个账号，请使用对应账号。");
  const pending = local.filter((e) => e.pending);
  await remote.push(pending, owner);
  const received = await remote.pull(owner);
  if (!received.every(isReview))
    throw new Error("云端数据格式不正确，本机记录未被覆盖。");
  return {
    acknowledged: pending.map((e) => e.id),
    received: [
      ...new Map(
        received.map((e) => [e.id, { ...e, pending: false, owner }]),
      ).values(),
    ],
  };
}
