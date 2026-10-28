import type { Review } from "./model";
// Preserve opaque event IDs. A branch's logical revision is its depth from the shared ancestor.
export function effectiveReviews(events: Review[]): Review[] {
  const byId = new Map(events.map((e) => [e.id, e]));
  const lineage = new Map<string, { root: string; depth: number }>();
  for (const start of byId.values()) {
    if (lineage.has(start.id)) continue;
    const path: Review[] = [];
    const seen = new Set<string>();
    let current: Review | undefined = start;
    let anchor = { root: start.pointId + ":new", depth: 0 };
    while (current) {
      const cached = lineage.get(current.id);
      if (cached) {
        anchor = cached;
        break;
      }
      if (seen.has(current.id))
        throw new Error("作答历史包含循环引用，不能导入。");
      seen.add(current.id);
      path.push(current);
      const parent = byId.get(current.base);
      if (parent && parent.pointId !== current.pointId)
        throw new Error("作答历史引用了其他知识点。");
      if (!parent) {
        anchor = { root: current.pointId + ":" + current.base, depth: 0 };
        break;
      }
      current = parent;
    }
    for (const item of path.reverse()) {
      anchor = { root: anchor.root, depth: anchor.depth + 1 };
      lineage.set(item.id, anchor);
    }
  }
  const groups = new Map<string, Review>();
  for (const e of byId.values()) {
    const l = lineage.get(e.id)!;
    const key = l.root + ":" + l.depth;
    const old = groups.get(key);
    if (
      !old ||
      e.rating < old.rating ||
      (e.rating === old.rating &&
        (e.at < old.at || (e.at === old.at && e.id < old.id)))
    )
      groups.set(key, e);
  }
  return [...groups.values()].sort(
    (a, b) =>
      lineage.get(a.id)!.depth - lineage.get(b.id)!.depth ||
      a.at.localeCompare(b.at) ||
      a.id.localeCompare(b.id),
  );
}
