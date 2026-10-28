import type { Review } from "./model";
export function activeSeconds(from: number, to: number, visible: boolean) {
  const seconds = (to - from) / 1000;
  return visible && seconds >= 0 && seconds <= 120 ? seconds : 0;
}
export function reviewSeconds(events: Review[]) {
  const values = events
    .filter(
      (e) =>
        e.base !== "new" &&
        e.activeMs &&
        e.activeMs > 0 &&
        e.activeMs <= 120000,
    )
    .map((e) => e.activeMs! / 1000)
    .sort((a, b) => a - b);
  if (!values.length) return 20;
  const mid = Math.floor(values.length / 2);
  return Math.max(
    5,
    values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2,
  );
}
export interface DailyPlan {
  day: string;
  ids: string[];
}
export function newPointTarget(
  events: Review[],
  plans: DailyPlan[] = [],
  now = new Date().toISOString(),
) {
  const start = Date.parse(now) - 7 * 86400000;
  const today = new Date(Date.parse(now) + 8 * 3600000)
    .toISOString()
    .slice(0, 10);
  const firstDay = new Date(start + 8 * 3600000).toISOString().slice(0, 10);
  const recent = plans.filter(
    (p) => p.day >= firstDay && p.day < today && p.ids.length,
  );
  if (recent.length < 3) return 6;
  const requested = recent.reduce((n, p) => n + new Set(p.ids).size, 0);
  const finished = recent.reduce(
    (n, p) =>
      n +
      new Set(
        events
          .filter((e) => e.day === p.day && p.ids.includes(e.pointId))
          .map((e) => e.pointId),
      ).size,
    0,
  );
  if (finished / requested < 0.8) return 4;
  const ordered = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const last = new Map<string, number>();
  const delayed: Review[] = [];
  for (const e of ordered) {
    const t = Date.parse(e.at);
    if (
      last.has(e.pointId) &&
      t - last.get(e.pointId)! >= 86400000 &&
      t >= start
    )
      delayed.push(e);
    last.set(e.pointId, t);
  }
  if (
    finished / requested >= 0.9 &&
    delayed.length >= 20 &&
    delayed.filter((e) => e.rating >= 2).length / delayed.length >= 0.85
  )
    return 7;
  return 6;
}
