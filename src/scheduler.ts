import { createEmptyCard, fsrs, type Card, type Grade } from "ts-fsrs";
import type { Point, Review } from "./model";
import { reviewSeconds } from "./budget";
import { effectiveReviews } from "./reviewHistory";
export { effectiveReviews } from "./reviewHistory";
const algorithm = fsrs({ request_retention: 0.9, enable_fuzz: false });
export const algorithmVersion = "ts-fsrs@5.4.2/default-0.90/no-fuzz";
export function learningDay(at: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
}
export function deriveCard(events: Review[]): Card {
  const ordered = effectiveReviews(events);
  let card = createEmptyCard(ordered[0]?.at ?? "2000-01-01T00:00:00Z");
  for (const event of ordered) {
    const at = new Date(
      Math.max(new Date(event.at).getTime(), card.last_review?.getTime() ?? 0),
    );
    card = algorithm.next(card, at, event.rating as Grade).card;
  }
  return card;
}
export function makeQueue(
  points: Point[],
  reviews: Review[],
  now: string,
  budget: number,
  allocated: string[],
  target = 6,
): Point[] {
  const when = new Date(now);
  const known = new Set(reviews.map((e) => e.pointId));
  const due = points
    .filter((p) => known.has(p.id))
    .map((p) => ({
      p,
      card: deriveCard(reviews.filter((e) => e.pointId === p.id)),
    }))
    .filter((x) => x.card.due <= when)
    .sort((a, b) => a.card.due.getTime() - b.card.due.getTime())
    .map((x) => x.p);
  const capacity = Math.max(
    0,
    Math.floor((budget * 60 - due.length * reviewSeconds(reviews)) / 60),
  );
  const resume = points.filter(
    (p) => allocated.includes(p.id) && !known.has(p.id),
  );
  const limit = Math.max(
    0,
    Math.min(target - new Set(allocated).size, capacity - resume.length),
  );
  const fresh = points
    .filter((p) => p.reviewed && !known.has(p.id) && !allocated.includes(p.id))
    .sort(
      (a, b) =>
        Number(a.books.length === 1 && a.books[0] === "ielts") -
        Number(b.books.length === 1 && b.books[0] === "ielts"),
    )
    .slice(0, limit);
  return [
    ...due.slice(
      0,
      Math.max(1, Math.floor((budget * 60) / reviewSeconds(reviews))),
    ),
    ...resume.slice(0, capacity),
    ...fresh,
  ];
}
